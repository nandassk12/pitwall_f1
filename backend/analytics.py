import numpy as np
import math
from typing import Optional
import session as sess
import simulator

# Physical constants
AIR_DENSITY      = 1.225   # kg/m³ at sea level
CAR_MASS         = 798.0   # kg (2023 F1 car + driver + fuel approx)
FRONTAL_AREA     = 1.5     # m² estimated frontal area
CD_ESTIMATE      = 0.7     # baseline drag coefficient (tuned per track)
CL_ESTIMATE      = 3.0     # baseline lift (downforce) coefficient
HP_PER_KW        = 1.341   # conversion factor

# Module-level results cache — populated by compute_all_analytics()
ANALYTICS_CACHE: dict = {}

def compute_power_and_aero(driver_code: str) -> dict:
    """
    Estimate power output and aerodynamic coefficients from telemetry.
    Uses full-throttle straight-line segments only.
    """
    default_res = {
        "driver": driver_code,
        "peakHp": 0.0,
        "avgHp": 0.0,
        "hpCurve": [],
        "cdActual": CD_ESTIMATE,
        "clActual": CL_ESTIMATE,
        "peakDownforceKg": 0.0,
        "aeroEfficiency": CL_ESTIMATE / CD_ESTIMATE,
        "straightFrames": 0,
    }

    cache = getattr(sess, 'DRIVERS_ENGINEERING_CACHE', {})
    frames = cache.get(driver_code, [])
    if not frames:
        return default_res

    valid_pairs = []
    
    # Iterate through consecutive frames in original telemetry sequence
    for i in range(len(frames) - 1):
        f1 = frames[i]
        f2 = frames[i + 1]

        # Filter: throttle >= 98 AND brake == 0 AND speed > 250
        if (f1.get('throttle', 0) >= 98 and f1.get('brake', 0) == 0 and f1.get('speed', 0) > 250 and
            f2.get('throttle', 0) >= 98 and f2.get('brake', 0) == 0 and f2.get('speed', 0) > 250):
            
            # Convert speed from km/h to m/s
            v1 = f1.get('speed', 0) / 3.6
            v2 = f2.get('speed', 0) / 3.6
            v_mean = (v1 + v2) / 2.0

            # Acceleration (FastF1 telemetry is ~20Hz so dt = 0.05s per frame)
            a = (v2 - v1) / 0.05

            # Compute drag force
            F_drag = 0.5 * AIR_DENSITY * CD_ESTIMATE * FRONTAL_AREA * (v_mean ** 2)

            # Compute engine force
            F_engine = CAR_MASS * a + F_drag

            # Skip deceleration artifacts
            if F_engine <= 0:
                continue

            # Compute power in watts
            P = F_engine * v_mean

            # Convert to HP
            hp = P * HP_PER_KW / 1000.0

            # Compute Cd_actual for this frame
            Cd_frame = F_engine / (0.5 * AIR_DENSITY * FRONTAL_AREA * (v_mean ** 2)) if v_mean > 0 else 0.0

            valid_pairs.append({
                "speed": float(f2.get('speed', 0)),
                "hp": float(hp),
                "rpm": int(f2.get('rpm', 0)),
                "Cd_frame": Cd_frame
            })

    # For downforce (Cl): use frames where speed > 180 AND throttle > 50 AND brake == 0 (fast corners)
    max_downforce_kg = 0.0
    for frame in frames:
        speed_kmh = frame.get('speed', 0)
        throttle = frame.get('throttle', 0)
        brake = frame.get('brake', 0)
        if speed_kmh > 180 and throttle > 50 and brake == 0:
            v = speed_kmh / 3.6
            df_kg = (0.5 * AIR_DENSITY * CL_ESTIMATE * FRONTAL_AREA * (v ** 2)) / 9.81
            if df_kg > max_downforce_kg:
                max_downforce_kg = df_kg

    if not valid_pairs:
        # If no straight frames matched, return default with cornering downforce details if any
        res = default_res.copy()
        res["peakDownforceKg"] = float(max_downforce_kg)
        return res

    hp_values = [item['hp'] for item in valid_pairs]
    peak_hp = float(max(hp_values))
    avg_hp = float(np.mean(hp_values))
    
    # Cd_actual is the median of Cd_frame across all straight-line frames
    cd_actual = float(np.median([item['Cd_frame'] for item in valid_pairs]))
    cl_actual = float(CL_ESTIMATE)
    aero_efficiency = float(cl_actual / cd_actual) if cd_actual > 0 else 0.0

    # hpCurve: one entry per valid frame, subsampled x5
    hp_curve = [
        {"speed": item["speed"], "hp": round(item["hp"], 2), "rpm": item["rpm"]}
        for item in valid_pairs[::5]
    ]

    return {
        "driver": driver_code,
        "peakHp": round(peak_hp, 2),
        "avgHp": round(avg_hp, 2),
        "hpCurve": hp_curve,
        "cdActual": round(cd_actual, 4),
        "clActual": cl_actual,
        "peakDownforceKg": round(float(max_downforce_kg), 2),
        "aeroEfficiency": round(aero_efficiency, 4),
        "straightFrames": len(valid_pairs),
    }

def compute_race_pace(threshold_pct: float = 5.0) -> list:
    """
    Filter out dirty laps (SC, VSC, pits, crashes) and return
    clean race pace per driver for meaningful comparison.
    """
    sim_lap_data = getattr(simulator, 'SIM_LAP_DATA', {})
    if not sim_lap_data:
        return []

    # Group laps by driver
    driver_laps = {}
    for lap_num, entries in sim_lap_data.items():
        for entry in entries:
            drv = entry.get('driver')
            if not drv:
                continue
            if drv not in driver_laps:
                driver_laps[drv] = []
            driver_laps[drv].append(entry)

    driver_results = []
    for drv, entries in driver_laps.items():
        # Laps where lapTime is not None
        total_laps = [e for e in entries if e.get('lapTime') is not None]
        total_lap_count = len(total_laps)
        if total_lap_count == 0:
            continue

        # Filter candidates: no pit stops, pit ins, or pit outs
        candidate_laps = [
            e for e in total_laps
            if not e.get('pitStop', False) and not e.get('pitIn', False) and not e.get('pitOut', False)
        ]
        if not candidate_laps:
            continue

        candidate_times = [e['lapTime'] for e in candidate_laps]
        
        # Compute median lap time per driver
        median_lap_time = float(np.median(candidate_times))

        # Filter: keep only laps where lapTime <= median * (1 + threshold_pct/100)
        limit = median_lap_time * (1 + threshold_pct / 100.0)
        clean_laps = [e for e in candidate_laps if e['lapTime'] <= limit]
        if not clean_laps:
            continue

        clean_times = [e['lapTime'] for e in clean_laps]
        clean_avg = float(np.mean(clean_times))
        consistency_std = float(np.std(clean_times)) if len(clean_times) > 1 else 0.0
        best_clean_lap = float(min(clean_times))

        # Find most used tire compound
        compounds = [e['compound'] for e in clean_laps if e.get('compound')]
        most_common_compound = max(set(compounds), key=compounds.count) if compounds else "UNKNOWN"

        first_entry = entries[0]
        team = first_entry.get('team', '')
        team_color = first_entry.get('teamColor', simulator.DEFAULT_COLOR)

        driver_results.append({
            "driver": drv,
            "team": team,
            "teamColor": team_color,
            "cleanAvgLapTime": round(clean_avg, 3),
            "medianLapTime": round(median_lap_time, 3),
            "paceDelta": 0.0,  # calculated later against best
            "cleanLapCount": len(clean_laps),
            "totalLapCount": total_lap_count,
            "consistencyStd": round(consistency_std, 3),
            "bestCleanLap": round(best_clean_lap, 3),
            "compound": most_common_compound,
        })

    if not driver_results:
        return []

    # Find the fastest clean_avg across all drivers (the reference)
    best_clean_avg = min(d['cleanAvgLapTime'] for d in driver_results)

    # Compute pace delta
    for d in driver_results:
        d['paceDelta'] = round(d['cleanAvgLapTime'] - best_clean_avg, 3)

    # Sort by cleanAvgLapTime ascending
    driver_results.sort(key=lambda x: x['cleanAvgLapTime'])
    return driver_results

def compute_segment_dominance(n_segments: int = 0) -> dict:
    """
    For every segment, rank ALL drivers by mean speed through that segment.
    The fastest driver's team color paints that segment.
    """
    track = getattr(sess, 'POLE_TELEMETRY_TRACK', [])
    cache = getattr(sess, 'DRIVERS_ENGINEERING_CACHE', {})
    bounds = getattr(sess, 'CIRCUIT_BOUNDS', {})

    # Auto-resolve segment count from detected corners
    if n_segments == 0:
        detected = getattr(sess, 'CIRCUIT_CORNER_COUNT', 0)
        if detected > 0:
            n_segments = detected
            print(f"[Analytics] Using circuit corner count: {n_segments} segments")
        else:
            n_segments = 20
            print(f"[Analytics] Corner count unavailable, defaulting to 20 segments")

    if not track or not cache:
        return {"segments": [], "driverSummary": {}, "n_segments": n_segments}

    span_x = bounds.get('width', 0)
    span_y = bounds.get('height', 0)
    min_x  = bounds.get('minX', 0)
    min_y  = bounds.get('minY', 0)

    def normalize_x(x):
        return round((x - min_x) / span_x, 5) if span_x else 0.5

    def normalize_y(y):
        return round((y - min_y) / span_y, 5) if span_y else 0.5

    # 3. Build arc-length cumulative distance array along track points
    # FastF1 track coordinates x and y are in decimeters (10 units = 1 meter)
    cum = [0.0]
    for i in range(1, len(track)):
        dx = track[i]['x'] - track[i-1]['x']
        dy = track[i]['y'] - track[i-1]['y']
        cum.append(cum[-1] + math.hypot(dx, dy))
    total_len = cum[-1]

    # Resolve driver meta (team and colors)
    standings = getattr(sess, 'LIVE_STANDINGS_TOWER', [])
    driver_meta = {}
    for entry in standings:
        drv = entry.get('name')
        if not drv:
            continue
        team = entry.get('team', '')
        color = simulator.TEAM_COLORS.get(team, simulator.DEFAULT_COLOR)
        driver_meta[drv] = (team, color)

    for drv in cache.keys():
        if drv not in driver_meta:
            driver_meta[drv] = ("", simulator.DEFAULT_COLOR)

    # Initialize driver summary
    driver_summary = {}
    for drv, drv_frames in cache.items():
        team, color = driver_meta.get(drv, ("", simulator.DEFAULT_COLOR))
        speeds_all = [f.get('speed', 0) for f in drv_frames]
        avg_speed = float(np.mean(speeds_all)) if speeds_all else 0.0
        driver_summary[drv] = {
            "segmentsLed": 0,
            "avgSpeed": round(avg_speed, 2),
            "teamColor": color,
            "team": team,
        }

    import bisect
    segments_list = []

    for i in range(n_segments):
        target_start = (i / n_segments) * total_len
        target_end = ((i + 1) / n_segments) * total_len

        start_idx = bisect.bisect_left(cum, target_start)
        end_idx = bisect.bisect_left(cum, target_end)

        start_idx = max(0, min(start_idx, len(track) - 1))
        end_idx = max(0, min(end_idx, len(track) - 1))

        if end_idx <= start_idx:
            end_idx = min(start_idx + 1, len(track) - 1)

        # 4. For each driver, map proportionally to track indices
        driver_speeds = {}
        for drv, drv_frames in cache.items():
            len_drv = len(drv_frames)
            start_drv = start_idx * len_drv // len(track)
            end_drv = end_idx * len_drv // len(track)

            start_drv = max(0, min(start_drv, len_drv - 1))
            end_drv = max(0, min(end_drv, len_drv - 1))
            if end_drv <= start_drv:
                end_drv = min(start_drv + 1, len_drv)

            slice_frames = drv_frames[start_drv:end_drv]
            speeds = [f.get('speed', 0) for f in slice_frames]
            mean_speed = float(np.mean(speeds)) if speeds else 0.0
            driver_speeds[drv] = mean_speed

        # 5. Build ranked list of ALL drivers
        segment_ranking = []
        for drv, mean_speed in driver_speeds.items():
            team, color = driver_meta.get(drv, ("", simulator.DEFAULT_COLOR))
            segment_ranking.append({
                "driver": drv,
                "team": team,
                "teamColor": color,
                "meanSpeed": mean_speed,
            })

        segment_ranking.sort(key=lambda x: x['meanSpeed'], reverse=True)

        # Calculate time delta approximations
        P1_speed = segment_ranking[0]['meanSpeed']
        avg_speed_kmh = float(np.mean([item['meanSpeed'] for item in segment_ranking])) if segment_ranking else 0.0
        avg_speed_ms = avg_speed_kmh / 3.6 if avg_speed_kmh > 0 else 0.0
        # Convert decimeters to meters for physical accuracy
        lengthMeters = (cum[end_idx] - cum[start_idx]) / 10.0

        for rank_idx, item in enumerate(segment_ranking):
            drv_speed = item['meanSpeed']
            if rank_idx == 0:
                delta_s = 0.0
            else:
                if avg_speed_kmh > 0 and avg_speed_ms > 0:
                    # delta: float (seconds behind P1 in this segment)
                    # computed as: (P1_speed - drv_speed) / avg_speed * segment_time_estimate
                    # where avg_speed = avg_speed_kmh, segment_time_estimate = lengthMeters / avg_speed_ms
                    delta_s = ((P1_speed - drv_speed) / avg_speed_kmh) * (lengthMeters / avg_speed_ms)
                else:
                    delta_s = 0.0
            item['position'] = rank_idx + 1
            item['delta'] = round(float(delta_s), 4)

        # 6. Segment color & opacity
        dominant_drv = segment_ranking[0]['driver']
        dominant_team = segment_ranking[0]['team']
        segment_color = segment_ranking[0]['teamColor']
        opacity = 1.0

        # Increment segment lead count
        if dominant_drv in driver_summary:
            driver_summary[dominant_drv]["segmentsLed"] += 1

        # Subsample points
        n_pts = end_idx - start_idx
        step = max(1, n_pts // 20)
        points = [{"x": normalize_x(track[idx]['x']), "y": normalize_y(track[idx]['y'])} for idx in range(start_idx, end_idx, step)]
        if points and (normalize_x(track[end_idx-1]['x']), normalize_y(track[end_idx-1]['y'])) != (points[-1]['x'], points[-1]['y']):
            points.append({"x": normalize_x(track[end_idx-1]['x']), "y": normalize_y(track[end_idx-1]['y'])})

        # Midpoint
        mid_idx = (start_idx + end_idx) // 2
        mid_pt = track[mid_idx]
        mid_x = normalize_x(mid_pt['x'])
        mid_y = normalize_y(mid_pt['y'])

        segments_list.append({
            "index": i,
            "label": f"T{i+1}",
            "points": points,
            "midpoint": {"x": mid_x, "y": mid_y},
            "startMeters": round(float(cum[start_idx] / 10.0), 2),
            "endMeters": round(float(cum[end_idx] / 10.0), 2),
            "lengthMeters": round(float(lengthMeters), 2),
            "color": segment_color,
            "opacity": opacity,
            "dominantDriver": dominant_drv,
            "dominantTeam": dominant_team,
            "ranking": segment_ranking,
        })

    return {
        "n_segments": n_segments,
        "segments": segments_list,
        "driverSummary": driver_summary,
    }


def compute_teammate_gaps() -> list:
    """
    For every team, compute the intra-team gap in the loaded session
    (qualifying time delta and race pace delta).
    """
    standings = getattr(sess, 'LIVE_STANDINGS_TOWER', [])
    if not standings:
        return []

    # Group drivers by team
    team_drivers = {}
    for entry in standings:
        team = entry.get('team')
        drv = entry.get('name')
        if not team or not drv:
            continue
        if team not in team_drivers:
            team_drivers[team] = []
        if drv not in team_drivers[team]:
            team_drivers[team].append(drv)

    # Helper to find best lapTime from SIM_LAP_DATA
    def get_best_lap_time_from_sim(driver_code):
        sim_lap_data = getattr(simulator, 'SIM_LAP_DATA', {})
        times = []
        for lap_num, entries in sim_lap_data.items():
            for entry in entries:
                if entry.get('driver') == driver_code and entry.get('lapTime') is not None:
                    times.append(entry['lapTime'])
        return min(times) if times else None

    # Get race pace averages
    race_pace_results = ANALYTICS_CACHE.get('race_pace')
    if not race_pace_results:
        race_pace_results = compute_race_pace(threshold_pct=5.0)

    pace_map = {item['driver']: item['cleanAvgLapTime'] for item in race_pace_results}

    results = []
    for team, drivers in team_drivers.items():
        if len(drivers) == 2:
            driver_1, driver_2 = drivers[0], drivers[1]

            # Qualifying/fastest-lap gap
            time_1 = None
            if sess.SESSION_OBJECT is not None:
                try:
                    time_1 = sess.SESSION_OBJECT.laps.pick_drivers(driver_1).pick_fastest()['LapTime'].total_seconds()
                except Exception:
                    pass
            if time_1 is None:
                time_1 = get_best_lap_time_from_sim(driver_1)

            time_2 = None
            if sess.SESSION_OBJECT is not None:
                try:
                    time_2 = sess.SESSION_OBJECT.laps.pick_drivers(driver_2).pick_fastest()['LapTime'].total_seconds()
                except Exception:
                    pass
            if time_2 is None:
                time_2 = get_best_lap_time_from_sim(driver_2)

            if time_1 is None or time_2 is None:
                continue

            qual_gap_ms = abs(time_1 - time_2) * 1000.0
            faster_in_qual = driver_1 if time_1 < time_2 else driver_2

            if time_1 <= time_2:
                driverA = driver_1
                driverB = driver_2
            else:
                driverA = driver_2
                driverB = driver_1

            # Race pace gap
            pace_1 = pace_map.get(driver_1)
            pace_2 = pace_map.get(driver_2)

            if pace_1 is not None and pace_2 is not None:
                race_pace_delta = abs(pace_1 - pace_2)
                faster_in_race = driver_1 if pace_1 < pace_2 else driver_2
            else:
                race_pace_delta = 0.0
                faster_in_race = faster_in_qual

            team_color = simulator.TEAM_COLORS.get(team, simulator.DEFAULT_COLOR)

            results.append({
                "team": team,
                "teamColor": team_color,
                "driverA": driverA,
                "driverB": driverB,
                "qualGapMs": round(qual_gap_ms, 2),
                "racePaceDelta": round(race_pace_delta, 3),
                "fasterInQual": faster_in_qual,
                "fasterInRace": faster_in_race,
            })

    # Sorted by qualGapMs ascending (tightest teammates first)
    results.sort(key=lambda x: x['qualGapMs'])
    return results

def compute_all_analytics():
    """
    Master function called once at session load time.
    Populates ANALYTICS_CACHE with all results.
    """
    global ANALYTICS_CACHE
    ANALYTICS_CACHE.clear()

    drivers_cache = getattr(sess, 'DRIVERS_ENGINEERING_CACHE', {})
    drivers = list(drivers_cache.keys())
    if not drivers:
        print("[Analytics] No driver cache — skipping analytics computation")
        return

    print(f"[Analytics] Computing analytics for {len(drivers)} drivers...")

    # Power and aero — per driver
    power_results = {}
    for drv in drivers:
        try:
            power_results[drv] = compute_power_and_aero(drv)
        except Exception as e:
            print(f"[Analytics] Power compute failed for {drv}: {e}")
    ANALYTICS_CACHE['power'] = power_results

    # Race pace — session-wide
    try:
        ANALYTICS_CACHE['race_pace'] = compute_race_pace(threshold_pct=5.0)
    except Exception as e:
        print(f"[Analytics] Race pace compute failed: {e}")
        ANALYTICS_CACHE['race_pace'] = []

    # Teammate gaps — depends on race_pace being computed
    try:
        ANALYTICS_CACHE['teammate_gaps'] = compute_teammate_gaps()
    except Exception as e:
        print(f"[Analytics] Teammate gap compute failed: {e}")
        ANALYTICS_CACHE['teammate_gaps'] = []

    # Segment dominance
    try:
        ANALYTICS_CACHE['dominance'] = compute_segment_dominance()
        total_segs = len(ANALYTICS_CACHE['dominance'].get('segments', []))
        print(f"[Analytics] Segment dominance computed: {total_segs} segments")
    except Exception as e:
        print(f"[Analytics] Segment dominance compute failed: {e}")
        ANALYTICS_CACHE['dominance'] = {"segments": [], "driverSummary": {}}

    print(f"[Analytics] Done. Keys: {list(ANALYTICS_CACHE.keys())}")
