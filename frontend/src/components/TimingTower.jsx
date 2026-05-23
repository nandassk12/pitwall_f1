import React from 'react';

export default function TimingTower({ drivers, activeDriver, setActiveDriver }) {
  return (
    <div style={{ backgroundColor: '#09090d', borderRadius: '6px', border: '1px solid #14141f', padding: '12px' }}>
      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#444552', paddingBottom: '8px', borderBottom: '1px solid #14141f', marginBottom: '8px' }}>
        TRACK GAP CLASSIFICATION
      </div>
      {drivers.map((drv) => (
        <div 
          key={drv.no}
          onClick={() => setActiveDriver(drv.name)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '11px 10px',
            marginBottom: '5px',
            backgroundColor: activeDriver === drv.name ? '#e1060015' : '#0f0f16',
            borderLeft: activeDriver === drv.name ? '4px solid #e10600' : '4px solid transparent',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: activeDriver === drv.name ? '#e10600' : '#444552', fontWeight: 'bold' }}>{drv.pos}</span>
            <div>
              <div style={{ fontWeight: 'bold', color: '#fff' }}>{drv.name}</div>
              <div style={{ fontSize: '9px', color: '#555666' }}>{drv.team.split(' ')[0]}</div>
            </div>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff' }}>{drv.gap}</span>
        </div>
      ))}
    </div>
  );
}
