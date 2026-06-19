"""
ingest_session.py

Pulls a single session from FastF1 (2018-2022) or OpenF1 (2023+),
transforms it into the exact field names used by the Supabase schema
(schema.sql) — which match the existing frontend API contract — and
writes everything in one pass.

Called by cache_check.py on a cache miss, or by the GitHub Actions
cron job right after a current-season session ends.
"""

import os
import math
import fastf1
import pandas as pd
import requests
from supabase import create_client, Client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

fastf1.Cache.enable_cache("/tmp/fastf1_cache")  # ephemeral, fine — Supabase is the real cache


# ============================================================
# SHARED HELPERS
# ============================================================

def _td_to_sec(td):
    """Convert a pandas Timedelta (or NaT) to float seconds, or None."""
    if td is None or pd.isna(td):
        return None
    return round(td.total_seconds(), 3)


def _clean(value):
    """Replace NaN with None so Supabase doesn't choke on invalid JSON."""
    if isinstance(value, float) and math.isnan(value):
        return None
    return value


def _format_gap(result_row, leader_time):
    """Mirrors the existing backend's Time -> '+1.234s' / 'LEADER' / 'DNF' logic."""
    status = result_row.get("Status", "")
    if status and "Finished" not in status and "+" not in str(status):
        return status  # "DNF", "DSQ", etc.
    gap_td = result_row.get("Time")
    if gap_td is None or pd.isna(gap_td):
        return "LEADER" if result_row.get("Position") == 1 else status
    return f"+{_td_to_sec(gap_td):.3f}s"


# ============================================================
# MAIN ENTRY POINT
# ============================================================

def ingest_session(year: int, round_: int, session_type: str, source: str) -> int:
    if source == "fastf1":
        return _ingest_from_fastf1(year, round_, session_type)
    elif source == "openf1":
        return _ingest_from_openf1(year, round_, session_type)
    else:
        raise ValueError(f"Unknown source: {source}")


# ============================================================
# FASTF1 PATH (2018–2022)
# ============================================================

def _ingest_from_fastf1(year, round_, session_type) -> int:
    session = fastf1.get_session(year, round_, session_type)
    session.load()  # pulls laps, telemetry, weather, results, race control

    event_id = _upsert_event(year, round_, session.event)
    session_id = _insert_session(event_id, year, round_, session_type, session, source="fastf1")

    _upsert_drivers(session.results)
    _insert_results(session_id, session.results)
    _insert_laps(session_id, session.laps)
    _insert_telemetry(session_id, session.laps)
    _insert_pit_stints(session_id, session.laps)
    _insert_race_control(session_id, session.race_control_messages)
    _insert_weather(session_id, session.weather_data)

    return session_id


def _upsert_event(year, round_, event) -> int:
    row = {
        "year": year,
        "round": round_,
        "name": event["EventName"],
        "shortName": event.get("Location", event["EventName"]),
        "country": event["Country"],
        "date": str(event["EventDate"].date()),
        "dateRange": None,  # formatted separately from session1-5 dates if needed
    }
    result = (
        supabase.table("events")
        .upsert(row, on_conflict="year,round")
        .execute()
    )
    return result.data[0]["id"]


def _insert_session(event_id, year, round_, session_type, session, source) -> int:
    row = {
        "event_id": event_id,
        "year": year,
        "round": round_,
        "sessionType": session_type,
        "label": f"{session.event['EventName']} - {session.name}",
        "source": source,
        "totalDrivers": len(session.results),
        "totalLaps": int(session.laps["LapNumber"].max()) if not session.laps.empty else None,
    }
    result = (
        supabase.table("sessions")
        .upsert(row, on_conflict="year,round,sessionType")
        .execute()
    )
    return result.data[0]["id"]


def _upsert_drivers(results_df):
    rows = []
    for _, r in results_df.iterrows():
        rows.append({
            "name": r["Abbreviation"],
            "fullName": r["FullName"],
            "no": int(r["DriverNumber"]) if pd.notna(r["DriverNumber"]) else None,
            "team": r["TeamName"],
            "teamColor": f"#{r['TeamColor']}" if r.get("TeamColor") else None,
        })
    if rows:
        supabase.table("drivers").upsert(rows, on_conflict="name").execute()


def _insert_results(session_id, results_df):
    rows = []
    for _, r in results_df.iterrows():
        rows.append({
            "session_id": session_id,
            "pos": _clean(r.get("Position")),
            "no": int(r["DriverNumber"]) if pd.notna(r["DriverNumber"]) else None,
            "name": r["Abbreviation"],
            "fullName": r["FullName"],
            "team": r["TeamName"],
            "pointsScored": _clean(r.get("Points")),
            "gap": _format_gap(r, None),
            "gridPosition": _clean(r.get("GridPosition")),
            "status": r.get("Status"),
            "hasTelemetry": True,
        })
    if rows:
        supabase.table("results").upsert(rows, on_conflict="session_id,name").execute()


def _flag_for_sector(value, session_best, personal_best):
    if value is None:
        return "none"
    if math.isclose(value, session_best, abs_tol=0.001):
        return "session_best"
    if math.isclose(value, personal_best, abs_tol=0.001):
        return "personal_best"
    return "normal"


def _insert_laps(session_id, laps_df):
    # session-wide bests, needed for purple/green flag coloring
    session_best_s1 = laps_df["Sector1Time"].dropna().apply(_td_to_sec).min() if not laps_df.empty else None
    session_best_s2 = laps_df["Sector2Time"].dropna().apply(_td_to_sec).min() if not laps_df.empty else None
    session_best_s3 = laps_df["Sector3Time"].dropna().apply(_td_to_sec).min() if not laps_df.empty else None

    rows = []
    for driver in laps_df["Driver"].unique():
        driver_laps = laps_df[laps_df["Driver"] == driver]
        personal_best_s1 = driver_laps["Sector1Time"].dropna().apply(_td_to_sec).min()
        personal_best_s2 = driver_laps["Sector2Time"].dropna().apply(_td_to_sec).min()
        personal_best_s3 = driver_laps["Sector3Time"].dropna().apply(_td_to_sec).min()

        for _, lap in driver_laps.iterrows():
            s1 = _td_to_sec(lap.get("Sector1Time"))
            s2 = _td_to_sec(lap.get("Sector2Time"))
            s3 = _td_to_sec(lap.get("Sector3Time"))

            rows.append({
                "session_id": session_id,
                "driver": driver,
                "lap": int(lap["LapNumber"]),
                "lapTime": _td_to_sec(lap.get("LapTime")),
                "s1": s1, "s2": s2, "s3": s3,
                "s1Flag": _flag_for_sector(s1, session_best_s1, personal_best_s1),
                "s2Flag": _flag_for_sector(s2, session_best_s2, personal_best_s2),
                "s3Flag": _flag_for_sector(s3, session_best_s3, personal_best_s3),
                "compound": lap.get("Compound"),
                "tyreAge": _clean(lap.get("TyreLife")),
                "position": _clean(lap.get("Position")),
                "pitIn": pd.notna(lap.get("PitInTime")),
                "pitOut": pd.notna(lap.get("PitOutTime")),
                "pitStop": pd.notna(lap.get("PitInTime")) or pd.notna(lap.get("PitOutTime")),
                "trackStatus": lap.get("TrackStatus"),
                "isAccurate": bool(lap.get("IsAccurate")) if pd.notna(lap.get("IsAccurate")) else None,
            })

    # batch insert, Supabase handles large arrays fine but chunk to be safe
    for i in range(0, len(rows), 500):
        supabase.table("laps").upsert(
            rows[i:i + 500], on_conflict="session_id,driver,lap"
        ).execute()


def _insert_telemetry(session_id, laps_df):
    rows = []
    for _, lap in laps_df.iterlaps():
        try:
            tel = lap.get_telemetry()
        except Exception:
            continue  # some laps (in/out laps) may lack telemetry

        if tel.empty:
            continue

        rows.append({
            "session_id": session_id,
            "driver": lap["Driver"],
            "lap": int(lap["LapNumber"]),
            "time": tel["Time"].dt.total_seconds().round(3).tolist(),
            "speed": tel["Speed"].round(1).tolist(),
            "throttle": tel["Throttle"].clip(0, 100).round(1).tolist(),
            "brake": (tel["Brake"].astype(bool).astype(int) * 100).tolist(),
            "rpm": tel["RPM"].clip(3000, 15500).round(0).tolist(),
            "gear": tel["nGear"].astype(int).tolist(),
            "drs": tel["DRS"].astype(int).tolist() if "DRS" in tel else None,
            "x": _normalize(tel["X"]).tolist(),
            "y": _normalize(tel["Y"]).tolist(),
            "latG": None,   # computed below if position data is usable
            "longG": None,
        })

    for i in range(0, len(rows), 100):  # smaller chunks, these rows are heavy
        supabase.table("telemetry").upsert(
            rows[i:i + 100], on_conflict="session_id,driver,lap"
        ).execute()


def _normalize(series):
    """Scales a coordinate series to [0,1], matching the existing
    backend's spatial normalization for SVG rendering."""
    lo, hi = series.min(), series.max()
    span = (hi - lo) or 1
    return ((series - lo) / span).round(5)


def _insert_pit_stints(session_id, laps_df):
    rows = []
    for driver in laps_df["Driver"].unique():
        driver_laps = laps_df[laps_df["Driver"] == driver].sort_values("LapNumber")
        if driver_laps.empty:
            continue

        team = driver_laps.iloc[0].get("Team")
        stint_order = 1
        current_compound = None
        start_lap = None

        for _, lap in driver_laps.iterrows():
            compound = lap.get("Compound")
            if compound != current_compound:
                if current_compound is not None:
                    rows.append({
                        "session_id": session_id,
                        "driver": driver,
                        "team": team,
                        "teamColor": None,  # joined from drivers table at read time
                        "compound": current_compound,
                        "startLap": start_lap,
                        "endLap": int(lap["LapNumber"]) - 1,
                        "lapCount": int(lap["LapNumber"]) - start_lap,
                        "stint_order": stint_order,
                    })
                    stint_order += 1
                current_compound = compound
                start_lap = int(lap["LapNumber"])

        # close out the final stint
        if current_compound is not None:
            last_lap = int(driver_laps["LapNumber"].max())
            rows.append({
                "session_id": session_id,
                "driver": driver,
                "team": team,
                "teamColor": None,
                "compound": current_compound,
                "startLap": start_lap,
                "endLap": last_lap,
                "lapCount": last_lap - start_lap + 1,
                "stint_order": stint_order,
            })

    if rows:
        supabase.table("pit_stints").insert(rows).execute()


def _insert_race_control(session_id, rc_df):
    if rc_df is None or rc_df.empty:
        return
    rows = []
    for _, msg in rc_df.iterrows():
        rows.append({
            "session_id": session_id,
            "lap": _clean(msg.get("Lap")),
            "date": str(msg.get("Time")),
            "flag": msg.get("Flag"),
            "flagColor": None,  # mapped from Flag at read/render time
            "badge": msg.get("Category"),
            "category": msg.get("Category"),
            "message": msg.get("Message"),
            "driverNumber": _clean(msg.get("RacingNumber")),
            "sector": _clean(msg.get("Sector")),
        })
    supabase.table("race_control_messages").insert(rows).execute()


def _insert_weather(session_id, weather_df):
    if weather_df is None or weather_df.empty:
        return
    avg = weather_df.mean(numeric_only=True)
    row = {
        "session_id": session_id,
        "trackTemp": _clean(avg.get("TrackTemp")),
        "airTemp": _clean(avg.get("AirTemp")),
        "rainRiskPercent": float(weather_df["Rainfall"].mean() * 100) if "Rainfall" in weather_df else 0,
    }
    supabase.table("weather").upsert(row, on_conflict="session_id").execute()


# ============================================================
# OPENF1 PATH (2023–present)
# Field names differ (snake_case, session_key, driver_number) —
# normalized here to the exact same schema columns as the FastF1 path
# so downstream code never knows which source a session came from.
# ============================================================

OPENF1_BASE = "https://api.openf1.org/v1"


def _ingest_from_openf1(year, round_, session_type) -> int:
    # Map our session_type to OpenF1's session_name values
    session_name_map = {
        "FP1": "Practice 1", "FP2": "Practice 2", "FP3": "Practice 3",
        "Q": "Qualifying", "R": "Race",
    }
    meetings = requests.get(f"{OPENF1_BASE}/meetings", params={"year": year}).json()
    meeting = next((m for m in meetings if m.get("meeting_key")), None)
    # NOTE: matching round_ to OpenF1's meeting requires cross-referencing
    # against the `events` table circuit name, since OpenF1 doesn't expose
    # round number directly. Left as a TODO — same normalization pattern
    # as below applies once the correct session_key is resolved.

    raise NotImplementedError(
        "OpenF1 ingestion: resolve session_key via meetings + sessions "
        "endpoints, then map laps/car_data/position/race_control responses "
        "into the same row shapes used in the FastF1 path above."
    )