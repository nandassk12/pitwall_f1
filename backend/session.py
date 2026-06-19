"""
session.py — Dynamic F1 Session Loader
Handles session discovery, calendar fetching, and dynamic
FastF1 session loading with full cache recomputation.

Resource Management Rules:
- Only ONE session loaded in memory at a time
- Previous session cleared before loading new one
- FastF1 disk cache always enabled (never re-download)
- Telemetry loaded lazily — only when explicitly requested
- Weather + laps always loaded (lightweight)
- Max 8 drivers cached (top finishers only, not all 20)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import fastf1
import numpy as np
import pandas as pd
import gc
import os
import psutil
from threading import Lock
import simulator
import openf1


# ── Global Framework Storage Matrices ────────────────────────────────────────
SESSION_OBJECT = None
POLE_TELEMETRY_TRACK = []
DRIVERS_ENGINEERING_CACHE = {}
LIVE_STANDINGS_TOWER = []
METEO_TRACK_DATA = {}
CIRCUIT_BOUNDS = {}              # {minX, maxX, minY, maxY, width, height} — computed per session
CIRCUIT_CORNER_COUNT = 0    # number of detected corners — set by compile_session_data
TEAM_COLOR_MAP: dict = {}   # {team_name: hex_color} — populated at session load

# ── OpenF1 integration (2023+ sessions only) ──────────────────────────────────
OPENF1_SESSION_KEY = None        # Integer session_key resolved from OpenF1 /sessions
RACE_CONTROL_MESSAGES = []       # Pre-fetched list from OpenF1 /race_control

SECTOR_BESTS_CACHE = {}          # {s1: float, s2: float, s3: float} - global precomputed sector bests

# ── Resource Management ───────────────────────────────────────────────────────
SESSION_LOAD_LOCK = Lock()
SESSION_LOADING = False          # public loading-state flag for /api/status
CALENDAR_CACHE = {}              # year (int) → list[race dicts] — safe to keep all years
MEMORY_WARN_MB = 1500
CURRENT_SESSION_LABEL = None     # e.g. "Monaco 2023 — Race"
CURRENT_SESSION_YEAR = None
CURRENT_SESSION_ROUND = None
CURRENT_SESSION_CIRCUIT = None
CURRENT_SESSION_TYPE = None


# Map long FastF1 session names → short UI codes
SESSION_LONG_TO_SHORT = {
    "Practice 1":        "FP1",
    "Practice 2":        "FP2",
    "Practice 3":        "FP3",
    "Qualifying":        "Q",
    "Race":              "R",
    "Sprint":            "Sprint",
    "Sprint Qualifying": "SQ",
    "Sprint Shootout":   "SQ",
}

SESSION_TYPE_LABELS = {
    "R":      "Race",
    "Q":      "Qualifying",
    "FP1":    "Practice 1",
    "FP2":    "Practice 2",
    "FP3":    "Practice 3",
    "Sprint": "Sprint",
    "SQ":     "Sprint Qualifying",
}


# ── Memory helpers ────────────────────────────────────────────────────────────

def check_memory() -> float:
    process = psutil.Process(os.getpid())
    mem_mb = process.memory_info().rss / 1024 / 1024
    if mem_mb > MEMORY_WARN_MB:
        print(f"[Memory] High memory usage: {mem_mb:.1f} MB - triggering GC")
        gc.collect()
    return mem_mb


def clear_session_cache():
    """Safely wipes all in-memory session caches and triggers GC."""
    global SESSION_OBJECT, CURRENT_SESSION_LABEL, CURRENT_SESSION_YEAR, CURRENT_SESSION_ROUND
    global CURRENT_SESSION_CIRCUIT, CURRENT_SESSION_TYPE
    global OPENF1_SESSION_KEY
    SESSION_OBJECT = None
    CURRENT_SESSION_LABEL = None
    CURRENT_SESSION_YEAR = None
    CURRENT_SESSION_ROUND = None
    CURRENT_SESSION_CIRCUIT = None
    CURRENT_SESSION_TYPE = None
    OPENF1_SESSION_KEY = None
    DRIVERS_ENGINEERING_CACHE.clear()
    POLE_TELEMETRY_TRACK.clear()
    LIVE_STANDINGS_TOWER.clear()
    METEO_TRACK_DATA.clear()
    CIRCUIT_BOUNDS.clear()
    global CIRCUIT_CORNER_COUNT
    CIRCUIT_CORNER_COUNT = 0
    RACE_CONTROL_MESSAGES.clear()
    SECTOR_BESTS_CACHE.clear()
    TEAM_COLOR_MAP.clear()
    openf1.clear_openf1_cache()
    simulator.clear_sim_state()
    gc.collect()
    print("[Cache] Session cache cleared")


# ── Core cache compilation (extracted from old main.py startup) ───────────────

def compile_session_data(session):
    """
    Recomputes all in-memory engineering caches from a loaded FastF1 session.
    Called both by the POST /api/sessions/load endpoint and (optionally) on startup.
    """
    global SESSION_OBJECT, CURRENT_SESSION_LABEL
    SESSION_OBJECT = session

    # Extract official team colors from FastF1 session results
    TEAM_COLOR_MAP.clear()
    try:
        for _, row in session.results.iterrows():
            team = str(row.get('TeamName', ''))
            color = str(row.get('TeamColor', ''))
            if team and color and color.lower() != 'nan':
                # FastF1 returns hex without '#'
                TEAM_COLOR_MAP[team] = f'#{color}' if not color.startswith('#') else color
        print(f"[Colors] Team colors loaded: {TEAM_COLOR_MAP}")
    except Exception as e:
        print(f"[Colors] Team color extraction failed: {e}")

    # 1. PARSE CRITICAL WEATHER INFORMATION
    try:
        weather_df = session.weather_data
        if not weather_df.empty:
            latest_weather = weather_df.iloc[-1]
            METEO_TRACK_DATA.update({
                "airTemp":        float(latest_weather['AirTemp']),
                "trackTemp":      float(latest_weather['TrackTemp']),
                "humidity":       float(latest_weather['Humidity']),
                "rainfall":       bool(latest_weather['Rainfall']),
                "rainRiskPercent": 90 if latest_weather['Humidity'] > 78 and not latest_weather['Rainfall'] else 15,
            })
    except Exception as we:
        print(f"[Weather] Weather stream parsing skipped: {we}")
        METEO_TRACK_DATA.update({
            "airTemp": 24.5, "trackTemp": 36.2,
            "humidity": 62.0, "rainfall": False, "rainRiskPercent": 10,
        })

    # 2. GENERATE POLE-LAP RACING-LINE & BRAKING-POINT MATRIX
    pole_tel = None
    try:
        pole_lap = session.laps.pick_fastest()
        pole_tel = pole_lap.get_telemetry().interpolate().reset_index(drop=True)
        for _, row in pole_tel.iterrows():
            POLE_TELEMETRY_TRACK.append({
                "x":                 float(row['X']),
                "y":                 float(row['Y']),
                "speed":             int(row['Speed']),
                "isIdealBrakingZone": bool(row['Brake'] and row['Speed'] > 110),
            })
    except Exception as pe:
        print(f"[Telemetry] Pole telemetry skipped: {pe}")

    # Compute session-aware coordinate bounds for dynamic circuit normalisation
    if POLE_TELEMETRY_TRACK:
        xs = [p['x'] for p in POLE_TELEMETRY_TRACK]
        ys = [p['y'] for p in POLE_TELEMETRY_TRACK]
        CIRCUIT_BOUNDS.update({
            'minX': min(xs), 'maxX': max(xs),
            'minY': min(ys), 'maxY': max(ys),
            'width':  max(xs) - min(xs),
            'height': max(ys) - min(ys),
        })
        print(f"[Circuit] Circuit bounds: X[{min(xs):.0f} to {max(xs):.0f}]  Y[{min(ys):.0f} to {max(ys):.0f}]")
        # Auto-detect corner count for this circuit
        global CIRCUIT_CORNER_COUNT
        try:
            from circuits import _detect_corner_count
            CIRCUIT_CORNER_COUNT = _detect_corner_count()
            print(f"[Circuit] Auto-detected {CIRCUIT_CORNER_COUNT} corners")
        except Exception as cc_ex:
            CIRCUIT_CORNER_COUNT = 20   # safe fallback
            print(f"[Circuit] Corner count detection failed, using default 20: {cc_ex}")

    # 3. COMPUTE VEHICLE DYNAMICS & AERODYNAMICS FOR ALL DRIVERS
    # Fetch cumulative standings to map season points
    season_points_map = {}
    global CURRENT_SESSION_YEAR, CURRENT_SESSION_ROUND
    year = CURRENT_SESSION_YEAR
    round_num = CURRENT_SESSION_ROUND
    if year and round_num:
        try:
            import requests
            wdc_url = f"https://api.jolpi.ca/ergast/f1/{year}/{round_num}/driverStandings.json"
            wdc_res = requests.get(wdc_url, timeout=5)
            if wdc_res.status_code == 200:
                wdc_data = wdc_res.json()
                lists = wdc_data.get('MRData', {}).get('StandingsTable', {}).get('StandingsLists', [])
                if lists:
                    standings = lists[0].get('DriverStandings', [])
                    for item in standings:
                        d = item.get('Driver', {})
                        code = d.get('code')
                        points = float(item['points']) if '.' in item['points'] else int(item['points'])
                        if code:
                            season_points_map[code.upper()] = points
        except Exception as e:
            print(f"[Core] Cumulative standings lookup failed: {e}")

    race_results = session.results
    is_race = False
    if not race_results.empty:
        first_time = race_results.iloc[0]['Time']
        is_race = pd.notna(first_time) and first_time is not pd.NaT

    session_fastest_lap = None
    if not is_race:
        try:
            session_fastest_lap = session.laps.pick_fastest()['LapTime']
        except Exception:
            pass

    for enum_rank, (_, row) in enumerate(race_results.iterrows()):
        drv_code = row['Abbreviation']

        # DNF / DSQ / Gap handling using Status column
        status = row.get('Status')
        status_str = str(status) if pd.notna(status) else "Finished"

        if is_race:
            if status_str.upper() in ["DISQUALIFIED", "DSQ"]:
                gap_string = "DSQ"
            elif status_str == "Finished" or not status_str:
                if enum_rank == 0:
                    gap_string = "LEADER"
                elif pd.notna(row.get('Time')):
                    # FastF1 Time column already represents the delta gap to the winner
                    gap_seconds = row['Time'].total_seconds()
                    gap_string = f"+{round(gap_seconds, 3)}s"
                else:
                    gap_string = ""
            elif status_str == "Lapped":
                leader_laps = race_results.iloc[0]['Laps']
                drv_laps = row.get('Laps', leader_laps)
                laps_diff = int(leader_laps - drv_laps) if pd.notna(leader_laps) and pd.notna(drv_laps) else 0
                if laps_diff == 1:
                    gap_string = "+1 Lap"
                elif laps_diff > 1:
                    gap_string = f"+{laps_diff} Laps"
                else:
                    gap_string = "+1 Lap"
            elif "+" in status_str:
                gap_string = status_str
            else:
                gap_string = "DNF"
        else:
            # Practice / Qualifying gap calculation
            driver_fastest_lap = None
            try:
                driver_fastest_lap = session.laps.pick_drivers(drv_code).pick_fastest()['LapTime']
            except Exception:
                pass

            if enum_rank == 0 or (driver_fastest_lap is not None and session_fastest_lap is not None and driver_fastest_lap == session_fastest_lap):
                gap_string = "LEADER"
            elif driver_fastest_lap is not None and session_fastest_lap is not None:
                gap_seconds = (driver_fastest_lap - session_fastest_lap).total_seconds()
                gap_string = f"+{round(gap_seconds, 3)}s"
            else:
                gap_string = "No Time"

        first_name = row.get('FirstName') if 'FirstName' in row.index else ''
        last_name = row.get('LastName') if 'LastName' in row.index else ''
        full_name = f"{first_name} {last_name}".strip()
        if not full_name and 'FullName' in row.index:
            full_name = str(row.get('FullName', ''))
        if not full_name:
            full_name = drv_code

        points_scored = float(row['Points']) if pd.notna(row.get('Points')) else 0.0
        if points_scored.is_integer():
            points_scored = int(points_scored)

        cumulative_points = season_points_map.get(drv_code.upper(), 0)

        LIVE_STANDINGS_TOWER.append({
            "pos":          enum_rank + 1,
            "no":           int(row['DriverNumber']),
            "name":         drv_code,
            "fullName":     full_name,
            "team":         row['TeamName'],
            "gap":          gap_string,
            "pointsScored": points_scored,
            "seasonPoints": cumulative_points,
            "hasTelemetry": False,
        })

        try:
            drv_lap = session.laps.pick_drivers(drv_code).pick_fastest()
            tel = drv_lap.get_telemetry().interpolate().reset_index(drop=True)

            n = len(tel)
            if n == 0:
                continue

            speeds_ms = tel['Speed'].to_numpy() / 3.6
            delta_v   = np.diff(speeds_ms, prepend=speeds_ms[0])
            long_g    = np.clip(delta_v * 0.45, -5.5, 3.2)

            # Heading-based curvature (finite difference on XY position)
            x_arr = tel['X'].to_numpy()
            y_arr = tel['Y'].to_numpy()
            dx = np.diff(x_arr, prepend=x_arr[0])
            dy = np.diff(y_arr, prepend=y_arr[0])
            heading = np.arctan2(dy, dx)                        # radians
            heading_change = np.abs(np.diff(heading, prepend=heading[0]))  # angular rate
            # Wrap discontinuities at ±π
            heading_change = np.minimum(heading_change, 2 * np.pi - heading_change)

            # Centripetal acceleration: a_lat = v² × κ where κ = curvature
            # κ ≈ |heading_change| / arc_length_per_sample
            arc_len = np.hypot(dx, dy)  # m per sample
            arc_len = np.where(arc_len < 0.01, 0.01, arc_len)  # avoid div/0
            curvature = heading_change / arc_len
            lat_accel = (speeds_ms ** 2) * curvature
            lat_g = np.clip(lat_accel / 9.81, 0.0, 6.0)

            # G sum for energy and driver demand index
            g_sum = np.abs(long_g) + np.abs(lat_g)
            energy_per_sample = g_sum * speeds_ms * 0.1
            tyre_energy = np.cumsum(energy_per_sample)

            # demandIndex (scaled to 0-10)
            demand_index = np.clip(g_sum * 1.5, 0.0, 10.0)

            # Guard TyreLife NaN before int() cast
            tyre_age_laps   = int(drv_lap['TyreLife']) if pd.notna(drv_lap.get('TyreLife')) else 0
            # Compound — Series has no .get(); use index membership
            compound_val    = drv_lap['Compound'] if 'Compound' in drv_lap.index else 'UNKNOWN'
            tyre_compound_label = f"{compound_val} (L{tyre_age_laps})"

            raw_speed = tel['Speed'].to_numpy()
            speed_arr = np.where((raw_speed > 0) & (raw_speed < 400), raw_speed, 0).astype(int)

            throttle_arr = np.clip(tel['Throttle'].to_numpy(), 0, 100).astype(int)

            # Brake handling (True/False or percentage)
            brake_raw = tel['Brake'].to_numpy()
            brake_bool = np.zeros(n, dtype=bool)
            for idx, val in enumerate(brake_raw):
                if val in (True, False, 0, 1, 0.0, 1.0):
                    brake_bool[idx] = bool(val)
                else:
                    brake_bool[idx] = val > 5.0
            brake_arr = (brake_bool * 100).astype(int)

            # HANDLING ESTIMATORS (Curvature-based)
            is_cornering = heading_change > 0.05
            understeer_mask = is_cornering & (throttle_arr > 60) & (speed_arr > 140)
            oversteer_mask  = is_cornering & (brake_arr == 0) & (throttle_arr < 20) & (speed_arr > 120)
            handling_arr = np.where(understeer_mask, "UNDERSTEER",
                           np.where(oversteer_mask,  "OVERSTEER", "NEUTRAL"))

            # AERODYNAMICS: Downforce — physics formula: ½ρv²·Cl
            # Coefficient tuned so 300 km/h → ~3200 kg
            downforce_arr = (2.144 * (speeds_ms ** 2)).astype(int)

            # Tyre wear estimation
            estimated_tyre_wear = np.minimum(98.5, (tyre_age_laps * 1.8) + (speed_arr * 0.04))

            # Reference speed
            pole_tel_len = len(POLE_TELEMETRY_TRACK)
            if pole_tel_len > 0 and pole_tel is not None:
                ref_idx = np.minimum(np.arange(n), pole_tel_len - 1)
                ref_speed_raw = pole_tel['Speed'].to_numpy()[ref_idx]
                ref_speed_arr = np.where((ref_speed_raw > 0) & (ref_speed_raw < 400), ref_speed_raw, speed_arr).astype(int)
            else:
                ref_speed_arr = speed_arr

            # RPM & Gear
            if 'RPM' in tel.columns:
                rpm_raw = tel['RPM'].to_numpy()
                rpm_arr = np.where((rpm_raw > 3000) & (rpm_raw < 15500), rpm_raw, 12000).astype(int)
            else:
                rpm_arr = np.full(n, 12000, dtype=int)

            gear_arr = tel['nGear'].to_numpy().astype(int) if 'nGear' in tel.columns else np.full(n, 5)

            # Package lists
            driver_array_packet = [
                {
                    "time":           i,
                    "x":              float(x_arr[i]),
                    "y":              float(y_arr[i]),
                    "speed":          int(speed_arr[i]),
                    "refSpeed":       int(ref_speed_arr[i]),
                    "throttle":       int(throttle_arr[i]),
                    "brake":          int(brake_arr[i]),
                    "rpm":            int(rpm_arr[i]),
                    "gear":           int(gear_arr[i]),
                    "handling":       str(handling_arr[i]),
                    "downforceKg":    int(downforce_arr[i]),
                    "tyreWearPercent": float(round(estimated_tyre_wear[i], 1)),
                    "tyreCompound":   tyre_compound_label,
                    "tyreAge":        tyre_age_laps,
                    "longG":          float(round(long_g[i], 2)),
                    "latG":           float(round(lat_g[i], 2)),
                    "tyreEnergy":     float(round(tyre_energy[i], 1)),
                    "demandIndex":    float(round(demand_index[i], 1)),
                }
                for i in range(n)
            ]

            DRIVERS_ENGINEERING_CACHE[drv_code] = driver_array_packet
            for d in LIVE_STANDINGS_TOWER:
                if d["name"] == drv_code:
                    d["hasTelemetry"] = True
                    break

        except Exception as drv_ex:
            print(f"[Telemetry] Track data skipped for {drv_code}: {drv_ex}")

    mem_mb = check_memory()
    print(f"[Core] Session compiled. Drivers cached: {len(DRIVERS_ENGINEERING_CACHE)}. Memory: {mem_mb:.1f} MB")

    # Pre-compute lap-by-lap race simulation data (runs fast — all pandas ops)
    try:
        simulator.SIM_SESSION_LABEL = CURRENT_SESSION_LABEL or ''
        simulator.precompute_race_data(session)
        # Populate sector bests cache
        try:
            from panels import compute_sector_bests
            bests = compute_sector_bests(simulator.SIM_LAP_DATA)
            SECTOR_BESTS_CACHE.update(bests)
            print(f"[Core] Sector bests cached: S1={SECTOR_BESTS_CACHE.get('s1')}, S2={SECTOR_BESTS_CACHE.get('s2')}, S3={SECTOR_BESTS_CACHE.get('s3')}")
        except Exception as pb_ex:
            print(f"[Core] Sector bests caching failed: {pb_ex}")
    except Exception as sim_ex:
        print(f"[Simulator] Race simulation precompute failed: {sim_ex}")

    # ── OpenF1 integration — Race Control messages (2023+ only) ──────────────
    global OPENF1_SESSION_KEY
    year = CURRENT_SESSION_YEAR
    if year and year >= openf1.OPENF1_MIN_YEAR:
        try:
            circuit_name  = session.event['EventName'] if 'EventName' in session.event.index else ''
            session_type  = SESSION_LONG_TO_SHORT.get(str(getattr(session, 'name', '')), 'R')
            sk = openf1.resolve_session_key(year, circuit_name, session_type)
            OPENF1_SESSION_KEY = sk
            if sk:
                messages = openf1.fetch_race_control(sk)
                RACE_CONTROL_MESSAGES.clear()
                RACE_CONTROL_MESSAGES.extend(messages)
                print(f"[OpenF1] Race control loaded: {len(messages)} messages (session_key={sk})")
            else:
                print(f"[OpenF1] session_key not resolved for {circuit_name} {year} — race control unavailable")
        except Exception as of1_ex:
            print(f"[OpenF1] Race control fetch failed: {of1_ex}")
    else:
        print(f"[OpenF1] Year {year} < {openf1.OPENF1_MIN_YEAR} — race control not available")


# ── FastAPI Router ────────────────────────────────────────────────────────────

session_router = APIRouter()


@session_router.get("/api/team-colors")
def get_team_colors():
    """
    Returns team colors for the currently loaded session.
    Colors come directly from FastF1 session.results — correct per season.
    Falls back to static map if session not loaded.
    """
    if TEAM_COLOR_MAP:
        return TEAM_COLOR_MAP

    # Static fallback for when no session is loaded
    return {
        "Red Bull Racing":   "#3671C6",
        "Ferrari":           "#E8002D",
        "Mercedes":          "#27F4D2",
        "McLaren":           "#FF8000",
        "Aston Martin":      "#229971",
        "Alpine":            "#FF87BC",
        "Williams":          "#64C4FF",
        "AlphaTauri":        "#6692FF",
        "Alfa Romeo":        "#C92D4B",
        "Haas F1 Team":      "#B6BABD",
        "RB":                "#6692FF",
        "Kick Sauber":       "#52E252",
        "Sauber":            "#52E252",
    }


@session_router.get("/api/sessions/years")
def get_supported_years():
    """Returns the list of supported F1 seasons. No FastF1 call — instant.
    FastF1 coverage: 2018–present.
    OpenF1 enrichment (race control, etc.): 2023–present.
    """
    return list(range(2018, 2027))  # 2018 – 2026 inclusive


@session_router.get("/api/sessions/calendar")
def get_calendar(year: int):
    """
    Returns the race calendar for a given year.
    Cached in CALENDAR_CACHE to avoid repeated network calls for the same year.
    """
    if year in CALENDAR_CACHE:
        return CALENDAR_CACHE[year]

    try:
        schedule = fastf1.get_event_schedule(year, include_testing=False)
        races = []
        for _, event in schedule.iterrows():
            event_format = str(event.get('EventFormat', '')).lower()
            if 'testing' in event_format or event_format == 'nan' or not event_format:
                continue

            event_name = event.get('EventName')
            if pd.isna(event_name) or not event_name:
                continue
            event_name = str(event_name).strip()

            round_val = event.get('RoundNumber')
            if pd.isna(round_val) or round_val is None:
                continue
            try:
                round_num = int(round_val)
            except (ValueError, TypeError):
                continue

            if round_num == 0:
                continue

            short_name = event_name.replace('Grand Prix', '').replace('  ', ' ').strip()

            event_date = event.get('EventDate')
            if pd.isna(event_date) or event_date is None:
                date_str = "TBD"
            else:
                date_str = (
                    str(event_date.date())
                    if hasattr(event_date, 'date') else str(event_date)
                )

            sessions = []
            for i in range(1, 6):
                slot_name = event.get(f'Session{i}')
                slot_date = event.get(f'Session{i}Date')
                if pd.notna(slot_name) and slot_name and pd.notna(slot_date) and slot_date is not None:
                    try:
                        formatted_time = slot_date.strftime('%B %d, %Y %I:%M %p')
                    except Exception:
                        formatted_time = str(slot_date)
                    sessions.append({
                        "name": str(slot_name),
                        "time": formatted_time
                    })

            session1_date = event.get('Session1Date')
            session5_date = event.get('Session5Date')
            try:
                start_str = session1_date.strftime('%B %d, %Y') if pd.notna(session1_date) else ""
                end_str = session5_date.strftime('%B %d, %Y') if pd.notna(session5_date) else ""
                date_range = f"{start_str} ~ {end_str}" if start_str and end_str else date_str
            except Exception:
                date_range = date_str

            races.append({
                "round":     round_num,
                "name":      event_name,       # full name — used as FastF1 identifier
                "shortName": short_name,       # display label in dropdown
                "country":   str(event.get('Country', 'Unknown')),
                "date":      date_str,
                "dateRange": date_range,
                "sessions":  sessions,
            })

        CALENDAR_CACHE[year] = races
        return races

    except Exception as e:
        print(f"[Session] Calendar fetch failed for year {year}: {e}")
        raise HTTPException(status_code=500, detail=f"Calendar fetch failed: {e}")


@session_router.get("/api/sessions/types")
def get_session_types(year: int, circuit: str):
    """
    Returns the available session types for a given event.
    Looks up from the cached schedule if available, otherwise fetches from FastF1.
    """
    fallback_types = ["FP1", "FP2", "FP3", "Q", "R"]
    try:
        # Use cached schedule when available — avoids an extra network call
        if year in CALENDAR_CACHE:
            races = CALENDAR_CACHE[year]
            match = next((r for r in races if r['name'] == circuit), None)
            if match:
                # Re-fetch the raw schedule row to read Session1-5 fields
                schedule = fastf1.get_event_schedule(year, include_testing=False)
                event_row = schedule[schedule['EventName'] == circuit]
                if not event_row.empty:
                    event = event_row.iloc[0]
                    available = _parse_session_types(event)
                    return {"available": available if available else fallback_types}

        # Fallback: direct event fetch
        event = fastf1.get_event(year, circuit)
        available = _parse_session_types(event)
        return {"available": available if available else fallback_types}

    except Exception as e:
        print(f"[Session] Session type fetch failed for {year} - {circuit}: {e}")
        return {"available": fallback_types}


def _parse_session_types(event) -> list:
    """Extracts ordered session short codes from a FastF1 Event Series row."""
    available = []
    try:
        for slot in ['Session1', 'Session2', 'Session3', 'Session4', 'Session5']:
            raw = event.get(slot, '') if hasattr(event, 'get') else event[slot] if slot in event.index else ''
            val = str(raw).strip()
            if val and val.lower() != 'nan' and val != 'None' and val.lower() != 'nat':
                short = SESSION_LONG_TO_SHORT.get(val, val)
                if short not in available:
                    available.append(short)
    except Exception as e:
        print(f"[Session] _parse_session_types failed: {e}")
    return available if available else ["FP1", "FP2", "FP3", "Q", "R"]


class SessionLoadRequest(BaseModel):
    year:         int
    circuit:      str   # full EventName e.g. "Monaco Grand Prix"
    session_type: str   # short code e.g. "R", "Q", "FP1", "Sprint"


@session_router.post("/api/sessions/load")
def load_session(req: SessionLoadRequest):
    """
    Heavy endpoint — loads a full FastF1 session and recomputes all caches.
    Protected by SESSION_LOAD_LOCK to prevent concurrent loads.
    Expected duration: 30–120 seconds depending on cache state.
    """
    global SESSION_LOADING, CURRENT_SESSION_LABEL

    if not SESSION_LOAD_LOCK.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Session load already in progress")

    SESSION_LOADING = True
    try:
        mem_before = check_memory()
        label = f"{req.circuit} {req.year} - {SESSION_TYPE_LABELS.get(req.session_type, req.session_type)}"
        print(f"[Core] Loading: {label} | Memory before: {mem_before:.1f} MB")

        # Clear previous session from memory
        clear_session_cache()

        # Load session from FastF1 (uses disk cache if available)
        session = fastf1.get_session(req.year, req.circuit, req.session_type)
        session.load(laps=True, telemetry=True, weather=True)

        global CURRENT_SESSION_LABEL, CURRENT_SESSION_YEAR, CURRENT_SESSION_ROUND
        global CURRENT_SESSION_CIRCUIT, CURRENT_SESSION_TYPE
        CURRENT_SESSION_LABEL = label
        CURRENT_SESSION_YEAR = req.year
        CURRENT_SESSION_CIRCUIT = req.circuit
        CURRENT_SESSION_TYPE = req.session_type
        CURRENT_SESSION_ROUND = int(session.event['RoundNumber']) if 'RoundNumber' in session.event.index else 1

        # Recompute all engineering caches
        compile_session_data(session)
        import analytics
        analytics.compute_all_analytics()

        total_drivers = len(DRIVERS_ENGINEERING_CACHE)
        total_laps = (
            int(session.laps['LapNumber'].max())
            if not session.laps.empty else 0
        )

        return {
            "status":       "loaded",
            "year":         req.year,
            "round":        CURRENT_SESSION_ROUND,
            "circuit":      req.circuit,
            "sessionType":  req.session_type,
            "totalDrivers": total_drivers,
            "totalLaps":    total_laps,
            "label":        CURRENT_SESSION_LABEL,
        }

    except Exception as e:
        print(f"[Core] Session load failed: {e}")
        raise HTTPException(status_code=500, detail=f"Session load failed: {str(e)}")

    finally:
        SESSION_LOADING = False
        SESSION_LOAD_LOCK.release()
