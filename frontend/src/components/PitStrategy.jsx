import React, { useState, useEffect } from 'react';
import API_BASE from '../config';

const COMPOUND_COLORS = {
  SOFT:    { bg: '#e8002d', text: '#fff' },
  MEDIUM:  { bg: '#ffea00', text: '#000' },
  HARD:    { bg: '#f0f0f5', text: '#000' },
  INTER:   { bg: '#22aa44', text: '#fff' },
  WET:     { bg: '#2979ff', text: '#fff' },
  UNKNOWN: { bg: '#333344', text: '#888' },
};

export default function PitStrategy() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredStint, setHoveredStint] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/panels/pit-strategy`)
      .then(r => {
        if (!r.ok) throw new Error('Simulation or session data not active.');
        return r.json();
      })
      .then(setData)
      .catch(err => {
        console.error(err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ color: '#888', padding: '20px', fontFamily: 'monospace', textAlign: 'center' }}>
        LOADING TYRE STRATEGY DATA...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ color: '#ff4444', padding: '20px', fontFamily: 'monospace', textAlign: 'center' }}>
        {error || 'STRATEGY DATA TEMPORARILY UNAVAILABLE'}
      </div>
    );
  }

  const { drivers = [], totalLaps = 78 } = data;

  return (
    <div style={{
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '6px',
      padding: '15px',
      fontFamily: 'monospace',
    }}>
      {/* Panel Title & Legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', letterSpacing: '1px' }}>
          ⏱ PIT STOP & TYRE STINT STRATEGY
        </span>
        
        {/* Legend */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {Object.entries(COMPOUND_COLORS).map(([name, styles]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px' }}>
              <span style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                backgroundColor: styles.bg,
                borderRadius: '2px',
                border: '1px solid #222',
              }} />
              <span style={{ color: '#888' }}>{name}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', marginLeft: '6px' }}>
            <span style={{
              display: 'inline-block',
              width: '2px',
              height: '10px',
              backgroundColor: '#fff',
              boxShadow: '0 0 3px #fff',
            }} />
            <span style={{ color: '#888' }}>PIT STOP</span>
          </div>
        </div>
      </div>

      {/* Gantt List Container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
        {drivers.map(drv => {
          return (
            <div key={drv.driver} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Driver code + Team badge */}
              <div style={{ width: '90px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  display: 'inline-block',
                  width: '3px',
                  height: '14px',
                  backgroundColor: drv.teamColor,
                  borderRadius: '1px',
                }} />
                <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#fff', width: '32px' }}>
                  {drv.driver}
                </span>
                <span style={{ fontSize: '9px', color: '#555666', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '42px' }} title={drv.team}>
                  {drv.team}
                </span>
              </div>

              {/* Stints horizontal track */}
              <div style={{
                flexGrow: 1,
                height: '22px',
                backgroundColor: '#111116',
                borderRadius: '3px',
                position: 'relative',
                display: 'flex',
                overflow: 'hidden',
                border: '1px solid #1c1c28',
              }}>
                {drv.stints.map((stint, idx) => {
                  const compStyles = COMPOUND_COLORS[stint.compound] || COMPOUND_COLORS.UNKNOWN;
                  const widthPercent = (stint.lapCount / totalLaps) * 100;
                  
                  return (
                    <div
                      key={idx}
                      onMouseEnter={() => setHoveredStint({ driver: drv.driver, ...stint })}
                      onMouseLeave={() => setHoveredStint(null)}
                      style={{
                        width: `${widthPercent}%`,
                        height: '100%',
                        backgroundColor: compStyles.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: compStyles.text,
                        fontSize: '9px',
                        fontWeight: 'bold',
                        cursor: 'help',
                        transition: 'opacity 0.1s ease',
                        opacity: hoveredStint && hoveredStint.driver === drv.driver && hoveredStint.startLap !== stint.startLap ? 0.4 : 0.9,
                        position: 'relative',
                      }}
                    >
                      {stint.lapCount >= 4 && (
                        <span>{stint.lapCount}</span>
                      )}
                    </div>
                  );
                })}

                {/* Pit Stop Marker Overlays */}
                {drv.pitLaps.map(lap => {
                  const leftPercent = (lap / totalLaps) * 100;
                  return (
                    <div
                      key={lap}
                      style={{
                        position: 'absolute',
                        left: `${leftPercent}%`,
                        top: 0,
                        bottom: 0,
                        width: '2px',
                        backgroundColor: '#ffffff',
                        boxShadow: '0 0 4px rgba(255, 255, 255, 0.9)',
                        zIndex: 2,
                        pointerEvents: 'none',
                      }}
                      title={`Pit stop on Lap ${lap}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Axis / Grid Labels */}
      <div style={{ display: 'flex', marginLeft: '102px', marginTop: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '4px', justifyContent: 'space-between', fontSize: '9px', color: '#444552' }}>
        <span>LAP 1</span>
        <span>LAP {Math.round(totalLaps * 0.25)}</span>
        <span>LAP {Math.round(totalLaps * 0.5)}</span>
        <span>LAP {Math.round(totalLaps * 0.75)}</span>
        <span>LAP {totalLaps}</span>
      </div>

      {/* Hover Info HUD */}
      <div style={{
        marginTop: '12px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid #1b1b2a',
        borderRadius: '4px',
        padding: '8px 12px',
        minHeight: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
        color: '#888',
      }}>
        {hoveredStint ? (
          <div>
            DRIVER <span style={{ color: '#fff', fontWeight: 'bold' }}>{hoveredStint.driver}</span> // stint compound:{' '}
            <span style={{ color: COMPOUND_COLORS[hoveredStint.compound]?.bg, fontWeight: 'bold' }}>
              {hoveredStint.compound}
            </span>{' '}
            // laps: <span style={{ color: '#fff', fontWeight: 'bold' }}>{hoveredStint.lapCount}</span> (Lap {hoveredStint.startLap} → {hoveredStint.endLap})
          </div>
        ) : (
          <span>HOVER OVER STINT SECTIONS FOR DETAILED STATS</span>
        )}
      </div>
    </div>
  );
}
