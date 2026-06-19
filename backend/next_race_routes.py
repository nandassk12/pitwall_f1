import requests
import time
from fastapi import APIRouter
from datetime import datetime, timezone

next_race_router = APIRouter()

_next_race_cache = {}
_next_race_cache_time = 0
NEXT_RACE_TTL = 3600   # 1 hour

@next_race_router.get("/api/next-race")
def get_next_race():
    """
    Returns next upcoming F1 session from OpenF1 /sessions endpoint.
    Falls back to Jolpica/Ergast if OpenF1 returns nothing upcoming.
    """
    global _next_race_cache, _next_race_cache_time

    now = time.time()
    if _next_race_cache and (now - _next_race_cache_time) < NEXT_RACE_TTL:
        return _next_race_cache

    result = {
        "eventName":    None,
        "sessionName":  None,
        "circuitName":  None,
        "country":      None,
        "dateStart":    None,
        "round":        None,
        "year":         None,
        "countdownMs":  None,
    }

    try:
        current_year = datetime.now(timezone.utc).year
        resp = requests.get(
            "https://api.openf1.org/v1/sessions",
            params={"year": current_year},
            timeout=10,
        )
        if resp.status_code == 200:
            sessions = resp.json()
            
            # Group sessions by meeting_key to find the earliest start time for each meeting
            meeting_starts = {}
            for s in sessions:
                m_key = s.get("meeting_key")
                if not m_key:
                    continue
                # Exclude pre-season testing (e.g. session names with Day, February dates, or containing testing)
                s_name = s.get("session_name", "")
                date_start = s.get("date_start", "")
                if "Day" in s_name or "-02-" in date_start or "testing" in s_name.lower():
                    continue
                
                if m_key not in meeting_starts:
                    meeting_starts[m_key] = date_start
                else:
                    if date_start < meeting_starts[m_key]:
                        meeting_starts[m_key] = date_start
            
            # Sort meeting keys chronologically by start date to determine 1-based round index
            sorted_meeting_keys = sorted(meeting_starts.keys(), key=lambda k: meeting_starts[k])

            now_iso = datetime.now(timezone.utc).isoformat()
            upcoming = [
                s for s in sessions
                if s.get("date_start", "") > now_iso
            ]
            upcoming.sort(key=lambda s: s.get("date_start", ""))
            if upcoming:
                nxt = upcoming[0]
                m_key = nxt.get("meeting_key")
                
                resolved_round = m_key
                if m_key in sorted_meeting_keys:
                    resolved_round = sorted_meeting_keys.index(m_key) + 1

                # Resolve the clean event name using FastF1's schedule where possible
                country = nxt.get("country_name", "")
                location = nxt.get("location", "")
                resolved_name = ""
                
                try:
                    import fastf1
                    schedule = fastf1.get_event_schedule(current_year, include_testing=False)
                    matches = schedule[schedule["Country"].str.lower() == country.lower()]
                    if matches.empty:
                        matches = schedule[schedule["Location"].str.lower() == location.lower()]
                    
                    if not matches.empty:
                        if len(matches) == 1:
                            resolved_name = matches.iloc[0]["EventName"]
                        else:
                            # If there are multiple matches (e.g., USA or Spain), check location substring
                            for _, row in matches.iterrows():
                                row_loc = str(row.get("Location", "")).lower()
                                row_name = str(row.get("EventName", "")).lower()
                                loc_lower = location.lower()
                                if loc_lower in row_loc or row_loc in loc_lower or loc_lower in row_name:
                                    resolved_name = row["EventName"]
                                    break
                            if not resolved_name:
                                resolved_name = matches.iloc[0]["EventName"]
                except Exception as ex:
                    print(f"[NextRace] FastF1 EventName lookup failed: {ex}")
                
                if not resolved_name:
                    resolved_name = f"{country} Grand Prix" if country else "Grand Prix"

                date_start = nxt.get("date_start")
                dt = datetime.fromisoformat(date_start.replace("Z", "+00:00"))
                countdown_ms = int((dt - datetime.now(timezone.utc)).total_seconds() * 1000)
                result.update({
                    "eventName":   resolved_name,
                    "sessionName": nxt.get("session_name", ""),
                    "circuitName": nxt.get("circuit_short_name", ""),
                    "country":     country,
                    "dateStart":   date_start,
                    "round":       resolved_round,
                    "year":        current_year,
                    "countdownMs": max(0, countdown_ms),
                })
    except Exception as e:
        print(f"[NextRace] OpenF1 fetch failed: {e}")

    _next_race_cache = result
    _next_race_cache_time = now
    return result
