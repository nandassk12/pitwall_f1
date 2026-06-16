import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, ScatterChart, Scatter, Legend, ReferenceLine
} from 'recharts';

const CHART_TYPES = [
  { id: 'speed',    label: '📈 SPEED PROFILE' },
  { id: 'throttle', label: '🎮 PEDAL INPUTS'  },
  { id: 'tyres',    label: '🛞 TYRE DEGRADATION' },
  { id: 'gforce',   label: '⚡️ G-FORCE TRACE' },
  { id: 'rpm_speed',label: '⚙️ GEAR SIGNATURE' },
  { id: 'demand',   label: '⚡️ DRIVER DEMAND' }
];

const GEAR_COLORS = {
  1: '#ff1744', // Red
  2: '#ff9100', // Orange
  3: '#ffea00', // Yellow
  4: '#00e676', // Green
  5: '#00b0ff', // Blue
  6: '#2979ff', // Dark Blue
  7: '#d500f9', // Purple
  8: '#f50057'  // Pink
};

export default function AdvancedTelemetryCharts({ drivers = [], activeDriver = '' }) {
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedChart, setSelectedChart] = useState('speed');
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize selectedDriver from props
  useEffect(() => {
    if (activeDriver) {
      setSelectedDriver(activeDriver);
    }
  }, [activeDriver]);

  // Fetch chart data when driver or chart type changes
  useEffect(() => {
    if (!selectedDriver) return;

    setLoading(true);
    setError(null);

    let endpoint = `/api/chart/${selectedChart}`;
    if (selectedChart === 'rpm_speed') {
      endpoint = '/api/chart/rpm-vs-speed';
    }

    fetch(`${endpoint}?driver=${selectedDriver}`)
      .then(res => {
        if (!res.ok) throw new Error('Simulation or session data not active.');
        return res.json();
      })
      .then(setChartData)
      .catch(err => {
        console.error(err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [selectedDriver, selectedChart]);

  // Render Skeleton Loader for Recharts
  const renderSkeleton = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', height: '220px', padding: '10px' }}>
      <div style={{ width: '40%', height: '14px', backgroundColor: '#14141f', borderRadius: '3px' }} className="skeleton-pulse" />
      <div style={{ flexGrow: 1, backgroundColor: '#0d0d14', borderRadius: '4px', border: '1px solid #14141f', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '15px', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '100%' }}>
          <div style={{ width: '8%', height: '30%', backgroundColor: '#14141f', borderRadius: '2px' }} />
          <div style={{ width: '8%', height: '60%', backgroundColor: '#14141f', borderRadius: '2px' }} />
          <div style={{ width: '8%', height: '45%', backgroundColor: '#14141f', borderRadius: '2px' }} />
          <div style={{ width: '8%', height: '80%', backgroundColor: '#14141f', borderRadius: '2px' }} />
          <div style={{ width: '8%', height: '50%', backgroundColor: '#14141f', borderRadius: '2px' }} />
          <div style={{ width: '8%', height: '90%', backgroundColor: '#14141f', borderRadius: '2px' }} />
          <div style={{ width: '8%', height: '35%', backgroundColor: '#14141f', borderRadius: '2px' }} />
        </div>
      </div>
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 0.3; }
          100% { opacity: 0.6; }
        }
        .skeleton-pulse {
          animation: pulse 1.5s infinite ease-in-out;
        }
      `}</style>
    </div>
  );

  const renderChartContent = () => {
    if (loading) return renderSkeleton();

    if (error) {
      return (
        <div style={{ color: '#ff3d00', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>
          {error}
        </div>
      );
    }

    if (!chartData || chartData.length === 0) {
      return (
        <div style={{ color: '#555666', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>
          NO TELEMETRY DATA RECORDED FOR {selectedDriver}
        </div>
      );
    }

    switch (selectedChart) {
      case 'speed':
        return (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ left: -25, right: 5, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="speedCurveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e10600" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#e10600" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 2" stroke="#14141f" />
              <XAxis dataKey="time" hide />
              <YAxis stroke="#444552" domain={[60, 340]} fontSize={9} />
              <Tooltip
                contentStyle={{ backgroundColor: '#09090d', borderColor: '#1e1e2e', fontSize: '10px', fontFamily: 'monospace' }}
                formatter={(v, name) => [`${v} KMH`, name === 'speed' ? 'Driver speed' : 'Pole ref speed']}
              />
              <Area type="monotone" dataKey="speed" stroke="#e10600" strokeWidth={1.5} fillOpacity={1} fill="url(#speedCurveGrad)" name="speed" />
              <Line type="monotone" dataKey="refSpeed" stroke="#6b7280" strokeDasharray="3 3" dot={false} strokeWidth={1} name="refSpeed" />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'throttle':
        return (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ left: -25, right: 5, top: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="#14141f" />
              <XAxis dataKey="time" hide />
              <YAxis stroke="#444552" domain={[0, 100]} fontSize={9} />
              <Tooltip
                contentStyle={{ backgroundColor: '#09090d', borderColor: '#1e1e2e', fontSize: '10px', fontFamily: 'monospace' }}
                formatter={(v, name) => [`${v}%`, name]}
              />
              <Line type="monotone" dataKey="throttle" stroke="#00e676" strokeWidth={1.5} dot={false} name="Throttle" />
              <Line type="monotone" dataKey="brake" stroke="#ff1744" strokeWidth={1.5} dot={false} name="Brake" />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'tyres':
        return (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ left: -25, right: 5, top: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="#14141f" />
              <XAxis dataKey="lap" fontSize={9} stroke="#444552" />
              <YAxis stroke="#444552" domain={[0, 100]} fontSize={9} label={{ value: 'Wear %', angle: -90, position: 'insideLeft', style: { fill: '#444552', fontSize: 9 } }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#09090d', borderColor: '#1e1e2e', fontSize: '10px', fontFamily: 'monospace' }}
                formatter={(v, name, props) => [`${v}% (Age: ${props.payload.tyreAge} laps)`, 'Wear']}
              />
              <Line type="monotone" dataKey="tyreWear" stroke="#ffd54f" strokeWidth={2} dot={{ r: 2, fill: '#ffea00' }} name="Tyre Wear" />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'gforce':
        return (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ left: -25, right: 5, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="gforceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#29b6f6" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#29b6f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gforceLatGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ab47bc" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#ab47bc" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 2" stroke="#14141f" />
              <XAxis dataKey="time" hide />
              <YAxis stroke="#444552" domain={[-6, 6]} fontSize={9} />
              <Tooltip
                contentStyle={{ backgroundColor: '#09090d', borderColor: '#1e1e2e', fontSize: '10px', fontFamily: 'monospace' }}
                formatter={(v, name) => [
                  `${v} G`,
                  name === 'longG' ? 'Longitudinal G' : name === 'latG' ? 'Lateral G' : name
                ]}
              />
              <Legend verticalAlign="top" height={24} iconSize={6} wrapperStyle={{ fontSize: 9, fontFamily: 'monospace' }} />
              <ReferenceLine y={0} stroke="#444552" strokeWidth={1} strokeDasharray="3 3" />
              <Area type="monotone" dataKey="longG" stroke="#29b6f6" strokeWidth={1.5} fillOpacity={0.6} fill="url(#gforceGrad)" name="longG" />
              <Area type="monotone" dataKey="latG" stroke="#ab47bc" strokeWidth={1.5} fillOpacity={0.4} fill="url(#gforceLatGrad)" name="latG" />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'rpm_speed':
        // Segment by gear for coloring in ScatterChart
        return (
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ left: -25, right: 5, top: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="#14141f" />
              <XAxis type="number" dataKey="speed" name="Speed" unit=" kmh" fontSize={9} stroke="#444552" domain={[40, 350]} />
              <YAxis type="number" dataKey="rpm" name="RPM" unit=" rpm" fontSize={9} stroke="#444552" domain={[6000, 13000]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#09090d', borderColor: '#1e1e2e', fontSize: '10px', fontFamily: 'monospace' }}
                cursor={{ strokeDasharray: '3 3' }}
              />
              {/* Group data by gear for different colored scatters */}
              {[1, 2, 3, 4, 5, 6, 7, 8].map(gearNum => {
                const gearData = chartData.filter(d => d.gear === gearNum);
                if (gearData.length === 0) return null;
                return (
                  <Scatter
                    key={gearNum}
                    name={`Gear ${gearNum}`}
                    data={gearData}
                    fill={GEAR_COLORS[gearNum] || '#888'}
                    shape="circle"
                    legendType="circle"
                  />
                );
              })}
              <Legend verticalAlign="top" height={24} iconSize={6} wrapperStyle={{ fontSize: 9, fontFamily: 'monospace' }} />
            </ScatterChart>
          </ResponsiveContainer>
        );

      case 'demand':
        return (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ left: -25, right: 5, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="demandGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ffea00" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#ffea00" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 2" stroke="#14141f" />
              <XAxis dataKey="time" hide />
              <YAxis stroke="#444552" domain={[0, 10]} fontSize={9} />
              <Tooltip
                contentStyle={{ backgroundColor: '#09090d', borderColor: '#1e1e2e', fontSize: '10px', fontFamily: 'monospace' }}
                formatter={(v) => [`${v} / 10`, 'Demand Index']}
              />
              <Area type="monotone" dataKey="demandIndex" stroke="#ffea00" strokeWidth={1.5} fillOpacity={1} fill="url(#demandGrad)" name="demandIndex" />
            </AreaChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{
      backgroundColor: '#09090d',
      border: '1px solid #14141f',
      borderRadius: '6px',
      padding: '15px',
      fontFamily: 'monospace',
    }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #14141f', paddingBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', letterSpacing: '1px' }}>
          📊 ADVANCED VEHICLE TELEMETRY
        </span>
        <span style={{ fontSize: '9px', color: '#555666' }}>
          SESSION-AWARE PLOTS
        </span>
      </div>

      {/* Driver pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '15px' }}>
        {drivers.map(d => {
          const hasTel = d.hasTelemetry !== false;
          return (
            <button
              key={d.name}
              disabled={!hasTel}
              onClick={() => setSelectedDriver(d.name)}
              style={{
                padding: '4px 8px',
                fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold',
                backgroundColor: selectedDriver === d.name ? '#e10600' : '#111116',
                color: selectedDriver === d.name ? '#fff' : hasTel ? '#888' : '#444',
                border: `1px solid ${selectedDriver === d.name ? '#e10600' : '#1c1c28'}`,
                borderRadius: '3px',
                cursor: hasTel ? 'pointer' : 'not-allowed',
                opacity: hasTel ? 1 : 0.45,
                transition: 'all 0.1s ease',
              }}
              title={hasTel ? '' : 'Telemetry not cached for this driver (Retired/DNF)'}
            >
              {d.name}
            </button>
          );
        })}
      </div>

      {/* Grid: Charts Menu (left) + Chart Canvas (right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '15px' }}>
        {/* Charts Menu Toggles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {CHART_TYPES.map(chart => (
            <button
              key={chart.id}
              onClick={() => setSelectedChart(chart.id)}
              style={{
                textAlign: 'left',
                padding: '8px 10px',
                fontSize: '10px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                backgroundColor: selectedChart === chart.id ? '#14141f' : '#0c0c12',
                color: selectedChart === chart.id ? '#ffea00' : '#888899',
                border: '1px solid #1c1c28',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {chart.label}
            </button>
          ))}
        </div>

        {/* Chart Canvas */}
        <div style={{ backgroundColor: '#0c0c12', border: '1px solid #14141f', borderRadius: '4px', padding: '10px', overflow: 'hidden' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${selectedDriver}_${selectedChart}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
              style={{ width: '100%' }}
            >
              {renderChartContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
