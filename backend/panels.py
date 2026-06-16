from fastapi import APIRouter, HTTPException
import session as sess
import simulator
import requests

panels_router = APIRouter()

# Standings cache to avoid hitting Jolpica F1 API repeatedly for the same session
CHAMP_CACHE = {}


@panels_router.get("/api/panels/pit-strategy")
def get_pit_strategy():
    """
    Aggregates SIM_LAP_DATA into compound stint blocks per driver.
    """
    if not simulator.SIM_LAP_DATA:
        raise HTTPException(status_code=404, detail="No session or simulation data loaded")

    drivers_stints = []
    total_laps = simulator.SIM_TOTAL_LAPS

    # Get the list of driver codes from the standings tower or active session data
    driver_codes = [d['name'] for d in sess.LIVE_STANDINGS_TOWER]
    if not driver_codes:
        # Fallback to any drivers present in SIM_LAP_DATA
        driver_codes = sorted(list(set(
            entry['driver']
            for laps in simulator.SIM_LAP_DATA.values()
            for entry in laps
        )))

    for drv_code in driver_codes:
        # Find team details from any entry
        team_name = "Unknown"
        team_color = simulator.DEFAULT_COLOR
        for lap_num in range(1, total_laps + 1):
            entry = next((e for e in simulator.SIM_LAP_DATA.get(lap_num, []) if e['driver'] == drv_code), None)
            if entry:
                team_name = entry.get('team', "Unknown")
                team_color = entry.get('teamColor', simulator.DEFAULT_COLOR)
                break

        stints = []
        pit_laps = []
        current_stint = None

        for lap_num in range(1, total_laps + 1):
            lap_entries = simulator.SIM_LAP_DATA.get(lap_num, [])
            entry = next((e for e in lap_entries if e['driver'] == drv_code), None)
            if not entry:
                continue

            comp = entry.get('compound', 'UNKNOWN')
            is_pit_in = entry.get('pitIn', False)
            is_pit_out = entry.get('pitOut', False)

            if current_stint is None:
                current_stint = {
                    "startLap": lap_num,
                    "endLap": lap_num,
                    "compound": comp,
                    "lapCount": 1
                }
            elif comp != current_stint["compound"] or is_pit_out:
                # Close previous stint
                stints.append(current_stint)
                current_stint = {
                    "startLap": lap_num,
                    "endLap": lap_num,
                    "compound": comp,
                    "lapCount": 1
                }
            else:
                current_stint["endLap"] = lap_num
                current_stint["lapCount"] += 1

            if is_pit_in:
                pit_laps.append(lap_num)
                stints.append(current_stint)
                current_stint = None

        if current_stint is not None:
            stints.append(current_stint)

        drivers_stints.append({
            "driver": drv_code,
            "team": team_name,
            "teamColor": team_color,
            "totalLaps": total_laps,
            "stints": stints,
            "pitLaps": pit_laps
        })

    return {
        "drivers": drivers_stints,
        "totalLaps": total_laps
    }


def compute_sector_bests(lap_data: dict) -> dict:
    """
    Computes global session bests for S1, S2, S3 across all drivers and laps.
    Called once when compiling session data to populate SECTOR_BESTS_CACHE.
    """
    bests = {'s1': float('inf'), 's2': float('inf'), 's3': float('inf')}
    for entries in lap_data.values():
        for e in entries:
            s1 = e.get('sector1')
            s2 = e.get('sector2')
            s3 = e.get('sector3')
            if s1 is not None and s1 > 0 and s1 < bests['s1']:
                bests['s1'] = s1
            if s2 is not None and s2 > 0 and s2 < bests['s2']:
                bests['s2'] = s2
            if s3 is not None and s3 > 0 and s3 < bests['s3']:
                bests['s3'] = s3
    return {k: (None if v == float('inf') else v) for k, v in bests.items()}


@panels_router.get("/api/panels/sector-analysis")
def get_sector_analysis(driver: str):
    """
    Returns S1/S2/S3 sector times per lap for a driver, color-flagged with
    personal and session best indicators.
    """
    if not simulator.SIM_LAP_DATA:
        raise HTTPException(status_code=404, detail="No session or simulation data loaded")

    # 1. Read precomputed global session bests for S1, S2, S3
    session_best_s1 = sess.SECTOR_BESTS_CACHE.get('s1')
    session_best_s2 = sess.SECTOR_BESTS_CACHE.get('s2')
    session_best_s3 = sess.SECTOR_BESTS_CACHE.get('s3')

    # 2. Compute personal bests for requested driver, gather laps
    personal_best_s1 = float('inf')
    personal_best_s2 = float('inf')
    personal_best_s3 = float('inf')
    team_name = "Unknown"

    driver_laps = []
    total_laps = simulator.SIM_TOTAL_LAPS

    for lap_num in range(1, total_laps + 1):
        entries = simulator.SIM_LAP_DATA.get(lap_num, [])
        entry = next((e for e in entries if e['driver'] == driver), None)
        if not entry:
            continue

        team_name = entry.get('team', "Unknown")
        s1 = entry.get('sector1')
        s2 = entry.get('sector2')
        s3 = entry.get('sector3')

        if s1 is not None and s1 > 0 and s1 < personal_best_s1:
            personal_best_s1 = s1
        if s2 is not None and s2 > 0 and s2 < personal_best_s2:
            personal_best_s2 = s2
        if s3 is not None and s3 > 0 and s3 < personal_best_s3:
            personal_best_s3 = s3

        driver_laps.append({
            "lap": lap_num,
            "lapTime": entry.get('lapTime'),
            "s1": s1,
            "s2": s2,
            "s3": s3,
            "compound": entry.get('compound', 'UNKNOWN'),
            "tyreAge": entry.get('tyreAge', 1),
            "pitStop": entry.get('pitStop', False)
        })

    personal_best_s1 = None if personal_best_s1 == float('inf') else personal_best_s1
    personal_best_s2 = None if personal_best_s2 == float('inf') else personal_best_s2
    personal_best_s3 = None if personal_best_s3 == float('inf') else personal_best_s3

    # 3. Flag each sector relative to personal and session bests
    # Tolerance for floating-point comparisons
    TOL = 1e-4

    for dl in driver_laps:
        s1, s2, s3 = dl["s1"], dl["s2"], dl["s3"]

        # S1 Flag
        if s1 is None:
            dl["s1Flag"] = "normal"
        elif session_best_s1 is not None and abs(s1 - session_best_s1) < TOL:
            dl["s1Flag"] = "session_best"
        elif personal_best_s1 is not None and abs(s1 - personal_best_s1) < TOL:
            dl["s1Flag"] = "personal_best"
        else:
            dl["s1Flag"] = "normal"

        # S2 Flag
        if s2 is None:
            dl["s2Flag"] = "normal"
        elif session_best_s2 is not None and abs(s2 - session_best_s2) < TOL:
            dl["s2Flag"] = "session_best"
        elif personal_best_s2 is not None and abs(s2 - personal_best_s2) < TOL:
            dl["s2Flag"] = "personal_best"
        else:
            dl["s2Flag"] = "normal"

        # S3 Flag
        if s3 is None:
            dl["s3Flag"] = "normal"
        elif session_best_s3 is not None and abs(s3 - session_best_s3) < TOL:
            dl["s3Flag"] = "session_best"
        elif personal_best_s3 is not None and abs(s3 - personal_best_s3) < TOL:
            dl["s3Flag"] = "personal_best"
        else:
            dl["s3Flag"] = "normal"

    return {
        "driver": driver,
        "team": team_name,
        "sessionBestS1": session_best_s1,
        "sessionBestS2": session_best_s2,
        "sessionBestS3": session_best_s3,
        "personalBestS1": personal_best_s1,
        "personalBestS2": personal_best_s2,
        "personalBestS3": personal_best_s3,
        "laps": driver_laps
    }


@panels_router.get("/api/panels/lap-times")
def get_lap_times(drivers: str):
    """
    Returns lap-by-lap lap times for up to 4 specified drivers.
    Used for LapComparison charts.
    """
    if not simulator.SIM_LAP_DATA:
        raise HTTPException(status_code=404, detail="No session or simulation data loaded")

    driver_list = [d.strip() for d in drivers.split(',') if d.strip()]
    laps_list = []
    total_laps = simulator.SIM_TOTAL_LAPS

    for lap_num in range(1, total_laps + 1):
        lap_row = {"lap": lap_num}
        any_present = False
        for d in driver_list:
            entry = next((e for e in simulator.SIM_LAP_DATA.get(lap_num, []) if e['driver'] == d), None)
            if entry and entry.get('lapTime') is not None:
                lap_row[d] = entry['lapTime']
                any_present = True
        if any_present:
            laps_list.append(lap_row)

    return {
        "laps": laps_list,
        "drivers": driver_list
    }


@panels_router.get("/api/panels/championship")
def get_championship(year: int = None, round: int = None):
    """
    Proxies Jolpica F1 API with caching for WDC and WCC standings.
    """
    if year is None:
        year = sess.CURRENT_SESSION_YEAR
    if round is None:
        round = sess.CURRENT_SESSION_ROUND

    if not year or not round:
        raise HTTPException(
            status_code=400,
            detail="Year and Round must be specified, or a session must be loaded."
        )

    cache_key = (year, round)
    if cache_key in CHAMP_CACHE:
        return CHAMP_CACHE[cache_key]

    try:
        # Jolpica F1 standings endpoints
        wdc_url = f"https://api.jolpi.ca/ergast/f1/{year}/{round}/driverStandings.json"
        wcc_url = f"https://api.jolpi.ca/ergast/f1/{year}/{round}/constructorStandings.json"

        wdc_res = requests.get(wdc_url, timeout=8)
        wdc_res.raise_for_status()
        wdc_data = wdc_res.json()

        wcc_res = requests.get(wcc_url, timeout=8)
        wcc_res.raise_for_status()
        wcc_data = wcc_res.json()

        # Parse WDC Standings
        wdc_list = []
        try:
            lists = wdc_data.get('MRData', {}).get('StandingsTable', {}).get('StandingsLists', [])
            if lists:
                standings = lists[0].get('DriverStandings', [])
                for item in standings:
                    d = item.get('Driver', {})
                    driver_name = f"{d.get('givenName', '')} {d.get('familyName', '')}".strip()
                    constructors = item.get('Constructors', [])
                    team_name = constructors[0].get('name', 'Unknown') if constructors else 'Unknown'
                    
                    wdc_list.append({
                        "pos": int(item['position']),
                        "driver": driver_name,
                        "code": d.get('code') or d.get('driverId', '')[:3].upper(),
                        "team": team_name,
                        "points": float(item['points']) if '.' in item['points'] else int(item['points']),
                        "wins": int(item['wins'])
                    })
        except Exception as pe:
            print(f"Error parsing driver standings: {pe}")

        # Parse WCC Standings
        wcc_list = []
        try:
            lists = wcc_data.get('MRData', {}).get('StandingsTable', {}).get('StandingsLists', [])
            if lists:
                standings = lists[0].get('ConstructorStandings', [])
                for item in standings:
                    c = item.get('Constructor', {})
                    wcc_list.append({
                        "pos": int(item['position']),
                        "team": c.get('name', ''),
                        "points": float(item['points']) if '.' in item['points'] else int(item['points']),
                        "wins": int(item['wins'])
                    })
        except Exception as pe:
            print(f"Error parsing constructor standings: {pe}")

        result = {
            "year": year,
            "round": round,
            "wdc": wdc_list,
            "wcc": wcc_list
        }
        CHAMP_CACHE[cache_key] = result
        return result

    except Exception as e:
        print(f"Error fetching standings for {year} round {round}: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Championship standings fetching failed: {str(e)}"
        )
