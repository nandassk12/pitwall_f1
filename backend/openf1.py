"""
openf1.py — OpenF1 REST API Client
Thin HTTP client for https://api.openf1.org/v1

Coverage: 2023 onwards only (historical data, no auth required).
All fetched data is cached in OPENF1_CACHE keyed by session_key
so repeated calls within a session never hit the network twice.

Exported helpers used by session.py:
  resolve_session_key(year, circuit_name, session_type) -> int | None
  fetch_race_control(session_key)                       -> list[dict]
"""

import requests
import logging

log = logging.getLogger(__name__)

OPENF1_BASE = "https://api.openf1.org/v1"

# Per-session_key response cache — cleared externally via clear_openf1_cache()
OPENF1_CACHE: dict = {}

# OpenF1 only has data from 2023 onwards
OPENF1_MIN_YEAR = 2023

# Map FastF1 short session codes → OpenF1 session_name strings
# OpenF1 uses: "Race", "Qualifying", "Sprint", "Sprint Qualifying",
#              "Practice 1", "Practice 2", "Practice 3"
_SESSION_TYPE_MAP = {
    "R":      "Race",
    "Q":      "Qualifying",
    "FP1":    "Practice 1",
    "FP2":    "Practice 2",
    "FP3":    "Practice 3",
    "Sprint": "Sprint",
    "SQ":     "Sprint Qualifying",
}

# Flag category → display badge colour (used by frontend)
FLAG_COLORS = {
    "YELLOW":       "#FFD600",
    "DOUBLE YELLOW": "#FFD600",
    "RED":          "#e10600",
    "GREEN":        "#00e676",
    "BLUE":         "#448aff",
    "BLACK":        "#555666",
    "CHEQUERED":    "#f5f5f7",
    "SAFETY CAR":   "#FF8F00",
    "VIRTUAL SAFETY CAR": "#FF8F00",
    "VSC ENDING":   "#FFB300",
    "DRS ENABLED":  "#00e5ff",
    "DRS DISABLED": "#888899",
    "CLEAR":        "#00e676",
    "MEDICAL CAR":  "#FF8F00",
}

DEFAULT_FLAG_COLOR = "#888899"


def clear_openf1_cache():
    """Wipes the in-memory OpenF1 response cache. Called from session.clear_session_cache()."""
    OPENF1_CACHE.clear()
    log.info("[OpenF1] Cache cleared")


def _get(endpoint: str, params: dict) -> list | None:
    """
    Internal GET wrapper. Returns parsed JSON list or None on any error.
    Timeout: 8s — OpenF1 is generally fast but we don't want to stall session load.
    """
    try:
        url = f"{OPENF1_BASE}/{endpoint}"
        resp = requests.get(url, params=params, timeout=8)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.Timeout:
        log.warning(f"[OpenF1] Timeout on /{endpoint} params={params}")
    except requests.exceptions.RequestException as e:
        log.warning(f"[OpenF1] Request error on /{endpoint}: {e}")
    except Exception as e:
        log.warning(f"[OpenF1] Unexpected error on /{endpoint}: {e}")
    return None


def resolve_session_key(year: int, circuit_name: str, session_type: str) -> int | None:
    """
    Resolves an OpenF1 session_key for a given FastF1 session.

    Args:
        year:         e.g. 2024
        circuit_name: FastF1 full EventName, e.g. "Monaco Grand Prix"
        session_type: FastF1 short code, e.g. "R", "Q", "FP1"

    Returns:
        Integer session_key if found, None otherwise.
        Always returns None for years before OPENF1_MIN_YEAR (2023).
    """
    if year < OPENF1_MIN_YEAR:
        log.info(f"[OpenF1] Year {year} < {OPENF1_MIN_YEAR} — skipping session_key resolution")
        return None

    openf1_session_name = _SESSION_TYPE_MAP.get(session_type)
    if not openf1_session_name:
        log.warning(f"[OpenF1] Unknown session_type '{session_type}' — cannot resolve session_key")
        return None

    # OpenF1 /sessions accepts year + session_name filtering
    sessions = _get("sessions", {"year": year, "session_name": openf1_session_name})
    if not sessions:
        log.warning(f"[OpenF1] No sessions returned for year={year} session_name={openf1_session_name}")
        return None

    # Match by circuit name — OpenF1 has country_name and circuit_short_name.
    # We normalise both sides to lowercase and check for substring containment
    # because FastF1 uses "Monaco Grand Prix" while OpenF1 uses "Monaco" / "Circuit de Monaco".
    circuit_lower = circuit_name.lower()

    for s in sessions:
        country   = str(s.get("country_name", "")).lower()
        circuit_sn = str(s.get("circuit_short_name", "")).lower()
        location  = str(s.get("location", "")).lower()

        # Match if any OpenF1 name token appears in the FastF1 circuit name or vice versa
        if (
            country   in circuit_lower or circuit_lower in country or
            circuit_sn in circuit_lower or circuit_lower in circuit_sn or
            location  in circuit_lower or circuit_lower in location
        ):
            sk = s.get("session_key")
            if sk:
                log.info(f"[OpenF1] Resolved session_key={sk} for {circuit_name} {year} {session_type}")
                return int(sk)

    log.warning(f"[OpenF1] Could not match circuit '{circuit_name}' in OpenF1 sessions for {year}")
    return None


def fetch_race_control(session_key: int) -> list[dict]:
    """
    Fetches and caches Race Control messages for a session.

    Returns a list of cleaned message dicts sorted by lap_number (ascending),
    with an added 'flagColor' field for frontend badge rendering.
    Returns [] on any error or cache miss.
    """
    if session_key is None:
        return []

    cache_key = f"rc_{session_key}"
    if cache_key in OPENF1_CACHE:
        log.info(f"[OpenF1] Race control cache hit for session_key={session_key}")
        return OPENF1_CACHE[cache_key]

    raw = _get("race_control", {"session_key": session_key})
    if not raw:
        log.warning(f"[OpenF1] No race control data returned for session_key={session_key}")
        OPENF1_CACHE[cache_key] = []
        return []

    messages = []
    for item in raw:
        flag     = str(item.get("flag") or "").upper().strip()
        category = str(item.get("category") or "").strip()

        # Determine badge label: prefer flag string, fall back to category
        badge = flag if flag and flag not in ("NONE", "") else category.upper()

        # Look up flag colour — try exact flag match, then category
        color = (
            FLAG_COLORS.get(flag) or
            FLAG_COLORS.get(category.upper()) or
            DEFAULT_FLAG_COLOR
        )

        drv_num = item.get("driver_number")
        messages.append({
            "lap":        item.get("lap_number"),
            "date":       str(item.get("date") or ""),
            "category":   category,
            "flag":       flag,
            "badge":      badge,
            "flagColor":  color,
            "message":    str(item.get("message") or "").strip(),
            "scope":      str(item.get("scope") or "").strip(),
            "sector":     item.get("sector"),
            "driverNumber": int(drv_num) if drv_num is not None else None,
        })

    # Sort by lap number ascending (None laps go to the top)
    messages.sort(key=lambda m: (m["lap"] is None, m["lap"] or 0))

    OPENF1_CACHE[cache_key] = messages
    log.info(f"[OpenF1] Fetched {len(messages)} race control messages for session_key={session_key}")
    return messages
