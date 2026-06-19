import React, { useState, useEffect } from 'react';
import { getTeamColor } from './teamColours';

export default function ChampionshipBoard({ sessionYear, sessionRound, tab }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If we don't have year or round, fetch from the default endpoint (backend will check current loaded session)
    let url = '/api/panels/championship';
    const params = [];
    if (sessionYear) params.push(`year=${sessionYear}`);
    if (sessionRound) params.push(`round=${sessionRound}`);
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }

    setLoading(true);
    setError(null);

    fetch(url)
      .then(r => {
        if (!r.ok) {
          throw new Error('Championship standings fetch failed. Ergast/Jolpica API may be offline.');
        }
        return r.json();
      })
      .then(setData)
      .catch(err => {
        console.error(err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [sessionYear, sessionRound]);

  if (loading) {
    return (
      <div style={{ color: '#888', padding: '30px', fontFamily: 'monospace', textAlign: 'center' }}>
        LOADING CHAMPIONSHIP STANDINGS...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid #2b1114',
        borderRadius: '6px',
        padding: '20px',
        textAlign: 'center',
        fontFamily: 'monospace'
      }}>
        <div style={{ color: '#ff3d00', fontWeight: 'bold', fontSize: '11px', letterSpacing: '1px', marginBottom: '8px' }}>
          STANDINGS UNAVAILABLE — Jolpica/Ergast API Offline
        </div>
        <div style={{ fontSize: '10px', color: '#555666' }}>
          Year: {sessionYear || 'N/A'} // Round: {sessionRound || 'N/A'}
        </div>
      </div>
    );
  }

  const { wdc = [], wcc = [], year, round } = data;
  const wdcLeaderPoints = wdc.length > 0 ? wdc[0].points : 0;
  const wccLeaderPoints = wcc.length > 0 ? wcc[0].points : 0;

  return (
    <div style={{
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '6px',
      padding: '15px',
      fontFamily: 'monospace',
    }}>
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', letterSpacing: '1px' }}>
          🏆 CHAMPIONSHIP STANDINGS // SEASON {year} — ROUND {round}
        </span>
        <span style={{ fontSize: '9px', color: '#555666' }}>
          SOURCE: JOLPICA API (ERGAST DATABASE)
        </span>
      </div>

      {/* Side-by-Side Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: tab === 'drivers' ? '1fr' : tab === 'constructors' ? '1fr' : '1.2fr 1fr',
        gap: '20px'
      }}>
        
        {/* Left Column: WDC Standings */}
        {tab !== 'constructors' && (
          <div>
          <div style={{ fontSize: '9px', color: '#888', fontWeight: 'bold', letterSpacing: '1.5px', marginBottom: '8px', borderBottom: '1px solid #222', paddingBottom: '4px' }}>
            WORLD DRIVERS' CHAMPIONSHIP (WDC)
          </div>
          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
              <thead>
                <tr style={{ color: '#555666', textAlign: 'left', height: '22px' }}>
                  <th style={{ width: '30px' }}>POS</th>
                  <th>DRIVER</th>
                  <th>TEAM</th>
                  <th style={{ textAlign: 'right' }}>PTS</th>
                  <th style={{ textAlign: 'right' }}>WINS</th>
                  <th style={{ textAlign: 'right' }}>GAP</th>
                </tr>
              </thead>
              <tbody>
                {wdc.slice(0, 20).map((entry) => {
                  const teamColor = getTeamColor(entry.team);
                  const isLeader = entry.pos === 1;
                  const gap = isLeader ? '—' : `-${(wdcLeaderPoints - entry.points).toFixed(0)}`;
                  
                  return (
                    <tr
                      key={entry.driver}
                      style={{
                        borderBottom: '1px solid #111116',
                        height: '24px',
                        backgroundColor: entry.pos % 2 === 0 ? 'rgba(25, 25, 35, 0.2)' : 'transparent',
                      }}
                    >
                      <td style={{ fontWeight: 'bold', color: isLeader ? '#ffea00' : '#888' }}>
                        {entry.pos}
                      </td>
                      <td style={{ color: '#fff', fontWeight: 'bold' }}>
                        {entry.driver} <span style={{ color: '#555666', fontSize: '8px', fontWeight: 'normal' }}>({entry.code})</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{
                            display: 'inline-block',
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: teamColor,
                          }} />
                          <span style={{ color: '#aaa', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '100px' }} title={entry.team}>
                            {entry.team}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#fff' }}>
                        {entry.points}
                      </td>
                      <td style={{ textAlign: 'right', color: entry.wins > 0 ? '#ffea00' : '#888' }}>
                        {entry.wins}
                      </td>
                      <td style={{ textAlign: 'right', color: '#ff3d00' }}>
                        {gap}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

        {/* Right Column: WCC Standings */}
        {tab !== 'drivers' && (
          <div>
            <div style={{ fontSize: '9px', color: '#888', fontWeight: 'bold', letterSpacing: '1.5px', marginBottom: '8px', borderBottom: '1px solid #222', paddingBottom: '4px' }}>
            WORLD CONSTRUCTORS' CHAMPIONSHIP (WCC)
          </div>
          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
              <thead>
                <tr style={{ color: '#555666', textAlign: 'left', height: '22px' }}>
                  <th style={{ width: '30px' }}>POS</th>
                  <th>CONSTRUCTOR</th>
                  <th style={{ textAlign: 'right' }}>PTS</th>
                  <th style={{ textAlign: 'right' }}>WINS</th>
                  <th style={{ textAlign: 'right' }}>GAP</th>
                </tr>
              </thead>
              <tbody>
                {wcc.map((entry) => {
                  const teamColor = getTeamColor(entry.team);
                  const isLeader = entry.pos === 1;
                  const gap = isLeader ? '—' : `-${(wccLeaderPoints - entry.points).toFixed(0)}`;
                  
                  return (
                    <tr
                      key={entry.team}
                      style={{
                        borderBottom: '1px solid #111116',
                        height: '24px',
                        backgroundColor: entry.pos % 2 === 0 ? 'rgba(25, 25, 35, 0.2)' : 'transparent',
                      }}
                    >
                      <td style={{ fontWeight: 'bold', color: isLeader ? '#ffea00' : '#888' }}>
                        {entry.pos}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{
                            display: 'inline-block',
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: teamColor,
                          }} />
                          <span style={{ color: '#fff', fontWeight: 'bold' }}>
                            {entry.team}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#fff' }}>
                        {entry.points}
                      </td>
                      <td style={{ textAlign: 'right', color: entry.wins > 0 ? '#ffea00' : '#888' }}>
                        {entry.wins}
                      </td>
                      <td style={{ textAlign: 'right', color: '#ff3d00' }}>
                        {gap}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
