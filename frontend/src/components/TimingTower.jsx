import React from 'react';
import { getTeamColor } from './teamColours';

export default function TimingTower({ drivers = [], activeDriver = '', setActiveDriver }) {
  return (
    <div style={{
      backgroundColor: 'var(--bg-secondary)',
      borderRadius: '6px',
      border: '1px solid var(--border-color)',
      padding: '20px',
      fontFamily: 'monospace',
      width: '100%',
      boxSizing: 'border-box',
    }}>
      {/* Title Header */}
      <div style={{
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#e10600',
        letterSpacing: '1px',
        marginBottom: '16px',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>◆ RACE RESULTS CLASSIFICATION</span>
        <span style={{ fontSize: '12px', color: '#555666' }}>OFFICIAL FIA CLASSIFICATION</span>
      </div>

      {/* Table Container */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)', color: '#888899', fontSize: '13px', height: '35px' }}>
              <th style={{ padding: '8px 12px', width: '70px' }}>POS.</th>
              <th style={{ padding: '8px 12px', width: '70px' }}>NO.</th>
              <th style={{ padding: '8px 12px' }}>DRIVER</th>
              <th style={{ padding: '8px 12px' }}>TEAM</th>
              <th style={{ padding: '8px 12px', width: '110px' }}>Grid POS</th>
              <th style={{ padding: '8px 12px', width: '180px' }}>INT</th>
              <th style={{ padding: '8px 12px', width: '100px', textAlign: 'right' }}>POINTS</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((drv) => {
              const teamColor = getTeamColor(drv.team);
              const isPointsFinish = drv.pointsScored > 0;

              return (
                <tr
                  key={drv.no}
                  style={{
                    borderBottom: '1px solid #14141f',
                    height: '45px',
                    fontSize: '15px',
                    color: '#f5f5f7',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0d0d14'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {/* Position */}
                  <td style={{ padding: '8px 12px', fontWeight: 'bold', color: drv.pos === 1 ? '#ffd700' : drv.pos === 2 ? '#c0c0c0' : drv.pos === 3 ? '#cd7f32' : '#888899' }}>
                    {drv.pos}
                  </td>

                  {/* Driver Number */}
                  <td style={{ padding: '8px 12px', color: '#888899' }}>
                    #{drv.no}
                  </td>

                  {/* Driver Name */}
                  <td style={{ padding: '8px 12px', fontWeight: 'bold', color: '#ffffff' }}>
                    {drv.fullName ? drv.fullName.toUpperCase() : drv.name}
                  </td>

                  {/* Team */}
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: teamColor,
                        marginRight: '10px',
                        flexShrink: 0
                      }} />
                      <span>{drv.team}</span>
                    </div>
                  </td>

                  {/* Starting Position (Grid) */}
                  <td style={{ padding: '8px 12px', color: '#888899' }}>
                    P{drv.grid || drv.pos}
                  </td>

                  {/* Interval */}
                  <td style={{
                    padding: '8px 12px',
                    fontWeight: 'bold',
                    color: drv.interval === 'DNF' || drv.gap === 'DNF' ? '#ff1744' : drv.interval === 'DSQ' || drv.gap === 'DSQ' ? '#e10600' : '#ffffff'
                  }}>
                    {drv.interval || drv.gap || '—'}
                  </td>

                  {/* Points */}
                  <td style={{
                    padding: '8px 12px',
                    textAlign: 'right',
                    fontWeight: 'bold',
                    color: isPointsFinish ? '#ffea00' : '#555666'
                  }}>
                    {isPointsFinish ? `+${drv.pointsScored}` : '0'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
