# 🏎️ F1 Pitwall // Engineering Console

A full-stack telemetry dashboard that pulls official Formula 1 session data, computes real-time car physics, and renders them on a live engineering console interface. Telemetry is pre-cached on startup so the dashboard streams with under 150ms lag when switching between drivers.

---

## 📁 Project Structure

```
f1-pitwall/
├── backend/
│   ├── main.py          # FastAPI server, startup cache, all API endpoints
│   ├── charts.py        # Matplotlib & Seaborn static chart generation module
│   └── f1_cache/        # FastF1 local session cache (auto-generated on first run)
├── frontend/
│   ├── src/
│   │   ├── App.jsx                      # Root component, state & polling logic
│   │   ├── main.jsx                     # React DOM entry point
│   │   └── components/
│   │       ├── TimingTower.jsx          # Driver standings & gap classification
│   │       ├── TelemetryCharts.jsx      # Speed overlay, throttle/brake charts
│   │       ├── VehicleDiagnostics.jsx   # Map, handling state, tyre profile
│   │       └── WeatherPanel.jsx         # Track & air temperature, rain risk
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## ⚡ Key Functionalities

### Fast Startup Caching
Telemetry is loaded and all physics vectors are computed once at app startup using FastF1. All driver data is stored in memory. Switching drivers hits the in-memory cache, keeping dashboard response time under 150ms with no repeated API calls.

### Live Timing Tower
Displays a real-time classification panel for the top 8 finishers. Each row shows driver code, team, position, and time gap. P1 is labelled `LEADER`. Clicking any driver row switches the entire telemetry stream to that driver.

### Live Map Tracking
Uses `X` and `Y` coordinate channels extracted from the fastest lap telemetry to draw the Monaco circuit outline via SVG. A glowing green dot updates in real time to show the car's current position on track.

### Real-Time Environment Monitor
Weather data is sourced directly from FastF1's `session.weather_data` DataFrame. The header panel displays:
- **Track Temperature** and **Air Temperature** from the last recorded weather row
- **Rain Risk %** — a derived metric computed from the humidity threshold (>78% with no active rainfall triggers high risk)
- **Rainfall boolean** — direct flag from the FastF1 weather feed

### Digital Instrument Cluster
Four live metric cards update every 150ms:
- **Velocity** — current speed in KMH
- **RPM Trace** — engine revs
- **Gear Ratio** — current gear selection
- **Aerodynamic Downforce** — calculated in KG

### Aerodynamic Downforce Calculation
Live downforce load is computed per telemetry point using the quadratic velocity relationship:

```
F_downforce = v² × 0.014
```

Downforce scales non-linearly with speed, consistent with real F1 aerodynamic behaviour.

### Velocity Curve Overlay vs Pole Baseline
An area chart plots the active driver's speed trace (red filled area) directly against the pole position fastest lap reference speed (grey dashed line). This allows real-time gap identification in braking zones and corner entry.

### Throttle & Brake Trace
A dual-line chart displays throttle input (green) and brake pressure (red) across the telemetry window. Allows visualisation of trail braking, lift-and-coast zones, and full-throttle sections.

### Handling State Detection
Throttle and brake input thresholds are used to classify each telemetry point as one of three states:
- `NEUTRAL` — normal driving condition (green indicator)
- `UNDERSTEER` — heavy throttle at high speed (red indicator)
- `OVERSTEER` — sudden throttle lift at high speed with no brake input (red indicator)

### Tyre Wear & Compound Profile
Displays the active tyre compound (SOFT / MEDIUM / HARD) with lap age. A progress bar estimates thermal degradation with colour coding:
- 🟢 Green — below 40% wear
- 🟡 Yellow — 40–70% wear
- 🔴 Red — above 70% wear

Wear percentage is estimated from tyre age in laps combined with instantaneous speed, modelling thermal strain accumulation over a stint.

### Longitudinal G-Force Tracking
G-force vectors are computed from velocity delta arrays using NumPy. Values are clipped to physically realistic bounds (−5.5g to +3.2g) representing maximum braking and acceleration loads on an F1 car.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Backend | FastAPI (Python) | API endpoints and server-side logic |
| Data Source | FastF1 | Official F1 telemetry and session data |
| Data Processing | NumPy & Pandas | Physics calculations and array operations |
| Static Charts | Matplotlib & Seaborn | Chart generation module (charts.py) |
| Frontend | React.js via Vite | UI components and state management |
| Live Charts | Recharts | Real-time performance graph rendering |
| Environment | Docker & VirtualBox | Containerisation and Ubuntu VM management |

---

## 🚀 How to Run

Make sure Docker is running, then from the project root:

```bash
docker-compose up --build
```

| Service | URL |
|---|---|
| Frontend Dashboard | http://localhost:3000 |
| Backend API Explorer | http://localhost:8000/docs |

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/drivers` | Returns full standings tower with gaps |
| GET | `/api/weather` | Returns track temp, air temp, rain risk |
| GET | `/api/circuit-geometry` | Returns pole lap X/Y coordinate path |
| GET | `/api/telemetry?driver=VER&index=0` | Returns 45-point rolling telemetry slice |

---

## 📊 Data Flow

```
FastF1 API
    │
    ▼
session.load() ──► weather_data ──► /api/weather ──► WeatherPanel
    │
    ├──► laps.pick_fastest() ──► /api/circuit-geometry ──► SVG Map
    │
    └──► laps.pick_driver() ──► physics computation
              │
              ├── NumPy  : G-force vectors, downforce, speed arrays
              ├── Pandas : DataFrame ops, tyre/weather parsing
              │
              └──► DRIVERS_ENGINEERING_CACHE
                        │
                        ▼
              /api/telemetry (polled every 150ms)
                        │
                        ▼
          TelemetryCharts + VehicleDiagnostics + TimingTower
```

---

## 🗄️ Data Source

**Session:** Monaco Grand Prix 2023 — Race

All telemetry is sourced from the official [FastF1](https://github.com/theOehrly/Fast-F1) library which pulls data from the Ergast API and Formula 1's own timing service. Data is cached locally in the `f1_cache/` directory on first load to avoid repeated network requests.
