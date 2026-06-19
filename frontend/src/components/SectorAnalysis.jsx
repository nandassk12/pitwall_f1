import React, { useState, useEffect } from 'react';

const FLAG_STYLES = {
  session_best:  { bg: '#2b004a', color: '#d500f9', border: '#d500f9' },  // Purple
  personal_best: { bg: '#002b11', color: '#00e676', border: '#00e676' },  // Green
  normal:        { bg: '#242000', color: '#ffeb3b', border: '#c5b300' },  // Yellow
  none:          { bg: 'transparent', color: '#555666', border: 'transparent' }
};

const COMPOUND_COLORS = {
  SOFT:    '#e8002d',
  MEDIUM:  '#ffea00',
  HARD:    '#f0f0f5',
  INTER:   '#22aa44',
  WET:     '#2979ff',
  UNKNOWN: '#555666'
};

export default function SectorAnalysis({ drivers = [], activeDriver = '' }) {
  const [selectedDriver, setSelectedDriver] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Initialize selected driver from activeDriver prop
  useEffect(() => {
    if (activeDriver) {
      setSelectedDriver(activeDriver);
      setCurrentPage(1);
    }
  }, [activeDriver]);

  // Fetch sector data when selected driver changes
  useEffect(() => {
    if (!selectedDriver) return;
    
    setLoading(true);
    setError(null);
    
    fetch(`/api/panels/sector-analysis?driver=${selectedDriver}`)
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
  }, [selectedDriver]);

  const handleDriverChange = (drvName) => {
    setSelectedDriver(drvName);
    setCurrentPage(1);
  };

  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return '—';
    return seconds.toFixed(3);
  };

  const formatLapTime = (seconds) => {
    if (seconds === null || seconds === undefined) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}:${s.toFixed(3).padStart(6, '0')}` : s.toFixed(3);
  };

  if (!selectedDriver) {
    return (
      <div style={{ color: '#888', padding: '20px', fontFamily: 'monospace', textAlign: 'center' }}>
        SELECT A DRIVER TO ANALYZE SECTOR PERFORMANCE
      </div>
    );
  }

  const laps = data?.laps || [];
  const totalPages = Math.max(1, Math.ceil(laps.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLaps = laps.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div style={{
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '6px',
      padding: '15px',
      fontFamily: 'monospace',
    }}>
      {/* Header & Selection */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', letterSpacing: '1px' }}>
          ◈ SECTOR PERFORMANCE ANALYSIS
        </span>
        
        {/* Legend */}
        <div style={{ display: 'flex', gap: '8px', fontSize: '9px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: FLAG_STYLES.session_best.bg, border: `1px solid ${FLAG_STYLES.session_best.border}` }} />
            <span style={{ color: FLAG_STYLES.session_best.color, fontWeight: 'bold' }}>SESSION BEST (PURPLE)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: FLAG_STYLES.personal_best.bg, border: `1px solid ${FLAG_STYLES.personal_best.border}` }} />
            <span style={{ color: FLAG_STYLES.personal_best.color, fontWeight: 'bold' }}>PERSONAL BEST (GREEN)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: FLAG_STYLES.normal.bg, border: `1px solid ${FLAG_STYLES.normal.border}` }} />
            <span style={{ color: FLAG_STYLES.normal.color, fontWeight: 'bold' }}>NORMAL LAP (YELLOW)</span>
          </div>
        </div>
      </div>

      {/* Driver pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '15px' }}>
        {drivers.map(d => (
          <button
            key={d.name}
            onClick={() => handleDriverChange(d.name)}
            style={{
              padding: '4px 8px',
              fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold',
              backgroundColor: selectedDriver === d.name ? '#e10600' : '#111116',
              color: selectedDriver === d.name ? '#fff' : '#888',
              border: `1px solid ${selectedDriver === d.name ? '#e10600' : '#1c1c28'}`,
              borderRadius: '3px',
              cursor: 'pointer',
              transition: 'all 0.1s ease',
            }}
          >
            {d.name}
          </button>
        ))}
      </div>

      {/* Main Analysis Body */}
      {loading ? (
        <div style={{ color: '#888', padding: '30px', textAlign: 'center', fontSize: '11px' }}>
          FETCHING SECTOR STATISTICS...
        </div>
      ) : error ? (
        <div style={{ color: '#ff4444', padding: '30px', textAlign: 'center', fontSize: '11px' }}>
          {error}
        </div>
      ) : data ? (
        <div>
          {/* Best thresholds HUD */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '12px',
          }}>
            {/* Session best thresholds */}
            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '8px 12px' }}>
              <div style={{ fontSize: '8px', color: '#555666', letterSpacing: '1px', marginBottom: '4px' }}>SESSION FASTEST SECTORS</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span>S1: <span style={{ color: '#bf00ff', fontWeight: 'bold' }}>{formatTime(data.sessionBestS1)}s</span></span>
                <span>S2: <span style={{ color: '#bf00ff', fontWeight: 'bold' }}>{formatTime(data.sessionBestS2)}s</span></span>
                <span>S3: <span style={{ color: '#bf00ff', fontWeight: 'bold' }}>{formatTime(data.sessionBestS3)}s</span></span>
              </div>
            </div>

            {/* Personal best thresholds */}
            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '8px 12px' }}>
              <div style={{ fontSize: '8px', color: '#555666', letterSpacing: '1px', marginBottom: '4px' }}>{data.driver} PERSONAL BEST SECTORS</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span>S1: <span style={{ color: '#00e676', fontWeight: 'bold' }}>{formatTime(data.personalBestS1)}s</span></span>
                <span>S2: <span style={{ color: '#00e676', fontWeight: 'bold' }}>{formatTime(data.personalBestS2)}s</span></span>
                <span>S3: <span style={{ color: '#00e676', fontWeight: 'bold' }}>{formatTime(data.personalBestS3)}s</span></span>
              </div>
            </div>
          </div>

          {/* Sector Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #222', color: '#555666', height: '24px' }}>
                <th style={{ textAlign: 'left', paddingLeft: '8px' }}>LAP</th>
                <th>LAP TIME</th>
                <th>SECTOR 1</th>
                <th>SECTOR 2</th>
                <th>SECTOR 3</th>
                <th>TYRE</th>
                <th>AGE</th>
                <th>PIT</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLaps.map((lapRow) => {
                const s1Style = FLAG_STYLES[lapRow.s1Flag] || FLAG_STYLES.none;
                const s2Style = FLAG_STYLES[lapRow.s2Flag] || FLAG_STYLES.none;
                const s3Style = FLAG_STYLES[lapRow.s3Flag] || FLAG_STYLES.none;
                const compoundColor = COMPOUND_COLORS[lapRow.compound] || COMPOUND_COLORS.UNKNOWN;

                return (
                  <tr
                    key={lapRow.lap}
                    style={{
                      borderBottom: '1px solid #111116',
                      height: '26px',
                      backgroundColor: lapRow.pitStop ? '#2b0c10' : 'transparent',
                    }}
                  >
                    <td style={{ textAlign: 'left', paddingLeft: '8px', color: '#fff', fontWeight: 'bold' }}>
                      L{lapRow.lap}
                    </td>
                    <td style={{ color: '#fff' }}>
                      {formatLapTime(lapRow.lapTime)}
                    </td>
                    
                    {/* Sector 1 */}
                    <td style={{ padding: '2px' }}>
                      <div style={{
                        backgroundColor: s1Style.bg,
                        color: s1Style.color,
                        border: `1px solid ${s1Style.border}`,
                        borderRadius: '2px',
                        padding: '2px 0',
                        fontWeight: lapRow.s1Flag !== 'normal' && lapRow.s1Flag !== 'none' ? 'bold' : 'normal',
                      }}>
                        {formatTime(lapRow.s1)}
                      </div>
                    </td>

                    {/* Sector 2 */}
                    <td style={{ padding: '2px' }}>
                      <div style={{
                        backgroundColor: s2Style.bg,
                        color: s2Style.color,
                        border: `1px solid ${s2Style.border}`,
                        borderRadius: '2px',
                        padding: '2px 0',
                        fontWeight: lapRow.s2Flag !== 'normal' && lapRow.s2Flag !== 'none' ? 'bold' : 'normal',
                      }}>
                        {formatTime(lapRow.s2)}
                      </div>
                    </td>

                    {/* Sector 3 */}
                    <td style={{ padding: '2px' }}>
                      <div style={{
                        backgroundColor: s3Style.bg,
                        color: s3Style.color,
                        border: `1px solid ${s3Style.border}`,
                        borderRadius: '2px',
                        padding: '2px 0',
                        fontWeight: lapRow.s3Flag !== 'normal' && lapRow.s3Flag !== 'none' ? 'bold' : 'normal',
                      }}>
                        {formatTime(lapRow.s3)}
                      </div>
                    </td>

                    {/* Tyre info */}
                    <td>
                      <span style={{
                        color: compoundColor,
                        fontWeight: 'bold',
                        fontSize: '9px',
                        border: `1px solid ${compoundColor}`,
                        padding: '1px 4px',
                        borderRadius: '2px',
                      }}>
                        {lapRow.compound}
                      </span>
                    </td>
                    <td style={{ color: '#888' }}>{lapRow.tyreAge}</td>
                    <td style={{ color: lapRow.pitStop ? '#ff3d00' : '#888', fontWeight: lapRow.pitStop ? 'bold' : 'normal' }}>
                      {lapRow.pitStop ? '◀ IN' : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '9px', color: '#555666' }}>
              SHOWING LAPS {startIndex + 1}–{Math.min(startIndex + itemsPerPage, laps.length)} OF {laps.length}
            </span>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                style={{
                  padding: '3px 8px',
                  backgroundColor: '#111116',
                  color: currentPage === 1 ? '#444' : '#888',
                  border: '1px solid #1c1c28',
                  borderRadius: '3px',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '10px',
                }}
              >
                ◀ PREV
              </button>
              <span style={{ fontSize: '10px', color: '#fff', display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                PAGE {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                style={{
                  padding: '3px 8px',
                  backgroundColor: '#111116',
                  color: currentPage === totalPages ? '#444' : '#888',
                  border: '1px solid #1c1c28',
                  borderRadius: '3px',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '10px',
                }}
              >
                NEXT ▶
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ color: '#888', padding: '20px', textAlign: 'center' }}>
          NO LAP SECTOR DATA FOR THIS DRIVER
        </div>
      )}
    </div>
  );
}
