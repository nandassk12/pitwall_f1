"""
cache_check.py

Decides: serve from Supabase, or fetch fresh from FastF1/OpenF1?

This sits in front of every session-dependent endpoint. Call
get_or_fetch_session() at the top of any route that needs session
data (laps, telemetry, results, etc.) before doing anything else.

Flow:
  1. Look up (year, round, sessionType) in the `sessions` table.
  2. Found  -> return the existing session_id. Caller reads from
              Supabase as normal. FastF1/OpenF1 never touched.
  3. Not found -> trigger ingest_session() (the FastF1/OpenF1 fetch +
              transform + write script), then return the new session_id.
"""

from datetime import date
from supabase import create_client, Client
import os

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]  # server-side only, never in frontend

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

MIN_YEAR = 2018  # site-wide rule: nothing before 2018, from either source


class SessionNotAvailable(Exception):
    """Raised when the requested session is outside the supported range
    or doesn't exist on the calendar at all."""
    pass


def get_or_fetch_session(year: int, round_: int, session_type: str) -> int:
    """
    Returns the Supabase `sessions.id` for the given session, fetching
    and caching it first if it isn't already stored.

    year:         e.g. 2023
    round_:       round number within that season
    session_type: "FP1" | "FP2" | "FP3" | "Q" | "R"
    """
    if year < MIN_YEAR:
        raise SessionNotAvailable(
            f"Telemetry/session data is only available from {MIN_YEAR} onward."
        )

    # 1. Check Supabase first — this is the cache hit path
    existing = (
        supabase.table("sessions")
        .select("id")
        .eq("year", year)
        .eq("round", round_)
        .eq("sessionType", session_type)
        .maybe_single()
        .execute()
    )

    if existing.data:
        # Cache hit — FastF1/OpenF1 never gets called
        return existing.data["id"]

    # 2. Cache miss — figure out which source covers this year
    source = "openf1" if year >= 2023 else "fastf1"

    # 3. Make sure this session has actually happened (don't fetch
    #    sessions that haven't run yet)
    scheduled_session = (
        supabase.table("event_sessions")
        .select("time, events!inner(year, round)")
        .eq("events.year", year)
        .eq("events.round", round_)
        .execute()
    )

    if not scheduled_session.data:
        raise SessionNotAvailable(
            f"No session found for {year} round {round_}."
        )

    session_time = scheduled_session.data[0]["time"]
    if session_time and session_time > date.today().isoformat():
        raise SessionNotAvailable(
            "This session hasn't happened yet — nothing to fetch."
        )

    # 4. Trigger the actual ingestion (separate script, imported here)
    from ingest_session import ingest_session

    session_id = ingest_session(year=year, round_=round_,
                                 session_type=session_type, source=source)

    return session_id
