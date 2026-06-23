import React, { useState, useEffect, useRef, useCallback } from 'react';
import API_BASE from '../config';

const SPEEDS = [0.5, 1, 2, 4];

const STATUS_COLOR = {
  idle:     '#555666',
  playing:  '#00e676',
  paused:   '#ffea00',
  finished: '#e10600',
};

export default function SimulationControls() {
  const [simState, setSimState] = useState({
    status:       'idle',
    currentLap:   0,
    totalLaps:    0,
    speed:        1,
    progress:     0,
    ready:        false,
    lapState:     [],
    sessionLabel: '',
  });
  const [seekDragging,  setSeekDragging]  = useState(false);
  const [seekValue,     setSeekValue]     = useState(0);
  const seekRef = useRef(false);

  // ── Poll /api/sim/state every 1000ms ─────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      if (!seekRef.current) {
        fetch(`${API_BASE}/api/sim/state`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (!data) return;
            setSimState(data);
            if (!seekRef.current) setSeekValue(data.currentLap);
          })
          .catch(() => {});
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Control helper ────────────────────────────────────────────────────────
  const control = useCallback((action, params = {}) => {
    const qs = new URLSearchParams({ action, ...params }).toString();
    fetch(`${API_BASE}/api/sim/control?${qs}`)
      .then(r => r.json())
      .then(data => {
        setSimState(prev => ({ ...prev, ...data }));
        if (data.currentLap != null) setSeekValue(data.currentLap);
      })
      .catch(() => {});
  }, []);

  const handlePlayPause = () => {
    if (simState.status === 'playing') {
      control('pause');
    } else {
      control('play', { speed: simState.speed });
    }
  };

  const handleReset = () => control('reset');

  const handleSpeed = (s) => {
    control('setspeed', { speed: s });
    if (simState.status === 'playing') control('play', { speed: s });
  };

  const handleSeekStart = () => {
    seekRef.current = true;
    setSeekDragging(true);
  };

  const handleSeekEnd = (e) => {
    const lap = parseInt(e.target.value, 10);
    seekRef.current = false;
    setSeekDragging(false);
    control('seek', { lap });
  };

  const { status, currentLap, totalLaps, speed, progress, ready, isFinished } = simState;

  const isPlaying  = status === 'playing';
  const isFinishedStatus = status === 'finished';

  // ── Not ready ─────────────────────────────────────────────────────────────
  if (!ready) {
    return null; // Don't render controls if session is not ready
  }

  // ── Ready ─────────────────────────────────────────────────────────────────
  return (
    <div style={panelStyle}>

      {/* ── Header row ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={titleStyle}>◆ SIMULATION</span>
          <span style={{ ...dotStyle, backgroundColor: STATUS_COLOR[status] || '#555' }} />
        </div>
        <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#fff' }}>
          LAP <span style={{ color: '#e10600' }}>{currentLap}</span> / {totalLaps}
        </span>
      </div>

      {/* ── Race progress bar ────────────────────────────────────────────── */}
      <div style={{ height: '4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden', border: '1px solid #1e1e2e', marginBottom: '8px' }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          backgroundColor: isFinishedStatus ? '#e10600' : '#00e676',
          borderRadius: '2px',
          transition: 'width 0.8s ease',
          boxShadow: `0 0 6px ${isFinishedStatus ? '#e10600' : '#00e676'}`,
        }} />
      </div>

      {/* ── Control row ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {/* Play / Pause */}
          <button onClick={handlePlayPause} style={bigBtnStyle(isPlaying ? '#ffea00' : '#00e676')}>
            {isPlaying ? '⏸' : isFinishedStatus ? '↺' : '▶'}
          </button>

          {/* Reset */}
          <button onClick={handleReset} style={smallBtnStyle}>
            ⏮
          </button>
        </div>

        {/* Speed pills */}
        <div style={{ display: 'flex', gap: '3px' }}>
          {SPEEDS.map(s => (
            <button
              key={s}
              onClick={() => handleSpeed(s)}
              style={{
                padding: '4px 6px',
                fontSize: '9px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                backgroundColor: speed === s ? '#e10600' : 'var(--bg-tertiary)',
                color:           speed === s ? '#fff'    : '#666677',
                border:          `1px solid ${speed === s ? '#e10600' : '#1e1e2e'}`,
                borderRadius:    '3px',
                cursor:          'pointer',
                transition:      'all 0.12s ease',
              }}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* ── Lap scrubber ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '8px', color: '#555666', whiteSpace: 'nowrap' }}>L1</span>
        <input
          type="range"
          min={1}
          max={totalLaps || 1}
          value={seekValue}
          onMouseDown={handleSeekStart}
          onTouchStart={handleSeekStart}
          onChange={e => setSeekValue(parseInt(e.target.value, 10))}
          onMouseUp={handleSeekEnd}
          onTouchEnd={handleSeekEnd}
          style={{
            flex: 1,
            accentColor: '#e10600',
            cursor: 'pointer',
            height: '4px',
          }}
        />
        <span style={{ fontSize: '8px', color: '#555666', whiteSpace: 'nowrap' }}>L{totalLaps}</span>
        {seekDragging && (
          <span style={{ fontSize: '9px', color: '#e10600', fontWeight: 'bold', minWidth: '22px' }}>
            →{seekValue}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Style constants ───────────────────────────────────────────────────────────
const panelStyle = {
  backgroundColor: 'var(--bg-secondary)',
  border:          '1px solid var(--border-color)',
  borderRadius:    '6px',
  padding:         '12px',
  fontFamily:      'monospace',
};

const titleStyle = {
  fontSize:    '10px',
  fontWeight:  'bold',
  color:       '#e10600',
  letterSpacing: '0.5px',
};

const dotStyle = {
  display:       'inline-block',
  width:         '6px',
  height:        '6px',
  borderRadius:  '50%',
  marginLeft:    '4px',
  verticalAlign: 'middle',
};

const bigBtnStyle = (color) => ({
  width:           '28px',
  height:          '24px',
  backgroundColor: `${color}18`,
  color:           color,
  border:          `1px solid ${color}`,
  borderRadius:    '4px',
  fontFamily:      'monospace',
  fontSize:        '10px',
  fontWeight:      'bold',
  cursor:          'pointer',
  display:         'flex',
  alignItems:      'center',
  justifyContent:  'center',
  transition:      'all 0.12s ease',
});

const smallBtnStyle = {
  width:           '28px',
  height:          '24px',
  backgroundColor: 'var(--bg-tertiary)',
  color:           '#888899',
  border:          '1px solid #1e1e2e',
  borderRadius:    '4px',
  fontFamily:      'monospace',
  fontSize:        '10px',
  fontWeight:      'bold',
  cursor:          'pointer',
  display:         'flex',
  alignItems:      'center',
  justifyContent:  'center',
};
