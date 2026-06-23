import React, { useState, useEffect } from 'react';
import NavBar from '../components/NavBar';
import LapComparison from '../components/LapComparison';
import TrackDominanceMap from '../components/TrackDominanceMap';
import PitStrategy from '../components/PitStrategy';
import TimingTower from '../components/TimingTower';
import RaceControl from '../components/RaceControl';
import API_BASE from '../config';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  ScatterChart,
  Scatter,
  Legend,
  ReferenceLine,
  CartesianGrid
} from 'recharts';

const SESSION_TYPE_LABELS = {
  R: 'Race',
  Q: 'Qualifying',
  FP1: 'Practice 1',
  FP2: 'Practice 2',
  FP3: 'Practice 3',
  Sprint: 'Sprint',
  SQ: 'Sprint Qualifying',
};

const SESSION_LABELS = {
  FP1: 'FP1', FP2: 'FP2', FP3: 'FP3',
  Q: 'QUALI', R: 'RACE', Sprint: 'SPRINT', SQ: 'SPRINT Q',
};

export default function TelemetryPage() {
  const [activeTab, setActiveTab] = useState('telemetry'); // 'results' | 'strategy' | 'laptimes' | 'dominance' | 'telemetry' | 'racecontrol'
  const [raceControl, setRaceControl] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [activeDriver, setActiveDriver] = useState('');
  const [loading, setLoading] = useState(true);

  // Year, venue, and session type dropdown selections
  const [activeYear, setActiveYear] = useState(2024);
  const [years, setYears] = useState([2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  const [calendar, setCalendar] = useState([]);
  const [activeCircuit, setActiveCircuit] = useState('');
  const [sessionTypes, setSessionTypes] = useState([]);
  const [activeSessionType, setActiveSessionType] = useState('');
  const [sessionLoading, setSessionLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadError, setLoadError] = useState(null);
  const [sessionLabel, setSessionLabel] = useState('');
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [loadedSession, setLoadedSession] = useState({ year: null, circuit: "", sessionType: "" });

  // States for the 8 interactive telemetry graphs
  const [c1Driver, setC1Driver] = useState('VER');
  const [c1Lap, setC1Lap] = useState(4);

  const [c2Driver, setC2Driver] = useState('BOT');
  const [c2Lap, setC2Lap] = useState(8);

  const [c3Driver, setC3Driver] = useState('ANT');
  const [c3Lap, setC3Lap] = useState(12);

  const [c4Driver, setC4Driver] = useState('HAM');
  const [c4Lap, setC4Lap] = useState(15);

  const [c5Driver, setC5Driver] = useState('VER');
  const [c5Lap, setC5Lap] = useState(20);

  const [c6Driver, setC6Driver] = useState('NOR');
  const [c6Lap, setC6Lap] = useState(22);

  const [c7Driver, setC7Driver] = useState('LEC');
  const [c7Compound, setC7Compound] = useState('SOFT');

  const [c8Driver, setC8Driver] = useState('SAI');
  const [c8Lap, setC8Lap] = useState(25);

  const [latency, setLatency] = useState('12.4ms');

  // Load supported years list and current status on mount
  useEffect(() => {
    // 1. Fetch years
    fetch(`${API_BASE}/api/sessions/years`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setYears(data);
        }
      })
      .catch(err => console.warn('Failed to load years:', err));

    // 2. Fetch status
    fetch(`${API_BASE}/api/status`)
      .then(r => r.ok ? r.json() : {})
      .then(async (status) => {
        if (status.sessionLoaded) {
          setSessionLoaded(true);
          setSessionLabel(status.currentSession);
          setActiveYear(status.year);
          setActiveCircuit(status.circuit);
          setActiveSessionType(status.sessionType);
          setLoadedSession({ year: status.year, circuit: status.circuit, sessionType: status.sessionType });

          // Fetch calendar and sessions for this active session
          const calendarRes = await fetch(`${API_BASE}/api/sessions/calendar?year=${status.year}`);
          const calendarData = calendarRes.ok ? await calendarRes.json() : [];
          setCalendar(calendarData);

          const typesRes = await fetch(`${API_BASE}/api/sessions/types?year=${status.year}&circuit=${encodeURIComponent(status.circuit)}`);
          const typesData = typesRes.ok ? await typesRes.json() : [];
          setSessionTypes(typesData.available || []);

          // Load drivers
          const driversRes = await fetch(`${API_BASE}/api/drivers`);
          const driversData = driversRes.ok ? await driversRes.json() : [];
          setDrivers(driversData);
          if (driversData.length > 0) {
            const firstWithTelemetry = driversData.find(d => d.hasTelemetry);
            setActiveDriver(firstWithTelemetry ? firstWithTelemetry.name : driversData[0].name);
            
            const codes = driversData.map(d => d.name);
            if (codes.length > 0) {
              setC1Driver(codes[0] || 'VER');
              setC2Driver(codes[Math.min(1, codes.length - 1)] || 'BOT');
              setC3Driver(codes[Math.min(2, codes.length - 1)] || 'ANT');
              setC4Driver(codes[Math.min(3, codes.length - 1)] || 'HAM');
              setC5Driver(codes[Math.min(4, codes.length - 1)] || 'VER');
              setC6Driver(codes[Math.min(5, codes.length - 1)] || 'NOR');
              setC7Driver(codes[Math.min(6, codes.length - 1)] || 'LEC');
              setC8Driver(codes[Math.min(7, codes.length - 1)] || 'SAI');
            }
          }
          setLoading(false);
        } else {
          // If no session loaded, we fetch the default calendar for 2024
          const calendarRes = await fetch(`${API_BASE}/api/sessions/calendar?year=2024`);
          const calendarData = calendarRes.ok ? await calendarRes.json() : [];
          setCalendar(calendarData);
          if (calendarData.length > 0) {
            setActiveCircuit(calendarData[0].name);
            const typesRes = await fetch(`${API_BASE}/api/sessions/types?year=2024&circuit=${encodeURIComponent(calendarData[0].name)}`);
            const typesData = typesRes.ok ? await typesRes.json() : [];
            const availableTypes = typesData.available || [];
            setSessionTypes(availableTypes);
            setActiveSessionType(availableTypes.includes('R') ? 'R' : availableTypes[0] || 'R');
          }
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('Failed to resolve initial status:', err);
        setLoading(false);
      });
  }, []);

  // Fetch race control messages whenever a session is loaded
  useEffect(() => {
    if (!sessionLoaded) return;
    fetch(`${API_BASE}/api/race-control`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setRaceControl(data); })
      .catch(err => console.warn('Failed to load race control:', err));
  }, [sessionLoaded, loadedSession]);

  // Simulating live telemetry update frequency
  useEffect(() => {
    const timer = setInterval(() => {
      const ms = (12 + Math.random() * 0.8).toFixed(1);
      setLatency(`${ms}ms`);
    }, 1000);
    const isDirty = !sessionLoaded || activeYear !== loadedSession.year || activeCircuit !== loadedSession.circuit || activeSessionType !== loadedSession.sessionType;

  return () => clearInterval(timer);
  }, []);

  const loadSession = async (year, circuit, sessionType) => {
    if (!year || !circuit || !sessionType || sessionLoading) return;
    setSessionLoading(true);
    setLoadError(null);
    setLoadProgress(0);
    
    const progressInterval = setInterval(() => {
      setLoadProgress(prev => {
        if (prev >= 85) {
          clearInterval(progressInterval);
          return 85;
        }
        return parseFloat((prev + 0.9).toFixed(1));
      });
    }, 400);

    try {
      const res = await fetch(`${API_BASE}/api/sessions/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: Number(year),
          circuit: circuit,
          session_type: sessionType,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Session load failed');
      }

      const meta = await res.json();
      clearInterval(progressInterval);
      setLoadProgress(100);
      setSessionLabel(meta.label);
      setSessionLoaded(true);
      setLoadedSession({ year: Number(year), circuit: circuit, sessionType: sessionType });

      const driversRes = await fetch(`${API_BASE}/api/drivers`);
      const driversData = driversRes.ok ? await driversRes.json() : [];
      setDrivers(driversData);
      if (driversData.length > 0) {
        const firstWithTelemetry = driversData.find(d => d.hasTelemetry);
        setActiveDriver(firstWithTelemetry ? firstWithTelemetry.name : driversData[0].name);
        
        const codes = driversData.map(d => d.name);
        if (codes.length > 0) {
          setC1Driver(codes[0] || 'VER');
          setC2Driver(codes[Math.min(1, codes.length - 1)] || 'BOT');
          setC3Driver(codes[Math.min(2, codes.length - 1)] || 'ANT');
          setC4Driver(codes[Math.min(3, codes.length - 1)] || 'HAM');
          setC5Driver(codes[Math.min(4, codes.length - 1)] || 'VER');
          setC6Driver(codes[Math.min(5, codes.length - 1)] || 'NOR');
          setC7Driver(codes[Math.min(6, codes.length - 1)] || 'LEC');
          setC8Driver(codes[Math.min(7, codes.length - 1)] || 'SAI');
        }
      }
    } catch (err) {
      clearInterval(progressInterval);
      setLoadProgress(0);
      setLoadError(err.message);
    } finally {
      setSessionLoading(false);
    }
  };

  const handleYearChange = async (e) => {
    const newYear = Number(e.target.value);
    setActiveYear(newYear);
    setCalendar([]);
    setSessionTypes([]);
    
    try {
      const calendarRes = await fetch(`${API_BASE}/api/sessions/calendar?year=${newYear}`);
      const calendarData = calendarRes.ok ? await calendarRes.json() : [];
      setCalendar(calendarData);
      
      if (calendarData.length > 0) {
        const firstCircuit = calendarData[0].name;
        setActiveCircuit(firstCircuit);
        
        const typesRes = await fetch(`${API_BASE}/api/sessions/types?year=${newYear}&circuit=${encodeURIComponent(firstCircuit)}`);
        const typesData = typesRes.ok ? await typesRes.json() : { available: [] };
        const availableTypes = typesData.available || [];
        setSessionTypes(availableTypes);
        
        const defaultType = availableTypes.includes('R') ? 'R' : (availableTypes[0] || 'R');
        setActiveSessionType(defaultType);
        

      }
    } catch (err) {
      console.error('Failed on year change sequence:', err);
    }
  };

  const handleCircuitChange = async (e) => {
    const newCircuit = e.target.value;
    setActiveCircuit(newCircuit);
    setSessionTypes([]);
    
    try {
      const typesRes = await fetch(`${API_BASE}/api/sessions/types?year=${activeYear}&circuit=${encodeURIComponent(newCircuit)}`);
      const typesData = typesRes.ok ? await typesRes.json() : { available: [] };
      const availableTypes = typesData.available || [];
      setSessionTypes(availableTypes);
      
      const defaultType = availableTypes.includes('R') ? 'R' : (availableTypes[0] || 'R');
      setActiveSessionType(defaultType);
      

    } catch (err) {
      console.error('Failed on circuit change sequence:', err);
    }
  };

  const handleSessionTypeChange = async (e) => {
    const newType = e.target.value;
    setActiveSessionType(newType);

  };

  const getSeed = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash / 10000;
  };

  const driverOptions = drivers.length > 0 ? drivers.map((d) => d.name) : ['VER', 'HAM', 'LEC', 'NOR', 'SAI', 'RUS', 'PIA', 'ALO', 'GAS', 'TSU', 'ALB', 'HUL', 'MAG', 'BOT', 'ZHO', 'OCO', 'STR', 'SAR'];
  const lapOptions = Array.from({ length: 53 }, (_, i) => i + 1);
  const compoundOptions = ['SOFT', 'MEDIUM', 'HARD', 'INTER', 'WET'];

  // 1. Generate Speed Trace
  const getSpeedTraceData = (driver, lap) => {
    const seed = getSeed(driver + lap);
    const data = [];
    const length = 50;
    for (let i = 0; i < length; i++) {
      const distance = Math.round((i * 5800) / (length - 1));
      const base = 220 + Math.sin(i * 0.4) * 60 - Math.cos(i * 0.8) * 35;
      const variance = Math.sin(i + seed) * 12;
      const speed = Math.max(78, Math.min(335, Math.round(base + variance)));
      data.push({ distance, speed });
    }
    return data;
  };

  // 2. Generate Gear Shifts Step Data
  const getGearShiftsData = (driver, lap) => {
    const seed = getSeed(driver + lap);
    const data = [];
    let currentGear = 3;
    const steps = 30;
    for (let i = 0; i < steps; i++) {
      const time = Math.round((i * 80000) / (steps - 1));
      if (Math.sin(i * 0.7 + seed) > 0.3) {
        currentGear = Math.max(1, Math.min(8, currentGear + (Math.cos(i + seed) > 0 ? 1 : -1)));
      }
      data.push({ time, gear: currentGear });
    }
    return data;
  };

  // 3. Generate Pedal Inputs
  const getPedalInputsData = (driver, lap) => {
    const seed = getSeed(driver + lap);
    const data = [];
    const length = 50;
    for (let i = 0; i < length; i++) {
      const distance = Math.round((i * 5800) / (length - 1));
      const isCorner = Math.sin(i * 0.55 + seed) > 0.45;
      let throttle = 100;
      let brake = 0;
      if (isCorner) {
        throttle = Math.max(0, Math.round(15 + Math.sin(i) * 15));
        brake = Math.max(0, Math.round(85 + Math.cos(i) * 10));
      } else {
        throttle = Math.max(75, Math.round(98 + Math.sin(i) * 3));
        brake = 0;
      }
      data.push({ distance, throttle, brake });
    }
    return data;
  };

  // 4. Generate RPM Trace
  const getRpmData = (driver, lap) => {
    const seed = getSeed(driver + lap);
    const data = [];
    const length = 50;
    for (let i = 0; i < length; i++) {
      const time = Math.round((i * 80000) / (length - 1));
      const revCycle = (i % 7) / 7;
      const rpm = Math.round(10500 + revCycle * 4200 + Math.sin(i + seed) * 180);
      data.push({ time, rpm });
    }
    return data;
  };

  // 5. Generate G-Force Coordinates
  const getGForceData = (driver, lap) => {
    const seed = getSeed(driver + lap);
    const data = [];
    const length = 25;
    for (let i = 0; i < length; i++) {
      const lat = Number((Math.sin(i * 0.6 + seed) * 2.6).toFixed(2));
      const long = Number((Math.cos(i * 0.4 + seed) * 1.8).toFixed(2));
      data.push({ lat, long });
    }
    return data;
  };

  // 5b. Generate G-Force Trace Time-Series
  const getGForceTraceData = (driver, lap) => {
    const seed = getSeed(driver + lap);
    const data = [];
    const length = 50;
    for (let i = 0; i < length; i++) {
      const time = Math.round((i * 80000) / (length - 1));
      const longG = Number((Math.sin(i * 0.5 + seed) * 3.5).toFixed(2));
      const latG = Number((Math.cos(i * 0.3 + seed) * 2.8).toFixed(2));
      data.push({ time, longG, latG });
    }
    return data;
  };

  // 6. Generate Gear Signature Durations
  const getGearSignatureData = (driver, lap) => {
    const seed = getSeed(driver + lap);
    const baseDurations = [4, 7, 10, 15, 25, 18, 13, 8];
    return baseDurations.map((base, idx) => {
      const variance = Math.sin(idx + seed) * 2.5;
      const pct = Math.max(1, Math.round(base + variance));
      return { gear: `G${idx + 1}`, duration: pct };
    });
  };

  // 7. Generate Tyre Degradation Forecast
  const getTyreDegradationData = (driver, compound) => {
    const rate = compound === 'SOFT' ? 2.4 : compound === 'MEDIUM' ? 1.7 : compound === 'HARD' ? 1.1 : 0.8;
    const data = [];
    for (let lap = 1; lap <= 60; lap++) {
      const wear = Math.min(100, Math.round(lap * rate));
      data.push({ lap, wear, limit: 80 });
    }
    return data;
  };

  // 8. Generate Brake Temperatures
  const getBrakeTemps = (driver, lap) => {
    const seed = getSeed(driver + lap);
    const front = Math.round(810 + Math.sin(seed) * 80);
    const rear = Math.round(590 + Math.cos(seed) * 65);
    return { front, rear };
  };

  const brakeTemps = getBrakeTemps(c8Driver, c8Lap);
  const frontPct = Math.min(100, Math.round((brakeTemps.front / 1100) * 100));
  const rearPct = Math.min(100, Math.round((brakeTemps.rear / 1100) * 100));

  const activeCircuitDetails = calendar.find(r => r.name === activeCircuit);
  const activeCircuitShortName = activeCircuitDetails?.shortName || activeCircuit || 'Sakhir';
  const activeCircuitCountry = activeCircuitDetails?.country || 'Bahrain';

  const isDirty = !sessionLoaded || activeYear !== loadedSession.year || activeCircuit !== loadedSession.circuit || activeSessionType !== loadedSession.sessionType;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--color-text)] font-mono select-none antialiased pb-16">
      <NavBar />

      {/* ── FIXED HEADER WRAPPER ── */}
      <div className="fixed top-[48px] w-full z-40 bg-[var(--bg-primary)]">
        {/* Session Header */}
        <header className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-edge-margin py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button className="text-[var(--color-muted)] hover:text-[#e10600] transition-colors flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
            <div>
              <h1 className="text-[18px] font-bold text-white uppercase tracking-wider">
                {activeCircuitShortName} Grand Prix — {SESSION_TYPE_LABELS[activeSessionType] || activeSessionType || 'Race'}
              </h1>
              <p className="text-[14px] text-[var(--color-muted)] uppercase mt-0.5">
                {activeYear} Season • {activeCircuitCountry}
              </p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {/* Year Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-white font-mono font-bold text-[14px] uppercase select-none">YEAR:</span>
              <select
                value={activeYear}
                onChange={handleYearChange}
                disabled={sessionLoading}
                className="bg-[#e10600] border border-[#e10600] pl-3 pr-8 py-1.5 text-[14px] font-mono font-bold text-white hover:bg-[#ff1e16] hover:border-[#ff1e16] rounded-[2px] outline-none appearance-none cursor-pointer transition-colors"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M1 1l3 2 3-2' stroke='%23ffffff' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                }}
              >
                <option value={activeYear} className="bg-[var(--bg-secondary)] text-white">{activeYear}</option>
                {years.filter(y => y !== activeYear).map(y => (
                  <option key={y} value={y} className="bg-[var(--bg-secondary)] text-white">{y}</option>
                ))}
              </select>
            </div>

            {/* Venue Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-white font-mono font-bold text-[14px] uppercase select-none">VENUE:</span>
              <select
                value={activeCircuit}
                onChange={handleCircuitChange}
                disabled={sessionLoading || calendar.length === 0}
                className="bg-[#e10600] border border-[#e10600] pl-3 pr-8 py-1.5 text-[14px] font-mono font-bold text-white hover:bg-[#ff1e16] hover:border-[#ff1e16] rounded-[2px] outline-none appearance-none cursor-pointer transition-colors max-w-[220px] truncate"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M1 1l3 2 3-2' stroke='%23ffffff' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                }}
              >
                <option value={activeCircuit} className="bg-[var(--bg-secondary)] text-white">{activeCircuitShortName.toUpperCase()}</option>
                {calendar.filter(r => r.name !== activeCircuit).map(race => (
                  <option key={race.name} value={race.name} className="bg-[var(--bg-secondary)] text-white">
                    {race.shortName.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Session Type Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-white font-mono font-bold text-[14px] uppercase select-none">SESSION:</span>
              <select
                value={activeSessionType}
                onChange={handleSessionTypeChange}
                disabled={sessionLoading || sessionTypes.length === 0}
                className="bg-[#e10600] border border-[#e10600] pl-3 pr-8 py-1.5 text-[14px] font-mono font-bold text-white hover:bg-[#ff1e16] hover:border-[#ff1e16] rounded-[2px] outline-none appearance-none cursor-pointer transition-colors"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M1 1l3 2 3-2' stroke='%23ffffff' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                }}
              >
                <option value={activeSessionType} className="bg-[var(--bg-secondary)] text-white">{(SESSION_LABELS[activeSessionType] || activeSessionType || '').toUpperCase()}</option>
                {sessionTypes.filter(t => t !== activeSessionType).map(type => (
                  <option key={type} value={type} className="bg-[var(--bg-secondary)] text-white">
                    {(SESSION_LABELS[type] || type).toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Load Session Action Button */}
            <button
              onClick={() => loadSession(activeYear, activeCircuit, activeSessionType)}
              disabled={sessionLoading || !activeYear || !activeCircuit || !activeSessionType || !isDirty}
              className={`px-4 py-1.5 text-[14px] font-mono font-bold uppercase rounded-[2px] transition-all duration-150 ${
                isDirty && activeYear && activeCircuit && activeSessionType
                  ? "bg-white text-[#e10600] hover:bg-gray-100 cursor-pointer shadow-[0_0_15px_rgba(255,255,255,0.35)]"
                  : "bg-[var(--bg-primary)] text-[var(--color-muted)] border border-[var(--border-color)] cursor-default opacity-50"
              }`}
            >
              {sessionLoading ? "Loading..." : isDirty ? "Load Data" : "Loaded"}
            </button>
          </div>
        </header>

        {/* Tab Bar Navigation */}
        <nav className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-edge-margin flex overflow-x-auto custom-scrollbar">
          <div className="flex h-10 items-center">
            <button
              onClick={() => setActiveTab('results')}
              className={`px-4 text-[15px] font-bold h-full border-b-2 flex items-center transition-all ${
                activeTab === 'results'
                  ? 'border-[#e10600] text-[#e10600]'
                  : 'border-transparent text-[var(--color-muted)] hover:text-white'
              }`}
            >
              {activeTab === 'results' ? 'RESULTS' : 'Results'}
            </button>
            <button
              onClick={() => setActiveTab('strategy')}
              className={`px-4 text-[15px] font-bold h-full border-b-2 flex items-center transition-all ${
                activeTab === 'strategy'
                  ? 'border-[#e10600] text-[#e10600]'
                  : 'border-transparent text-[var(--color-muted)] hover:text-white'
              }`}
            >
              {activeTab === 'strategy' ? 'STRATEGY' : 'Strategy'}
            </button>
            <button
              onClick={() => setActiveTab('laptimes')}
              className={`px-4 text-[15px] font-bold h-full border-b-2 flex items-center transition-all ${
                activeTab === 'laptimes'
                  ? 'border-[#e10600] text-[#e10600]'
                  : 'border-transparent text-[var(--color-muted)] hover:text-white'
              }`}
            >
              {activeTab === 'laptimes' ? 'LAP TIMES' : 'Lap Times'}
            </button>
            <button
              onClick={() => setActiveTab('dominance')}
              className={`px-4 text-[15px] font-bold h-full border-b-2 flex items-center transition-all ${
                activeTab === 'dominance'
                  ? 'border-[#e10600] text-[#e10600]'
                  : 'border-transparent text-[var(--color-muted)] hover:text-white'
              }`}
            >
              {activeTab === 'dominance' ? 'TRACK DOMINANCE' : 'Track Dominance'}
            </button>
            <button
              onClick={() => setActiveTab('telemetry')}
              className={`px-4 text-[15px] font-bold h-full border-b-2 flex items-center transition-all ${
                activeTab === 'telemetry'
                  ? 'border-[#e10600] text-[#e10600]'
                  : 'border-transparent text-[var(--color-muted)] hover:text-white'
              }`}
            >
              {activeTab === 'telemetry' ? 'TELEMETRY' : 'Telemetry'}
            </button>
            <button
              onClick={() => setActiveTab('racecontrol')}
              className={`px-4 text-[15px] font-bold h-full border-b-2 flex items-center transition-all ${
                activeTab === 'racecontrol'
                  ? 'border-[#e10600] text-[#e10600]'
                  : 'border-transparent text-[var(--color-muted)] hover:text-white'
              }`}
            >
              {activeTab === 'racecontrol' ? 'RACE CONTROL' : 'Race Control'}
            </button>
          </div>
        </nav>
      </div>

      {/* ── TAB CONTENT DISPLAY AREA ── */}
      <main className="px-edge-margin pt-[150px] pb-8">
        {loading ? (
          <div className="text-center py-24 text-[16px] text-[var(--color-muted)] tracking-widest font-bold uppercase">
            CONNECTING TO F1 PITWALL CONTROLS...
          </div>
        ) : sessionLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-center font-mono">
            <div className="text-[16px] text-[#e10600] font-bold tracking-[3px] mb-3 animate-pulse">
              ◆ COMPILING SESSION DATA FOR {activeCircuitShortName.toUpperCase()} {activeYear} — {activeSessionType.toUpperCase()}
            </div>
            <div className="w-96 h-1 bg-[var(--border-color)] border border-[#1e1e2e] relative overflow-hidden mb-6">
              <div className="h-full bg-[#e10600] transition-all duration-300" style={{ width: `${loadProgress}%` }} />
            </div>
            <div className="text-[14px] text-[var(--color-muted)] uppercase space-y-1">
              <div>Progress: {Math.round(loadProgress)}%</div>
              <div>Estimated Time: 30 - 60 Seconds</div>
              <div>Fetching telemetry from FastF1 servers...</div>
            </div>
          </div>
        ) : !sessionLoaded ? (
          <div className="flex flex-col items-center justify-center py-24 text-center font-mono border border-dashed border-[var(--border-color)] rounded-[4px] bg-[var(--bg-secondary)]">
            <span className="material-symbols-outlined text-[#e10600] text-[52px] mb-4">settings_suggest</span>
            <div className="text-[17px] text-[var(--color-text)] font-bold uppercase tracking-[2px] mb-2">No Active Session Loaded</div>
            <div className="text-[14px] text-[var(--color-muted)] uppercase max-w-sm mb-6">
              Use the dropdown selectors in the header to select a year, circuit venue, and session type to begin analysis.
            </div>
            {loadError && (
              <div className="max-w-md bg-[#1a0404] border border-[#3a0808] p-4 text-[14px] text-[#ff4444] rounded-[2px]">
                ⚠ LOAD ERROR: {loadError}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* 1. Results Tab */}
            {activeTab === 'results' && (
              <div className="grid grid-cols-1 gap-6">
                <TimingTower drivers={drivers} activeDriver={activeDriver} setActiveDriver={setActiveDriver} />
              </div>
            )}

            {/* 2. Strategy Tab */}
            {activeTab === 'strategy' && (
              <div className="grid grid-cols-1 gap-6">
                <PitStrategy />
              </div>
            )}

            {/* 3. Lap Times Tab */}
            {activeTab === 'laptimes' && (
              <div className="grid grid-cols-1 gap-6">
                <LapComparison drivers={drivers} activeDriver={activeDriver} />
              </div>
            )}

            {/* 4. Track Dominance Tab */}
            {activeTab === 'dominance' && (
              <div className="grid grid-cols-1 gap-6">
                <TrackDominanceMap />
              </div>
            )}

            {/* 6. Race Control Tab */}
            {activeTab === 'racecontrol' && (
              <div className="grid grid-cols-1 gap-6">
                <RaceControl raceControl={raceControl} />
              </div>
            )}

            {/* 5. Telemetry Tab (Grid of 8 Premium Recharts Graphs) */}
            {activeTab === 'telemetry' && (
              <div className="space-y-6">
                
                {/* Latency Info Header */}
                <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-2 text-[13px] text-[var(--color-muted)] uppercase font-bold">
                  <span>TELEMETRY_REALTIME_CHANNELS</span>
                  <span>System Latency: <span className="text-[#e10600]">{latency}</span></span>
                </div>

                {/* Row 1 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Graph 1: SPEED TRACE */}
                  <section className="bg-[var(--bg-secondary)] border border-[var(--border-color)] flex flex-col h-[520px] rounded-[2px] overflow-hidden">
                    <header className="p-4 border-b border-[var(--border-color)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-[#e10600]"></div>
                        <h2 className="text-[15px] font-bold uppercase text-[var(--color-text)]">
                          {c1Driver}'s Lap {c1Lap} Speed Trace
                        </h2>
                      </div>
                      <div className="flex gap-2">
                        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] px-2.5 py-1 text-[14px] font-mono text-[var(--color-muted)] rounded-[2px] uppercase">CHART: SPEED</div>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-mono font-bold text-[14px] uppercase select-none">DRIVER:</span>
                          <select
                            value={c1Driver}
                            onChange={(e) => setC1Driver(e.target.value)}
                            className="bg-[var(--bg-primary)] border border-[var(--border-color)] pl-2.5 pr-10 py-1 text-[14px] font-mono text-[var(--color-muted)] hover:text-white hover:border-[#e10600] rounded-[2px] outline-none appearance-none cursor-pointer transition-colors" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M1 1l3 2 3-2' stroke='%23888888' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                          >
                            <option value={c1Driver} className="bg-[var(--bg-secondary)] text-white">{c1Driver}</option>
                            {driverOptions.filter(d => d !== c1Driver).map(d => (
                              <option key={d} value={d} className="bg-[var(--bg-secondary)] text-white">{d}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-mono font-bold text-[14px] uppercase select-none">LAP:</span>
                          <select
                            value={c1Lap}
                            onChange={(e) => setC1Lap(Number(e.target.value))}
                            className="bg-[var(--bg-primary)] border border-[var(--border-color)] pl-2.5 pr-10 py-1 text-[14px] font-mono text-[var(--color-muted)] hover:text-white hover:border-[#e10600] rounded-[2px] outline-none appearance-none cursor-pointer transition-colors" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M1 1l3 2 3-2' stroke='%23888888' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                          >
                            <option value={c1Lap} className="bg-[var(--bg-secondary)] text-white">{String(c1Lap).padStart(2, '0')}</option>
                            {lapOptions.filter(l => l !== c1Lap).map(l => (
                              <option key={l} value={l} className="bg-[var(--bg-secondary)] text-white">{String(l).padStart(2, '0')}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </header>
                    <div className="flex-grow bg-[var(--bg-primary)] technical-grid relative p-6 flex flex-col">
                      <div className="flex justify-between text-[#454655] text-[13px] font-bold mb-2">
                        <span>Y: KM/H [0..350]</span>
                        <span>X: TRACK DISTANCE [m]</span>
                      </div>
                      <div className="flex-grow relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={getSpeedTraceData(c1Driver, c1Lap)} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                            <XAxis dataKey="distance" stroke="#1e1e2e" tick={false} />
                            <YAxis domain={[0, 350]} stroke="#1e1e2e" tick={{ fill: '#454655', fontSize: 13 }} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', fontSize: 14, fontFamily: 'monospace' }} />
                            <Line type="monotone" dataKey="speed" stroke="#e10600" strokeWidth={1.5} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                        <div className="absolute top-4 right-4 bg-[var(--bg-secondary)] border border-[var(--border-color)] p-3 text-[14px] space-y-1 backdrop-blur-sm z-10">
                          <div className="flex justify-between gap-8"><span>V_MAX:</span> <span className="text-white font-bold">328.4 KM/H</span></div>
                          <div className="flex justify-between gap-8"><span>V_MIN:</span> <span className="text-white font-bold">82.1 KM/H</span></div>
                          <div className="flex justify-between gap-8"><span>DRS_ACT:</span> <span className="text-[#00e676] font-bold">TRUE</span></div>
                        </div>
                      </div>
                    </div>
                    <footer className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] flex justify-end">
                      <button className="text-[13px] text-[var(--color-muted)] hover:text-[#e10600] transition-colors uppercase font-bold">[ ↓ Download Chart .CSV ]</button>
                    </footer>
                  </section>

                  {/* Graph 2: GEAR SHIFTS */}
                  <section className="bg-[var(--bg-secondary)] border border-[var(--border-color)] flex flex-col h-[520px] rounded-[2px] overflow-hidden">
                    <header className="p-4 border-b border-[var(--border-color)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-[#81cfff]"></div>
                        <h2 className="text-[15px] font-bold uppercase text-[var(--color-text)]">
                          {c2Driver}'s Lap {c2Lap} Gear Shifts
                        </h2>
                      </div>
                      <div className="flex gap-2">
                        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] px-2.5 py-1 text-[14px] font-mono text-[var(--color-muted)] rounded-[2px] uppercase">CHART: GEAR</div>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-mono font-bold text-[14px] uppercase select-none">DRIVER:</span>
                          <select
                            value={c2Driver}
                            onChange={(e) => setC2Driver(e.target.value)}
                            className="bg-[var(--bg-primary)] border border-[var(--border-color)] pl-2.5 pr-10 py-1 text-[14px] font-mono text-[var(--color-muted)] hover:text-white hover:border-[#e10600] rounded-[2px] outline-none appearance-none cursor-pointer transition-colors" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M1 1l3 2 3-2' stroke='%23888888' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                          >
                            <option value={c2Driver} className="bg-[var(--bg-secondary)] text-white">{c2Driver}</option>
                            {driverOptions.filter(d => d !== c2Driver).map(d => (
                              <option key={d} value={d} className="bg-[var(--bg-secondary)] text-white">{d}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-mono font-bold text-[14px] uppercase select-none">LAP:</span>
                          <select
                            value={c2Lap}
                            onChange={(e) => setC2Lap(Number(e.target.value))}
                            className="bg-[var(--bg-primary)] border border-[var(--border-color)] pl-2.5 pr-10 py-1 text-[14px] font-mono text-[var(--color-muted)] hover:text-white hover:border-[#e10600] rounded-[2px] outline-none appearance-none cursor-pointer transition-colors" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M1 1l3 2 3-2' stroke='%23888888' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                          >
                            <option value={c2Lap} className="bg-[var(--bg-secondary)] text-white">{String(c2Lap).padStart(2, '0')}</option>
                            {lapOptions.filter(l => l !== c2Lap).map(l => (
                              <option key={l} value={l} className="bg-[var(--bg-secondary)] text-white">{String(l).padStart(2, '0')}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </header>
                    <div className="flex-grow bg-[var(--bg-primary)] technical-grid relative p-6 flex flex-col">
                      <div className="flex justify-between text-[#454655] text-[13px] font-bold mb-2">
                        <span>Y: GEAR [1..8]</span>
                        <span>X: TIME [ms]</span>
                      </div>
                      <div className="flex-grow relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={getGearShiftsData(c2Driver, c2Lap)} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                            <XAxis dataKey="time" stroke="#1e1e2e" tick={false} />
                            <YAxis domain={[1, 8]} ticks={[1, 2, 3, 4, 5, 6, 7, 8]} stroke="#1e1e2e" tick={{ fill: '#454655', fontSize: 13 }} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', fontSize: 14, fontFamily: 'monospace' }} />
                            <Line type="stepAfter" dataKey="gear" stroke="#81cfff" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                        <div className="absolute bottom-4 left-4 flex gap-4 bg-[var(--bg-secondary)] px-3 py-1.5 border border-[var(--border-color)] rounded-[2px]">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-[#00e676] rounded-full animate-pulse shadow-[0_0_5px_#00e676]"></span>
                            <span className="text-[13px] text-[var(--color-muted)] font-bold uppercase">Gear Sync Active</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <footer className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] flex justify-end">
                      <button className="text-[13px] text-[var(--color-muted)] hover:text-[#e10600] transition-colors uppercase font-bold">[ ↓ Download Chart .PNG ]</button>
                    </footer>
                  </section>

                </div>

                {/* Row 2 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Graph 3: THROTTLE & BRAKE */}
                  <section className="bg-[var(--bg-secondary)] border border-[var(--border-color)] flex flex-col h-[520px] rounded-[2px] overflow-hidden">
                    <header className="p-4 border-b border-[var(--border-color)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-[#00e676]"></div>
                        <h2 className="text-[15px] font-bold uppercase text-[var(--color-text)]">
                          {c3Driver}'s Lap {c3Lap} Inputs
                        </h2>
                      </div>
                      <div className="flex gap-2">
                        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] px-2.5 py-1 text-[14px] font-mono text-[var(--color-muted)] rounded-[2px] uppercase">CHART: PEDAL</div>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-mono font-bold text-[14px] uppercase select-none">DRIVER:</span>
                          <select
                            value={c3Driver}
                            onChange={(e) => setC3Driver(e.target.value)}
                            className="bg-[var(--bg-primary)] border border-[var(--border-color)] pl-2.5 pr-10 py-1 text-[14px] font-mono text-[var(--color-muted)] hover:text-white hover:border-[#e10600] rounded-[2px] outline-none appearance-none cursor-pointer transition-colors" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M1 1l3 2 3-2' stroke='%23888888' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                          >
                            <option value={c3Driver} className="bg-[var(--bg-secondary)] text-white">{c3Driver}</option>
                            {driverOptions.filter(d => d !== c3Driver).map(d => (
                              <option key={d} value={d} className="bg-[var(--bg-secondary)] text-white">{d}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-mono font-bold text-[14px] uppercase select-none">LAP:</span>
                          <select
                            value={c3Lap}
                            onChange={(e) => setC3Lap(Number(e.target.value))}
                            className="bg-[var(--bg-primary)] border border-[var(--border-color)] pl-2.5 pr-10 py-1 text-[14px] font-mono text-[var(--color-muted)] hover:text-white hover:border-[#e10600] rounded-[2px] outline-none appearance-none cursor-pointer transition-colors" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M1 1l3 2 3-2' stroke='%23888888' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                          >
                            <option value={c3Lap} className="bg-[var(--bg-secondary)] text-white">{String(c3Lap).padStart(2, '0')}</option>
                            {lapOptions.filter(l => l !== c3Lap).map(l => (
                              <option key={l} value={l} className="bg-[var(--bg-secondary)] text-white">{String(l).padStart(2, '0')}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </header>
                    <div className="flex-grow bg-[var(--bg-primary)] technical-grid relative p-6 flex flex-col">
                      <div className="flex justify-between text-[#454655] text-[13px] font-bold mb-2">
                        <span>Y: % INPUT [0..100]</span>
                        <span>X: TRACK DISTANCE [m]</span>
                      </div>
                      <div className="flex-grow relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={getPedalInputsData(c3Driver, c3Lap)} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                            <XAxis dataKey="distance" stroke="#1e1e2e" tick={false} />
                            <YAxis domain={[0, 100]} stroke="#1e1e2e" tick={{ fill: '#454655', fontSize: 13 }} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', fontSize: 14, fontFamily: 'monospace' }} />
                            <Line type="monotone" dataKey="throttle" stroke="#00e676" strokeWidth={1.5} dot={false} name="Throttle" />
                            <Line type="monotone" dataKey="brake" stroke="#e10600" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Brake" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <footer className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] flex justify-end">
                      <button className="text-[13px] text-[var(--color-muted)] hover:text-[#e10600] transition-colors uppercase font-bold">[ ↓ Download Chart .CSV ]</button>
                    </footer>
                  </section>

                  {/* Graph 4: ENGINE RPM */}
                  <section className="bg-[var(--bg-secondary)] border border-[var(--border-color)] flex flex-col h-[520px] rounded-[2px] overflow-hidden">
                    <header className="p-4 border-b border-[var(--border-color)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-[#e10600]"></div>
                        <h2 className="text-[15px] font-bold uppercase text-[var(--color-text)]">
                          {c4Driver}'s Lap {c4Lap} RPM Trace
                        </h2>
                      </div>
                      <div className="flex gap-2">
                        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] px-2.5 py-1 text-[14px] font-mono text-[var(--color-muted)] rounded-[2px] uppercase">CHART: RPM</div>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-mono font-bold text-[14px] uppercase select-none">DRIVER:</span>
                          <select
                            value={c4Driver}
                            onChange={(e) => setC4Driver(e.target.value)}
                            className="bg-[var(--bg-primary)] border border-[var(--border-color)] pl-2.5 pr-10 py-1 text-[14px] font-mono text-[var(--color-muted)] hover:text-white hover:border-[#e10600] rounded-[2px] outline-none appearance-none cursor-pointer transition-colors" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M1 1l3 2 3-2' stroke='%23888888' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                          >
                            <option value={c4Driver} className="bg-[var(--bg-secondary)] text-white">{c4Driver}</option>
                            {driverOptions.filter(d => d !== c4Driver).map(d => (
                              <option key={d} value={d} className="bg-[var(--bg-secondary)] text-white">{d}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-mono font-bold text-[14px] uppercase select-none">LAP:</span>
                          <select
                            value={c4Lap}
                            onChange={(e) => setC4Lap(Number(e.target.value))}
                            className="bg-[var(--bg-primary)] border border-[var(--border-color)] pl-2.5 pr-10 py-1 text-[14px] font-mono text-[var(--color-muted)] hover:text-white hover:border-[#e10600] rounded-[2px] outline-none appearance-none cursor-pointer transition-colors" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M1 1l3 2 3-2' stroke='%23888888' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                          >
                            <option value={c4Lap} className="bg-[var(--bg-secondary)] text-white">{String(c4Lap).padStart(2, '0')}</option>
                            {lapOptions.filter(l => l !== c4Lap).map(l => (
                              <option key={l} value={l} className="bg-[var(--bg-secondary)] text-white">{String(l).padStart(2, '0')}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </header>
                    <div className="flex-grow bg-[var(--bg-primary)] technical-grid relative p-6 flex flex-col">
                      <div className="flex justify-between text-[#454655] text-[13px] font-bold mb-2">
                        <span>Y: RPM [0..15000]</span>
                        <span>X: TIME [ms]</span>
                      </div>
                      <div className="flex-grow relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={getRpmData(c4Driver, c4Lap)} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                            <XAxis dataKey="time" stroke="#1e1e2e" tick={false} />
                            <YAxis domain={[0, 15000]} ticks={[0, 3000, 6000, 9000, 12000, 15000]} stroke="#1e1e2e" tick={{ fill: '#454655', fontSize: 13 }} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', fontSize: 14, fontFamily: 'monospace' }} />
                            <Line type="monotone" dataKey="rpm" stroke="#ffea00" strokeWidth={1} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <footer className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] flex justify-end">
                      <button className="text-[13px] text-[var(--color-muted)] hover:text-[#e10600] transition-colors uppercase font-bold">[ ↓ Download Chart .PNG ]</button>
                    </footer>
                  </section>

                </div>

                {/* Row 3 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Graph 5: G-FORCE */}
                  <section className="bg-[var(--bg-secondary)] border border-[var(--border-color)] flex flex-col min-h-[520px] rounded-[2px] overflow-hidden">
                    <header className="p-4 border-b border-[var(--border-color)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-[#c6c5d7]"></div>
                        <h2 className="text-[15px] font-bold uppercase text-[var(--color-text)]">
                          {c5Driver}'s Lap {c5Lap} G-Force
                        </h2>
                      </div>
                      <div className="flex gap-2">
                        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] px-2.5 py-1 text-[14px] font-mono text-[var(--color-muted)] rounded-[2px] uppercase">CHART: G-FORCE</div>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-mono font-bold text-[14px] uppercase select-none">DRIVER:</span>
                          <select
                            value={c5Driver}
                            onChange={(e) => setC5Driver(e.target.value)}
                            className="bg-[var(--bg-primary)] border border-[var(--border-color)] pl-2.5 pr-10 py-1 text-[14px] font-mono text-[var(--color-muted)] hover:text-white hover:border-[#e10600] rounded-[2px] outline-none appearance-none cursor-pointer transition-colors" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M1 1l3 2 3-2' stroke='%23888888' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                          >
                            <option value={c5Driver} className="bg-[var(--bg-secondary)] text-white">{c5Driver}</option>
                            {driverOptions.filter(d => d !== c5Driver).map(d => (
                              <option key={d} value={d} className="bg-[var(--bg-secondary)] text-white">{d}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-mono font-bold text-[14px] uppercase select-none">LAP:</span>
                          <select
                            value={c5Lap}
                            onChange={(e) => setC5Lap(Number(e.target.value))}
                            className="bg-[var(--bg-primary)] border border-[var(--border-color)] pl-2.5 pr-10 py-1 text-[14px] font-mono text-[var(--color-muted)] hover:text-white hover:border-[#e10600] rounded-[2px] outline-none appearance-none cursor-pointer transition-colors" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M1 1l3 2 3-2' stroke='%23888888' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                          >
                            <option value={c5Lap} className="bg-[var(--bg-secondary)] text-white">{String(c5Lap).padStart(2, '0')}</option>
                            {lapOptions.filter(l => l !== c5Lap).map(l => (
                              <option key={l} value={l} className="bg-[var(--bg-secondary)] text-white">{String(l).padStart(2, '0')}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </header>
                    <div className="flex-grow bg-[var(--bg-primary)] technical-grid p-6 flex flex-col xl:flex-row items-center justify-center gap-6 overflow-hidden">
                      {/* G-Force Radar Layout */}
                      <div className="relative flex-shrink-0 flex items-center justify-center" style={{ width: '240px', height: '240px' }}>
                        {/* Concentric circles */}
                        <div className="absolute border border-[var(--border-color)] rounded-full pointer-events-none" style={{ width: '240px', height: '240px' }}></div>
                        <div className="absolute border border-[var(--border-color)] rounded-full pointer-events-none" style={{ width: '180px', height: '180px' }}></div>
                        <div className="absolute border border-[var(--border-color)] rounded-full pointer-events-none" style={{ width: '120px', height: '120px' }}></div>
                        <div className="absolute border border-[var(--border-color)] rounded-full pointer-events-none" style={{ width: '60px', height: '60px' }}></div>
                        
                        {/* Crosshairs */}
                        <div className="absolute w-full h-[1px] bg-[var(--border-color)]/80 pointer-events-none"></div>
                        <div className="absolute h-full w-[1px] bg-[var(--border-color)]/80 pointer-events-none"></div>
                        
                        <span className="absolute top-1 text-[11px] font-bold text-[#454655] uppercase tracking-wider">LONG +</span>
                        <span className="absolute bottom-1 text-[11px] font-bold text-[#454655] uppercase tracking-wider">LONG -</span>
                        <span className="absolute right-1 text-[11px] font-bold text-[#454655] uppercase tracking-wider">LAT +</span>
                        <span className="absolute left-1 text-[11px] font-bold text-[#454655] uppercase tracking-wider">LAT -</span>
                        
                        {/* Functional Radar Plot */}
                        <div className="absolute inset-0 z-10">
                          <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                              <XAxis type="number" dataKey="lat" domain={[-4, 4]} hide />
                              <YAxis type="number" dataKey="long" domain={[-4, 4]} hide />
                              <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', fontSize: 12, fontFamily: 'monospace' }} />
                              <Scatter name="G-Force Radar" data={getGForceData(c5Driver, c5Lap)} fill="#e10600" line={false} />
                            </ScatterChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* G-Force Trace Time-Series Plot */}
                      <div className="flex-grow w-full min-w-[240px]" style={{ height: '240px' }}>
                        <div className="flex justify-between text-[#454655] text-[12px] font-bold mb-1.5">
                          <span>Y: G-LOAD [-6G..+6G]</span>
                          <span>X: TIME [ms]</span>
                        </div>
                        <ResponsiveContainer width="100%" height="90%">
                          <AreaChart data={getGForceTraceData(c5Driver, c5Lap)} margin={{ left: -25, right: 5, top: 5, bottom: 0 }}>
                            <defs>
                              <linearGradient id="gforceGradTelemetry" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#29b6f6" stopOpacity={0.25}/>
                                <stop offset="95%" stopColor="#29b6f6" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="gforceLatGradTelemetry" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ab47bc" stopOpacity={0.25}/>
                                <stop offset="95%" stopColor="#ab47bc" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="2 2" stroke="var(--border-color)" />
                            <XAxis dataKey="time" hide />
                            <YAxis stroke="#444552" domain={[-6, 6]} fontSize={11} />
                            <Tooltip
                              contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: '#1e1e2e', fontSize: '11px', fontFamily: 'monospace' }}
                              formatter={(v, name) => [
                                `${v} G`,
                                name === 'longG' ? 'Longitudinal G' : name === 'latG' ? 'Lateral G' : name
                              ]}
                            />
                            <Legend verticalAlign="top" height={24} iconSize={6} wrapperStyle={{ fontSize: 11, fontFamily: 'monospace' }} />
                            <ReferenceLine y={0} stroke="#444552" strokeWidth={1} strokeDasharray="3 3" />
                            <Area type="monotone" dataKey="longG" stroke="#29b6f6" strokeWidth={1.5} fillOpacity={0.6} fill="url(#gforceGradTelemetry)" name="longG" />
                            <Area type="monotone" dataKey="latG" stroke="#ab47bc" strokeWidth={1.5} fillOpacity={0.4} fill="url(#gforceLatGradTelemetry)" name="latG" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <footer className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] flex justify-end">
                      <button className="text-[13px] text-[var(--color-muted)] hover:text-[#e10600] transition-colors uppercase font-bold">[ ↓ Download Chart .CSV ]</button>
                    </footer>
                  </section>

                  {/* Graph 6: GEAR SIGNATURE */}
                  <section className="bg-[var(--bg-secondary)] border border-[var(--border-color)] flex flex-col h-[520px] rounded-[2px] overflow-hidden">
                    <header className="p-4 border-b border-[var(--border-color)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-[#81cfff]"></div>
                        <h2 className="text-[15px] font-bold uppercase text-[var(--color-text)]">
                          {c6Driver}'s Lap {c6Lap} Gear Signature
                        </h2>
                      </div>
                      <div className="flex gap-2">
                        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] px-2.5 py-1 text-[14px] font-mono text-[var(--color-muted)] rounded-[2px] uppercase">CHART: SIGN</div>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-mono font-bold text-[14px] uppercase select-none">DRIVER:</span>
                          <select
                            value={c6Driver}
                            onChange={(e) => setC6Driver(e.target.value)}
                            className="bg-[var(--bg-primary)] border border-[var(--border-color)] pl-2.5 pr-10 py-1 text-[14px] font-mono text-[var(--color-muted)] hover:text-white hover:border-[#e10600] rounded-[2px] outline-none appearance-none cursor-pointer transition-colors" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M1 1l3 2 3-2' stroke='%23888888' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                          >
                            <option value={c6Driver} className="bg-[var(--bg-secondary)] text-white">{c6Driver}</option>
                            {driverOptions.filter(d => d !== c6Driver).map(d => (
                              <option key={d} value={d} className="bg-[var(--bg-secondary)] text-white">{d}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-mono font-bold text-[14px] uppercase select-none">LAP:</span>
                          <select
                            value={c6Lap}
                            onChange={(e) => setC6Lap(Number(e.target.value))}
                            className="bg-[var(--bg-primary)] border border-[var(--border-color)] pl-2.5 pr-10 py-1 text-[14px] font-mono text-[var(--color-muted)] hover:text-white hover:border-[#e10600] rounded-[2px] outline-none appearance-none cursor-pointer transition-colors" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M1 1l3 2 3-2' stroke='%23888888' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                          >
                            <option value={c6Lap} className="bg-[var(--bg-secondary)] text-white">{String(c6Lap).padStart(2, '0')}</option>
                            {lapOptions.filter(l => l !== c6Lap).map(l => (
                              <option key={l} value={l} className="bg-[var(--bg-secondary)] text-white">{String(l).padStart(2, '0')}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </header>
                    <div className="flex-grow bg-[var(--bg-primary)] technical-grid relative p-6 flex flex-col">
                      <div className="flex justify-between text-[#454655] text-[13px] font-bold mb-2">
                        <span>Y: % DURATION IN GEAR</span>
                        <span>X: TRANSMISSION STAGES</span>
                      </div>
                      <div className="flex-grow relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={getGearSignatureData(c6Driver, c6Lap)} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                            <XAxis dataKey="gear" stroke="#1e1e2e" tick={{ fill: '#454655', fontSize: 13 }} />
                            <YAxis domain={[0, 45]} stroke="#1e1e2e" tick={{ fill: '#454655', fontSize: 13 }} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', fontSize: 14, fontFamily: 'monospace' }} />
                            <Bar dataKey="duration" fill="#81cfff" radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <footer className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] flex justify-end">
                      <button className="text-[13px] text-[var(--color-muted)] hover:text-[#e10600] transition-colors uppercase font-bold">[ ↓ Download Chart .PNG ]</button>
                    </footer>
                  </section>

                </div>

                {/* Row 4 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Graph 7: TYRE DEGRADATION */}
                  <section className="bg-[var(--bg-secondary)] border border-[var(--border-color)] flex flex-col h-[520px] rounded-[2px] overflow-hidden">
                    <header className="p-4 border-b border-[var(--border-color)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-[#e10600]"></div>
                        <h2 className="text-[15px] font-bold uppercase text-[var(--color-text)]">
                          {c7Compound} - {c7Driver} Tyre Forecast
                        </h2>
                      </div>
                      <div className="flex gap-2">
                        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] px-2.5 py-1 text-[14px] font-mono text-[var(--color-muted)] rounded-[2px] uppercase">CHART: TYRE</div>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-mono font-bold text-[14px] uppercase select-none">DRIVER:</span>
                          <select
                            value={c7Driver}
                            onChange={(e) => setC7Driver(e.target.value)}
                            className="bg-[var(--bg-primary)] border border-[var(--border-color)] pl-2.5 pr-10 py-1 text-[14px] font-mono text-[var(--color-muted)] hover:text-white hover:border-[#e10600] rounded-[2px] outline-none appearance-none cursor-pointer transition-colors" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M1 1l3 2 3-2' stroke='%23888888' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                          >
                            <option value={c7Driver} className="bg-[var(--bg-secondary)] text-white">{c7Driver}</option>
                            {driverOptions.filter(d => d !== c7Driver).map(d => (
                              <option key={d} value={d} className="bg-[var(--bg-secondary)] text-white">{d}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-mono font-bold text-[14px] uppercase select-none">COMP:</span>
                          <select
                            value={c7Compound}
                            onChange={(e) => setC7Compound(e.target.value)}
                            className="bg-[var(--bg-primary)] border border-[var(--border-color)] pl-2.5 pr-10 py-1 text-[14px] font-mono text-[var(--color-muted)] hover:text-white hover:border-[#e10600] rounded-[2px] outline-none appearance-none cursor-pointer transition-colors" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M1 1l3 2 3-2' stroke='%23888888' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                          >
                            <option value={c7Compound} className="bg-[var(--bg-secondary)] text-white">{c7Compound}</option>
                            {compoundOptions.filter(c => c !== c7Compound).map(c => (
                              <option key={c} value={c} className="bg-[var(--bg-secondary)] text-white">{c}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </header>
                    <div className="flex-grow bg-[var(--bg-primary)] technical-grid relative p-6 flex flex-col">
                      <div className="flex justify-between text-[#454655] text-[13px] font-bold mb-2">
                        <span>Y: TYRE WEAR (%)</span>
                        <span>X: LAPS RUN</span>
                      </div>
                      <div className="flex-grow relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={getTyreDegradationData(c7Driver, c7Compound)} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                            <XAxis dataKey="lap" stroke="#1e1e2e" tick={{ fill: '#454655', fontSize: 13 }} />
                            <YAxis domain={[0, 100]} stroke="#1e1e2e" tick={{ fill: '#454655', fontSize: 13 }} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', fontSize: 14, fontFamily: 'monospace' }} />
                            <Area type="monotone" dataKey="wear" stroke="#888899" fill="#888899" fillOpacity={0.1} strokeWidth={1} name="Actual Wear" />
                            <Area type="monotone" dataKey="limit" stroke="#e10600" fill="none" strokeDasharray="6 6" strokeWidth={2} name="Wear Limit" />
                          </AreaChart>
                        </ResponsiveContainer>
                        <div className="absolute top-10 left-10 text-[13px] font-bold text-[#e10600] uppercase tracking-widest bg-[var(--bg-secondary)] px-2 py-1 border border-[var(--border-color)]">
                          Critical Wear Limit
                        </div>
                      </div>
                    </div>
                    <footer className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] flex justify-end">
                      <button className="text-[13px] text-[var(--color-muted)] hover:text-[#e10600] transition-colors uppercase font-bold">[ ↓ Download Chart .CSV ]</button>
                    </footer>
                  </section>

                  {/* Graph 8: BRAKE TEMPERATURE */}
                  <section className="bg-[var(--bg-secondary)] border border-[var(--border-color)] flex flex-col h-[520px] rounded-[2px] overflow-hidden">
                    <header className="p-4 border-b border-[var(--border-color)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-orange-500"></div>
                        <h2 className="text-[15px] font-bold uppercase text-[var(--color-text)]">
                          {c8Driver}'s Lap {c8Lap} Brake Temps
                        </h2>
                      </div>
                      <div className="flex gap-2">
                        <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] px-2.5 py-1 text-[14px] font-mono text-[var(--color-muted)] rounded-[2px] uppercase">CHART: BRAKE</div>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-mono font-bold text-[14px] uppercase select-none">DRIVER:</span>
                          <select
                            value={c8Driver}
                            onChange={(e) => setC8Driver(e.target.value)}
                            className="bg-[var(--bg-primary)] border border-[var(--border-color)] pl-2.5 pr-10 py-1 text-[14px] font-mono text-[var(--color-muted)] hover:text-white hover:border-[#e10600] rounded-[2px] outline-none appearance-none cursor-pointer transition-colors" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M1 1l3 2 3-2' stroke='%23888888' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                          >
                            <option value={c8Driver} className="bg-[var(--bg-secondary)] text-white">{c8Driver}</option>
                            {driverOptions.filter(d => d !== c8Driver).map(d => (
                              <option key={d} value={d} className="bg-[var(--bg-secondary)] text-white">{d}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-mono font-bold text-[14px] uppercase select-none">LAP:</span>
                          <select
                            value={c8Lap}
                            onChange={(e) => setC8Lap(Number(e.target.value))}
                            className="bg-[var(--bg-primary)] border border-[var(--border-color)] pl-2.5 pr-10 py-1 text-[14px] font-mono text-[var(--color-muted)] hover:text-white hover:border-[#e10600] rounded-[2px] outline-none appearance-none cursor-pointer transition-colors" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M1 1l3 2 3-2' stroke='%23888888' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                          >
                            <option value={c8Lap} className="bg-[var(--bg-secondary)] text-white">{String(c8Lap).padStart(2, '0')}</option>
                            {lapOptions.filter(l => l !== c8Lap).map(l => (
                              <option key={l} value={l} className="bg-[var(--bg-secondary)] text-white">{String(l).padStart(2, '0')}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </header>
                    <div className="flex-grow bg-[var(--bg-primary)] technical-grid relative p-8 flex items-center">
                      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8">
                        
                        {/* Front Axle */}
                        <div className="flex flex-col justify-center gap-4 bg-[var(--bg-secondary)] p-6 border border-[var(--border-color)] rounded-[2px]">
                          <span className="text-[14px] font-bold text-[var(--color-muted)] uppercase tracking-wider">Front Axle Temperature</span>
                          <div className="h-3 w-full bg-[#1e2021] overflow-hidden rounded-[1px] border border-[var(--border-color)]">
                            <div className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-500" style={{ width: `${frontPct}%` }}></div>
                          </div>
                          <span className="text-[15px] font-bold text-white tracking-widest mt-1">
                            AXLE AVERAGE: <span className="text-orange-500 font-black">{brakeTemps.front}°C</span>
                          </span>
                        </div>

                        {/* Rear Axle */}
                        <div className="flex flex-col justify-center gap-4 bg-[var(--bg-secondary)] p-6 border border-[var(--border-color)] rounded-[2px]">
                          <span className="text-[14px] font-bold text-[var(--color-muted)] uppercase tracking-wider">Rear Axle Temperature</span>
                          <div className="h-3 w-full bg-[#1e2021] overflow-hidden rounded-[1px] border border-[var(--border-color)]">
                            <div className="h-full bg-gradient-to-r from-orange-400 to-orange-300 transition-all duration-500" style={{ width: `${rearPct}%` }}></div>
                          </div>
                          <span className="text-[15px] font-bold text-white tracking-widest mt-1">
                            AXLE AVERAGE: <span className="text-orange-300 font-black">{brakeTemps.rear}°C</span>
                          </span>
                        </div>

                      </div>
                    </div>
                    <footer className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] flex justify-end">
                      <button className="text-[13px] text-[var(--color-muted)] hover:text-[#e10600] transition-colors uppercase font-bold">[ ↓ Download Chart .PNG ]</button>
                    </footer>
                  </section>

                </div>

                {/* ── Reference Index ── */}
                <section className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[2px] mt-8 overflow-hidden">
                  <div className="p-3 border-b border-[var(--border-color)] bg-[var(--border-color)]">
                    <h3 className="text-[14px] font-bold text-[var(--color-text)] uppercase tracking-[3px]">
                      Telemetry Type Reference Index
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-color)]">
                    <div className="p-4 hover:bg-[var(--border-color)] transition-colors cursor-help">
                      <h4 className="text-[13px] font-bold text-[#e10600] mb-1.5 uppercase">Speed Trace</h4>
                      <p className="text-[14px] text-[var(--color-muted)] leading-relaxed">Velocity profiles across track distance. Identifies corner entry/exit efficiency.</p>
                    </div>
                    <div className="p-4 hover:bg-[var(--border-color)] transition-colors cursor-help">
                      <h4 className="text-[13px] font-bold text-[var(--color-muted)] mb-1.5 uppercase">Throttle/Brake</h4>
                      <p className="text-[14px] text-[var(--color-muted)] leading-relaxed">Input percentage overlay. Analyzes driver aggression and trail braking tech.</p>
                    </div>
                    <div className="p-4 hover:bg-[var(--border-color)] transition-colors cursor-help">
                      <h4 className="text-[13px] font-bold text-[var(--color-muted)] mb-1.5 uppercase">RPM</h4>
                      <p className="text-[14px] text-[var(--color-muted)] leading-relaxed">Engine revolutions per minute. Crucial for shift optimization and torque delivery.</p>
                    </div>
                    <div className="p-4 hover:bg-[var(--border-color)] transition-colors cursor-help">
                      <h4 className="text-[13px] font-bold text-[var(--color-muted)] mb-1.5 uppercase">Gear</h4>
                      <p className="text-[14px] text-[var(--color-muted)] leading-relaxed">Step-chart of transmission states. Maps to track-specific ratio adjustments.</p>
                    </div>
                    <div className="p-4 hover:bg-[var(--border-color)] transition-colors cursor-help">
                      <h4 className="text-[13px] font-bold text-[var(--color-muted)] mb-1.5 uppercase">G-Force</h4>
                      <p className="text-[14px] text-[var(--color-muted)] leading-relaxed">Lateral and longitudinal loading metrics. Highlighting aerodynamic efficiency.</p>
                    </div>
                    <div className="p-4 hover:bg-[var(--border-color)] transition-colors cursor-help">
                      <h4 className="text-[13px] font-bold text-[var(--color-muted)] mb-1.5 uppercase">Gear Signature</h4>
                      <p className="text-[14px] text-[var(--color-muted)] leading-relaxed">Unique driver shift patterns. Used for benchmarking team-mate performance gap.</p>
                    </div>
                    <div className="p-4 hover:bg-[var(--border-color)] transition-colors cursor-help">
                      <h4 className="text-[13px] font-bold text-[var(--color-muted)] mb-1.5 uppercase">Tyre Degradation</h4>
                      <p className="text-[14px] text-[var(--color-muted)] leading-relaxed">Surface vs Carcass temp differentials and predicted wear coefficient.</p>
                    </div>
                  </div>
                </section>

              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
