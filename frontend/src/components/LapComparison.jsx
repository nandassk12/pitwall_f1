import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import API_BASE from '../config';

const SLOT_COLORS = ['#e10600', '#29b6f6', '#00e676', '#ffea00'];

export default function LapComparison({ drivers = [], activeDriver = '' }) {
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [telemetryData, setTelemetryData] = useState({});
  const [lapTimesData, setLapTimesData] = useState(null);
  const [sectorsData, setSectorsData] = useState([]);

  // Initialize selectedDrivers with the activeDriver from props
  useEffect(() => {
    if (activeDriver && !selectedDrivers.includes(activeDriver)) {
      setSelectedDrivers(prev => {
        if (prev.length === 0) return [activeDriver];
        return prev;
      });
    }
  }, [activeDriver]);

  // Handle Driver Toggle Selection
  const handleToggleDriver = (name) => {
    setSelectedDrivers(prev => {
      if (prev.includes(name)) {
        if (prev.length === 1) return prev; // Keep at least one driver
        return prev.filter(d => d !== name);
      } else {
        if (prev.length >= 4) return prev; // Limit to 4 drivers max
        return [...prev, name];
      }
    });
  };

  // Fetch telemetry traces (fastest lap speed + throttle) for each selected driver
  useEffect(() => {
    if (selectedDrivers.length === 0) return;

    const promises = selectedDrivers.map(drv =>
      Promise.all([
        fetch(`${API_BASE}/api/chart/speed?driver=${drv}`).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/api/chart/throttle?driver=${drv}`).then(r => r.ok ? r.json() : []),
      ]).then(([speedArr, throttleArr]) => {
        // Merge speed + throttle + brake into one array keyed by index
        const merged = speedArr.map((s, i) => ({
          time:     s.time,
          speed:    s.speed,
          throttle: throttleArr[i]?.throttle ?? 0,
          brake:    throttleArr[i]?.brake    ?? 0,
        }));
        return { driver: drv, telemetry: merged };
      }).catch(() => ({ driver: drv, telemetry: [] }))
    );

    Promise.all(promises).then(results => {
      const newTelData = {};
      results.forEach(res => { newTelData[res.driver] = res.telemetry; });
      setTelemetryData(newTelData);
    });
  }, [selectedDrivers]);

  // Fetch lap times for delta chart
  useEffect(() => {
    if (selectedDrivers.length === 0) return;

    fetch(`${API_BASE}/api/panels/lap-times?drivers=${selectedDrivers.join(',')}`)
      .then(r => r.json())
      .then(setLapTimesData)
      .catch(err => console.error('Error fetching comparison lap-times:', err));
  }, [selectedDrivers]);

  // Fetch sector analysis for mini-sectors comparison table
  useEffect(() => {
    if (selectedDrivers.length === 0) return;

    const promises = selectedDrivers.map(drv =>
      fetch(`${API_BASE}/api/panels/sector-analysis?driver=${drv}`)
        .then(r => r.json())
        .then(data => ({
          driver: drv,
          bestS1: data.personalBestS1,
          bestS2: data.personalBestS2,
          bestS3: data.personalBestS3,
          theoretical: (data.personalBestS1 || 0) + (data.personalBestS2 || 0) + (data.personalBestS3 || 0)
        }))
        .catch(err => {
          console.error(`Sector analysis fetch failed for ${drv}:`, err);
          return { driver: drv, bestS1: null, bestS2: null, bestS3: null, theoretical: 0 };
        })
    );

    Promise.all(promises).then(setSectorsData);
  }, [selectedDrivers]);

  // Merge multiple telemetry streams for speed/throttle/brake overlay charts
  const getMergedTelemetry = () => {
    const firstDriver = selectedDrivers[0];
    const firstTel = telemetryData[firstDriver] || [];
    if (!firstTel.length) return [];

    return firstTel.map((frame, idx) => {
      const row = { time: frame.time };
      selectedDrivers.forEach((drv, i) => {
        const drvTel = telemetryData[drv] || [];
        const drvFrame = drvTel[idx] || {};
        row[`speed_${drv}`] = drvFrame.speed ?? null;
        row[`throttle_${drv}`] = drvFrame.throttle ?? null;
        row[`brake_${drv}`] = drvFrame.brake ?? null;
      });
      return row;
    });
  };

  // Prepare Lap Delta Data
  const getLapDeltaData = () => {
    if (!lapTimesData || !lapTimesData.laps || selectedDrivers.length === 0) return [];
    const refDriver = selectedDrivers[0];

    return lapTimesData.laps.map(lapRow => {
      const row = { lap: lapRow.lap };
      const refTime = lapRow[refDriver];

      selectedDrivers.forEach(drv => {
        const drvTime = lapRow[drv];
        if (refTime && drvTime) {
          // Delta: positive = slower than A, negative = faster than A
          row[`delta_${drv}`] = Number((drvTime - refTime).toFixed(3));
        } else {
          row[`delta_${drv}`] = null;
        }
      });
      return row;
    });
  };

  const mergedTel = getMergedTelemetry();
  const deltaChartData = getLapDeltaData();

  // Helper formatting functions
  const formatSec = (val) => (val !== null && val !== undefined ? val.toFixed(3) : '—');
  const formatLapTime = (seconds) => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toFixed(3).padStart(6, '0')}`;
  };

  return (
    <div style={{
      backgroundColor: '#09090d',
      border: '1px solid #14141f',
      borderRadius: '6px',
      padding: '15px',
      fontFamily: 'monospace',
    }}>
      {/* Header and Driver Pills */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #14141f', paddingBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', letterSpacing: '1px' }}>
          ⇌ MULTI-DRIVER LAP & TELEMETRY COMPARISON
        </span>
        <span style={{ fontSize: '9px', color: '#555666' }}>
          COMPARE UP TO 4 DRIVERS // SLOTS: A B C D
        </span>
      </div>

      {/* Driver Pills Selector */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '15px' }}>
        {drivers.map(d => {
          const index = selectedDrivers.indexOf(d.name);
          const isSelected = index !== -1;
          const slotColor = isSelected ? SLOT_COLORS[index] : 'transparent';
          const hasTel = d.hasTelemetry !== false;

          return (
            <button
              key={d.name}
              disabled={!hasTel}
              onClick={() => hasTel && handleToggleDriver(d.name)}
              style={{
                padding: '4px 8px',
                fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold',
                backgroundColor: isSelected ? `${slotColor}20` : '#111116',
                color: isSelected ? '#fff' : hasTel ? '#666677' : '#444',
                border: `1px solid ${isSelected ? slotColor : '#1c1c28'}`,
                borderRadius: '3px',
                cursor: hasTel ? 'pointer' : 'not-allowed',
                opacity: hasTel ? 1 : 0.45,
                transition: 'all 0.1s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title={hasTel ? '' : 'Telemetry not cached for this driver (Retired/DNF)'}
            >
              {isSelected && (
                <span style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: slotColor,
                }} />
              )}
              {d.name}
              {isSelected && (
                <span style={{ fontSize: '8px', color: '#888' }}>
                  ({String.fromCharCode(65 + index)})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Middle Row: Mini Sectors (left) + Lap Delta Chart (right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '15px' }}>
        
        {/* Left Side: Mini Sectors Table */}
        <div style={{ backgroundColor: '#0c0c12', border: '1px solid #14141f', borderRadius: '4px', padding: '10px' }}>
          <div style={{ fontSize: '9px', color: '#888', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '8px', borderBottom: '1px solid #1c1c28', paddingBottom: '4px' }}>
            MINI SECTORS (PERSONAL BESTS)
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', textAlign: 'left' }}>
            <thead>
              <tr style={{ color: '#555666', borderBottom: '1px solid #222', height: '20px' }}>
                <th>SLOT</th>
                <th>DRIVER</th>
                <th>BEST S1</th>
                <th>BEST S2</th>
                <th>BEST S3</th>
                <th>THEO LAP</th>
                <th style={{ textAlign: 'right' }}>THEO Δ</th>
              </tr>
            </thead>
            <tbody>
              {sectorsData.map((row, idx) => {
                const color = SLOT_COLORS[idx];
                const isRef = idx === 0;
                const refTheo = sectorsData[0]?.theoretical || 0;
                const delta = isRef ? '—' : `+${(row.theoretical - refTheo).toFixed(3)}s`;

                return (
                  <tr key={row.driver} style={{ borderBottom: '1px solid #111116', height: '24px' }}>
                    <td style={{ color, fontWeight: 'bold' }}>
                      {String.fromCharCode(65 + idx)}
                    </td>
                    <td style={{ color: '#fff', fontWeight: 'bold' }}>
                      {row.driver}
                    </td>
                    <td style={{ color: '#aaa' }}>{formatSec(row.bestS1)}</td>
                    <td style={{ color: '#aaa' }}>{formatSec(row.bestS2)}</td>
                    <td style={{ color: '#aaa' }}>{formatSec(row.bestS3)}</td>
                    <td style={{ color: '#ffea00', fontWeight: 'bold' }}>
                      {formatLapTime(row.theoretical)}
                    </td>
                    <td style={{ textAlign: 'right', color: isRef ? '#888' : '#ff3d00', fontWeight: 'bold' }}>
                      {delta}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Right Side: Lap Delta Chart */}
        <div style={{ backgroundColor: '#0c0c12', border: '1px solid #14141f', borderRadius: '4px', padding: '10px' }}>
          <div style={{ fontSize: '9px', color: '#888', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '8px', borderBottom: '1px solid #1c1c28', paddingBottom: '4px' }}>
            LAP DELTA VS DRIVER A (REFERENCE: {selectedDrivers[0] || '—'})
          </div>
          <div style={{ width: '100%', height: '110px' }}>
            {deltaChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={deltaChartData} margin={{ top: 5, left: -25, right: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#1c1c28" />
                  <XAxis dataKey="lap" fontSize={8} stroke="#444552" />
                  <YAxis fontSize={8} stroke="#444552" label={{ value: 'Delta (s)', angle: -90, position: 'insideLeft', style: { fill: '#444552', fontSize: 8 } }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#09090d', borderColor: '#1e1e2e', fontSize: '10px', fontFamily: 'monospace' }}
                    labelFormatter={(label) => `Lap ${label}`}
                    formatter={(v, name) => [`${v} s`, name.replace('delta_', '')]}
                  />
                  <ReferenceLine y={0} stroke="#ff3d00" strokeWidth={1} strokeDasharray="3 3" />
                  {selectedDrivers.map((drv, idx) => (
                    <Line
                      key={drv}
                      type="monotone"
                      dataKey={`delta_${drv}`}
                      stroke={SLOT_COLORS[idx]}
                      strokeWidth={idx === 0 ? 1 : 1.5}
                      dot={false}
                      name={`delta_${drv}`}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ color: '#555666', fontSize: '10px', display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                WAITING FOR LAP TIMES DATA...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Stacked Telemetry Traces */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        
        {/* Speed Chart */}
        <div style={{ backgroundColor: '#040406', border: '1px solid #14141f', borderRadius: '4px', padding: '8px 10px' }}>
          <div style={{ fontSize: '8px', color: '#555666', letterSpacing: '1px', marginBottom: '6px' }}>VELOCITY OVERLAY (KMH)</div>
          <div style={{ width: '100%', height: '110px' }}>
            {mergedTel.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mergedTel} margin={{ left: -25, right: 5, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#14141f" />
                  <XAxis dataKey="time" hide />
                  <YAxis stroke="#444552" domain={[60, 340]} fontSize={8} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#09090d', borderColor: '#1e1e2e', fontSize: '9px', fontFamily: 'monospace' }}
                    formatter={(v, name) => [`${v} KMH`, name.replace('speed_', '')]}
                  />
                  {selectedDrivers.map((drv, idx) => (
                    <Line
                      key={drv}
                      type="monotone"
                      dataKey={`speed_${drv}`}
                      stroke={SLOT_COLORS[idx]}
                      strokeWidth={1.5}
                      dot={false}
                      name={`speed_${drv}`}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ color: '#555666', fontSize: '10px', display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                WAITING FOR TELEMETRY...
              </div>
            )}
          </div>
        </div>

        {/* Throttle Chart */}
        <div style={{ backgroundColor: '#040406', border: '1px solid #14141f', borderRadius: '4px', padding: '8px 10px' }}>
          <div style={{ fontSize: '8px', color: '#555666', letterSpacing: '1px', marginBottom: '6px' }}>THROTTLE PEDAL (%)</div>
          <div style={{ width: '100%', height: '80px' }}>
            {mergedTel.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mergedTel} margin={{ left: -25, right: 5, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#14141f" />
                  <XAxis dataKey="time" hide />
                  <YAxis stroke="#444552" domain={[0, 100]} fontSize={8} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#09090d', borderColor: '#1e1e2e', fontSize: '9px', fontFamily: 'monospace' }}
                    formatter={(v, name) => [`${v}%`, name.replace('throttle_', '')]}
                  />
                  {selectedDrivers.map((drv, idx) => (
                    <Line
                      key={drv}
                      type="monotone"
                      dataKey={`throttle_${drv}`}
                      stroke={SLOT_COLORS[idx]}
                      strokeWidth={1.2}
                      dot={false}
                      name={`throttle_${drv}`}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ color: '#555666', fontSize: '10px', display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                WAITING FOR TELEMETRY...
              </div>
            )}
          </div>
        </div>

        {/* Brake Chart */}
        <div style={{ backgroundColor: '#040406', border: '1px solid #14141f', borderRadius: '4px', padding: '8px 10px' }}>
          <div style={{ fontSize: '8px', color: '#555666', letterSpacing: '1px', marginBottom: '6px' }}>BRAKE TRIGGER (ON/OFF)</div>
          <div style={{ width: '100%', height: '70px' }}>
            {mergedTel.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mergedTel} margin={{ left: -25, right: 5, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#14141f" />
                  <XAxis dataKey="time" hide />
                  <YAxis stroke="#444552" domain={[0, 1]} fontSize={8} ticks={[0, 1]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#09090d', borderColor: '#1e1e2e', fontSize: '9px', fontFamily: 'monospace' }}
                    formatter={(v, name) => [v === 1 ? 'BRAKING' : 'OFF', name.replace('brake_', '')]}
                  />
                  {selectedDrivers.map((drv, idx) => (
                    <Line
                      key={drv}
                      type="step"
                      dataKey={`brake_${drv}`}
                      stroke={SLOT_COLORS[idx]}
                      strokeWidth={1.2}
                      dot={false}
                      name={`brake_${drv}`}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ color: '#555666', fontSize: '10px', display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                WAITING FOR TELEMETRY...
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
