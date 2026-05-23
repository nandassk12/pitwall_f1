import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Gauge, Cpu, Navigation, Wind, CloudRain, ShieldAlert, AlertTriangle } from 'lucide-react';

function App() {
  const [drivers, setDrivers] = useState([]);
  const [telemetry, setTelemetry] = useState([]);
  const [weather, setWeather] = useState({});
  const [activeDriver, setActiveDriver] = useState("VER");
  const [streamIndex, setStreamIndex] = useState(0);

  useEffect(() => {
    fetch('http://localhost:8000/api/drivers')
      .then(res => res.json())
      .then(data => setDrivers(data))
      .catch(err => console.error("Standings pipeline disconnect:", err));

    fetch('http://localhost:8000/api/weather')
      .then(res => res.json())
      .then(data => setWeather(data))
      .catch(err => console.error("Weather channel disconnect:", err));
  }, []);

  useEffect(() => {
    setStreamIndex(0);
  }, [activeDriver]);

  useEffect(() => {
    const telemetryLoop = setInterval(() => {
      setStreamIndex(prev => {
        const nextIdx = prev + 1;
        fetch(`http://localhost:8000/api/telemetry?driver=${activeDriver}&index=${nextIdx}`)
          .then(res => res.json())
          .then(data => { if (data && data.length > 0) setTelemetry(data); })
          .catch(err => console.error("Stream sync dropped:", err));
        return nextIdx;
      });
    }, 150);

    return () => clearInterval(telemetryLoop);
  }, [activeDriver]);

  if (telemetry.length === 0) {
    return <div style={{ color: '#fff', backgroundColor: '#040406', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>SYNCHRONIZING OPTIMIZED RACING MATRICES...</div>;
  }

  const liveTick = telemetry[telemetry.length - 1] || {};
  const mapX = ((liveTick.x + 10000) / 20000) * 150 + 15;
  const mapY = ((liveTick.y + 10000) / 20000) * 150 + 15;

  return (
    <div style={{ backgroundColor: '#040406', color: '#f5f5f7', minHeight: '100vh', fontFamily: 'monospace', padding: '15px' }}>
      
      {/* HUD HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #14141f', paddingBottom: '10px', marginBottom: '15px' }}>
        <div>
          <h2 style={{ color: '#e10600', margin: 0, fontWeight: '900', letterSpacing: '0.5px' }}>F1 PITWALL // ENGINEERING CONSOLE</h2>
          <div style={{ fontSize: '10px', color: '#555666', marginTop: '2px' }}>PRE-CACHED STREAM CHANNELS ACTIVE</div>
        </div>
        
        <div style={{ display: 'flex', gap: '20px', fontSize: '11px', backgroundColor: '#0b0b12', padding: '6px 12px', borderRadius: '4px', border: '1px solid #14141f', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#29b6f6' }}><CloudRain size={14}/> ENVIRONMENT:</div>
          <div>TRACK: <span style={{ color: '#fff' }}>{weather.trackTemp}°C</span></div>
          <div>AIR: <span style={{ color: '#fff' }}>{weather.airTemp}°C</span></div>
          <div>RAIN RISK: <span style={{ color: weather.rainRiskPercent > 50 ? '#ff1744' : '#00e676', fontWeight: 'bold' }}>{weather.rainRiskPercent}%</span></div>
        </div>
      </header>

      {/* THREE INTERACTIVE COLUMNS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.4fr 1.1fr', gap: '15px' }}>
        
        {/* COL 1: TIMING TOWER */}
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
                cursor: 'pointer'
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

        {/* COL 2: MAIN GRAPHS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
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
              <div style={{ fontSize: '18px', fontWeight: '900', marginTop: '4px', color: '#00e676' }}>G{liveTick.gear}</div>
            </div>
            <div style={{ backgroundColor: '#09090d', padding: '10px', borderRadius: '6px', border: '1px solid #14141f' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#555666', fontSize: '10px' }}><Wind size={12}/> DOWNFORCE</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '4px', color: '#29b6f6' }}>{liveTick.downforceKg} <span style={{ fontSize: '10px', color: '#444552' }}>KG</span></div>
            </div>
          </div>

          <div style={{ backgroundColor: '#09090d', border: '1px solid #14141f', borderRadius: '6px', padding: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
              <span>VELOCITY CURVE OVERLAY VS POLE BASELINE</span>
              <span style={{ color: '#e10600' }}>TARGET COMP: {activeDriver}</span>
            </div>
            <div style={{ width: '100%', height: '170px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={telemetry} margin={{ left: -25, right: 5 }}>
                  <defs>
                    <linearGradient id="spCol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e10600" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#e10600" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 2" stroke="#14141f" />
                  <XAxis dataKey="time" hide />
                  <YAxis stroke="#444552" domain={[60, 310]} fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#09090d', borderColor: '#14141f' }} />
                  <Area type="monotone" dataKey="speed" stroke="#e10600" strokeWidth={2} fillOpacity={1} fill="url(#spCol)" name="Driver Speed" />
                  <Line type="monotone" dataKey="refSpeed" stroke="#4b5563" strokeDasharray="3 3" dot={false} strokeWidth={1} name="Pole Ideal Reference" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

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

        {/* COL 3: DIAGNOSTICS & MAP */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          <div style={{ backgroundColor: '#09090d', border: '1px solid #14141f', borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#555666', width: '100%', marginBottom: '8px' }}>CIRCUIT SPATIAL POSITION</div>
            <div style={{ width: '160px', height: '140px', backgroundColor: '#040406', borderRadius: '4px', border: '1px solid #14141f', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="100%" height="100%" viewBox="0 0 180 180" style={{ transform: 'rotate(-40deg)' }}>
                <path d="M 40 30 Q 140 10 160 70 T 120 150 Q 60 180 20 120 Z" fill="none" stroke="#1c1c2a" strokeWidth="5" strokeLinecap="round"/>
                <circle cx={mapX || 90} cy={mapY || 90} r="6" fill="#00e676" style={{ filter: 'drop-shadow(0px 0px 4px #00e676)' }} />
              </svg>
            </div>
          </div>

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

          <div style={{ backgroundColor: '#09090d', border: '1px solid #14141f', borderRadius: '6px', padding: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#555666', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12}/> TYRE DEGRADATION PROFILE</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>
              COMPOUND: <span style={{ color: '#ffea00' }}>{liveTick.tyreCompound} (L{liveTick.tyreAge})</span>
            </div>
            <div style={{ marginTop: '8px', backgroundColor: '#13141f', height: '14px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #232336' }}>
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

      </div>
    </div>
  );
}

export default App;
