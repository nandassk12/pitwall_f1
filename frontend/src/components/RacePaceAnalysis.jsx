import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
         ResponsiveContainer, Cell, ReferenceLine, ScatterChart,
         Scatter, ZAxis } from 'recharts';
import API_BASE from '../config';

const COMPOUND_COLORS = {
  SOFT: '#e10600',
  MEDIUM: '#ffea00',
  HARD: '#f0f0f0',
  INTER: '#00e676',
  WET: '#2196f3',
  UNKNOWN: '#888899',
};

const getCompoundBgColor = (compound) => {
  const color = COMPOUND_COLORS[compound.toUpperCase()] || COMPOUND_COLORS.UNKNOWN;
  if (color === '#e10600') return 'rgba(225, 6, 0, 0.15)';
  if (color === '#ffea00') return 'rgba(255, 234, 0, 0.15)';
  if (color === '#f0f0f0') return 'rgba(240, 240, 240, 0.15)';
  if (color === '#00e676') return 'rgba(0, 230, 118, 0.15)';
  if (color === '#2196f3') return 'rgba(33, 150, 243, 0.15)';
  return 'rgba(136, 136, 153, 0.15)';
};

const formatLapTime = (secs) => {
  if (secs == null || isNaN(secs)) return '—';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.round((secs % 1) * 1000);
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};

// Custom Tooltip for the Horizontal Bar Chart
const BarCustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isLeader = data.paceDelta === 0;
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
        <div>Avg Lap Time: <span style={{ color: '#fff' }}>{formatLapTime(data.cleanAvgLapTime)}</span></div>
        <div>Pace Deficit: <span style={{ color: isLeader ? '#00e676' : '#ffea00' }}>{isLeader ? 'LEADER' : `+${data.paceDelta.toFixed(3)}s`}</span></div>
        <div>Consistency: <span style={{ color: '#888899' }}>±{data.consistencyStd.toFixed(3)}s</span></div>
        <div>Laps Used: <span style={{ color: '#888899' }}>{data.cleanLapCount} / {data.totalLapCount}</span></div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for the Scatter Chart
const ScatterCustomTooltip = ({ active, payload }) => {
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
          {data.driver}
        </div>
        <div>Pace Gap: <span style={{ color: '#fff' }}>+{data.paceDelta.toFixed(3)}s</span></div>
        <div>Consistency (Std Dev): <span style={{ color: '#fff' }}>{data.consistencyStd.toFixed(3)}s</span></div>
      </div>
    );
  }
  return null;
};

// Custom shape to render driver abbreviation label next to each dot
const RenderCustomDot = (props) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy) return null;
  const color = payload.teamColor || '#888899';
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

export default function RacePaceAnalysis() {
  const [threshold, setThreshold] = useState(5.0);
  const [paceData, setPaceData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Debounced fetch whenever threshold changes
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`${API_BASE}/api/analytics/race-pace?threshold=${threshold}`)
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          setPaceData(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching race pace:", err);
          setLoading(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [threshold]);

  // Derived statistics
  const leaderDriver = paceData[0]?.driver || '—';
  const leaderTeam = paceData[0]?.team || '';
  const leaderColor = paceData[0]?.teamColor || '#888899';
  const leaderPace = paceData[0]?.cleanAvgLapTime ? formatLapTime(paceData[0].cleanAvgLapTime) : '—';
  const fieldSpread = paceData.length > 0 
    ? (paceData[paceData.length - 1].paceDelta - paceData[0].paceDelta).toFixed(3) + 's'
    : '—';
  const avgLapsUsed = paceData.length > 0 
    ? (paceData.reduce((acc, curr) => acc + curr.cleanLapCount, 0) / paceData.length).toFixed(1)
    : '—';

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
      {/* 1. HEADER ROW */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #14141f',
        paddingBottom: '8px',
      }}>
        <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '11px', letterSpacing: '1px' }}>
          ⚡ RACE PACE ANALYTICS
        </span>
        <span style={{ color: '#555666', fontSize: '10px', fontWeight: 'bold' }}>
          OUTLIER FILTER: {threshold}% THRESHOLD
        </span>
      </div>

      {/* 2. THRESHOLD SLIDER */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <input
          type="range"
          min={0}
          max={15}
          step={0.5}
          value={threshold}
          onChange={(e) => setThreshold(parseFloat(e.target.value))}
          style={{
            width: '100%',
            cursor: 'pointer',
            background: `linear-gradient(to right, #e10600 ${threshold / 15 * 100}%, #14141f ${threshold / 15 * 100}%)`,
            appearance: 'none',
            height: '6px',
            borderRadius: '3px',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#444552', fontSize: '9px' }}>
          <span>0% — INCLUDE ALL LAPS</span>
          <span>15% — AGGRESSIVE FILTER</span>
        </div>
      </div>

      {/* 3. STATS SUMMARY ROW */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '10px',
      }}>
        {/* Card 1 */}
        <div style={{
          backgroundColor: '#09090d',
          border: '1px solid #14141f',
          borderRadius: '6px',
          padding: '10px',
        }}>
          <div style={{ color: '#555666', fontSize: '9px', fontWeight: 'bold', marginBottom: '4px' }}>FIELD LEADER</div>
          <div style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>{leaderDriver}</div>
          {leaderTeam && (
            <div style={{ color: leaderColor, fontSize: '9px', fontWeight: 'bold', marginTop: '2px' }}>
              {leaderTeam}
            </div>
          )}
        </div>

        {/* Card 2 */}
        <div style={{
          backgroundColor: '#09090d',
          border: '1px solid #14141f',
          borderRadius: '6px',
          padding: '10px',
        }}>
          <div style={{ color: '#555666', fontSize: '9px', fontWeight: 'bold', marginBottom: '4px' }}>LEADER PACE</div>
          <div style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>{leaderPace}</div>
        </div>

        {/* Card 3 */}
        <div style={{
          backgroundColor: '#09090d',
          border: '1px solid #14141f',
          borderRadius: '6px',
          padding: '10px',
        }}>
          <div style={{ color: '#555666', fontSize: '9px', fontWeight: 'bold', marginBottom: '4px' }}>FIELD SPREAD</div>
          <div style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>{fieldSpread}</div>
        </div>

        {/* Card 4 */}
        <div style={{
          backgroundColor: '#09090d',
          border: '1px solid #14141f',
          borderRadius: '6px',
          padding: '10px',
        }}>
          <div style={{ color: '#555666', fontSize: '9px', fontWeight: 'bold', marginBottom: '4px' }}>AVG LAPS USED</div>
          <div style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>{avgLapsUsed}</div>
        </div>
      </div>

      {loading ? (
        <div style={{
          height: '480px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: '#888899',
          fontSize: '12px',
        }}>
          ⚡ CALIBRATING RACE PACE MODELS...
        </div>
      ) : (
        <>
          {/* 4. PACE DEFICIT HORIZONTAL BAR CHART */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            backgroundColor: '#09090d',
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid #14141f',
          }}>
            <div style={{ color: '#888899', fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
              CLEAN RACE PACE DEFICIT TO LEADER (SECONDS)
            </div>
            <div style={{ height: '280px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={paceData}
                  layout="vertical"
                  margin={{ top: 5, right: 15, left: -20, bottom: 5 }}
                >
                  <CartesianGrid stroke="#14141f" strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 'auto']}
                    fontSize={9}
                    stroke="#444552"
                    tickLine={false}
                    tickFormatter={(v) => `+${v}s`}
                  />
                  <YAxis
                    dataKey="driver"
                    type="category"
                    width={35}
                    fontSize={10}
                    stroke="#444552"
                    tickLine={false}
                  />
                  <Tooltip content={<BarCustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <ReferenceLine x={0} stroke="#e10600" strokeDasharray="3 3" />
                  <Bar dataKey="paceDelta" radius={[0, 3, 3, 0]} barSize={10}>
                    {paceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.teamColor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 5. CONSISTENCY vs PACE SCATTER */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            backgroundColor: '#09090d',
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid #14141f',
          }}>
            <div style={{ color: '#888899', fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
              PACE CONSISTENCY MATRIX (STD DEV vs AVG LAP TIME)
            </div>
            <div style={{ height: '200px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 35, left: -15, bottom: 10 }}>
                  <CartesianGrid stroke="#14141f" strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="paceDelta"
                    name="Pace Gap"
                    unit="s"
                    stroke="#444552"
                    fontSize={9}
                    tickLine={false}
                    label={{ value: "Pace Gap to Leader (s)", position: "insideBottom", offset: -5, fill: "#444552", fontSize: 9 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="consistencyStd"
                    name="Consistency"
                    unit="s"
                    stroke="#444552"
                    fontSize={9}
                    tickLine={false}
                    label={{ value: "Consistency Std Dev (s)", angle: -90, position: "insideLeft", offset: 5, fill: "#444552", fontSize: 9 }}
                  />
                  <ZAxis range={[60, 60]} />
                  <Tooltip content={<ScatterCustomTooltip />} />
                  <Scatter name="Pace Matrix" data={paceData} shape={<RenderCustomDot />} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 6. COMPOUND USAGE ROW */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            paddingTop: '8px',
          }}>
            {paceData.map((d) => {
              const borderCol = COMPOUND_COLORS[d.compound.toUpperCase()] || COMPOUND_COLORS.UNKNOWN;
              const bgCol = getCompoundBgColor(d.compound);
              return (
                <div
                  key={d.driver}
                  style={{
                    backgroundColor: bgCol,
                    border: `1px solid ${borderCol}`,
                    color: '#fff',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {d.driver} — {d.compound}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
