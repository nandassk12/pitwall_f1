import { useEffect, useState } from 'react';
import AnalyticsTabs from './AnalyticsTabs';
import SessionSelector from './SessionSelector';
import SimulationControls from './SimulationControls';
import TelemetryCharts from './TelemetryCharts';
import TimingTower from './TimingTower';
import VehicleDiagnostics from './VehicleDiagnostics';
import WeatherPanel from './WeatherPanel';
import { loadTeamColors } from './teamColours';
import API_BASE from '../config';

export default function PitwallDashboard() {
  // ── Session gate state ───────────────────────────────────────────────────
  const [currentSession, setCurrentSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionYear, setSessionYear] = useState(null);
  const [sessionRound, setSessionRound] = useState(null);

  // ── Telemetry state ──────────────────────────────────────────────────────
  const [drivers, setDrivers] = useState([]);
  const [speedData, setSpeedData] = useState([]);
  const [throttleData, setThrottleData] = useState([]);
  const [rpmData, setRpmData] = useState([]);
  const [weather, setWeather] = useState({});
  const [activeDriver, setActiveDriver] = useState('');

  // ── Simulation state (drives CircuitMap positions) ───────────────────────────────
  const [simState, setSimState] = useState(null);

  // ── Circuit map geometry (one-time per session) ──────────────────────────────
  const [circuitGeometry, setCircuitGeometry] = useState(null);
  const [allPositions, setAllPositions] = useState([]);

  // ── Race control messages (OpenF1, one-time per session, 2023+ only) ─────────
  const [raceControl, setRaceControl] = useState(null);

  // ── Fetch static data after session is ready ─────────────────────────────
  useEffect(() => {
    if (!sessionReady) return;

    fetch(`${API_BASE}/api/drivers`)
      .then(r => r.json())
      .then(data => {
        setDrivers(data);
        if (data.length > 0) {
          const firstWithTelemetry = data.find(d => d.hasTelemetry);
          setActiveDriver(firstWithTelemetry ? firstWithTelemetry.name : data[0].name);
        }
      })
      .catch(err => console.error('Standings pipeline disconnect:', err));

    fetch(`${API_BASE}/api/weather`)
      .then(r => r.json())
      .then(setWeather)
      .catch(err => console.error('Weather channel disconnect:', err));

    // Circuit geometry — one-time fetch per session (not polled)
    fetch(`${API_BASE}/api/circuit/geometry`)
      .then(r => r.json())
      .then(setCircuitGeometry)
      .catch(err => console.error('Circuit geometry fetch failed:', err));

    // Race control messages — one-time fetch per session (OpenF1, 2023+ only)
    fetch(`${API_BASE}/api/race-control`)
      .then(r => r.json())
      .then(setRaceControl)
      .catch(err => console.error('Race control fetch failed:', err));

  }, [sessionReady]);

  // ── Fetch charts once activeDriver changes (static per driver, no poll) ───
  useEffect(() => {
    if (!sessionReady || !activeDriver) return;

    setSpeedData([]);
    setThrottleData([]);
    setRpmData([]);

    fetch(`${API_BASE}/api/chart/speed?driver=${activeDriver}`)
      .then(r => r.json())
      .then(data => Array.isArray(data) ? setSpeedData(data) : null)
      .catch(err => console.error('Speed chart fetch failed:', err));

    fetch(`${API_BASE}/api/chart/throttle?driver=${activeDriver}`)
      .then(r => r.json())
      .then(data => Array.isArray(data) ? setThrottleData(data) : null)
      .catch(err => console.error('Throttle chart fetch failed:', err));

    fetch(`${API_BASE}/api/chart/rpm-vs-speed?driver=${activeDriver}`)
      .then(r => r.json())
      .then(data => Array.isArray(data) ? setRpmData(data) : null)
      .catch(err => console.error('RPM chart fetch failed:', err));

  }, [sessionReady, activeDriver]);

  // ── Simulation state poll — 1 s cadence ─────────────────────────────────
  // Drives circuit map positions in sync with SimulationControls.
  useEffect(() => {
    if (!sessionReady) return;
    const poll = setInterval(() => {
      fetch(`${API_BASE}/api/sim/state`)
        .then(r => r.json())
        .then(setSimState)
        .catch(err => console.error('Sim state sync dropped:', err));
    }, 1000);
    return () => clearInterval(poll);
  }, [sessionReady]);

  // ── Session loaded callback ───────────────────────────────────────────────
  const handleSessionLoaded = async (meta) => {
    await loadTeamColors();
    setCurrentSession(meta.label);
    setSessionYear(meta.year);
    setSessionRound(meta.round);
    setSpeedData([]);
    setThrottleData([]);
    setRpmData([]);
    setDrivers([]);
    setActiveDriver('');
    setCircuitGeometry(null);
    setAllPositions([]);
    setSessionReady(true);
  };

  // ── "Change session" ──────────────────────────────────────────────────────
  const handleChangeSession = () => {
    setSessionReady(false);
    setSpeedData([]);
    setThrottleData([]);
    setRpmData([]);
    setAllPositions([]);
    setSessionYear(null);
    setSessionRound(null);
    setRaceControl(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SESSION SELECTOR (full screen — shown when no session is loaded)
  // ─────────────────────────────────────────────────────────────────────────
  if (!sessionReady) {
    return (
      <SessionSelector
        onSessionLoaded={handleSessionLoaded}
        currentSession={currentSession}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING SPINNER — waiting for first telemetry frame
  // ─────────────────────────────────────────────────────────────────────────
  if (speedData.length === 0) {
    return (
      <div style={{
        color: '#fff', backgroundColor: 'var(--bg-primary)',
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', gap: '12px',
      }}>
        <div style={{ color: '#e10600', fontSize: '11px', letterSpacing: '3px', fontWeight: 'bold' }}>◆ F1 PITWALL</div>
        <div style={{ fontSize: '13px', color: '#f0f0f5' }}>SYNCHRONIZING TELEMETRY STREAM...</div>
        <div style={{ fontSize: '10px', color: '#555666' }}>{currentSession}</div>
      </div>
    );
  }

  const latestSpeed = speedData[speedData.length - 1] || {};
  const latestThrottle = throttleData[throttleData.length - 1] || {};
  const latestRpm = rpmData[rpmData.length - 1] || {};
  const liveTick = {
    speed: latestSpeed.speed ?? '—',
    rpm: latestRpm.rpm ?? '—',
    gear: latestRpm.gear ?? '—',
    downforceKg: latestSpeed.downforceKg ?? '—',
    throttle: latestThrottle.throttle ?? 0,
    brake: latestThrottle.brake ?? 0,
  };

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN DASHBOARD
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', color: '#f5f5f7', minHeight: '100vh', fontFamily: 'monospace', padding: '15px' }}>

      {/* HUD HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border-color)', paddingBottom: '10px', marginBottom: '15px' }}>
        <div>
          <h2 style={{ color: '#e10600', margin: 0, fontWeight: '900', letterSpacing: '0.5px' }}>F1 PITWALL // ENGINEERING CONSOLE</h2>
          <div style={{ fontSize: '10px', color: '#555666', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>PRE-CACHED STREAM CHANNELS ACTIVE</span>
            {currentSession && (
              <span style={{ color: '#00e676', fontWeight: 'bold' }}>✓ {currentSession.toUpperCase()}</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <WeatherPanel weather={weather} />
          <button
            onClick={handleChangeSession}
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--bg-tertiary)', color: '#e10600',
              border: '1px solid #e10600', borderRadius: '4px',
              fontFamily: 'monospace', fontSize: '10px', fontWeight: 'bold',
              letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >
            ⟳ CHANGE SESSION
          </button>
        </div>
      </header>

      {/* THREE INTERACTIVE COLUMNS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.4fr 1.1fr', gap: '15px' }}>

        {/* COL 1: TIMING TOWER */}
        <TimingTower
          drivers={drivers}
          activeDriver={activeDriver}
          setActiveDriver={setActiveDriver}
          simState={simState}
        />

        {/* COL 2: MAIN GRAPHS + LAP COMPARISON */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <TelemetryCharts
            speedData={speedData}
            throttleData={throttleData}
            rpmData={rpmData}
            activeDriver={activeDriver}
            liveTick={liveTick}
          />
        </div>

        {/* COL 3: CIRCUIT MAP + DIAGNOSTICS */}
        <VehicleDiagnostics
          liveTick={liveTick}
          circuitGeometry={circuitGeometry}
          allPositions={allPositions}
          activeDriver={activeDriver}
          simState={simState}
        />

      </div>

      {/* SIMULATION ENGINE PANEL — full width below the 3 columns */}
      <SimulationControls />

      {/* SESSION-AWARE ANALYSIS PANELS */}
      <AnalyticsTabs
        drivers={drivers}
        activeDriver={activeDriver}
        sessionYear={sessionYear}
        sessionRound={sessionRound}
        raceControl={raceControl}
      />

    </div>
  );
}
