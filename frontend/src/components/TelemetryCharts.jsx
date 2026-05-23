import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Gauge, Cpu, Navigation, Wind } from 'lucide-react';

export default function TelemetryCharts({ telemetry, activeDriver, liveTick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      {/* DIGITAL METERS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        <div style={{ backgroundColor: '#09090d', padding: '10px', borderRadius: '6px', border: '1px solid #14141f' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#555666', fontSize: '10px' }}><Gauge size={12}/> VELOCITY</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '4px', color: '#fff' }}>{liveTick.speed} <span style={{ fontSize: '10px', color: '#444552' }}>KMH</span></div>
        </div>
        <div style={{ backgroundColor: '#09090d', padding: '10px', borderRadius: '6px', border: '1px solid #14141f' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#555666', fontSize: '10px' }}><Cpu size={12}/> RPM TRACE</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '4px', color: '#ffea00' }}>{liveTick.rpm}</div>
        </div>
        <div style={{ backgroundColor: '#09090d', padding: '10px', borderRadius: '6px', border: '1px solid #14141f' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#555666', fontSize: '10px' }}><Navigation size={12}/> RATIO</div>
          <div style={{ fontSize: '18px', fontWeight: '900', marginTop: '4px', color: '#00e676' }}>GEAR {liveTick.gear}</div>
        </div>
        <div style={{ backgroundColor: '#09090d', padding: '10px', borderRadius: '6px', border: '1px solid #14141f' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#555666', fontSize: '10px' }}><Wind size={12}/> DOWNFORCE</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '4px', color: '#29b6f6' }}>{liveTick.downforceKg} <span style={{ fontSize: '10px', color: '#444552' }}>KG</span></div>
        </div>
      </div>

      {/* SPEED AREA CHART */}
      <div style={{ backgroundColor: '#09090d', border: '1px solid #14141f', borderRadius: '6px', padding: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
          <span>VELOCITY CURVE OVERLAY VS POLE BASELINE</span>
          <span style={{ color: '#e10600' }}>TARGET COMP: {activeDriver}</span>
        </div>
        <div style={{ width: '100%', height: '170px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={telemetry} margin={{ left: -25, right: 5 }}>
              <defs>
                <linearGradient id="speedCol" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e10600" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#e10600" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 2" stroke="#14141f" />
              <XAxis dataKey="time" hide />
              <YAxis stroke="#444552" domain={[60, 310]} fontSize={10} />
              <Tooltip contentStyle={{ backgroundColor: '#09090d', borderColor: '#14141f' }} />
              <Area type="monotone" dataKey="speed" stroke="#e10600" strokeWidth={2} fillOpacity={1} fill="url(#speedCol)" name="Driver Speed" />
              <Line type="monotone" dataKey="refSpeed" stroke="#4b5563" strokeDasharray="3 3" dot={false} strokeWidth={1} name="Pole Ideal Reference" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* THROTTLE / BRAKE LINE CHART */}
      <div style={{ backgroundColor: '#09090d', border: '1px solid #14141f', borderRadius: '6px', padding: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', marginBottom: '10px' }}>MECHANICAL FORCES (THROTTLE INPUT VS BRAKE LINE)</div>
        <div style={{ width: '100%', height: '130px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={telemetry} margin={{ left: -25, right: 5 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="#14141f" />
              <XAxis dataKey="time" hide />
              <YAxis stroke="#444552" domain={[0, 100]} fontSize={10} />
              <Tooltip contentStyle={{ backgroundColor: '#09090d', borderColor: '#14141f' }} />
              <Line type="monotone" dataKey="throttle" stroke="#00e676" strokeWidth={1.5} dot={false} name="Throttle (%)" />
              <Line type="monotone" dataKey="brake" stroke="#ff1744" strokeWidth={1.5} dot={false} name="Brake (%)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
