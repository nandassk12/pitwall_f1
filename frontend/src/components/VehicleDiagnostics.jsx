import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import CircuitMap from './CircuitMap';
import API_BASE from '../config';

export default function VehicleDiagnostics({
  liveTick,
  circuitGeometry,
  allPositions = [],
  activeDriver = '',
  simState = null,
}) {
  const [dominanceData, setDominanceData] = useState(null);
  const [domDriverA, setDomDriverA] = useState('');
  const [domDriverB, setDomDriverB] = useState('');

  useEffect(() => {
    if (!activeDriver) return;
    const p2driver = simState?.lapState?.[1]?.driver || '';
    if (!p2driver || p2driver === activeDriver) return;

    if (activeDriver === domDriverA && p2driver === domDriverB && dominanceData) {
      return;
    }

    setDomDriverA(activeDriver);
    setDomDriverB(p2driver);

    fetch(`${API_BASE}/api/analytics/dominance?a=${activeDriver}&b=${p2driver}&segments=25`)
      .then(r => r.ok ? r.json() : null)
      .then(setDominanceData)
      .catch(() => setDominanceData(null));
  }, [activeDriver, simState, domDriverA, domDriverB, dominanceData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

      {/* DYNAMIC CIRCUIT MAP */}
      <CircuitMap
        circuitGeometry={circuitGeometry}
        allPositions={allPositions}
        activeDriver={activeDriver}
        simState={simState}
        width={270}
        height={210}
        dominanceData={dominanceData}
        domDriverA={domDriverA}
        domDriverB={domDriverB}
      />

      {/* DOMINANCE LEGEND */}
      {dominanceData && (
        <div style={{
          backgroundColor: '#09090d',
          border: '1px solid #14141f',
          borderRadius: '6px',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          fontFamily: 'monospace',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            fontSize: '9px',
            fontWeight: 'bold',
          }}>
            <span style={{ color: '#e10600' }}>■ {domDriverA} FASTER</span>
            <span style={{ color: '#444552' }}>■ NEUTRAL</span>
            <span style={{ color: '#29b6f6' }}>■ {domDriverB} FASTER</span>
          </div>
          <div style={{
            fontSize: '9px',
            color: '#888899',
            textAlign: 'center',
          }}>
            {domDriverA} wins {dominanceData.driverSummary?.[domDriverA]?.segmentsLed ?? dominanceData.segmentsWonA ?? 0} segments | {domDriverB} wins {dominanceData.driverSummary?.[domDriverB]?.segmentsLed ?? dominanceData.segmentsWonB ?? 0} segments
          </div>
        </div>
      )}

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
          COMPOUND: <span style={{ color: '#ffea00' }}>{liveTick.tyreCompound}</span>
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
