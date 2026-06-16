import React, { useState, useEffect } from 'react';
import { getTeamColor } from './teamColours';
import { getDriverHeadshot } from './driverImages';

export default function TimingTower({ drivers = [], activeDriver = '', setActiveDriver, simState }) {
  const activeDrvObj = drivers.find(d => d.name === activeDriver) || drivers[0];
  const [headshot, setHeadshot] = useState(null);
  const [loadingImg, setLoadingImg] = useState(false);

  // Fetch headshot when the active driver changes
  useEffect(() => {
    if (activeDrvObj?.fullName) {
      setLoadingImg(true);
      getDriverHeadshot(activeDrvObj.fullName)
        .then(url => {
          setHeadshot(url);
          setLoadingImg(false);
        })
        .catch(() => {
          setHeadshot(null);
          setLoadingImg(false);
        });
    }
  }, [activeDrvObj?.fullName]);

  const activeColor = activeDrvObj ? getTeamColor(activeDrvObj.team) : '#e10600';

  return (
    <div style={{
      backgroundColor: '#09090d',
      borderRadius: '6px',
      border: '1px solid #14141f',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      fontFamily: 'monospace',
      height: '100%',
      boxSizing: 'border-box',
    }}>
      <style>{`
        .timing-tower-list::-webkit-scrollbar {
          width: 4px;
        }
        .timing-tower-list::-webkit-scrollbar-track {
          background: #09090d;
        }
        .timing-tower-list::-webkit-scrollbar-thumb {
          background: #1c1c28;
          border-radius: 2px;
        }
        .timing-tower-list::-webkit-scrollbar-thumb:hover {
          background: #313148;
        }
      `}</style>

      {/* HUD Header */}
      <div style={{ 
        fontSize: '11px', 
        fontWeight: 'bold', 
        color: '#444552', 
        paddingBottom: '8px', 
        borderBottom: '1px solid #14141f',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>TRACK GAP CLASSIFICATION</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingRight: '10px' }}>
          <span style={{ width: '65px', textAlign: 'right' }}>PTS</span>
          <span style={{ width: '78px', textAlign: 'right' }}>GAP</span>
        </div>
      </div>

      {/* ACTIVE DRIVER FOCUS CARD */}
      {activeDrvObj && (
        <div style={{
          backgroundColor: '#0c0c12',
          border: `1px solid ${activeColor}40`,
          borderRadius: '6px',
          padding: '10px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          transition: 'all 0.2s ease',
          boxShadow: `0 0 10px ${activeColor}15`,
        }}>
          {/* Driver headshot */}
          <div style={{
            position: 'relative',
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            overflow: 'hidden',
            backgroundColor: '#111116',
            border: `2px solid ${activeColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {loadingImg ? (
              <div style={{ fontSize: '8px', color: '#555' }}>...</div>
            ) : headshot ? (
              <img
                src={headshot}
                alt={activeDrvObj.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#444' }}>
                {activeDrvObj.name}
              </span>
            )}
          </div>

          {/* Profile details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
            <div style={{ fontSize: '8px', color: activeColor, fontWeight: 'bold', letterSpacing: '1px' }}>
              ACTIVE ANALYSIS
            </div>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {activeDrvObj.fullName}
            </div>
            <div style={{ fontSize: '9px', color: '#888899', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {activeDrvObj.team}
            </div>
            <div style={{ fontSize: '9px', color: '#555666' }}>
              CAR #{activeDrvObj.no}
            </div>
          </div>
        </div>
      )}

      {/* DRIVERS LIST CLASSIFICATION */}
      <div 
        className="timing-tower-list overflow-auto"
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '5px',
          maxHeight: '348px',
          overflowY: 'auto',
          overflowX: 'auto',
          paddingRight: '4px'
        }}
      >
        {drivers.map((drv) => {
          const isSelected = activeDriver === drv.name;
          const teamColor = getTeamColor(drv.team);
          const hasTel = drv.hasTelemetry !== false;

          return (
            <div
              key={drv.no}
              onClick={() => hasTel && setActiveDriver(drv.name)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 10px',
                backgroundColor: isSelected ? '#14141f' : '#0c0c12',
                borderLeft: `4px solid ${teamColor}`,
                borderRadius: '4px',
                cursor: hasTel ? 'pointer' : 'not-allowed',
                opacity: hasTel ? 1 : 0.45,
                transition: 'all 0.15s ease',
                transform: isSelected ? 'scale(1.01)' : 'scale(1)',
                boxShadow: isSelected ? '0 2px 5px rgba(0,0,0,0.3)' : 'none',
              }}
              title={hasTel ? '' : 'Telemetry not cached for this driver (Retired/DNF)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                <span style={{ color: isSelected ? teamColor : '#444552', fontWeight: 'bold', width: '14px', flexShrink: 0 }}>
                  {drv.pos}
                </span>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {drv.name}
                    {isSelected && (
                      <span style={{
                        display: 'inline-block',
                        width: '4px',
                        height: '4px',
                        borderRadius: '50%',
                        backgroundColor: teamColor,
                      }} />
                    )}
                  </div>
                  <div style={{ fontSize: '8px', color: '#555666', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {drv.team}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                <span style={{ 
                  fontSize: '10px', 
                  color: drv.pointsScored > 0 ? '#ffea00' : '#444552',
                  width: '65px',
                  textAlign: 'right'
                }}>
                  {drv.pointsScored > 0 ? `+${drv.pointsScored} pts` : '0 pts'}{drv.seasonPoints && drv.seasonPoints !== drv.pointsScored ? ` (${drv.seasonPoints})` : ''}
                </span>
                <span style={{ 
                  fontSize: '11px', 
                  fontWeight: 'bold', 
                  color: drv.gapLabel === 'DNF' ? '#ff1744' : drv.gapLabel === 'DSQ' ? '#e10600' : '#fff',
                  width: '78px',
                  textAlign: 'right'
                }}>
                  {drv.gapLabel ?? drv.gap}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
