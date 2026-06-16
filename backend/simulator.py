"""
simulator.py — Race Simulation Engine

Pre-computes lap-by-lap race state from an already-loaded FastF1 session.
Runs a background thread to advance laps at configurable speed.

Design principles:
- ALL race data pre-computed at session load time (zero latency during playback)
- Background thread simply increments current_lap with a configurable sleep
- Thread-safe: all state mutations happen under SIM_LOCK
- No FastF1 calls during playback — reads only from SIM_LAP_DATA
- Graceful degradation: non-race sessions still get lap time simulation

Resource budget:
- Monaco 2023 Race: ~20 drivers × 78 laps = ~1560 entries ≈ 400KB RAM
- 0 new network calls during simulation
- Thread is daemon — exits automatically when FastAPI process ends
"""

import threading
import time
import gc
import math
import pandas as pd
import numpy as np
from fastapi import APIRouter, HTTPException
from typing import Optional
import session as sess


# ── Team colour palette (copied here to avoid circular import) ────────────────
# circuits.py owns this too — keep in sync manually if team names change.
TEAM_COLORS = {
    "Red Bull Racing":        "#3671C6",
    "Ferrari":                "#E8002D",
    "Mercedes":               "#27F4D2",
    "McLaren":                "#FF8000",
    "Aston Martin":           "#229971",
    "Alpine":                 "#FF87BC",
    "Williams":               "#64C4FF",
    "AlphaTauri":             "#6692FF",
    "Alfa Romeo":             "#C92D4B",
    "Haas F1 Team":           "#B6BABD",
    "RB":                     "#6692FF",
    "Kick Sauber":            "#52E252",
    "Visa Cash App RB":       "#6692FF",
    "Sauber":                 "#52E252",
}
DEFAULT_COLOR = "#888899"

# ── Global Simulation State ───────────────────────────────────────────────────
SIM_LAP_DATA    = {}       # {lap_num: [driver_entry, ...]} — pre-computed
SIM_STATUS      = "idle"   # idle | playing | paused | finished
SIM_CURRENT_LAP = 0
SIM_TOTAL_LAPS  = 0
SIM_SPEED       = 1.0      # 0.5, 1.0, 2.0, 4.0
SIM_SESSION_LABEL = ""     # e.g. "Monaco 2023 — Race"

SIM_LOCK     = threading.Lock()
_stop_event  = threading.Event()
_pause_event = threading.Event()
_pause_event.set()          # not paused initially (set = can continue)
_sim_thread: Optional[threading.Thread] = None

# How many real seconds between each simulated lap advance at 1× speed.
# At 1× → 2s/lap. Full race (78 laps) takes 2.6 minutes.
# At 4× → 0.5s/lap. Full race takes ~39 seconds.
BASE_LAP_DELAY = 2.0

# ── Arc-length cache (FIX 2) ────────────────────────────────────────────────
# Precomputed once per session from POLE_TELEMETRY_TRACK.
# Cleared by clear_sim_state() when a new session loads.
_ARC_CACHE: dict = {}   # keys: 'cum_dist', 'total_len'


# ── State management ──────────────────────────────────────────────────────────

def clear_sim_state():
    """Wipes all simulation data and stops any running thread. Called from
    session.clear_session_cache() before loading a new session."""
    global SIM_STATUS, SIM_CURRENT_LAP, SIM_TOTAL_LAPS, SIM_SPEED, SIM_SESSION_LABEL
    _stop_event.set()
    _pause_event.set()   # unblock thread so it sees the stop event
    if _sim_thread and _sim_thread.is_alive():
        _sim_thread.join(timeout=1.0)
    SIM_LAP_DATA.clear()
    _ARC_CACHE.clear()   # FIX 2: invalidate arc-length cache for new session
    SIM_STATUS       = "idle"
    SIM_CURRENT_LAP  = 0
    SIM_TOTAL_LAPS   = 0
    SIM_SPEED        = 1.0
    SIM_SESSION_LABEL = ""
    gc.collect()
    print("[Simulator] Sim state cleared")


# ── Helper ────────────────────────────────────────────────────────────────────

def _td_to_sec(val) -> Optional[float]:
    """Converts a pandas Timedelta to float seconds. Returns None for NaT."""
    if val is None:
        return None
    try:
        if pd.isna(val):
            return None
    except (TypeError, ValueError):
        pass
    if hasattr(val, 'total_seconds'):
        s = val.total_seconds()
        return round(s, 3) if s > 0 else None
    return None


# ── Pre-computation (called from session.compile_session_data) ────────────────

def precompute_race_data(session):
    """
    Extracts per-lap race state for ALL drivers.
    Called ONCE after session.load() completes.
    Stores results in SIM_LAP_DATA: {lap_num: [sorted driver entries]}.

    Gap computation uses session.laps['Time'] — the elapsed race timestamp at
    lap completion — which gives REAL on-track gaps for race sessions.
    """
    global SIM_TOTAL_LAPS, SIM_SESSION_LABEL

    laps    = session.laps
    results = session.results

    if laps.empty:
        print("[Simulator] No lap data - race simulation unavailable")
        return

    t_start = time.time()

    # ── Build driver metadata lookup ──────────────────────────────────────────
    team_lookup   = {}
    carnum_lookup = {}
    for _, row in results.iterrows():
        code = str(row['Abbreviation']).strip()
        team_lookup[code]   = str(row['TeamName'])
        carnum_lookup[code] = int(row['DriverNumber'])

    max_lap = int(laps['LapNumber'].max())
    SIM_TOTAL_LAPS = max_lap

    # Detect if this is a Race/Sprint (enables real gap computation from Time col)
    session_name = str(getattr(session, 'name', '')).lower()
    is_race_type = any(k in session_name for k in ('race', 'sprint'))

    print(f"[Simulator] Pre-computing {max_lap} laps (session type: race={is_race_type})...")

    for lap_num in range(1, max_lap + 1):
        lap_slice = laps[laps['LapNumber'] == lap_num].copy()
        if lap_slice.empty:
            continue

        entries = []

        for _, lap_row in lap_slice.iterrows():
            drv = str(lap_row.get('Driver', '')).strip()
            if not drv:
                continue

            team  = team_lookup.get(drv, '')
            color = TEAM_COLORS.get(team, DEFAULT_COLOR)

            # ── Times ──────────────────────────────────────────────────────
            lap_time  = _td_to_sec(lap_row.get('LapTime'))
            sector1   = _td_to_sec(lap_row.get('Sector1Time'))
            sector2   = _td_to_sec(lap_row.get('Sector2Time'))
            sector3   = _td_to_sec(lap_row.get('Sector3Time'))
            # Cumulative elapsed race time at lap completion (real race clock)
            race_time = _td_to_sec(lap_row.get('Time'))

            # ── Pit stop detection ──────────────────────────────────────────
            pit_in  = lap_row.get('PitInTime')
            pit_out = lap_row.get('PitOutTime')
            has_pit_in  = bool(pd.notna(pit_in)  and pit_in  is not None)
            has_pit_out = bool(pd.notna(pit_out) and pit_out is not None)
            pit_stop    = has_pit_in or has_pit_out

            # ── Tyre ────────────────────────────────────────────────────────
            compound = str(lap_row.get('Compound', 'UNKNOWN')).strip()
            if compound.lower() in ('nan', 'none', ''):
                compound = 'UNKNOWN'
            tyre_age = int(lap_row.get('TyreLife', 1)) \
                if pd.notna(lap_row.get('TyreLife')) else 1

            # ── Grid position ───────────────────────────────────────────────
            pos_val  = lap_row.get('Position')
            position = int(pos_val) if pd.notna(pos_val) else 99

            entries.append({
                'driver':    drv,
                'carNumber': carnum_lookup.get(drv, 0),
                'team':      team,
                'teamColor': color,
                'position':  position,
                'lapTime':   lap_time,
                'sector1':   sector1,
                'sector2':   sector2,
                'sector3':   sector3,
                'raceTime':  race_time,
                'compound':  compound,
                'tyreAge':   tyre_age,
                'pitStop':   pit_stop,
                'pitIn':     has_pit_in,
                'pitOut':    has_pit_out,
                'gap':       None,
                'interval':  None,
            })

        if not entries:
            continue

        # ── Compute real race gaps from elapsed cumulative time ───────────
        if is_race_type:
            valid   = [e for e in entries if e['raceTime'] is not None]
            invalid = [e for e in entries if e['raceTime'] is None]
            valid.sort(key=lambda e: e['raceTime'])

            if valid:
                leader_time = valid[0]['raceTime']
                valid[0]['gap']      = 0.0          # FIX 1: float, not string
                valid[0]['gapLabel'] = 'LEADER'     # FIX 1: UI display label
                valid[0]['interval'] = 0.0
                valid[0]['position'] = 1

                prev_time = leader_time
                for rank, entry in enumerate(valid[1:], 2):
                    gap_s      = round(entry['raceTime'] - leader_time, 3)
                    interval_s = round(entry['raceTime'] - prev_time, 3)
                    entry['gap']      = gap_s        # FIX 1: raw float
                    entry['gapLabel'] = f'+{gap_s}s' # FIX 1: formatted string for UI
                    entry['interval'] = interval_s
                    entry['position'] = rank
                    prev_time = entry['raceTime']

            SIM_LAP_DATA[lap_num] = valid + invalid
        else:
            # Non-race: sort by lap time (fastest = P1 on that lap)
            valid   = [e for e in entries if e['lapTime'] is not None]
            invalid = [e for e in entries if e['lapTime'] is None]
            valid.sort(key=lambda e: e['lapTime'])

            if valid:
                best_time = valid[0]['lapTime']
                valid[0]['gap']      = 0.0           # FIX 1: float
                valid[0]['gapLabel'] = 'FASTEST'     # FIX 1: UI label
                valid[0]['interval'] = 0.0
                valid[0]['position'] = 1
                for rank, entry in enumerate(valid[1:], 2):
                    delta = round(entry['lapTime'] - best_time, 3)
                    entry['gap']      = delta        # FIX 1: raw float
                    entry['gapLabel'] = f'+{delta}s' # FIX 1: formatted string for UI
                    entry['interval'] = delta
                    entry['position'] = rank

            SIM_LAP_DATA[lap_num] = valid + invalid

    elapsed_ms = int((time.time() - t_start) * 1000)
    print(f"[Simulator] Simulation pre-computed: {len(SIM_LAP_DATA)} laps in {elapsed_ms}ms")


# ── Background simulation thread ──────────────────────────────────────────────

def _sim_loop():
    global SIM_STATUS, SIM_CURRENT_LAP

    while not _stop_event.is_set():
        # ── Block here when paused ──────────────────────────────────────────
        _pause_event.wait()

        if _stop_event.is_set():
            break

        # ── Check for race end and load current lap under lock ──────────────
        with SIM_LOCK:
            if SIM_CURRENT_LAP > SIM_TOTAL_LAPS or SIM_CURRENT_LAP < 0:
                SIM_STATUS = "finished"
                break
            
            # If we are starting from idle (lap 0), default to lap 1
            if SIM_CURRENT_LAP == 0 and SIM_TOTAL_LAPS > 0:
                SIM_CURRENT_LAP = 1
                
            current_lap = SIM_CURRENT_LAP
            speed = SIM_SPEED

        # ── Sleep for current lap duration ──────────────────────────────────
        delay = BASE_LAP_DELAY / speed
        deadline = time.time() + delay
        seek_detected = False

        while time.time() < deadline:
            if _stop_event.is_set():
                return

            with SIM_LOCK:
                # Detect mid-lap seek triggers
                if SIM_CURRENT_LAP != current_lap:
                    seek_detected = True
                    break
                # Detect mid-lap speed changes and adjust deadline dynamically
                if SIM_SPEED != speed:
                    elapsed = time.time() - (deadline - delay)
                    fraction_remaining = max(0.0, 1.0 - (elapsed / delay))
                    speed = SIM_SPEED
                    delay = BASE_LAP_DELAY / speed
                    deadline = time.time() + (delay * fraction_remaining)

            if not _pause_event.is_set():
                # Entered pause mid-lap — freeze and wait
                _pause_event.wait()
                # When resumed, reset deadline
                with SIM_LOCK:
                    speed = SIM_SPEED
                    delay = BASE_LAP_DELAY / speed
                deadline = time.time() + delay

            time.sleep(0.05)  # 50ms tick — responsive to pause/stop/seek

        if seek_detected:
            # Re-evaluate loop with the new seeked lap immediately
            continue

        # ── Advance lap at the end of the sleep cycle ───────────────────────
        with SIM_LOCK:
            if SIM_CURRENT_LAP >= SIM_TOTAL_LAPS:
                SIM_STATUS = "finished"
                break
            else:
                SIM_CURRENT_LAP += 1

    with SIM_LOCK:
        if SIM_STATUS not in ("paused", "finished"):
            SIM_STATUS = "idle"


# ── FastAPI router ────────────────────────────────────────────────────────────

sim_router = APIRouter()


@sim_router.get("/api/sim/state")
def get_sim_state():
    """Lightweight state snapshot — poll every 1000ms from the frontend."""
    with SIM_LOCK:
        lap      = SIM_CURRENT_LAP
        total    = SIM_TOTAL_LAPS
        status   = SIM_STATUS
        speed    = SIM_SPEED
        progress = round(lap / total * 100, 1) if total > 0 else 0.0

    lap_state = SIM_LAP_DATA.get(lap if lap > 0 else 1, [])

    return {
        "status":       status,
        "currentLap":   lap,
        "totalLaps":    total,
        "speed":        speed,
        "progress":     progress,
        "ready":        len(SIM_LAP_DATA) > 0,
        "lapState":     lap_state,
        "sessionLabel": SIM_SESSION_LABEL,
        "positions":    _compute_track_positions(lap_state),
    }


def _compute_track_positions(lap_state: list) -> dict:
    """
    Distributes drivers around the circuit outline based on their on-track gap
    to the leader.  Returns {driver_code: {x, y, teamColor}} using the same
    normalised [0, 1] coordinate space as /api/circuit/geometry.

    Strategy:
      - The leader is placed at t=0 on the circuit outline.
      - Each other driver is offset backwards (lower t) proportional to their
        gap in seconds, assuming an average lap time of ~90s.
      - Positions wrap around [0, 1] so backmarkers appear behind the leader.
    """
    track = sess.POLE_TELEMETRY_TRACK
    bounds = sess.CIRCUIT_BOUNDS

    # Nothing to show if geometry hasn't loaded or no drivers
    if not track or not bounds or not lap_state:
        return {}

    span_x = bounds['width']
    span_y = bounds['height']
    min_x  = bounds['minX']
    min_y  = bounds['minY']
    n      = len(track)

    # FIX 2: Read arc-length table from cache; compute and store if not yet built.
    if not _ARC_CACHE:
        cd = [0.0]
        for i in range(1, n):
            dx = track[i]['x'] - track[i - 1]['x']
            dy = track[i]['y'] - track[i - 1]['y']
            cd.append(cd[-1] + math.hypot(dx, dy))
        _ARC_CACHE['cum_dist']  = cd
        _ARC_CACHE['total_len'] = cd[-1] if cd[-1] > 0 else 1.0

    cum_dist  = _ARC_CACHE['cum_dist']
    total_len = _ARC_CACHE['total_len']

    def point_at_t(t: float):
        """Return normalised (x, y) for a fractional distance t in [0, 1] along the track."""
        t = t % 1.0
        target = t * total_len
        # Binary search for the segment
        lo, hi = 0, n - 1
        while lo < hi - 1:
            mid = (lo + hi) // 2
            if cum_dist[mid] <= target:
                lo = mid
            else:
                hi = mid
        seg_len = cum_dist[hi] - cum_dist[lo]
        frac = (target - cum_dist[lo]) / seg_len if seg_len > 0 else 0.0
        raw_x = track[lo]['x'] + frac * (track[hi]['x'] - track[lo]['x'])
        raw_y = track[lo]['y'] + frac * (track[hi]['y'] - track[lo]['y'])
        nx = round((raw_x - min_x) / span_x, 5) if span_x else 0.5
        ny = round((raw_y - min_y) / span_y, 5) if span_y else 0.5
        return nx, ny

    # FIX 3: Compute avg_lap_time from median of all valid lapTimes across
    # all entries — guards against leader pitting and having None lapTime.
    sorted_state = sorted(lap_state, key=lambda e: e.get('position', 99))
    valid_times = [e['lapTime'] for e in sorted_state if e.get('lapTime') is not None]
    if valid_times:
        valid_times.sort()
        mid = len(valid_times) // 2
        median_val = (
            valid_times[mid]
            if len(valid_times) % 2 == 1
            else (valid_times[mid - 1] + valid_times[mid]) / 2.0
        )
        avg_lap_time = max(60.0, median_val)
    else:
        avg_lap_time = 90.0

    positions = {}
    for entry in sorted_state:
        driver = entry.get('driver', '')
        if not driver:
            continue

        # FIX 4: gap is now stored as a plain float (0.0 for leader)
        gap_s = float(entry.get('gap') or 0.0)
        if gap_s < 0:   # FIX 3: clamp negative gaps (data artefact)
            gap_s = 0.0

        # Convert gap → fraction of lap behind the leader
        t_offset = (gap_s / avg_lap_time) % 1.0
        t = (1.0 - t_offset) % 1.0   # leader at t=1.0≡0.0; others behind

        nx, ny = point_at_t(t)
        positions[driver] = {
            'x':         nx,
            'y':         ny,
            'teamColor': entry.get('teamColor', DEFAULT_COLOR),
            'position':  entry.get('position', 99),
            'compound':  entry.get('compound', 'UNKNOWN'),
        }

    return positions


@sim_router.get("/api/sim/lap/{lap_num}")
def get_specific_lap(lap_num: int):
    """Returns pre-computed state for any specific lap number."""
    if lap_num not in SIM_LAP_DATA:
        raise HTTPException(
            status_code=404,
            detail=f"Lap {lap_num} not in range 1–{SIM_TOTAL_LAPS}"
        )
    return {"lap": lap_num, "drivers": SIM_LAP_DATA[lap_num]}


@sim_router.get("/api/sim/history")
def get_full_history():
    """Full race history — all pre-computed lap states. Use sparingly."""
    return {"totalLaps": SIM_TOTAL_LAPS, "laps": SIM_LAP_DATA}


@sim_router.get("/api/sim/control")
def sim_control(
    action: str,
    speed:  Optional[float] = None,
    lap:    Optional[int]   = None,
):
    """
    Unified simulation control endpoint.
    action = play | pause | resume | reset | seek | setspeed
    ?speed=N   (0.5–8.0, used by play and setspeed)
    ?lap=N     (used by seek)
    """
    global SIM_STATUS, SIM_CURRENT_LAP, SIM_SPEED, _sim_thread

    if not SIM_LAP_DATA:
        raise HTTPException(
            status_code=409,
            detail="No session loaded — load a race session to use simulation"
        )

    action = action.lower().strip()

    # ── PLAY / RESUME ─────────────────────────────────────────────────────────
    if action in ("play", "resume"):
        with SIM_LOCK:
            if speed is not None:
                SIM_SPEED = max(0.5, min(8.0, float(speed)))
            # If we finished, restart from lap 0
            if SIM_STATUS == "finished":
                SIM_CURRENT_LAP = 0
            SIM_STATUS = "playing"

        _stop_event.clear()
        _pause_event.set()   # unblock / resume

        # Launch thread if not alive
        if _sim_thread is None or not _sim_thread.is_alive():
            _sim_thread = threading.Thread(target=_sim_loop, daemon=True)
            _sim_thread.start()

        with SIM_LOCK:
            return {"status": SIM_STATUS, "speed": SIM_SPEED, "currentLap": SIM_CURRENT_LAP}

    # ── PAUSE ─────────────────────────────────────────────────────────────────
    elif action == "pause":
        _pause_event.clear()    # block the thread
        with SIM_LOCK:
            SIM_STATUS = "paused"
            return {"status": "paused", "currentLap": SIM_CURRENT_LAP}

    # ── RESET ─────────────────────────────────────────────────────────────────
    elif action == "reset":
        _stop_event.set()
        _pause_event.set()       # unblock thread so it can exit
        if _sim_thread and _sim_thread.is_alive():
            _sim_thread.join(timeout=1.5)
        with SIM_LOCK:
            SIM_CURRENT_LAP = 0
            SIM_STATUS      = "idle"
        return {"status": "idle", "currentLap": 0}

    # ── SEEK ──────────────────────────────────────────────────────────────────
    elif action == "seek":
        if lap is None:
            raise HTTPException(status_code=422, detail="seek requires ?lap=N")
        clamped = max(1, min(SIM_TOTAL_LAPS, int(lap)))
        with SIM_LOCK:
            SIM_CURRENT_LAP = clamped
        return {"status": SIM_STATUS, "currentLap": clamped}

    # ── SETSPEED ──────────────────────────────────────────────────────────────
    elif action == "setspeed":
        if speed is None:
            raise HTTPException(status_code=422, detail="setspeed requires ?speed=N")
        with SIM_LOCK:
            SIM_SPEED = max(0.5, min(8.0, float(speed)))
        return {"status": SIM_STATUS, "speed": SIM_SPEED}

    else:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown action '{action}'. Valid: play, pause, resume, reset, seek, setspeed"
        )
