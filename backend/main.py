from contextlib import asynccontextmanager
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import fastf1
import os
import psutil

# Import all live state from session module — shared references to the same
# mutable dicts/lists so mutations in session.py are visible here instantly.
import session as sess
from session import session_router
from circuits import circuits_router
from simulator import sim_router
from panels import panels_router
from charts import charts_router
from analytics_routes import analytics_router
from news_routes import news_router
from next_race_routes import next_race_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # On startup: enable disk cache only — no hardcoded session auto-load.
    # First load happens when the user selects a session via SessionSelector.
    cache_dir = './f1_cache'
    os.makedirs(cache_dir, exist_ok=True)
    fastf1.Cache.enable_cache(cache_dir)
    print("[Core] F1 Pitwall ready - awaiting session selection via dashboard")
    yield

app = FastAPI(title="F1 Pitwall Advanced Engineering Telemetry Core", lifespan=lifespan)

# Enable CORS so the Vite dev server (port 3000) can reach this API (port 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the dynamic session router (years / calendar / types / load endpoints)
app.include_router(session_router)

# Mount the circuit geometry + multi-driver positions router
app.include_router(circuits_router)

# Mount the race simulation engine router
app.include_router(sim_router)

# Mount the session analysis panels router
app.include_router(panels_router)

# Mount the advanced charts router
app.include_router(charts_router)

# Mount the analytics router
app.include_router(analytics_router)

app.include_router(news_router)
app.include_router(next_race_router)


# ── Status ────────────────────────────────────────────────────────────────────

@app.get("/api/status")
def get_status():
    """Lightweight heartbeat — poll at most every 5 seconds from frontend."""
    process = psutil.Process(os.getpid())
    mem_mb  = process.memory_info().rss / 1024 / 1024
    return {
        "sessionLoaded":  sess.SESSION_OBJECT is not None,
        "currentSession": sess.CURRENT_SESSION_LABEL,
        "loading":        sess.SESSION_LOADING,
        "memoryMB":       round(mem_mb, 1),
        "year":           sess.CURRENT_SESSION_YEAR,
        "circuit":        sess.CURRENT_SESSION_CIRCUIT,
        "sessionType":    sess.CURRENT_SESSION_TYPE,
    }


# ── Telemetry data endpoints ──────────────────────────────────────────────────

@app.get("/api/drivers")
def get_standings_tower():
    return sess.LIVE_STANDINGS_TOWER


@app.get("/api/circuit-geometry")
def get_static_circuit_path():
    return sess.POLE_TELEMETRY_TRACK


@app.get("/api/weather")
def get_live_weather():
    return sess.METEO_TRACK_DATA


@app.get("/api/race-control")
def get_race_control():
    """Returns pre-fetched OpenF1 Race Control messages for the loaded session.
    Available for 2023+ sessions only. Returns empty list for earlier years
    or if the OpenF1 session_key could not be resolved."""
    return {
        "sessionKey":  sess.OPENF1_SESSION_KEY,
        "available":   len(sess.RACE_CONTROL_MESSAGES) > 0,
        "messages":    sess.RACE_CONTROL_MESSAGES,
        "totalMessages": len(sess.RACE_CONTROL_MESSAGES),
    }


@app.get("/api/telemetry")
def streaming_pipeline_gateway(driver: str = "VER", index: int = 0):
    """Slices a rolling 45-point frame from the driver's pre-cached telemetry array.
    Wraps around end-of-stream so the chart always has data regardless of index."""
    cache = sess.DRIVERS_ENGINEERING_CACHE
    if not cache:
        return {"frames": [], "nextIndex": 0}
    # Fall back to first cached driver if requested driver not yet loaded
    stream = cache.get(driver) or cache.get(next(iter(cache), None), [])
    if not stream:
        return {"frames": [], "nextIndex": 0}
    n     = len(stream)
    start = index % n
    end   = start + 45
    window = 45
    next_idx = (index + window) % n
    if end <= n:
        frames_list = stream[start:end]
    else:
        # Wrap around: combine tail + head to always return exactly 45 points
        frames_list = stream[start:] + stream[:end - n]
    return {"frames": frames_list, "nextIndex": next_idx}


@app.get("/api/telemetry/multi")
def get_multi_telemetry(
    drivers: list[str] = Query(...),   # e.g. ?drivers=VER&drivers=HAM
    index:   int = 0,
    window:  int = 45,
):
    """
    Returns a rolling telemetry window for up to 4 drivers simultaneously.
    Used by the lap comparison / overlay chart.

    Response shape:
    {
      "VER": {"speed": [...], "throttle": [...], "brake": [...],
              "rpm": [...], "gear": [...], "teamColor": "#3671C6"},
      "HAM": { ... },
      ...
    }
    """
    from simulator import TEAM_COLORS
    result   = {}
    cache    = sess.DRIVERS_ENGINEERING_CACHE
    standings = sess.LIVE_STANDINGS_TOWER
    team_lookup = {s['name']: s['team'] for s in standings}

    for code in drivers[:4]:   # hard cap at 4
        frames = cache.get(code)
        if not frames:
            continue
        n     = len(frames)
        start = index % n
        end   = start + window
        if end <= n:
            slice_ = frames[start:end]
        else:
            slice_ = frames[start:] + frames[:end - n]

        team  = team_lookup.get(code, '')
        color = TEAM_COLORS.get(team, '#888899')

        result[code] = {
            "speed":     [f.get('speed',    0) for f in slice_],
            "throttle":  [f.get('throttle', 0) for f in slice_],
            "brake":     [f.get('brake',    0) for f in slice_],
            "rpm":       [f.get('rpm',      0) for f in slice_],
            "gear":      [f.get('gear',     0) for f in slice_],
            "teamColor": color,
        }

    return result
