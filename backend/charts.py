from fastapi import APIRouter, HTTPException
import session as sess
import simulator

charts_router = APIRouter()


@charts_router.get("/api/chart/speed")
def get_chart_speed(driver: str):
    """
    Returns velocity curve overlay vs pole baseline for the driver's fastest lap.
    """
    cache = sess.DRIVERS_ENGINEERING_CACHE
    if not cache or driver not in cache:
        raise HTTPException(status_code=404, detail=f"No telemetry cache available for driver {driver}")

    stream = cache[driver]
    return [
        {
            "time": p["time"],
            "speed": p["speed"],
            "refSpeed": p["refSpeed"]
        }
        for p in stream
    ]


@charts_router.get("/api/chart/throttle")
def get_chart_throttle(driver: str):
    """
    Returns mechanical throttle and brake inputs for the driver's fastest lap.
    """
    cache = sess.DRIVERS_ENGINEERING_CACHE
    if not cache or driver not in cache:
        raise HTTPException(status_code=404, detail=f"No telemetry cache available for driver {driver}")

    stream = cache[driver]
    return [
        {
            "time": p["time"],
            "throttle": p["throttle"],
            "brake": p["brake"]
        }
        for p in stream
    ]


@charts_router.get("/api/chart/tyres")
def get_chart_tyres(driver: str):
    """
    Returns tyre wear degradation saw-tooth history across all race laps.
    """
    if not simulator.SIM_LAP_DATA:
        raise HTTPException(status_code=404, detail="No session or simulation data loaded")

    laps_data = []
    total_laps = simulator.SIM_TOTAL_LAPS

    for lap_num in range(1, total_laps + 1):
        entries = simulator.SIM_LAP_DATA.get(lap_num, [])
        entry = next((e for e in entries if e['driver'] == driver), None)
        if entry:
            comp = entry.get('compound', 'UNKNOWN')
            age = entry.get('tyreAge', 1)

            # Sawtooth tyre wear simulation based on compound and age
            factor = 2.2 if comp == "SOFT" else 1.5 if comp == "MEDIUM" else 1.0 if comp == "HARD" else 1.8
            wear = min(98.5, age * factor)

            laps_data.append({
                "lap": lap_num,
                "tyreWear": round(wear, 1),
                "tyreAge": age,
                "compound": comp
            })

    return laps_data


@charts_router.get("/api/chart/gforce")
def get_chart_gforce(driver: str):
    """
    Returns longitudinal and lateral G-force measurements for the driver's fastest lap.
    """
    cache = sess.DRIVERS_ENGINEERING_CACHE
    if not cache or driver not in cache:
        raise HTTPException(status_code=404, detail=f"No telemetry cache available for driver {driver}")

    stream = cache[driver]
    return [
        {
            "time": p["time"],
            "longG": p["longG"],
            "latG": p.get("latG", 0.0),
            "speed": p["speed"]
        }
        for p in stream
    ]


@charts_router.get("/api/chart/rpm-vs-speed")
def get_chart_rpm_vs_speed(driver: str):
    """
    Returns RPM vs Speed scatter coordinates to analyze gear ratios.
    """
    cache = sess.DRIVERS_ENGINEERING_CACHE
    if not cache or driver not in cache:
        raise HTTPException(status_code=404, detail=f"No telemetry cache available for driver {driver}")

    stream = cache[driver]
    return [
        {
            "speed": p["speed"],
            "rpm": p["rpm"],
            "gear": p["gear"]
        }
        for p in stream
    ]


@charts_router.get("/api/chart/demand")
def get_chart_demand(driver: str):
    """
    Returns driver demand index measurements for the driver's fastest lap.
    """
    cache = sess.DRIVERS_ENGINEERING_CACHE
    if not cache or driver not in cache:
        raise HTTPException(status_code=404, detail=f"No telemetry cache available for driver {driver}")

    stream = cache[driver]
    return [
        {
            "time": p["time"],
            "demandIndex": p.get("demandIndex", 0.0),
            "speed": p["speed"]
        }
        for p in stream
    ]

