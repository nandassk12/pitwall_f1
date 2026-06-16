import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
         ResponsiveContainer, Cell, ScatterChart, Scatter,
         ZAxis, LineChart, Line, Legend } from 'recharts';
import API_BASE from '../config';
import { getTeamColor } from './teamColours';

// Custom Tooltip for the Horsepower Bar Chart
const BarTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{
        backgroundColor: '#0d0d14',
        border: '1px solid #1c1c28',
        padding: '10px',
        borderRadius: '6px',
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#fff',
      }}>
        <div style={{ fontWeight: 'bold', color: data.teamColor, marginBottom: '4px' }}>
          {data.driver} — {data.team}
        </div>
        <div>Peak Power: <span style={{ color: '#fff' }}>{data.peakHp.toFixed(1)} HP</span></div>
        <div>Avg Power: <span style={{ color: '#fff' }}>{data.avgHp.toFixed(1)} HP</span></div>
        <div>Straight Frames: <span style={{ color: '#888899' }}>{data.straightFrames}</span></div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for the HP vs Speed Curve Overlay
const LineCustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const sortedPayload = [...payload].sort((a, b) => b.value - a.value);
    return (
      <div style={{
        backgroundColor: '#0d0d14',
        border: '1px solid #1c1c28',
        padding: '10px',
        borderRadius: '6px',
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#fff',
        maxHeight: '180px',
        overflowY: 'auto',
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#ffea00' }}>
          Speed: {label} km/h
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {sortedPayload.slice(0, 10).map((item) => (
            <div key={item.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
              <span style={{ color: item.color, fontWeight: 'bold' }}>{item.name}</span>
              <span style={{ color: '#fff' }}>{item.value.toFixed(1)} HP</span>
            </div>
          ))}
          {sortedPayload.length > 10 && (
            <div style={{ color: '#888899', fontSize: '9px', textAlign: 'center', marginTop: '4px' }}>
              + {sortedPayload.length - 10} more drivers
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for the Aero Efficiency Scatter Chart
const AeroTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const color = getTeamColor(data.team);
    return (
      <div style={{
        backgroundColor: '#0d0d14',
        border: '1px solid #1c1c28',
        padding: '10px',
        borderRadius: '6px',
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#fff',
      }}>
        <div style={{ fontWeight: 'bold', color: color, marginBottom: '4px' }}>
          {data.driver} — {data.team}
        </div>
        <div>Drag Coeff (Cd): <span style={{ color: '#fff' }}>{data.cd.toFixed(4)}</span></div>
        <div>Peak Downforce: <span style={{ color: '#fff' }}>{data.peakDownforceKg.toFixed(1)} kg</span></div>
        <div>Aero Efficiency: <span style={{ color: '#ffea00' }}>{data.aeroEfficiency.toFixed(4)}</span></div>
      </div>
    );
  }
  return null;
};

// Custom dot shape for the Aero Efficiency Scatter Chart
const AeroDot = (props) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy) return null;
  const color = getTeamColor(payload.team);
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill={color} stroke="#09090d" strokeWidth={1.5} />
      <text
        x={cx + 8}
        y={cy + 3}
        fill="#888899"
        fontSize={8}
        fontFamily="monospace"
        fontWeight="bold"
      >
        {payload.driver}
      </text>
    </g>
  );
};

export default function PowerAeroPanel() {
  const [powerAll, setPowerAll] = useState({});
  const [aeroScatter, setAeroScatter] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/analytics/power/all`).then(r => r.ok ? r.json() : {}),
      fetch(`${API_BASE}/api/analytics/aero/scatter`).then(r => r.ok ? r.json() : []),
    ])
      .then(([powerData, aeroData]) => {
        setPowerAll(powerData);
        setAeroScatter(aeroData);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching power/aero telemetry:", err);
        setLoading(false);
      });
  }, []);

  // ── SECTION 1 DATA BUILD ───────────────────────────────────────────────────
  const driverTeamMap = {};
  aeroScatter.forEach(item => {
    driverTeamMap[item.driver] = item.team;
  });

  const barChartData = Object.entries(powerAll).map(([driver, data]) => {
    const team = driverTeamMap[driver] || "";
    const teamColor = getTeamColor(team);
    return {
      driver,
      peakHp: data.peakHp,
      avgHp: data.avgHp,
      team,
      teamColor,
      straightFrames: data.straightFrames,
    };
  });
  barChartData.sort((a, b) => b.peakHp - a.peakHp);

  // ── SECTION 2 DATA BUILD (Merge speed buckets) ──────────────────────────────
  const speedBuckets = {};
  Object.entries(powerAll).forEach(([driver, driverData]) => {
    const curve = driverData.hpCurve || [];
    curve.forEach(point => {
      const speedKey = Math.round(point.speed);
      if (speedKey < 250 || speedKey > 340) return;

      if (!speedBuckets[speedKey]) {
        speedBuckets[speedKey] = { speed: speedKey };
      }
      if (speedBuckets[speedKey][`${driver}_hp`] === undefined) {
        speedBuckets[speedKey][`${driver}_hp`] = parseFloat(point.hp.toFixed(1));
      }
    });
  });
  const lineChartData = Object.values(speedBuckets);
  lineChartData.sort((a, b) => a.speed - b.speed);

  if (loading) {
    return (
      <div style={{
        height: '400px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#888899',
        fontSize: '12px',
        fontFamily: 'monospace',
        backgroundColor: '#0d0d14',
        border: '1px solid #14141f',
        borderRadius: '6px',
      }}>
        🔋 PRE-CALCULATING POWER AND AERODYNAMICS VECTORS...
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      backgroundColor: '#0d0d14',
      padding: '16px',
      borderRadius: '6px',
      border: '1px solid #14141f',
      fontFamily: 'monospace',
    }}>
      {/* SECTION 1: PEAK HORSEPOWER BAR CHART */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        backgroundColor: '#09090d',
        padding: '12px',
        borderRadius: '6px',
        border: '1px solid #14141f',
      }}>
        <div>
          <span style={{ color: '#fff', fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
            ESTIMATED PEAK POWER OUTPUT (HP) BY DRIVER
          </span>
          <div style={{ color: '#555666', fontSize: '8px', marginTop: '2px' }}>
            Computed from full-throttle straight segments &gt;250 km/h
          </div>
        </div>
        <div style={{ height: '220px', width: '100%', marginTop: '6px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={barChartData}
              layout="vertical"
              margin={{ top: 5, right: 15, left: -20, bottom: 5 }}
            >
              <CartesianGrid stroke="#14141f" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" fontSize={9} stroke="#444552" tickLine={false} />
              <YAxis
                dataKey="driver"
                type="category"
                width={35}
                fontSize={10}
                stroke="#444552"
                tickLine={false}
              />
              <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
              <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />
              <Bar dataKey="peakHp" name="Peak HP" radius={[0, 3, 3, 0]} barSize={5}>
                {barChartData.map((entry, index) => (
                  <Cell key={`cell-peak-${index}`} fill={entry.teamColor} />
                ))}
              </Bar>
              <Bar dataKey="avgHp" name="Avg HP" fill="#444552" radius={[0, 3, 3, 0]} barSize={5} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SECTION 2: HP CURVE OVERLAY (multi-driver) */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        backgroundColor: '#09090d',
        padding: '12px',
        borderRadius: '6px',
        border: '1px solid #14141f',
      }}>
        <div style={{ color: '#fff', fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
          HP vs SPEED CURVE — ALL DRIVERS
        </div>
        <div style={{ height: '200px', width: '100%', marginTop: '6px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={lineChartData}
              margin={{ top: 10, right: 15, left: -20, bottom: 10 }}
            >
              <CartesianGrid stroke="#14141f" strokeDasharray="3 3" />
              <XAxis
                dataKey="speed"
                type="number"
                domain={[250, 340]}
                stroke="#444552"
                fontSize={9}
                tickLine={false}
                label={{ value: "Speed (km/h)", position: "insideBottom", offset: -5, fill: "#444552", fontSize: 9 }}
              />
              <YAxis
                stroke="#444552"
                fontSize={9}
                tickLine={false}
                label={{ value: "HP", angle: -90, position: "insideLeft", offset: 5, fill: "#444552", fontSize: 9 }}
              />
              <Tooltip content={<LineCustomTooltip />} />
              {Object.entries(powerAll).map(([driver]) => {
                const team = driverTeamMap[driver] || "";
                const color = getTeamColor(team);
                return (
                  <Line
                    key={driver}
                    type="monotone"
                    dataKey={`${driver}_hp`}
                    name={driver}
                    stroke={color}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls={true}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SECTION 3: AERO EFFICIENCY SCATTER */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        backgroundColor: '#09090d',
        padding: '12px',
        borderRadius: '6px',
        border: '1px solid #14141f',
      }}>
        <div>
          <span style={{ color: '#fff', fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
            AERODYNAMIC EFFICIENCY MAP (Cd vs Downforce)
          </span>
          <div style={{ color: '#555666', fontSize: '8px', marginTop: '2px' }}>
            Higher downforce + lower drag = better aero package
          </div>
        </div>
        <div style={{ height: '220px', width: '100%', marginTop: '6px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 35, left: -15, bottom: 10 }}>
              <CartesianGrid stroke="#14141f" strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="cd"
                name="Cd"
                stroke="#444552"
                fontSize={9}
                tickLine={false}
                tickFormatter={(v) => v.toFixed(3)}
                label={{ value: "Drag Coefficient (Cd)", position: "insideBottom", offset: -5, fill: "#444552", fontSize: 9 }}
              />
              <YAxis
                type="number"
                dataKey="peakDownforceKg"
                name="Peak Downforce"
                unit="kg"
                stroke="#444552"
                fontSize={9}
                tickLine={false}
                label={{ value: "Peak Downforce (kg)", angle: -90, position: "insideLeft", offset: 5, fill: "#444552", fontSize: 9 }}
              />
              <ZAxis range={[80, 80]} />
              <Tooltip content={<AeroTooltip />} />
              <Scatter name="Aero Map" data={aeroScatter} shape={<AeroDot />} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
