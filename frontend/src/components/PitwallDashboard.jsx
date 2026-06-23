import { useEffect, useState } from 'react';
import API_BASE from '../config';

import SessionSector from './SessionSector';
import TelemetryCharts from './TelemetryCharts';
import VehicleDiagnostics from './VehicleDiagnostics';
import WeatherPanel from './WeatherPanel';
import { loadTeamColors } from './teamColours';

const SESSION_TYPE_LABELS = {
  R: 'Race',
  Q: 'Qualifying',
  FP1: 'Practice 1',
  FP2: 'Practice 2',
  FP3: 'Practice 3',
  Sprint: 'Sprint',
  SQ: 'Sprint Qualifying',
};

const SESSION_LABELS = {
  FP1: 'FP1', FP2: 'FP2', FP3: 'FP3',
  Q: 'QUALI', R: 'RACE', Sprint: 'SPRINT', SQ: 'SPRINT Q',
};

export default function PitwallDashboard() {
  // ── Session selection states ─────────────────────────────────────────────
  const [activeYear, setActiveYear] = useState(2024);
  const [years, setYears] = useState([2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  const [calendar, setCalendar] = useState([]);
  const [activeCircuit, setActiveCircuit] = useState('');
  const [sessionTypes, setSessionTypes] = useState([]);
  const [activeSessionType, setActiveSessionType] = useState('');
  const [sessionLoading, setSessionLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [loadedSession, setLoadedSession] = useState({ year: null, circuit: "", sessionType: "" });

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

  // Load supported years list and current status on mount
  useEffect(() => {
    // 1. Fetch years
    fetch(`${API_BASE}/api/sessions/years`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setYears(data);
        }
      })
      .catch(err => console.warn('Failed to load years:', err));

    // 2. Fetch status
    fetch(`${API_BASE}/api/status`)
      .then(r => r.ok ? r.json() : {})
      .then(async (status) => {
        if (status.sessionLoaded) {
          setSessionLoaded(true);
          setActiveYear(status.year);
          setActiveCircuit(status.circuit);
          setActiveSessionType(status.sessionType);
          setLoadedSession({ year: status.year, circuit: status.circuit, sessionType: status.sessionType });

          // Fetch calendar and sessions for this active session
          const calendarRes = await fetch(`${API_BASE}/api/sessions/calendar?year=${status.year}`);
          const calendarData = calendarRes.ok ? await calendarRes.json() : [];
          setCalendar(calendarData);

          const typesRes = await fetch(`${API_BASE}/api/sessions/types?year=${status.year}&circuit=${encodeURIComponent(status.circuit)}`);
          const typesData = typesRes.ok ? await typesRes.json() : [];
          setSessionTypes(typesData.available || []);

          setSessionYear(status.year);
          setSessionReady(true);
        } else {
          // If no session loaded, we fetch the default calendar for 2024
          const calendarRes = await fetch(`${API_BASE}/api/sessions/calendar?year=2024`);
          const calendarData = calendarRes.ok ? await calendarRes.json() : [];
          setCalendar(calendarData);
          if (calendarData.length > 0) {
            setActiveCircuit(calendarData[0].name);
            const typesRes = await fetch(`${API_BASE}/api/sessions/types?year=2024&circuit=${encodeURIComponent(calendarData[0].name)}`);
            const typesData = typesRes.ok ? await typesRes.json() : [];
            const availableTypes = typesData.available || [];
            setSessionTypes(availableTypes);
            setActiveSessionType(availableTypes.includes('R') ? 'R' : availableTypes[0] || 'R');
          }
        }
      })
      .catch(err => {
        console.error('Failed to resolve initial status:', err);
      });
  }, []);

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
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setSimState(data); })
        .catch(() => { });
    }, 1000);
    return () => clearInterval(poll);
  }, [sessionReady]);

  const handleYearChange = async (e) => {
    const newYear = Number(e.target.value);
    setActiveYear(newYear);
    setCalendar([]);
    setSessionTypes([]);

    try {
      const calendarRes = await fetch(`${API_BASE}/api/sessions/calendar?year=${newYear}`);
      const calendarData = calendarRes.ok ? await calendarRes.json() : [];
      setCalendar(calendarData);

      if (calendarData.length > 0) {
        const firstCircuit = calendarData[0].name;
        setActiveCircuit(firstCircuit);

        const typesRes = await fetch(`${API_BASE}/api/sessions/types?year=${newYear}&circuit=${encodeURIComponent(firstCircuit)}`);
        const typesData = typesRes.ok ? await typesRes.json() : { available: [] };
        const availableTypes = typesData.available || [];
        setSessionTypes(availableTypes);

        const defaultType = availableTypes.includes('R') ? 'R' : (availableTypes[0] || 'R');
        setActiveSessionType(defaultType);
      }
    } catch (err) {
      console.error('Failed on year change sequence:', err);
    }
  };

  const handleCircuitChange = async (e) => {
    const newCircuit = e.target.value;
    setActiveCircuit(newCircuit);
    setSessionTypes([]);

    try {
      const typesRes = await fetch(`${API_BASE}/api/sessions/types?year=${activeYear}&circuit=${encodeURIComponent(newCircuit)}`);
      const typesData = typesRes.ok ? await typesRes.json() : { available: [] };
      const availableTypes = typesData.available || [];
      setSessionTypes(availableTypes);

      const defaultType = availableTypes.includes('R') ? 'R' : (availableTypes[0] || 'R');
      setActiveSessionType(defaultType);
    } catch (err) {
      console.error('Failed on circuit change sequence:', err);
    }
  };

  const handleSessionTypeChange = async (e) => {
    const newType = e.target.value;
    setActiveSessionType(newType);
  };

  const loadSession = async (year, circuit, sessionType) => {
    if (!year || !circuit || !sessionType || sessionLoading) return;
    setSessionLoading(true);
    setLoadError(null);
    setLoadProgress(0);
    setSessionReady(false);

    const progressInterval = setInterval(() => {
      setLoadProgress(prev => {
        if (prev >= 85) {
          clearInterval(progressInterval);
          return 85;
        }
        return parseFloat((prev + 0.9).toFixed(1));
      });
    }, 400);

    try {
      const res = await fetch(`${API_BASE}/api/sessions/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: Number(year),
          circuit: circuit,
          session_type: sessionType,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Session load failed');
      }

      const meta = await res.json();
      clearInterval(progressInterval);
      setLoadProgress(100);
      setSessionLoaded(true);
      setLoadedSession({ year: Number(year), circuit: circuit, sessionType: sessionType });

      await loadTeamColors();
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
    } catch (err) {
      clearInterval(progressInterval);
      setLoadProgress(0);
      setLoadError(err.message);
    } finally {
      setSessionLoading(false);
    }
  };

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

  const activeCircuitDetails = calendar.find(r => r.name === activeCircuit);
  const activeCircuitShortName = activeCircuitDetails?.shortName || activeCircuit || 'Sakhir';

  const isDirty = !sessionLoaded || activeYear !== loadedSession.year || activeCircuit !== loadedSession.circuit || activeSessionType !== loadedSession.sessionType;

  // Style constants
  const selectStyle = {
    backgroundColor: '#e10600',
    border: '1px solid #e10600',
    paddingLeft: '10px',
    paddingRight: '28px',
    paddingTop: '5px',
    paddingBottom: '5px',
    fontSize: '12px',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#ffffff',
    borderRadius: '2px',
    outline: 'none',
    appearance: 'none',
    cursor: 'pointer',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M1 1l3 2 3-2' stroke='%23ffffff' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    transition: 'all 0.15s ease',
  };

  const buttonStyle = {
    padding: '5px 12px',
    backgroundColor: (!isDirty || sessionLoading) ? 'var(--bg-primary)' : '#ffffff',
    color: (!isDirty || sessionLoading) ? 'var(--color-muted)' : '#e10600',
    border: `1px solid ${(!isDirty || sessionLoading) ? 'var(--border-color)' : '#ffffff'}`,
    borderRadius: '2px',
    fontFamily: 'monospace',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: (!isDirty || sessionLoading) ? 'not-allowed' : 'pointer',
    opacity: (!isDirty || sessionLoading) ? 0.6 : 1,
    transition: 'all 0.15s ease',
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', color: '#f5f5f7', minHeight: '100vh', fontFamily: 'monospace', padding: '15px' }}>

      {/* HUD HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border-color)', paddingBottom: '10px', marginBottom: '15px' }}>
        <div>
          <h2 style={{ color: '#e10600', margin: 0, fontSize: '26px', fontWeight: '900', letterSpacing: '0.5px' }}>F1 PITWALL // ENGINEERING CONSOLE</h2>
          <div style={{ fontSize: '12px', color: '#555666', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>PRE-CACHED STREAM CHANNELS ACTIVE</span>
            {sessionLoaded && (
              <span style={{ color: '#00e676', fontWeight: 'bold' }}>✓ {loadedSession.circuit.toUpperCase()} {loadedSession.year}</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Year Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#ffffff', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', userSelect: 'none' }}>
              YEAR:
            </span>
            <select
              value={activeYear}
              onChange={handleYearChange}
              disabled={sessionLoading}
              style={selectStyle}
            >
              <option value={activeYear}>{activeYear}</option>
              {years.filter(y => y !== activeYear).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Venue Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#ffffff', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', userSelect: 'none' }}>
              VENUE:
            </span>
            <select
              value={activeCircuit}
              onChange={handleCircuitChange}
              disabled={sessionLoading || calendar.length === 0}
              style={{ ...selectStyle, maxWidth: '180px' }}
            >
              <option value={activeCircuit}>{activeCircuitShortName.toUpperCase()}</option>
              {calendar.filter(r => r.name !== activeCircuit).map(race => (
                <option key={race.name} value={race.name}>
                  {race.shortName.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Session Type Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#ffffff', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', userSelect: 'none' }}>
              SESSION:
            </span>
            <select
              value={activeSessionType}
              onChange={handleSessionTypeChange}
              disabled={sessionLoading || sessionTypes.length === 0}
              style={selectStyle}
            >
              <option value={activeSessionType}>{(SESSION_LABELS[activeSessionType] || activeSessionType || '').toUpperCase()}</option>
              {sessionTypes.filter(t => t !== activeSessionType).map(type => (
                <option key={type} value={type}>
                  {(SESSION_LABELS[type] || type).toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Load Session Button */}
          <button
            onClick={() => loadSession(activeYear, activeCircuit, activeSessionType)}
            disabled={!isDirty || sessionLoading}
            style={buttonStyle}
          >
            {sessionLoading ? 'LOADING...' : isDirty ? 'LOAD SESSION' : 'LOADED'}
          </button>

          {sessionLoaded && <WeatherPanel weather={weather} />}
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      {sessionLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontFamily: 'monospace' }}>
          <div style={{ color: '#e10600', fontSize: '14px', fontWeight: 'bold', letterSpacing: '2px', marginBottom: '12px' }}>
            ◆ COMPILING SESSION DATA FOR {activeCircuitShortName.toUpperCase()} {activeYear}
          </div>
          <div style={{ width: '280px', height: '4px', backgroundColor: 'var(--border-color)', border: '1px solid #1c1c28', position: 'relative', overflow: 'hidden', borderRadius: '2px' }}>
            <div style={{ height: '100%', backgroundColor: '#e10600', transition: 'width 0.2s ease', width: `${loadProgress}%` }} />
          </div>
        </div>
      ) : !sessionReady ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontFamily: 'monospace', color: '#888899', gap: '12px' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', letterSpacing: '1px' }}>NO ACTIVE SESSION LOADED</div>
          <div style={{ fontSize: '15px', textAlign: 'center' }}>CHOOSE A YEAR, VENUE, AND SESSION TYPE FROM THE DROPDOWNS ABOVE AND CLICK "LOAD SESSION"</div>
        </div>
      ) : drivers.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', fontFamily: 'monospace', gap: '12px' }}>
          <div style={{ color: '#e10600', fontSize: '15px', letterSpacing: '3px', fontWeight: 'bold' }}>◆ F1 PITWALL</div>
          <div style={{ fontSize: '17px', color: '#f0f0f5' }}>SYNCHRONIZING TELEMETRY STREAM...</div>
          {loadError && <div style={{ color: '#ff3d00', fontSize: '15px' }}>Error: {loadError}</div>}
        </div>
      ) : (
        <>
          {/* THREE INTERACTIVE COLUMNS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 2.2fr 1.4fr', gap: '15px' }}>
            {/* COL 1: TIMING TOWER */}
            <SessionSector
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
        </>
      )}

    </div>
  );
}
