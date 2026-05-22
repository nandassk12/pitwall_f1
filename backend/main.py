from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import fastf1
import pandas as pd
import os

app = FastAPI(title="F1Pitwall Core")

# Enable CORS so our frontend can read data safely
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup a clean cache folder inside the container workspace
cache_dir = './f1_cache'
os.makedirs(cache_dir, exist_ok=True)
fastf1.Cache.enable_cache(cache_dir)

@app.get("/api/test")
def test_pipeline():
    try:
        # Pull a tiny, historical session dataset (Monaco 2023 Qualifying)
        session = fastf1.get_session(2023, 'Monaco', 'Q')
        session.load(laps=True, telemetry=True, weather=False)
        
        # Extract the fastest lap for Max Verstappen
        fastest_lap = session.laps.pick_driver('VER').pick_fastest()
        telemetry_matrix = fastest_lap.get_telemetry().iloc[:10] # Take first 10 rows
        
        return {
            "status": "connected",
            "system": "Linux-to-Windows-Bridge-OK",
            "driver": "VER",
            "lap_time": str(fastest_lap.LapTime),
            "telemetry_sample": telemetry_matrix[['Speed', 'RPM', 'Throttle']].to_dict(orient="records")
        }
    except Exception as e:
        return {"status": "failed", "error": str(e)}
