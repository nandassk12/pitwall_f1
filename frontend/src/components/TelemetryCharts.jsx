import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Gauge, Cpu, Navigation, Wind } from 'lucide-react';

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div style={{
      backgroundColor: '#09090d',
      border: '1px solid #14141f',
      padding: '8px 12px',
      borderRadius: '4px',
      fontFamily: 'monospace',
      fontSize: '11px',
      lineHeight: '1.8'
    }}>
      {payload.map((entry, i) => {
        if (entry.value == null) return null;
        const unit = (entry.name === 'Speed' || entry.name === 'Pole Ref') ? ' KMH'
                   : entry.name === 'RPM'  ? ' RPM'
                   : entry.name === 'Gear' ? ''
                   : '%';
        return (
          <div key={i} style={{ color: entry.color }}>
            {entry.name}: <span style={{ color: '#fff', fontWeight: 'bold' }}>
              {entry.value}
            </span>{unit}
          </div>
        );
      })}
    </div>
  );
};

export default function TelemetryCharts({ speedData = [], throttleData = [], rpmData = [], activeDriver, liveTick = {} }) {
  const WINDOW = 80;        // how many points visible in the chart at once
  const TICK_MS = 80;       // how fast the playhead advances (ms per frame)

  const [playhead, setPlayhead] = useState(0);
  const playheadRef = useRef(0);

  useEffect(() => {
    if (speedData.length === 0) return;
    playheadRef.current = 0;
    setPlayhead(0);

    const timer = setInterval(() => {
      playheadRef.current = (playheadRef.current + 1) % speedData.length;
      setPlayhead(playheadRef.current);
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [speedData]);

  const total   = speedData.length;
  const start   = Math.max(0, playhead - WINDOW);
  const end     = playhead + 1;

  const visibleSpeed    = speedData.slice(start, end);
  const visibleThrottle = throttleData.slice(start, end);
  // rpmData is keyed on speed not time, use same index range
  const visibleRpm      = rpmData.slice(start, end);

  // Current frame values for the digital meters
  const currentFrame    = speedData[playhead]    || {};
  const currentThrottle = throttleData[playhead] || {};
  const currentRpm      = rpmData[playhead]      || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      {/* DIGITAL METERS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        <div style={{ backgroundColor: '#09090d', padding: '10px', borderRadius: '6px', border: '1px solid #14141f' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#555666', fontSize: '10px' }}><Gauge size={12}/> VELOCITY</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '4px', color: '#fff' }}>{currentFrame.speed ?? '—'} <span style={{ fontSize: '10px', color: '#444552' }}>KMH</span></div>
        </div>
        <div style={{ backgroundColor: '#09090d', padding: '10px', borderRadius: '6px', border: '1px solid #14141f' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#555666', fontSize: '10px' }}><Cpu size={12}/> RPM TRACE</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '4px', color: '#ffea00' }}>{currentRpm.rpm ?? '—'}</div>
        </div>
        <div style={{ backgroundColor: '#09090d', padding: '10px', borderRadius: '6px', border: '1px solid #14141f' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#555666', fontSize: '10px' }}><Navigation size={12}/> RATIO</div>
          <div style={{ fontSize: '18px', fontWeight: '900', marginTop: '4px', color: '#00e676' }}>GEAR {currentRpm.gear ?? '—'}</div>
        </div>
        <div style={{ backgroundColor: '#09090d', padding: '10px', borderRadius: '6px', border: '1px solid #14141f' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#555666', fontSize: '10px' }}><Wind size={12}/> DOWNFORCE</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '4px', color: '#29b6f6' }}>{currentFrame.downforceKg ?? '—'} <span style={{ fontSize: '10px', color: '#444552' }}>KG</span></div>
        </div>
      </div>

      {/* LAP PROGRESS BAR */}
      <div style={{ backgroundColor: '#09090d', border: '1px solid #14141f', borderRadius: '6px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '10px', color: '#555666', flexShrink: 0 }}>LAP TRACE</span>
        <div style={{ flex: 1, height: '4px', backgroundColor: '#14141f', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${total > 0 ? (playhead / total) * 100 : 0}%`,
            backgroundColor: '#e10600',
            borderRadius: '2px',
            transition: 'width 0.08s linear',
          }} />
        </div>
        <span style={{ fontSize: '10px', color: '#444552', flexShrink: 0, width: '40px', textAlign: 'right' }}>
          {total > 0 ? Math.round((playhead / total) * 100) : 0}%
        </span>
      </div>

      {/* SPEED AREA CHART */}
      <div style={{ backgroundColor: '#09090d', border: '1px solid #14141f', borderRadius: '6px', padding: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
          <span>VELOCITY CURVE OVERLAY VS POLE BASELINE</span>
          <span style={{ color: '#e10600' }}>TARGET COMP: {activeDriver}</span>
        </div>
        <div style={{ width: '100%', height: '170px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={visibleSpeed} margin={{ left: -25, right: 5 }}>
              <defs>
                <linearGradient id="speedCol" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e10600" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#e10600" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 2" stroke="#14141f" />
              <XAxis dataKey="time" hide />
              <YAxis stroke="#444552" domain={[60, 310]} fontSize={10} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="speed" stroke="#e10600" strokeWidth={2} fillOpacity={1} fill="url(#speedCol)" name="Speed" />
              <Line
                type="monotone"
                dataKey="refSpeed"
                stroke="#4b5563"
                strokeDasharray="3 3"
                dot={false}
                strokeWidth={1}
                name="Pole Ref"
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* THROTTLE / BRAKE LINE CHART */}
      <div style={{ backgroundColor: '#09090d', border: '1px solid #14141f', borderRadius: '6px', padding: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', marginBottom: '10px' }}>MECHANICAL FORCES (THROTTLE INPUT VS BRAKE LINE)</div>
        <div style={{ width: '100%', height: '130px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={visibleThrottle} margin={{ left: -25, right: 5 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="#14141f" />
              <XAxis dataKey="time" hide />
              <YAxis stroke="#444552" domain={[0, 100]} fontSize={10} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="throttle" stroke="#00e676" strokeWidth={1.5} dot={false} name="Throttle" />
              <Line type="monotone" dataKey="brake" stroke="#ff1744" strokeWidth={1.5} dot={false} name="Brake" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* RPM TRACE */}
      <div style={{ backgroundColor: '#09090d', border: '1px solid #14141f', borderRadius: '6px', padding: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', marginBottom: '10px' }}>
          ENGINE RPM TRACE
        </div>
        <div style={{ width: '100%', height: '110px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={visibleRpm} margin={{ left: -25, right: 5 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="#14141f" />
              <XAxis dataKey="speed" hide />
              <YAxis stroke="#444552" domain={[6000, 15000]} fontSize={10} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="rpm" stroke="#ffea00"
                    strokeWidth={1.5} dot={false} name="RPM" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* GEAR SEQUENCE */}
      <div style={{ backgroundColor: '#09090d', border: '1px solid #14141f', borderRadius: '6px', padding: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', marginBottom: '10px' }}>
          GEAR RATIO SEQUENCE
        </div>
        <div style={{ width: '100%', height: '90px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={visibleRpm} margin={{ left: -25, right: 5 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="#14141f" />
              <XAxis dataKey="speed" hide />
              <YAxis stroke="#444552" domain={[1, 8]}
                     ticks={[1,2,3,4,5,6,7,8]} fontSize={10} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="gear" stroke="#00e676"
                    strokeWidth={2} dot={false} name="Gear" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
