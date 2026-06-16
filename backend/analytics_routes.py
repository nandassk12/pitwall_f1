from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import analytics
import session as sess

analytics_router = APIRouter()

@analytics_router.get("/api/analytics/power")
def get_power(driver: str):
    result = analytics.ANALYTICS_CACHE.get('power', {}).get(driver)
    if not result:
        raise HTTPException(404, f"No power data for {driver}")
    return result

@analytics_router.get("/api/analytics/power/all")
def get_power_all():
    return analytics.ANALYTICS_CACHE.get('power', {})

@analytics_router.get("/api/analytics/race-pace")
def get_race_pace(threshold: float = Query(5.0, ge=0.0, le=15.0)):
    # Re-compute with custom threshold if different from cached
    cached = analytics.ANALYTICS_CACHE.get('race_pace', [])
    if threshold == 5.0:
        return cached
    # Recompute on demand with custom threshold
    try:
        return analytics.compute_race_pace(threshold_pct=threshold)
    except Exception as e:
        raise HTTPException(500, str(e))

@analytics_router.get("/api/analytics/dominance")
def get_dominance(segments: int = Query(0, ge=0, le=50)):
    # Return cached result (computed at session load)
    cached = analytics.ANALYTICS_CACHE.get('dominance')
    if segments == 0 and cached and cached.get('segments'):
        return cached
    # Recompute on demand if cache miss or different segment count
    try:
        result = analytics.compute_segment_dominance(n_segments=segments)
        if segments == 0:
            analytics.ANALYTICS_CACHE['dominance'] = result
        return result
    except Exception as e:
        raise HTTPException(500, str(e))

@analytics_router.get("/api/analytics/teammate-gaps")
def get_teammate_gaps():
    return analytics.ANALYTICS_CACHE.get('teammate_gaps', [])

@analytics_router.get("/api/analytics/aero/scatter")
def get_aero_scatter():
    # Returns Cd vs Cl scatter data for all drivers
    power = analytics.ANALYTICS_CACHE.get('power', {})
    
    # Proactively resolve team name from standings tower for accuracy
    standings = getattr(sess, 'LIVE_STANDINGS_TOWER', [])
    team_map = {entry['name']: entry['team'] for entry in standings if 'name' in entry and 'team' in entry}
    
    return [
        {
            "driver": drv,
            "team": team_map.get(drv, data.get("team", "")),
            "cd": data.get("cdActual"),
            "cl": data.get("clActual"),
            "aeroEfficiency": data.get("aeroEfficiency"),
            "peakDownforceKg": data.get("peakDownforceKg"),
        }
        for drv, data in power.items()
        if data.get("cdActual")
    ]
