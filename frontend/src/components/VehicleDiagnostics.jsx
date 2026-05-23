import React from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

export default function VehicleDiagnostics({ liveTick, mapX, mapY }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      {/* SPATIAL TRACK MAP */}
      <div style={{ backgroundColor: '#09090d', border: '1px solid #14141f', borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#555666', width: '100%', marginBottom: '8px' }}>CIRCUIT SPATIAL POSITION</div>
        <div style={{ width: '160px', height: '140px', backgroundColor: '#040406', borderRadius: '4px', border: '1px solid #14141f', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="100%" height="100%" viewBox="0 0 180 180" style={{ transform: 'rotate(-40deg)' }}>
            <path d="M 40 30 Q 140 10 160 70 T 120 150 Q 60 180 20 120 Z" fill="none" stroke="#1c1c2a" strokeWidth="5" strokeLinecap="round"/>
            <circle cx={mapX || 90} cy={mapY || 90} r="6" fill="#00e676" style={{ filter: 'drop-shadow(0px 0px 4px #00e676)' }} />
          </svg>
        </div>
      </div>

      {/* CHASSIS HANDLING INDICATOR */}
      <div style={{ backgroundColor: '#09090d', border: '1px solid #14141f', borderRadius: '6px', padding: '12px' }}>
        <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#555666', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}><ShieldAlert size={12}/> HANDLING STATE</div>
        <div style={{ 
          backgroundColor: liveTick.handling === "NEUTRAL" ? "#131c13" : "#241313", 
          color: liveTick.handling === "NEUTRAL" ? "#00e676" : "#ff1744", 
          padding: '10px', borderRadius: '4px', fontWeight: 'bold', fontSize: '13px', textAlign: 'center', border: '1px solid'
        }}>
          {liveTick.handling} CHASSIS STATE
        </div>
      </div>

      {/* TYRE DEGRADATION METRICS */}
      <div style={{ backgroundColor: '#09090d', border: '1px solid #14141f', borderRadius: '6px', padding: '12px' }}>
        <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#555666', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12}/> TYRE DEGRADATION PROFILE</div>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>
          COMPOUND: <span style={{ color: '#ffea00' }}>{liveTick.tyreCompound} (L{liveTick.tyreAge})</span>
        </div>
        <div style={{ marginTop: '8px', backgroundColor: '#13141f', height: '16px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #232336' }}>
          <div style={{ 
            backgroundColor: liveTick.tyreWearPercent > 70 ? '#ff1744' : liveTick.tyreWearPercent > 40 ? '#ffea00' : '#00e676', 
            width: `${liveTick.tyreWearPercent}%`, height: '100%', transition: 'width 0.2s ease'
          }}></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginTop: '4px', color: '#8e8f99' }}>
          <span>EST. THERMAL WEAR</span>
          <span style={{ fontWeight: 'bold', color: '#fff' }}>{liveTick.tyreWearPercent}%</span>
        </div>
      </div>
    </div>
  );
}
