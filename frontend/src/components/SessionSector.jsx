import React, { useState, useEffect, useMemo } from 'react';
import API_BASE from '../config';

const COMPOUND_COLORS = {
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

export default function SessionSector({ drivers = [], activeDriver = '', setActiveDriver, simState }) {
  const [activeTab, setActiveTab] = useState('LAP'); // 'LAP' | 'SECTOR' | 'ANALYSIS' | 'TIRE' | 'GRID'
  const [history, setHistory] = useState(null);

  const [analysisDriver, setAnalysisDriver] = useState(activeDriver || '');
  const [analysisData, setAnalysisData] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [analysisPage, setAnalysisPage] = useState(1);

  const [selectFocused, setSelectFocused] = useState(false);
  const [selectHovered, setSelectHovered] = useState(false);

  useEffect(() => {
    if (activeDriver) {
      setAnalysisDriver(activeDriver);
      setAnalysisPage(1);
    }
  }, [activeDriver]);

  useEffect(() => {
    if (!analysisDriver) return;
    setAnalysisLoading(true);
    setAnalysisError(null);
    fetch(`${API_BASE}/api/panels/sector-analysis?driver=${analysisDriver}`)
      .then(r => r.ok ? r.json() : Promise.reject('Simulation not active.'))
      .then(setAnalysisData)
      .catch(err => setAnalysisError(err.toString()))
      .finally(() => setAnalysisLoading(false));
  }, [analysisDriver]);

  // Destructure state
  const { currentLap, ready, lapState } = simState || {};

  // Fetch full simulation history once session is ready
  useEffect(() => {
    if (ready) {
      fetch(`${API_BASE}/api/sim/history`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) setHistory(data.laps);
        })
        .catch(() => {});
    } else {
      setHistory(null);
    }
  }, [ready]);

  // Sort drivers based on current simulation position
  const sortedLapState = useMemo(() => {
    if (!lapState || lapState.length === 0) {
      // Fall back to static drivers list if simulation is not ready
      return drivers.map(d => ({
        driver: d.name,
        teamColor: d.teamColor || '#888899',
        team: d.team,
        position: d.pos,
        gapLabel: d.gapLabel || d.gap || '—',
        gap: d.gap ? (typeof d.gap === 'string' ? parseFloat(d.gap.replace(/[^\d.]/g, '')) : d.gap) : null,
        interval: null,
        lapTime: null,
        sector1: null,
        sector2: null,
        sector3: null,
        compound: 'UNKNOWN',
        tyreAge: 0,
        pitStop: false,
      }));
    }
    return [...lapState].sort((a, b) => a.position - b.position);
  }, [lapState, drivers]);

  // ── Stats Calculations (Dynamic History-Aware lookup) ──────────────────────────
  const stats = useMemo(() => {
    const personalBestLaps = {};
    const personalBestSectors = {};
    const sessionBestSectors = { s1: Infinity, s2: Infinity, s3: Infinity };
    const startingGrid = {};
    const pitCounts = {};

    if (!history) return { personalBestLaps, personalBestSectors, sessionBestSectors, startingGrid, pitCounts };

    // Calculate starting grid from Lap 1
    if (history[1]) {
      history[1].forEach(d => {
        startingGrid[d.driver] = d.position;
      });
    }

    const upToLap = currentLap > 0 ? currentLap : 1;

    for (let l = 1; l <= upToLap; l++) {
      const lapData = history[l] || [];
      lapData.forEach(d => {
        // Pit stops count
        if (d.pitIn) {
          pitCounts[d.driver] = (pitCounts[d.driver] || 0) + 1;
        }

        // Lap Times
        if (d.lapTime && d.lapTime > 0) {
          if (!personalBestLaps[d.driver] || d.lapTime < personalBestLaps[d.driver]) {
            personalBestLaps[d.driver] = d.lapTime;
          }
        }

        // Sector times
        if (!personalBestSectors[d.driver]) {
          personalBestSectors[d.driver] = { s1: Infinity, s2: Infinity, s3: Infinity };
        }
        if (d.sector1 && d.sector1 < personalBestSectors[d.driver].s1) {
          personalBestSectors[d.driver].s1 = d.sector1;
        }
        if (d.sector2 && d.sector2 < personalBestSectors[d.driver].s2) {
          personalBestSectors[d.driver].s2 = d.sector2;
        }
        if (d.sector3 && d.sector3 < personalBestSectors[d.driver].s3) {
          personalBestSectors[d.driver].s3 = d.sector3;
        }

        if (d.sector1 && d.sector1 < sessionBestSectors.s1) sessionBestSectors.s1 = d.sector1;
        if (d.sector2 && d.sector2 < sessionBestSectors.s2) sessionBestSectors.s2 = d.sector2;
        if (d.sector3 && d.sector3 < sessionBestSectors.s3) sessionBestSectors.s3 = d.sector3;
      });
    }

    return { personalBestLaps, personalBestSectors, sessionBestSectors, startingGrid, pitCounts };
  }, [history, currentLap]);

  // ── Render Mini Sector Bars ────────────────────────────────────────────────
  const renderMiniSectorBars = (sectorVal, personalBest, sessionBest) => {
    const bars = [];
    const color = (sectorVal && sessionBest && sectorVal <= sessionBest) ? '#bf00ff' // Purple
                : (sectorVal && personalBest && sectorVal <= personalBest) ? '#00e676' // Green
                : sectorVal ? '#ffea00' // Yellow
                : '#313148'; // Grey/Empty

    for (let i = 0; i < 6; i++) {
      bars.push(
        <span
          key={i}
          style={{
            width: '3px',
            height: '8px',
            backgroundColor: color,
            borderRadius: '0.5px',
          }}
        />
      );
    }
    return <div style={{ display: 'flex', gap: '1px' }}>{bars}</div>;
  };

  return (
    <div style={containerStyle}>
      {/* ── TOP TABS NAVBAR ── */}
      <div style={tabBarStyle}>
        {['LAP', 'SECTOR', 'ANALYSIS', 'TIRE', 'GRID'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={activeTab === tab ? activeTabStyle : inactiveTabStyle}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── TABLE CONTENT AREA ── */}
      <div className="timing-tower-list" style={listContainerStyle}>
        {/* Table Headers */}
        {activeTab !== 'ANALYSIS' && (
          <div style={headerStyle(activeTab)}>
            <span style={thStyle}>DRIVER</span>
            {activeTab === 'LAP' && (
              <>
                <span style={thStyle}>INTERVAL</span>
                <span style={thStyle}>LAP TIME</span>
                <span style={thStyle}>MINI SECTOR</span>
                <span style={thStyle}>TIRE</span>
              </>
            )}
            {activeTab === 'SECTOR' && (
              <>
                <span style={thStyle}>LAP TIME</span>
                <span style={thStyle}>SECTOR 1</span>
                <span style={thStyle}>SECTOR 2</span>
                <span style={thStyle}>SECTOR 3</span>
              </>
            )}
            {activeTab === 'TIRE' && (
              <>
                <span style={thStyle}>COMPOUND</span>
                <span style={thStyle}>AGE</span>
                <span style={thStyle}>STOPS</span>
                <span style={thStyle}>STATUS</span>
              </>
            )}
            {activeTab === 'GRID' && (
              <>
                <span style={thStyle}>GRID POS</span>
                <span style={thStyle}>CURRENT</span>
                <span style={thStyle}>CHANGE</span>
              </>
            )}
          </div>
        )}

        {/* Table Body Rows */}
        {activeTab !== 'ANALYSIS' && sortedLapState.map((entry, idx) => {
          const isSelected = activeDriver === entry.driver;
          const compound = (entry.compound || 'UNKNOWN').toUpperCase();
          const cmpColor = COMPOUND_COLORS[compound] || '#888';
          const pBestLap = stats.personalBestLaps[entry.driver];
          const pBestSectors = stats.personalBestSectors[entry.driver] || {};
          const pitCount = stats.pitCounts[entry.driver] || 0;
          
          const isLeader = entry.position === 1;

          // Calculate Interval & Gap
          const displayInterval = (() => {
            if (entry.interval != null && entry.interval !== entry.gap) {
              return entry.interval;
            }
            if (idx > 0) {
              const prevEntry = sortedLapState[idx - 1];
              if (entry.gap != null && prevEntry.gap != null) {
                const diff = entry.gap - prevEntry.gap;
                return diff >= 0 ? Number(diff.toFixed(3)) : 0;
              }
            }
            return null;
          })();

          const isRetired = entry.gapLabel === 'DNF' || entry.gapLabel === 'RETIRED';

          return (
            <div
              key={entry.driver}
              onClick={() => setActiveDriver(entry.driver)}
              style={rowStyle(isSelected, isRetired, activeTab)}
            >
              {/* 1. DRIVER PROFILE COLUMN (Shown on all tabs) */}
              <div style={driverColStyle}>
                <span style={posStyle(entry.position, isRetired)}>{isRetired ? 'DNF' : entry.position}</span>
                <span style={colorBarStyle(entry.teamColor)} />
                <span style={drvCodeStyle}>{entry.driver}</span>
              </div>

              {/* ── LAP TAB VIEW ── */}
              {activeTab === 'LAP' && (
                <>
                  {/* INTERVAL */}
                  <div style={cellDuoStyle}>
                    <span style={{ color: '#fff', fontWeight: 'bold' }}>
                      {isLeader ? '--' : isRetired ? '1L' : displayInterval != null ? `+${displayInterval}s` : '—'}
                    </span>
                    <span style={{ color: '#888', fontSize: '13px' }}>
                      {isLeader ? '' : isRetired ? 'RETIRED' : entry.gapLabel || '—'}
                    </span>
                  </div>

                  {/* LAP TIME */}
                  <div style={cellDuoStyle}>
                    <span style={{ color: isRetired ? '#ff1744' : isLeader ? '#00e676' : '#fff' }}>
                      {isRetired ? 'RETIRED' : fmt(entry.lapTime)}
                    </span>
                    <span style={{ color: '#888', fontSize: '13px' }}>
                      {pBestLap ? fmt(pBestLap) : fmt(entry.lapTime)}
                    </span>
                  </div>

                  {/* MINI SECTORS */}
                  <div style={miniSectorColStyle}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      {/* S1 */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        {renderMiniSectorBars(entry.sector1, pBestSectors.s1, stats.sessionBestSectors.s1)}
                        <span style={{ fontSize: '13px', color: '#ffea00', marginTop: '2px' }}>
                          {entry.sector1 ? entry.sector1.toFixed(3) : '—'}
                        </span>
                      </div>
                      {/* S2 */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        {renderMiniSectorBars(entry.sector2, pBestSectors.s2, stats.sessionBestSectors.s2)}
                        <span style={{ fontSize: '13px', color: '#ffea00', marginTop: '2px' }}>
                          {entry.sector2 ? entry.sector2.toFixed(3) : '—'}
                        </span>
                      </div>
                      {/* S3 */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        {renderMiniSectorBars(entry.sector3, pBestSectors.s3, stats.sessionBestSectors.s3)}
                        <span style={{ fontSize: '13px', color: '#ffea00', marginTop: '2px' }}>
                          {entry.sector3 ? entry.sector3.toFixed(3) : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* TIRE */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={circleTireStyle(cmpColor)}>
                      {compound.slice(0, 1)}
                    </div>
                    <div style={cellDuoStyle}>
                      <span style={{ color: '#fff', fontWeight: 'bold' }}>{pitCount}PIT</span>
                      <span style={{ color: '#888', fontSize: '13px' }}>{entry.tyreAge}LAP</span>
                    </div>
                  </div>
                </>
              )}

              {/* ── SECTOR TAB VIEW ── */}
              {activeTab === 'SECTOR' && (
                <>
                  <div style={singleCellStyle}>{fmt(entry.lapTime)}</div>
                  
                  {/* S1 */}
                  <div style={sectorCellStyle(entry.sector1, pBestSectors.s1, stats.sessionBestSectors.s1)}>
                    {entry.sector1 ? `${entry.sector1.toFixed(3)}s` : '—'}
                  </div>

                  {/* S2 */}
                  <div style={sectorCellStyle(entry.sector2, pBestSectors.s2, stats.sessionBestSectors.s2)}>
                    {entry.sector2 ? `${entry.sector2.toFixed(3)}s` : '—'}
                  </div>

                  {/* S3 */}
                  <div style={sectorCellStyle(entry.sector3, pBestSectors.s3, stats.sessionBestSectors.s3)}>
                    {entry.sector3 ? `${entry.sector3.toFixed(3)}s` : '—'}
                  </div>
                </>
              )}

              {/* ── TIRE TAB VIEW ── */}
              {activeTab === 'TIRE' && (
                <>
                  <div style={{ ...singleCellStyle, color: cmpColor, fontWeight: 'bold' }}>
                    {compound}
                  </div>
                  <div style={singleCellStyle}>{entry.tyreAge} laps</div>
                  <div style={singleCellStyle}>{pitCount} stops</div>
                  <div style={{ ...singleCellStyle, color: entry.pitStop ? '#ff9800' : '#888', fontWeight: 'bold' }}>
                    {entry.pitIn ? 'PIT IN' : entry.pitOut ? 'PIT OUT' : entry.pitStop ? 'IN PITS' : 'ON TRACK'}
                  </div>
                </>
              )}



              {/* ── GRID TAB VIEW ── */}
              {activeTab === 'GRID' && (
                <>
                  <div style={singleCellStyle}>P{stats.startingGrid[entry.driver] || '—'}</div>
                  <div style={singleCellStyle}>P{entry.position}</div>
                  
                  {/* Position Change */}
                  <div style={gridChangeStyle(stats.startingGrid[entry.driver] - entry.position)}>
                    {(() => {
                      const start = stats.startingGrid[entry.driver];
                      if (!start) return '—';
                      const diff = start - entry.position;
                      if (diff > 0) return `▲ +${diff}`;
                      if (diff < 0) return `▼ ${diff}`;
                      return '◀ 0';
                    })()}
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* ── SECTOR ANALYSIS DETAIL VIEW ── */}
        {activeTab === 'ANALYSIS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '15px' }}>
            {/* Driver Dropdown Select */}
            <div style={{ width: '100%', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {analysisDriver && (
                <span style={{ color: '#ffffff', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '15px', textTransform: 'uppercase', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  DRIVER:
                </span>
              )}
              <select
                value={analysisDriver}
                onChange={(e) => {
                  setAnalysisDriver(e.target.value);
                  setAnalysisPage(1);
                }}
                onFocus={() => setSelectFocused(true)}
                onBlur={() => setSelectFocused(false)}
                onMouseEnter={() => setSelectHovered(true)}
                onMouseLeave={() => setSelectHovered(false)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  paddingRight: '32px',
                  fontSize: '15px',
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  backgroundColor: 'var(--bg-tertiary)',
                  color: '#ffffff',
                  border: selectFocused
                    ? '1px solid var(--color-primary)'
                    : selectHovered
                    ? '1px solid #454655'
                    : '1px solid var(--border-color)',
                  borderRadius: '3px',
                  outline: 'none',
                  appearance: 'none',
                  cursor: 'pointer',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M1 1l3 2 3-2' stroke='%23888899' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  transition: 'all 0.15s ease',
                  boxShadow: selectFocused ? '0 0 8px rgba(225, 6, 0, 0.2)' : 'none',
                }}
              >
                <option value="" disabled>SELECT DRIVER FOR ANALYSIS...</option>
                {drivers.map(d => {
                  const label = `${d.name} — ${d.fullName || d.name}`;
                  return (
                    <option key={d.name} value={d.name} style={{ backgroundColor: 'var(--bg-tertiary)', color: '#ffffff' }}>
                      {label.toUpperCase()}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: '#888' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: '#2b004a', border: '1px solid #d500f9' }} />
                <span style={{ color: '#d500f9', fontWeight: 'bold' }}>SESSION BEST</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: '#002b11', border: '1px solid #00e676' }} />
                <span style={{ color: '#00e676', fontWeight: 'bold' }}>PERSONAL BEST</span>
              </div>
            </div>

            {analysisLoading ? (
              <div style={{ color: '#888', padding: '20px', textAlign: 'center' }}>LOADING SECTORS...</div>
            ) : analysisError ? (
              <div style={{ color: '#ff4444', padding: '20px', textAlign: 'center' }}>{analysisError}</div>
            ) : analysisData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Thresholds summary */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '13px', backgroundColor: '#0c0c12', padding: '6px', borderRadius: '4px' }}>
                  <div>
                    <div style={{ color: '#555666', fontSize: '12px', marginBottom: '2px' }}>SESSION BEST</div>
                    <div>S1: <span style={{ color: '#bf00ff' }}>{analysisData.sessionBestS1?.toFixed(3) || '—'}</span></div>
                    <div>S2: <span style={{ color: '#bf00ff' }}>{analysisData.sessionBestS2?.toFixed(3) || '—'}</span></div>
                    <div>S3: <span style={{ color: '#bf00ff' }}>{analysisData.sessionBestS3?.toFixed(3) || '—'}</span></div>
                  </div>
                  <div>
                    <div style={{ color: '#555666', fontSize: '12px', marginBottom: '2px' }}>PERSONAL BEST</div>
                    <div>S1: <span style={{ color: '#00e676' }}>{analysisData.personalBestS1?.toFixed(3) || '—'}</span></div>
                    <div>S2: <span style={{ color: '#00e676' }}>{analysisData.personalBestS2?.toFixed(3) || '—'}</span></div>
                    <div>S3: <span style={{ color: '#00e676' }}>{analysisData.personalBestS3?.toFixed(3) || '—'}</span></div>
                  </div>
                </div>

                {/* Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: '#555666', height: '20px' }}>
                      <th style={{ textAlign: 'left' }}>LAP</th>
                      <th>LAP TIME</th>
                      <th>S1</th>
                      <th>S2</th>
                      <th>S3</th>
                      <th>TYRE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisData.laps.slice((analysisPage - 1) * 8, analysisPage * 8).map(lapRow => {
                      const s1Color = lapRow.s1Flag === 'session_best' ? '#d500f9' : lapRow.s1Flag === 'personal_best' ? '#00e676' : '#ffea00';
                      const s2Color = lapRow.s2Flag === 'session_best' ? '#d500f9' : lapRow.s2Flag === 'personal_best' ? '#00e676' : '#ffea00';
                      const s3Color = lapRow.s3Flag === 'session_best' ? '#d500f9' : lapRow.s3Flag === 'personal_best' ? '#00e676' : '#ffea00';
                      const compoundColor = COMPOUND_COLORS[lapRow.compound.toUpperCase()] || '#888';

                      return (
                        <tr key={lapRow.lap} style={{ borderBottom: '1px solid #14141f', height: '22px' }}>
                          <td style={{ fontWeight: 'bold', color: '#fff' }}>L{lapRow.lap}</td>
                          <td style={{ color: '#fff', textAlign: 'center' }}>{fmt(lapRow.lapTime)}</td>
                          <td style={{ color: s1Color, textAlign: 'center', fontWeight: 'bold' }}>{lapRow.s1?.toFixed(3) || '—'}</td>
                          <td style={{ color: s2Color, textAlign: 'center', fontWeight: 'bold' }}>{lapRow.s2?.toFixed(3) || '—'}</td>
                          <td style={{ color: s3Color, textAlign: 'center', fontWeight: 'bold' }}>{lapRow.s3?.toFixed(3) || '—'}</td>
                          <td style={{ color: compoundColor, textAlign: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                            {lapRow.compound.slice(0, 3)} L{lapRow.tyreAge}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '13px', color: '#555666' }}>
                  <span>PAGE {analysisPage} / {Math.ceil(analysisData.laps.length / 8)}</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      disabled={analysisPage === 1}
                      onClick={() => setAnalysisPage(p => Math.max(1, p - 1))}
                      style={{
                        padding: '2px 6px',
                        backgroundColor: '#111116',
                        color: analysisPage === 1 ? '#444' : '#888',
                        border: '1px solid #1c1c28',
                        borderRadius: '2px',
                        cursor: analysisPage === 1 ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      PREV
                    </button>
                    <button
                      disabled={analysisPage >= Math.ceil(analysisData.laps.length / 8)}
                      onClick={() => setAnalysisPage(p => p + 1)}
                      style={{
                        padding: '2px 6px',
                        backgroundColor: '#111116',
                        color: analysisPage >= Math.ceil(analysisData.laps.length / 8) ? '#444' : '#888',
                        border: '1px solid #1c1c28',
                        borderRadius: '2px',
                        cursor: analysisPage >= Math.ceil(analysisData.laps.length / 8) ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      NEXT
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: '#888', padding: '20px', textAlign: 'center' }}>NO DATA AVAILABLE</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const containerStyle = {
  backgroundColor: 'var(--bg-secondary)',
  border:          '1px solid var(--border-color)',
  borderRadius:    '6px',
  padding:         '12px',
  fontFamily:      'monospace',
  display:         'flex',
  flexDirection:   'column',
  gap:             '12px',
  height:          'fit-content',
  boxSizing:       'border-box',
};

const tabBarStyle = {
  display:         'flex',
  gap:             '6px',
  backgroundColor: '#0c0c12',
  padding:         '4px',
  borderRadius:    '4px',
};

const activeTabStyle = {
  flex:            1,
  backgroundColor: 'var(--border-color)',
  color:           '#ffffff',
  border:          'none',
  padding:         '6px 0',
  fontFamily:      'monospace',
  fontSize:        '15px',
  fontWeight:      'bold',
  borderRadius:    '3px',
  cursor:          'pointer',
  textAlign:       'center',
  textTransform:   'uppercase',
};

const inactiveTabStyle = {
  flex:            1,
  backgroundColor: 'transparent',
  color:           '#555666',
  border:          'none',
  padding:         '6px 0',
  fontFamily:      'monospace',
  fontSize:        '15px',
  fontWeight:      'bold',
  cursor:          'pointer',
  textAlign:       'center',
  textTransform:   'uppercase',
  transition:      'color 0.15s ease',
};

const listContainerStyle = {
  display:         'flex',
  flexDirection:   'column',
  gap:             '4px',
};

const getGridTemplateColumns = (tab) => {
  switch (tab) {
    case 'LAP':    return '1.2fr 0.8fr 1fr 2fr 0.8fr';
    case 'SECTOR': return '1fr 1fr 1fr 1fr 1fr';
    case 'TIRE':   return '1fr 1fr 0.8fr 0.8fr 1.2fr';
    case 'GRID':   return '1fr 1fr 1fr 1fr';
    default:       return '1.2fr 0.8fr 1fr 2fr 0.8fr';
  }
};

const headerStyle = (tab) => ({
  display:         'grid',
  gridTemplateColumns: getGridTemplateColumns(tab),
  columnGap:       '12px',
  alignItems:      'center',
  padding:         '6px 8px',
  borderBottom:    '1px solid var(--border-color)',
  color:           '#444552',
  fontSize:        '13px',
  fontWeight:      'bold',
  letterSpacing:   '0.5px',
});

const thStyle = {
  textAlign: 'left',
};

const rowStyle = (isSelected, isRetired, tab) => ({
  display:         'grid',
  gridTemplateColumns: getGridTemplateColumns(tab),
  columnGap:       '12px',
  alignItems:      'center',
  padding:         '8px',
  backgroundColor: isSelected ? 'var(--border-color)' : '#0c0c12',
  borderRadius:    '4px',
  cursor:          'pointer',
  opacity:         isRetired ? 0.5 : 1,
  transition:      'all 0.15s ease',
  boxShadow:       isSelected ? '0 2px 5px rgba(0,0,0,0.3)' : 'none',
  borderBottom:    '1px solid #14141f',
});

const driverColStyle = {
  display:     'flex',
  alignItems:  'center',
  gap:         '6px',
};

const posStyle = (pos, isRetired) => ({
  color: isRetired ? '#ff1744' : pos === 1 ? '#ffd700' : pos === 2 ? '#c0c0c0' : pos === 3 ? '#cd7f32' : '#444552',
  fontWeight: 'bold',
  fontSize:   '15px',
  width:      '16px',
  textAlign:  'left',
});

const colorBarStyle = (color) => ({
  width:           '3px',
  height:          '16px',
  backgroundColor: color || '#888',
  borderRadius:    '1px',
  flexShrink:      0,
});

const drvCodeStyle = {
  fontWeight: 'bold',
  color:      '#fff',
  fontSize:   '16px',
};

const cellDuoStyle = {
  display:       'flex',
  flexDirection: 'column',
  fontSize:      '14px',
  textAlign:     'left',
};

const singleCellStyle = {
  fontSize:  '15px',
  color:     '#fff',
  textAlign: 'left',
};

const miniSectorColStyle = {
  display:       'flex',
  flexDirection: 'column',
  textAlign:     'left',
};

const circleTireStyle = (color) => ({
  width:           '16px',
  height:          '16px',
  borderRadius:    '50%',
  border:          `1px solid ${color}`,
  color:           color,
  display:         'flex',
  alignItems:      'center',
  justifyContent:  'center',
  fontWeight:      'bold',
  fontSize:        '13px',
  flexShrink:      0,
});

const sectorCellStyle = (val, personalBest, sessionBest) => {
  const color = (val && sessionBest && val <= sessionBest) ? '#bf00ff' // Purple
              : (val && personalBest && val <= personalBest) ? '#00e676' // Green
              : val ? '#ffea00' // Yellow
              : '#888899';
  return {
    fontSize:   '15px',
    color:      color,
    fontWeight: 'bold',
    textAlign:  'left',
  };
};

const gridChangeStyle = (change) => {
  const color = change > 0 ? '#00e676' // Gained (Green)
              : change < 0 ? '#ff1744' // Lost (Red)
              : '#888899'; // Equal (Grey)
  return {
    fontSize:   '15px',
    color:      color,
    fontWeight: 'bold',
    textAlign:  'left',
  };
};
