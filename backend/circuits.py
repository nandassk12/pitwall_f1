"""
circuits.py — Dynamic Circuit Map Router
Serves circuit geometry, driver positions, and annotation metadata
from the in-memory session cache. Never calls FastF1 directly.

Endpoints:
  GET /api/circuit/geometry      → one-time fetch, circuit outline + bounds
  GET /api/circuit/positions     → 150ms poll, all cached driver positions
  GET /api/circuit/metadata      → one-time fetch, corners/sectors/DRS/start-finish
"""

import math
from fastapi import APIRouter, HTTPException
import session as sess

circuits_router = APIRouter()

# ── Team colour palette (2022–2025 livery codes) ──────────────────────────────
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
    # 2024 rebrands
    "RB":                     "#6692FF",
    "Kick Sauber":            "#52E252",
    "Visa Cash App RB":       "#6692FF",
    "Sauber":                 "#52E252",
}

DEFAULT_COLOR = "#888899"


def _normalise(val: float, lo: float, span: float) -> float:
    """Map a raw FastF1 coordinate to the [0, 1] range."""
    if span == 0:
        return 0.5
    return round((val - lo) / span, 5)


# ── GET /api/circuit/geometry ─────────────────────────────────────────────────

@circuits_router.get("/api/circuit/geometry")
def get_circuit_geometry():
    """
    Returns the circuit outline as normalised 0-1 points, plus the raw bounds.
    Intended to be fetched once when a session loads — not polled.
    Subsamples every 3rd pole-lap telemetry point (~600 → ~200 pts) for SVG
    performance while preserving enough resolution for smooth curves.
    """
    if not sess.POLE_TELEMETRY_TRACK:
        raise HTTPException(status_code=404, detail="No session loaded — circuit geometry unavailable")

    bounds = sess.CIRCUIT_BOUNDS
    if not bounds:
        raise HTTPException(status_code=503, detail="Circuit bounds not yet computed")

    min_x  = bounds['minX']
    min_y  = bounds['minY']
    span_x = bounds['width']
    span_y = bounds['height']

    # Subsample: every 3rd point is enough for a smooth D3 Catmull-Rom curve
    raw = sess.POLE_TELEMETRY_TRACK
    sampled = [raw[i] for i in range(0, len(raw), 3)]

    points = [
        {
            "x": _normalise(p['x'], min_x, span_x),
            "y": _normalise(p['y'], min_y, span_y),
        }
        for p in sampled
    ]

    return {
        "points":      points,
        "bounds":      bounds,
        "totalPoints": len(points),
    }


# ── GET /api/circuit/positions ────────────────────────────────────────────────

@circuits_router.get("/api/circuit/positions")
def get_circuit_positions(index: int = 0):
    """
    Returns the current map position of every cached driver at the given
    telemetry index. Index wraps per-driver (each driver has a different
    cache length). Intended to be polled at 150ms in sync with /api/telemetry.

    Returns at most 8 objects, each ~60 bytes — negligible bandwidth.
    """
    cache     = sess.DRIVERS_ENGINEERING_CACHE
    bounds    = sess.CIRCUIT_BOUNDS
    standings = sess.LIVE_STANDINGS_TOWER

    if not cache or not bounds:
        return []

    min_x  = bounds['minX']
    min_y  = bounds['minY']
    span_x = bounds['width']
    span_y = bounds['height']

    # Build fast driver→metadata lookup from standings
    team_lookup   = {s['name']: s['team'] for s in standings}
    carnum_lookup = {s['name']: s['no']   for s in standings}

    result = []
    for driver_code, frames in cache.items():
        if not frames:
            continue

        # Wrap index per-driver to handle different cache lengths gracefully
        frame = frames[index % len(frames)]

        team  = team_lookup.get(driver_code, '')
        color = TEAM_COLORS.get(team, DEFAULT_COLOR)

        result.append({
            "driver":    driver_code,
            "carNumber": carnum_lookup.get(driver_code, 0),
            "team":      team,
            "teamColor": color,
            "x":         _normalise(frame['x'], min_x, span_x),
            "y":         _normalise(frame['y'], min_y, span_y),
            "speed":     frame.get('speed', 0),
            "gear":      frame.get('gear', 0),
        })

    # Sort by driver code for stable render order
    result.sort(key=lambda d: d['driver'])
    return result


def _detect_corner_count() -> int:
    """
    Counts detected corners from POLE_TELEMETRY_TRACK using the same
    Gaussian-smoothed braking zone logic as get_circuit_metadata().
    Returns integer corner count. Called once at session load time.
    """
    import numpy as np
    from scipy.ndimage import gaussian_filter1d
    import session as sess

    track = sess.POLE_TELEMETRY_TRACK
    if not track:
        return 20   # fallback

    n = len(track)

    raw_speeds = np.array([p.get('speed', 0) for p in track], dtype=float)
    smooth_speeds = gaussian_filter1d(raw_speeds, sigma=5)

    # Arc-length for MIN_GAP computation (same as get_circuit_metadata)
    cum = [0.0]
    for i in range(1, n):
        dx = track[i]['x'] - track[i-1]['x']
        dy = track[i]['y'] - track[i-1]['y']
        cum.append(cum[-1] + math.hypot(dx, dy))
    total_len = cum[-1] if cum[-1] > 0 else 1.0
    MIN_GAP_METERS = total_len * 0.035

    corners = []
    in_zone = False
    zone_start = 0

    for i in range(n):
        explicit_flag = track[i].get('isIdealBrakingZone', None)
        if explicit_flag is not None:
            is_braking = explicit_flag
        else:
            if i > 0:
                is_braking = (smooth_speeds[i] < smooth_speeds[i-1]) and (smooth_speeds[i] < 200)
            else:
                is_braking = False

        if is_braking and not in_zone:
            in_zone = True
            zone_start = i
        elif not is_braking and in_zone:
            if corners and (cum[zone_start] - cum[corners[-1]]) < MIN_GAP_METERS:
                in_zone = False
                continue
            # Find apex (speed minimum)
            apex_idx = zone_start
            min_speed = smooth_speeds[zone_start]
            for j in range(zone_start, min(i, n)):
                if smooth_speeds[j] < min_speed:
                    min_speed = smooth_speeds[j]
                    apex_idx = j
            corners.append(apex_idx)
            in_zone = False

    return max(10, min(len(corners), 30))
    # Clamp between 10 and 30 — sane range for any F1 circuit


# ── GET /api/circuit/metadata ─────────────────────────────────────────────────

@circuits_router.get("/api/circuit/metadata")
def get_circuit_metadata():
    """
    Returns circuit annotation layers derived entirely from the in-memory
    POLE_TELEMETRY_TRACK — no extra FastF1 calls, no latency.

    Outputs (all coordinates in the same normalised [0,1] space as /api/circuit/geometry):
      corners       — apex points of braking zones, numbered sequentially
      startFinish   — first point of the fastest-lap telemetry stream
      sectors       — S1/S2/S3 split points at ~33% / 66% / 100% lap distance
      drsZones      — stretches where speed is high AND no braking (DRS-eligible)
    """
    import numpy as np
    from scipy.ndimage import gaussian_filter1d

    track  = sess.POLE_TELEMETRY_TRACK
    bounds = sess.CIRCUIT_BOUNDS

    if not track or not bounds:
        return {"error": "No session loaded — circuit metadata unavailable"}

    n      = len(track)
    min_x  = bounds['minX']
    min_y  = bounds['minY']
    span_x = bounds['width']
    span_y = bounds['height']

    def nx(x):
        return round((x - min_x) / span_x, 5) if span_x else 0.5

    def ny(y):
        return round((y - min_y) / span_y, 5) if span_y else 0.5

    # FIX 5: Gaussian-smoothed speed array for stable corner/apex detection
    raw_speeds    = np.array([p.get('speed', 0) for p in track], dtype=float)
    smooth_speeds = gaussian_filter1d(raw_speeds, sigma=5)

    # ── 1. START / FINISH LINE ─────────────────────────────────────────────────
    # The first point of the fastest-lap telemetry is always on the S/F straight.
    start_finish = {
        "x": nx(track[0]['x']),
        "y": ny(track[0]['y']),
    }

    # FIX 6: Compute arc-length table BEFORE corner loop so MIN_GAP_METERS works.
    # This same table is reused for sector splits — not duplicated.
    cum = [0.0]
    for i in range(1, n):
        dx = track[i]['x'] - track[i-1]['x']
        dy = track[i]['y'] - track[i-1]['y']
        cum.append(cum[-1] + math.hypot(dx, dy))
    total_len = cum[-1] if cum[-1] > 0 else 1.0

    # FIX 6: Arc-length-based minimum gap between corners (3.5% of lap distance)
    MIN_GAP_METERS = total_len * 0.035

    # ── 2. CORNERS ────────────────────────────────────────────────────────────
    # Detect braking zones: isIdealBrakingZone marks speed > 110 + brake active.
    # Walk through and grab the apex (speed minimum) within each braking cluster.
    corners      = []
    corner_num   = 1
    in_zone      = False
    zone_start   = 0

    for i in range(n):
        # FIX 5: Fallback braking flag using smoothed speed when explicit flag absent
        explicit_flag = track[i].get('isIdealBrakingZone', None)
        if explicit_flag is not None:
            is_braking = explicit_flag
        else:
            if i > 0:
                is_braking = (smooth_speeds[i] < smooth_speeds[i-1]) and (smooth_speeds[i] < 200)
            else:
                is_braking = False

        if is_braking and not in_zone:
            in_zone    = True
            zone_start = i

        elif not is_braking and in_zone:
            # End of braking cluster → find speed minimum (apex)
            zone_end = i
            # FIX 6: Enforce minimum gap using arc-length, not index distance
            if corners and (cum[zone_start] - cum[corners[-1]['_idx']]) < MIN_GAP_METERS:
                in_zone = False
                continue

            min_speed = None
            apex_idx  = zone_start
            for j in range(zone_start, min(zone_end, n)):
                s = smooth_speeds[j]   # FIX 5: use smoothed speed for apex finding
                if min_speed is None or s < min_speed:
                    min_speed = s
                    apex_idx  = j

            pt = track[apex_idx]
            corners.append({
                "number": corner_num,
                "x":      nx(pt['x']),
                "y":      ny(pt['y']),
                "_idx":   apex_idx,          # internal, stripped before return
            })
            corner_num += 1
            in_zone     = False

    # Strip internal index before sending to client
    for c in corners:
        c.pop('_idx', None)

    # ── 3. SECTOR SPLIT POINTS ────────────────────────────────────────────────
    # cum and total_len already computed above (FIX 6) — reuse directly.
    def idx_at_fraction(frac):
        target = frac * total_len
        for i in range(n - 1):
            if cum[i] <= target <= cum[i+1]:
                return i
        return n - 1

    s1_idx = idx_at_fraction(1/3)
    s2_idx = idx_at_fraction(2/3)

    sectors = [
        {
            "name":  "S1",
            "x":     nx(track[s1_idx]['x']),
            "y":     ny(track[s1_idx]['y']),
            "color": "#b146ff",
        },
        {
            "name":  "S2",
            "x":     nx(track[s2_idx]['x']),
            "y":     ny(track[s2_idx]['y']),
            "color": "#00e676",
        },
        {
            "name":  "S3",
            "x":     nx(track[0]['x']),
            "y":     ny(track[0]['y']),
            "color": "#ffea00",
        },
    ]

    # ── 4. DRS ZONES ──────────────────────────────────────────────────────────
    # A DRS zone is a continuous stretch of high-speed (> 220 km/h) track with
    # no braking — typically the main straight and one or two other straights.
    DRS_SPEED_THRESH = 220   # km/h
    DRS_MIN_POINTS   = max(15, n // 80)   # ~1.25% of lap

    drs_zones    = []
    zone_active  = False
    zone_s_idx   = 0

    for i in range(n):
        fast    = track[i].get('speed', 0) > DRS_SPEED_THRESH
        braking = track[i].get('isIdealBrakingZone', False)

        if fast and not braking and not zone_active:
            zone_active = True
            zone_s_idx  = i
        elif (not fast or braking) and zone_active:
            if (i - zone_s_idx) >= DRS_MIN_POINTS:
                mid = (zone_s_idx + i) // 2
                drs_zones.append({
                    "startX": nx(track[zone_s_idx]['x']),
                    "startY": ny(track[zone_s_idx]['y']),
                    "endX":   nx(track[i - 1]['x']),
                    "endY":   ny(track[i - 1]['y']),
                    "midX":   nx(track[mid]['x']),
                    "midY":   ny(track[mid]['y']),
                    # indices for rendering as a polyline segment
                    "segmentPoints": [
                        {"x": nx(track[j]['x']), "y": ny(track[j]['y'])}
                        for j in range(zone_s_idx, i, max(1, (i - zone_s_idx) // 20))
                    ],
                })
            zone_active = False

    # FIX 7: Close any DRS zone that extends to the end of the telemetry array
    if zone_active and (n - zone_s_idx) >= DRS_MIN_POINTS:
        mid = (zone_s_idx + n - 1) // 2
        drs_zones.append({
            "startX": nx(track[zone_s_idx]['x']),
            "startY": ny(track[zone_s_idx]['y']),
            "endX":   nx(track[n - 1]['x']),
            "endY":   ny(track[n - 1]['y']),
            "midX":   nx(track[mid]['x']),
            "midY":   ny(track[mid]['y']),
            "segmentPoints": [
                {"x": nx(track[j]['x']), "y": ny(track[j]['y'])}
                for j in range(zone_s_idx, n, max(1, (n - zone_s_idx) // 20))
            ],
        })

    return {
        "corners":      corners,
        "startFinish":  start_finish,
        "sectors":      sectors,
        "drsZones":     drs_zones,
        "totalCorners": len(corners),
    }
