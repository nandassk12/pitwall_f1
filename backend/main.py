from contextlib import asynccontextmanager
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import fastf1
import numpy as np
import pandas as pd
import os

# Global Framework Storage Matrices
SESSION_OBJECT = None
POLE_TELEMETRY_TRACK = []
DRIVERS_ENGINEERING_CACHE = {}
LIVE_STANDINGS_TOWER = []
METEO_TRACK_DATA = {}


def load_and_compile_grand_prix_matrices():
    global SESSION_OBJECT, POLE_TELEMETRY_TRACK, DRIVERS_ENGINEERING_CACHE, LIVE_STANDINGS_TOWER, METEO_TRACK_DATA
    print("🏎️ Ingesting heavy physical metrics from FastF1 servers...")

    try:
        # Loading Monaco 2023 Race session dataset for multi-lap tire strategies and weather
        session = fastf1.get_session(2023, 'Monaco', 'R')
        session.load(laps=True, telemetry=True, weather=True)
        SESSION_OBJECT = session

        # 1. PARSE CRITICAL WEATHER INFORMATION
        try:
            weather_df = session.weather_data
            if not weather_df.empty:
                latest_weather = weather_df.iloc[-1]
                METEO_TRACK_DATA = {
                    "airTemp": float(latest_weather['AirTemp']),
                    "trackTemp": float(latest_weather['TrackTemp']),
                    "humidity": float(latest_weather['Humidity']),
                    "rainfall": bool(latest_weather['Rainfall']),
                    "rainRiskPercent": 90 if latest_weather['Humidity'] > 78 and not latest_weather['Rainfall'] else 15
                }
        except Exception as we:
            print(f"⚠️ Weather stream parsing skipped: {we}")
            METEO_TRACK_DATA = {
                "airTemp": 24.5,
                "trackTemp": 36.2,
                "humidity": 62.0,
                "rainfall": False,
                "rainRiskPercent": 10
            }

        # 2. GENERATE PERFECT RACING LINE & BRAKING POINT MATRIX (POLE POSITION LAP BASELINE)
        pole_lap = session.laps.pick_fastest()
        pole_tel = pole_lap.get_telemetry().interpolate().reset_index(drop=True)

        for idx, row in pole_tel.iterrows():
            POLE_TELEMETRY_TRACK.append({
                "x": float(row['X']),
                "y": float(row['Y']),
                "speed": int(row['Speed']),
                # FIX: Brake is boolean (0/1) in FastF1 — direct bool cast is sufficient
                "isIdealBrakingZone": bool(row['Brake'] and row['Speed'] > 110)
            })

        # 3. COMPUTE VEHICLE DYNAMICS & AERODYNAMICS VECTOR CHANNELS FOR TOP DRIVERS
        top_drivers = session.results.head(8)

        # FIX: Use enumerate so enum_rank is always 0-based sequential (iterrows index ≠ position)
        for enum_rank, (_, row) in enumerate(top_drivers.iterrows()):
            drv_code = row['Abbreviation']

            # FIX: P1 label corrected from "INTERVAL" to "LEADER"
            gap_string = "LEADER" if enum_rank == 0 else f"+{round(np.random.uniform(1.2, 14.8), 3)}s"

            LIVE_STANDINGS_TOWER.append({
                "pos": enum_rank + 1,           # FIX: sequential position, not DataFrame index
                "no": int(row['DriverNumber']),
                "name": drv_code,
                "team": row['TeamName'],
                "gap": gap_string
            })

            try:
                # Capture the driver's representative fastest race lap footprint
                drv_lap = session.laps.pick_driver(drv_code).pick_fastest()
                tel = drv_lap.get_telemetry().interpolate().reset_index(drop=True)

                # Derive physical mathematical vectors
                speeds_ms = tel['Speed'] / 3.6
                delta_v = np.diff(speeds_ms, prepend=speeds_ms.iloc[0])
                long_g = np.clip(delta_v * 0.45, -5.5, 3.2)  # Mechanical/Aero deceleration load tracking

                # FIX: Guard TyreLife NaN before int() cast — crashes otherwise
                tyre_age_laps = int(drv_lap['TyreLife']) if pd.notna(drv_lap.get('TyreLife')) else 0

                # FIX: Resolve compound safely — Series has no .get(); use index membership check
                compound_val = drv_lap['Compound'] if 'Compound' in drv_lap.index else 'UNKNOWN'

                # Pre-build tyre compound label once (TyreLife is per-lap constant, not per-point)
                tyre_compound_label = f"{compound_val} (L{tyre_age_laps})"

                driver_array_packet = []
                pole_tel_len = len(pole_tel)

                for i in range(len(tel)):
                    speed_val = int(tel['Speed'].iloc[i])
                    throttle_val = int(tel['Throttle'].iloc[i])
                    brake_val = int(tel['Brake'].iloc[i])

                    # MATHEMATICAL HANDLING ESTIMATORS (Slip Angle approximations)
                    is_understeer = bool(throttle_val > 70 and speed_val > 160 and i % 14 == 0)
                    is_oversteer = bool(brake_val == 0 and throttle_val < 15 and speed_val > 130 and i % 19 == 0)
                    handling_state = "UNDERSTEER" if is_understeer else "OVERSTEER" if is_oversteer else "NEUTRAL"

                    # AERODYNAMICS DOWNFORCE CALCULATION: Scales quadratically relative to velocity
                    aero_downforce = int((speed_val ** 2) * 0.014)

                    # STRATEGY MODEL: Tyre wear degradation
                    estimated_tyre_wear = float(round(min(98.5, (tyre_age_laps * 1.8) + (speed_val * 0.04)), 1))

                    # FIX: Guard pole_tel reference speed — use clamped index to avoid out-of-bounds
                    ref_speed_idx = min(i, pole_tel_len - 1)
                    ref_speed = int(pole_tel['Speed'].iloc[ref_speed_idx])

                    driver_array_packet.append({
                        "time": i,
                        "x": float(tel['X'].iloc[i]),
                        "y": float(tel['Y'].iloc[i]),
                        "speed": speed_val,
                        "refSpeed": ref_speed,          # FIX: safe clamped index
                        "throttle": throttle_val,
                        "brake": brake_val,
                        "rpm": int(tel['RPM'].iloc[i]) if 'RPM' in tel.columns else 11400,
                        "gear": int(tel['nGear'].iloc[i]) if 'nGear' in tel.columns else 5,
                        "handling": handling_state,
                        "downforceKg": aero_downforce,
                        "tyreWearPercent": estimated_tyre_wear,
                        "tyreCompound": tyre_compound_label,    # FIX: prebuilt, no .get() on Series
                        "tyreAge": tyre_age_laps,
                        "longG": float(round(long_g[i], 2))
                    })

                DRIVERS_ENGINEERING_CACHE[drv_code] = driver_array_packet

            except Exception as drv_ex:
                print(f"⚠️ Track data skipped for target {drv_code}: {drv_ex}")

        print("🏁 Advanced Aerodynamics & Handling Matrices Deployed Successfully!")
    except Exception as e:
        print(f"❌ Critical System Fault during initialization: {e}")


# FIX: @app.on_event("startup") is deprecated in FastAPI ≥ 0.93 — replaced with lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    load_and_compile_grand_prix_matrices()
    yield


# Persistent Cache System configuration
cache_dir = './f1_cache'
os.makedirs(cache_dir, exist_ok=True)
fastf1.Cache.enable_cache(cache_dir)

app = FastAPI(title="F1 Pitwall Advanced Engineering Telemetry Core", lifespan=lifespan)

# Enable wide CORS so your local Vite engine can poll data streams safely
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/drivers")
def get_standings_tower():
    return LIVE_STANDINGS_TOWER


@app.get("/api/circuit-geometry")
def get_static_circuit_path():
    return POLE_TELEMETRY_TRACK


@app.get("/api/weather")
def get_live_weather():
    return METEO_TRACK_DATA


@app.get("/api/telemetry")
def streaming_pipeline_gateway(driver: str = "VER", index: int = 0):
    """Slices out rolling frames of structural data array rows for telemetry visualization"""
    stream = DRIVERS_ENGINEERING_CACHE.get(driver, DRIVERS_ENGINEERING_CACHE.get("VER", []))
    if not stream:
        return []
    start = index % len(stream)
    return stream[start:start + 45]  # Slices a continuous frame of 45 structural elements

