import React, { useState, useEffect, useRef } from 'react';

export default function SessionSelector({ onSessionLoaded, currentSession }) {
  const [selectedYear, setSelectedYear] = useState(2023);
  const [calendar, setCalendar] = useState([]);
  const [selectedCircuit, setSelectedCircuit] = useState('');
  const [sessionTypes, setSessionTypes] = useState([]);
  const [selectedType, setSelectedType] = useState('R');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const progressTimerRef = useRef(null);
  const years = [2018, 2019, 2020, 2021, 2022, 2023, 2024];

  const SESSION_LABELS = {
    FP1: 'FP1', FP2: 'FP2', FP3: 'FP3',
    Q: 'QUALI', R: 'RACE', Sprint: 'SPRINT', SQ: 'SPRINT Q',
  };

  // ── Calendar fetch on year change ─────────────────────────────────────────
  useEffect(() => {
    setCalendar([]);
    setSelectedCircuit('');
    setSessionTypes([]);
    setError(null);

    fetch(`/api/sessions/calendar?year=${selectedYear}`)
      .then(r => r.json())
      .then(data => {
        setCalendar(data);
        if (data.length > 0) setSelectedCircuit(data[0].name);
      })
      .catch(() => setError('Failed to load calendar. Is the backend running?'));
  }, [selectedYear]);

  // ── Session types fetch on circuit change ─────────────────────────────────
  useEffect(() => {
    if (!selectedCircuit) return;
    setSessionTypes([]);
    setError(null);

    fetch(`/api/sessions/types?year=${selectedYear}&circuit=${encodeURIComponent(selectedCircuit)}`)
      .then(r => r.json())
      .then(data => {
        const types = data.available || [];
        setSessionTypes(types);
        setSelectedType(types.includes('R') ? 'R' : types[0] || 'R');
      })
      .catch(() => setSessionTypes(['FP1', 'FP2', 'FP3', 'Q', 'R']));
  }, [selectedCircuit, selectedYear]);

  // ── Progress bar simulation ───────────────────────────────────────────────
  const startProgress = () => {
    setProgress(0);
    progressTimerRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 85) {
          clearInterval(progressTimerRef.current);
          return 85;
        }
        return parseFloat((prev + 0.7).toFixed(1));
      });
    }, 500);
  };

  const stopProgress = (success) => {
    clearInterval(progressTimerRef.current);
    setProgress(success ? 100 : 0);
  };

  // ── Session load ──────────────────────────────────────────────────────────
  const handleLoad = async () => {
    if (!selectedCircuit || !selectedType || loading) return;
    setError(null);
    setLoading(true);
    setLoadingMessage(`LOADING ${selectedCircuit.toUpperCase()} ${selectedYear} — ${selectedType}`);
    startProgress();

    try {
      const res = await fetch('/api/sessions/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: selectedYear,
          circuit: selectedCircuit,
          session_type: selectedType,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Session load failed');
      }

      const meta = await res.json();
      stopProgress(true);
      setLoading(false);
      onSessionLoaded(meta);

    } catch (err) {
      stopProgress(false);
      setLoading(false);
      setError(`Load failed: ${err.message}`);
    }
  };

  // ── Short display name for selected circuit ───────────────────────────────
  const circuitShort = calendar.find(r => r.name === selectedCircuit)?.shortName || selectedCircuit;

  // ─────────────────────────────────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: '#040406',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', zIndex: 1000,
      backgroundImage: 'radial-gradient(ellipse at 50% 0%, #1a0404 0%, #040406 60%)',
    }}>

      {/* Red accent line at top */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundColor: '#e10600' }} />

      {/* Ambient grid */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.04,
        backgroundImage: 'linear-gradient(#e10600 1px, transparent 1px), linear-gradient(90deg, #e10600 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
      }} />

      {/* Main card */}
      <div style={{
        backgroundColor: '#09090d',
        border: '1px solid #1e1e2e',
        borderRadius: '8px',
        padding: '36px 40px',
        width: '100%',
        maxWidth: '480px',
        position: 'relative',
        boxShadow: '0 0 60px rgba(225,6,0,0.06), 0 20px 60px rgba(0,0,0,0.6)',
      }}>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{
            fontSize: '10px', color: '#e10600', letterSpacing: '3px',
            fontWeight: 'bold', marginBottom: '6px',
          }}>
            ◆ F1 PITWALL
          </div>
          <h1 style={{
            margin: 0, fontSize: '20px', fontWeight: '900',
            color: '#ffffff', letterSpacing: '1px', lineHeight: 1.2,
          }}>
            SELECT SESSION
          </h1>
          <div style={{ fontSize: '10px', color: '#555666', marginTop: '6px' }}>
            CHOOSE A YEAR, CIRCUIT AND SESSION TYPE TO BEGIN TELEMETRY STREAM
          </div>
        </div>

        {/* ── YEAR ─────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ fontSize: '9px', color: '#555666', letterSpacing: '2px', display: 'block', marginBottom: '6px' }}>
            SEASON
          </label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {years.map(y => (
              <button
                key={y}
                disabled={loading}
                onClick={() => setSelectedYear(y)}
                style={{
                  padding: '7px 14px',
                  fontSize: '11px', fontWeight: 'bold', fontFamily: 'monospace',
                  border: '1px solid',
                  borderColor: selectedYear === y ? '#e10600' : '#1e1e2e',
                  backgroundColor: selectedYear === y ? '#e1060018' : '#0d0d14',
                  color: selectedYear === y ? '#e10600' : '#666677',
                  borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  opacity: loading ? 0.5 : 1,
                }}
              >{y}</button>
            ))}
          </div>
        </div>

        {/* ── CIRCUIT ──────────────────────────────────────────────────── */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ fontSize: '9px', color: '#555666', letterSpacing: '2px', display: 'block', marginBottom: '6px' }}>
            CIRCUIT — {calendar.length === 0 ? 'LOADING CALENDAR...' : `${calendar.length} EVENTS`}
          </label>
          <select
            disabled={loading || calendar.length === 0}
            value={selectedCircuit}
            onChange={e => setSelectedCircuit(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px',
              backgroundColor: '#0d0d14', color: '#f0f0f5',
              border: '1px solid #1e1e2e', borderRadius: '4px',
              fontFamily: 'monospace', fontSize: '12px', fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              outline: 'none', appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23555666' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {calendar.map(race => (
              <option key={race.round} value={race.name}>
                {race.shortName.padEnd(20)} — {race.date}
              </option>
            ))}
          </select>
        </div>

        {/* ── SESSION TYPE PILLS ───────────────────────────────────────── */}
        <div style={{ marginBottom: '28px' }}>
          <label style={{ fontSize: '9px', color: '#555666', letterSpacing: '2px', display: 'block', marginBottom: '6px' }}>
            SESSION TYPE
          </label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(sessionTypes.length > 0 ? sessionTypes : ['FP1', 'FP2', 'FP3', 'Q', 'R']).map(type => (
              <button
                key={type}
                disabled={loading}
                onClick={() => setSelectedType(type)}
                style={{
                  padding: '8px 16px',
                  fontSize: '11px', fontWeight: 'bold', fontFamily: 'monospace',
                  border: '1px solid',
                  borderColor: selectedType === type ? '#e10600' : '#1e1e2e',
                  backgroundColor: selectedType === type ? '#e10600' : '#0d0d14',
                  color: selectedType === type ? '#ffffff' : '#666677',
                  borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  opacity: loading ? 0.5 : 1,
                  letterSpacing: '1px',
                }}
              >{SESSION_LABELS[type] || type}</button>
            ))}
          </div>
        </div>

        {/* ── LOAD BUTTON ──────────────────────────────────────────────── */}
        {!loading ? (
          <button
            onClick={handleLoad}
            disabled={!selectedCircuit || !selectedType}
            style={{
              width: '100%', padding: '13px',
              backgroundColor: (!selectedCircuit || !selectedType) ? '#2a0a0a' : '#e10600',
              color: (!selectedCircuit || !selectedType) ? '#441111' : '#ffffff',
              border: 'none', borderRadius: '4px',
              fontFamily: 'monospace', fontSize: '13px', fontWeight: '900',
              letterSpacing: '2px', cursor: (!selectedCircuit || !selectedType) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            LOAD SESSION ◆
          </button>
        ) : (
          /* ── LOADING STATE ─────────────────────────────────────────── */
          <div>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: '#e10600', fontWeight: 'bold', letterSpacing: '1px' }}>
                  <PulsingDot /> {loadingMessage}
                </span>
                <span style={{ fontSize: '10px', color: '#555666' }}>{Math.round(progress)}%</span>
              </div>
              {/* Progress bar */}
              <div style={{ height: '4px', backgroundColor: '#0d0d14', borderRadius: '2px', overflow: 'hidden', border: '1px solid #1e1e2e' }}>
                <div style={{
                  height: '100%', width: `${progress}%`,
                  backgroundColor: '#e10600',
                  borderRadius: '2px',
                  transition: 'width 0.5s ease',
                  boxShadow: '0 0 8px #e10600',
                }} />
              </div>
            </div>
            <div style={{
              backgroundColor: '#0d0d14', border: '1px solid #1e1e2e',
              borderRadius: '4px', padding: '10px 14px',
              fontSize: '10px', color: '#555666', lineHeight: 1.6,
            }}>
              <div>⏱ ESTIMATED TIME: 60–90 SECONDS</div>
              <div>🔄 FETCHING TELEMETRY FROM FASTF1 SERVERS...</div>
              <div>💾 COMPUTING ENGINEERING MATRICES...</div>
            </div>
          </div>
        )}

        {/* ── ERROR ────────────────────────────────────────────────────── */}
        {error && (
          <div style={{
            marginTop: '14px', padding: '10px 14px',
            backgroundColor: '#1a0404', border: '1px solid #3a0808',
            borderRadius: '4px', fontSize: '11px', color: '#ff4444',
          }}>
            ⚠ {error}
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────────────── */}
        {currentSession && !loading && (
          <div style={{
            marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #1e1e2e',
            fontSize: '10px', color: '#555666', textAlign: 'center',
          }}>
            CURRENT: <span style={{ color: '#00e676' }}>✓ {currentSession}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* Tiny pulsing indicator dot */
function PulsingDot() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setOn(v => !v), 600);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{
      display: 'inline-block', width: '6px', height: '6px',
      borderRadius: '50%', backgroundColor: on ? '#e10600' : 'transparent',
      marginRight: '6px', verticalAlign: 'middle',
      transition: 'background-color 0.3s',
    }} />
  );
}
