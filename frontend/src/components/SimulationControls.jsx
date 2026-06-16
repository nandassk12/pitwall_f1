import React, { useState, useEffect, useRef, useCallback } from 'react';

const SPEEDS = [0.5, 1, 2, 4];

const STATUS_COLOR = {
  idle:     '#555666',
  playing:  '#00e676',
  paused:   '#ffea00',
  finished: '#e10600',
};

const COMPOUND_COLOR = {
  SOFT:    '#e8002d',
  MEDIUM:  '#ffea00',
  HARD:    '#f0f0f5',
  INTER:   '#22aa44',
  WET:     '#2979ff',
  UNKNOWN: '#555666',
};

function fmt(sec) {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(3).padStart(6, '0');
  return m > 0 ? `${m}:${s}` : `${s}`;
}

function fmtSector(sec) {
  if (sec == null) return '—';
  return sec.toFixed(3);
}

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
  const [showStandings, setShowStandings] = useState(true);
  const [seekDragging,  setSeekDragging]  = useState(false);
  const [seekValue,     setSeekValue]     = useState(0);
  const seekRef = useRef(false);

  // ── Poll /api/sim/state every 1000ms ─────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      if (!seekRef.current) {
        fetch('/api/sim/state')
          .then(r => r.json())
          .then(data => {
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
    fetch(`/api/sim/control?${qs}`)
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

  const { status, currentLap, totalLaps, speed, progress, ready, lapState, sessionLabel } = simState;

  const isPlaying  = status === 'playing';
  const isFinished = status === 'finished';

  // ── Not ready ─────────────────────────────────────────────────────────────
  if (!ready) {
    return (
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={titleStyle}>◆ RACE SIMULATION ENGINE</span>
            <span style={{ ...dotStyle, backgroundColor: STATUS_COLOR.idle }} />
            <span style={{ fontSize: '9px', color: '#555666', marginLeft: '6px' }}>IDLE</span>
          </div>
        </div>
        <div style={{ fontSize: '10px', color: '#555666', textAlign: 'center', padding: '10px 0' }}>
          LOAD A SESSION TO ENABLE RACE SIMULATION
        </div>
      </div>
    );
  }

  // ── Ready ─────────────────────────────────────────────────────────────────
  return (
    <div style={panelStyle}>

      {/* ── Header row ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={titleStyle}>◆ RACE SIMULATION</span>
          <span style={{ ...dotStyle, backgroundColor: STATUS_COLOR[status] || '#555' }} />
          <span style={{ fontSize: '9px', color: STATUS_COLOR[status] || '#555', letterSpacing: '1px', fontWeight: 'bold' }}>
            {status.toUpperCase()}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {sessionLabel && (
            <span style={{ fontSize: '9px', color: '#555666' }}>
              {sessionLabel.toUpperCase()}
            </span>
          )}
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', letterSpacing: '0.5px' }}>
            LAP <span style={{ color: '#e10600' }}>{currentLap}</span> / {totalLaps}
          </span>
        </div>
      </div>

      {/* ── Race progress bar ────────────────────────────────────────────── */}
      <div style={{ height: '5px', backgroundColor: '#0d0d14', borderRadius: '3px', overflow: 'hidden', border: '1px solid #1e1e2e', marginBottom: '10px' }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          backgroundColor: isFinished ? '#e10600' : '#00e676',
          borderRadius: '3px',
          transition: 'width 0.8s ease',
          boxShadow: `0 0 6px ${isFinished ? '#e10600' : '#00e676'}`,
        }} />
      </div>

      {/* ── Control row ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>

        {/* Play / Pause */}
        <button onClick={handlePlayPause} style={bigBtnStyle(isPlaying ? '#ffea00' : '#00e676')}>
          {isPlaying ? '⏸ PAUSE' : isFinished ? '↺ REPLAY' : '▶ PLAY'}
        </button>

        {/* Reset */}
        <button onClick={handleReset} style={smallBtnStyle}>
          ⏮ RESET
        </button>

        {/* Speed pills */}
        <div style={{ display: 'flex', gap: '4px', marginLeft: '4px' }}>
          {SPEEDS.map(s => (
            <button
              key={s}
              onClick={() => handleSpeed(s)}
              style={{
                padding: '5px 10px',
                fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold',
                backgroundColor: speed === s ? '#e10600' : '#0d0d14',
                color:           speed === s ? '#fff'    : '#666677',
                border:          `1px solid ${speed === s ? '#e10600' : '#1e1e2e'}`,
                borderRadius:    '3px', cursor: 'pointer',
                transition:      'all 0.12s ease',
              }}
            >
              {s}×
            </button>
          ))}
        </div>

        {/* Standings toggle */}
        <button
          onClick={() => setShowStandings(v => !v)}
          style={{ ...smallBtnStyle, marginLeft: 'auto' }}
        >
          {showStandings ? '▲ STANDINGS' : '▼ STANDINGS'}
        </button>
      </div>

      {/* ── Lap scrubber ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: showStandings && lapState.length ? '12px' : '0', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '9px', color: '#555666', whiteSpace: 'nowrap' }}>L1</span>
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
        <span style={{ fontSize: '9px', color: '#555666', whiteSpace: 'nowrap' }}>L{totalLaps}</span>
        {seekDragging && (
          <span style={{ fontSize: '10px', color: '#e10600', fontWeight: 'bold', minWidth: '30px' }}>
            →{seekValue}
          </span>
        )}
      </div>

      {/* ── Standings table ──────────────────────────────────────────────── */}
      {showStandings && lapState.length > 0 && (
        <div style={{ marginTop: '8px', overflowX: 'auto' }}>

          {/* Table header */}
          <div style={tableRowStyle(false, true)}>
            {['POS', 'DRV', 'TEAM', 'LAP TIME', 'GAP', 'INT', 'TYRE', 'S1', 'S2', 'S3', 'PIT'].map(h => (
              <span key={h} style={thStyle}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          {[...lapState]
            .sort((a, b) => a.position - b.position)
            .map((entry, idx) => {
              const compound = (entry.compound || 'UNKNOWN').toUpperCase();
              const cmpColor = COMPOUND_COLOR[compound] || '#888';
              const isPit    = entry.pitStop;
              const isLeader = entry.position === 1;

              return (
                <div key={entry.driver} style={tableRowStyle(isPit, false, isLeader)}>
                  {/* POS */}
                  <span style={{
                    ...tdStyle,
                    color: entry.position === 1 ? '#ffd700' : entry.position === 2 ? '#c0c0c0' : entry.position === 3 ? '#cd7f32' : '#f0f0f5',
                    fontWeight: entry.position <= 3 ? 'bold' : 'normal',
                  }}>
                    {entry.position}
                  </span>

                  {/* DRIVER */}
                  <span style={{ ...tdStyle, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: entry.teamColor, flexShrink: 0 }} />
                    <span style={{ color: '#f0f0f5', fontWeight: 'bold' }}>{entry.driver}</span>
                  </span>

                  {/* TEAM */}
                  <span style={{ ...tdStyle, color: '#666677', fontSize: '9px' }}>
                    {entry.team?.split(' ').slice(0, 2).join(' ')}
                  </span>

                  {/* LAP TIME */}
                  <span style={{ ...tdStyle, color: isLeader ? '#00e676' : '#f0f0f5' }}>
                    {fmt(entry.lapTime)}
                  </span>

                  {/* GAP */}
                  <span style={{ ...tdStyle, color: isLeader ? '#00e676' : '#ffea00' }}>
                    {entry.gap || '—'}
                  </span>

                  {/* INTERVAL */}
                  <span style={{ ...tdStyle, color: '#666677' }}>
                    {entry.interval != null && entry.interval > 0 ? `+${entry.interval}s` : '—'}
                  </span>

                  {/* TYRE */}
                  <span style={{ ...tdStyle, color: cmpColor, fontWeight: 'bold', fontSize: '9px' }}>
                    {compound.slice(0, 3)} L{entry.tyreAge}
                  </span>

                  {/* SECTORS */}
                  <span style={{ ...tdStyle, color: '#888' }}>{fmtSector(entry.sector1)}</span>
                  <span style={{ ...tdStyle, color: '#888' }}>{fmtSector(entry.sector2)}</span>
                  <span style={{ ...tdStyle, color: '#888' }}>{fmtSector(entry.sector3)}</span>

                  {/* PIT */}
                  <span style={{ ...tdStyle, color: isPit ? '#ff9800' : '#1e1e2e', fontWeight: 'bold', fontSize: '9px' }}>
                    {entry.pitIn ? 'IN' : entry.pitOut ? 'OUT' : isPit ? '●' : '—'}
                  </span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

// ── Style constants ───────────────────────────────────────────────────────────
const panelStyle = {
  backgroundColor: '#09090d',
  border:          '1px solid #14141f',
  borderRadius:    '6px',
  padding:         '14px 16px',
  marginTop:       '15px',
  fontFamily:      'monospace',
};

const titleStyle = {
  fontSize:    '11px',
  fontWeight:  'bold',
  color:       '#e10600',
  letterSpacing: '0.5px',
};

const dotStyle = {
  display:       'inline-block',
  width:         '7px',
  height:        '7px',
  borderRadius:  '50%',
  marginLeft:    '6px',
  verticalAlign: 'middle',
};

const bigBtnStyle = (color) => ({
  padding:         '7px 16px',
  backgroundColor: `${color}18`,
  color:           color,
  border:          `1px solid ${color}`,
  borderRadius:    '4px',
  fontFamily:      'monospace',
  fontSize:        '11px',
  fontWeight:      'bold',
  letterSpacing:   '1px',
  cursor:          'pointer',
  transition:      'all 0.12s ease',
});

const smallBtnStyle = {
  padding:         '5px 12px',
  backgroundColor: '#0d0d14',
  color:           '#555666',
  border:          '1px solid #1e1e2e',
  borderRadius:    '4px',
  fontFamily:      'monospace',
  fontSize:        '10px',
  fontWeight:      'bold',
  letterSpacing:   '1px',
  cursor:          'pointer',
};

const tableRowStyle = (isPit, isHeader, isLeader) => ({
  display:         'grid',
  gridTemplateColumns: '28px 60px 90px 72px 72px 56px 60px 50px 50px 50px 30px',
  alignItems:      'center',
  padding:         '4px 6px',
  borderRadius:    '3px',
  backgroundColor: isHeader  ? '#0d0d14'
                 : isPit     ? '#1a150a'
                 : isLeader  ? '#0a1a10'
                 : 'transparent',
  borderBottom:    isHeader ? '1px solid #1e1e2e' : '1px solid #0d0d14',
  marginBottom:    '1px',
});

const thStyle = {
  fontSize:      '8px',
  color:         '#555666',
  fontWeight:    'bold',
  letterSpacing: '0.5px',
};

const tdStyle = {
  fontSize:   '10px',
  color:      '#f0f0f5',
  whiteSpace: 'nowrap',
  overflow:   'hidden',
};
