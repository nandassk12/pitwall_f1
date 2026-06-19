import { useEffect, useState } from 'react';
import API_BASE from '../config';
import {
  getTireCompounds,
  getTrackCoordinates,
  getTrackStats,
  getWeatherForecast
} from '../utils/circuitShapes';
import CircuitSvgMap from './CircuitSvgMap';



export default function CalendarPanel() {
  const [years, setYears] = useState([2026]);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [races, setRaces] = useState([]);
  const [selectedRound, setSelectedRound] = useState(1);
  const [activeVisualTab, setActiveVisualTab] = useState('Circuit');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Dynamic countdown states
  const [countdownTarget, setCountdownTarget] = useState(null);
  const [countdownLabel, setCountdownLabel] = useState('Next Event');
  const [countdownTime, setCountdownTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // 1. Fetch available years on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/sessions/years`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.years) {
          setYears(data.years);
          const maxYear = Math.max(...data.years);
          setSelectedYear(maxYear);
        }
      })
      .catch(err => console.error('Failed to load season years:', err));
  }, []);

  // 2. Fetch race calendar for the active year
  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/api/sessions/calendar?year=${selectedYear}`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load calendar for ${selectedYear}`);
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setRaces(data);

          // Default to first round or stay on previously selected if valid
          const hasSelected = data.some(r => r.round === selectedRound);
          if (!hasSelected) {
            setSelectedRound(data[0].round);
          }

          calculateUpcomingMilestone(data);
        } else {
          setRaces([]);
        }
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [selectedYear]);

  // Determine next future session and hook timer to it
  const calculateUpcomingMilestone = (raceList) => {
    const now = new Date();
    let nextDate = null;
    let nextLabel = 'No upcoming sessions';

    for (const r of raceList) {
      if (r.sessions && r.sessions.length > 0) {
        for (const s of r.sessions) {
          const sDate = new Date(s.time);
          if (!isNaN(sDate.getTime()) && sDate > now) {
            if (!nextDate || sDate < nextDate) {
              nextDate = sDate;
              nextLabel = `${r.shortName} GP: ${s.name}`;
            }
          }
        }
      }
    }

    if (nextDate) {
      setCountdownTarget(nextDate);
      setCountdownLabel(nextLabel);
    } else {
      // Fallback ticking
      const fallbackTarget = new Date();
      fallbackTarget.setDate(fallbackTarget.getDate() + 8);
      fallbackTarget.setHours(22, 36, 24, 0);
      setCountdownTarget(fallbackTarget);
      setCountdownLabel('Austrian Grand Prix : Practice 1');
    }
  };

  // 3. Countdown Ticking Logic
  useEffect(() => {
    if (!countdownTarget) return;

    const tick = () => {
      const diff = countdownTarget - new Date();
      if (diff <= 0) {
        setCountdownTime({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setCountdownTime({ days, hours, minutes, seconds });
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [countdownTarget]);

  const formatCountdownText = () => {
    const d = String(countdownTime.days).padStart(2, '0');
    const h = String(countdownTime.hours).padStart(2, '0');
    const m = String(countdownTime.minutes).padStart(2, '0');
    const s = String(countdownTime.seconds).padStart(2, '0');
    return `${d}day ${h}:${m}:${s}`;
  };

  const isRaceCompleted = (raceDateStr) => {
    if (!raceDateStr || raceDateStr === 'TBD') return false;
    const rDate = new Date(raceDateStr);
    return rDate < new Date();
  };

  const formatSessionTime = (timeStr) => {
    if (!timeStr) return '';
    try {
      const d = new Date(timeStr);
      return d.toLocaleString([], {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return timeStr;
    }
  };

  const formatSessionEndTime = (timeStr) => {
    if (!timeStr) return '';
    try {
      const d = new Date(timeStr);
      // add 1 hour as estimate
      d.setHours(d.getHours() + 1);
      return d.toLocaleString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '~';
    }
  };

  const activeRace = races.find(r => r.round === selectedRound) || races[0];
  const activeStats = activeRace ? getTrackStats(activeRace.country, activeRace.name) : {};
  const activeWeather = activeRace ? getWeatherForecast(activeRace.country) : { temp: '28°C', desc: 'Dry / Sunny' };
  const activeCompounds = activeRace ? getTireCompounds(activeRace.country) : { hard: 'C3', med: 'C4', soft: 'C5' };

  return (
    <div className="flex-1 flex overflow-hidden min-h-0 bg-[#040406] text-[var(--color-text)] font-mono select-none">

      {/* LEFT SIDEBAR: GP Calendar */}
      <aside className="w-[380px] h-full flex-shrink-0 bg-surface-container-lowest border-r border-[#1e2021] flex flex-col">
        <div className="p-6 border-b border-[#1e2021]">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              {/* Static Year Display */}
              <span className="inline-block text-[#e10600] py-1 text-lg font-black uppercase tracking-widest select-none">
                2026 Season
              </span>
            </div>

            <div className="flex flex-col items-end">
              <span className="font-data-mono text-[14px] text-white font-bold">{formatCountdownText()}</span>
              <span className="font-data-mono text-[9px] text-[#ffffff] uppercase text-right tracking-tight">{countdownLabel}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="p-8 text-center text-[#ffffff] text-[11px] font-bold animate-pulse">
              INGESTING CALENDAR ARRAY...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600 text-[11px] font-bold">
              CALENDAR OFFLINE: {error}
            </div>
          ) : races.length === 0 ? (
            <div className="p-8 text-center text-[#444552] text-[11px]">
              NO CALENDAR EVENTS AVAILABLE
            </div>
          ) : (
            races.map((item) => {
              const isSelected = selectedRound === item.round;
              const completed = isRaceCompleted(item.date);
              return (
                <div
                  key={`${item.name}_${item.round}`}
                  onClick={() => setSelectedRound(item.round)}
                  className={`px-6 py-4 border-b border-[#1e2021] transition-colors cursor-pointer flex gap-4 relative select-none ${isSelected
                    ? 'border-l-[3px] border-l-[#e10600]'
                    : 'hover:bg-surface-container-low'
                    }`}
                  style={isSelected ? { backgroundColor: '#0d0d14' } : {}}
                >
                  <div className="text-center w-12 pt-1 flex-shrink-0">
                    <div className="font-headline-sm text-lg text-white font-bold">{item.round}</div>
                    <div className="font-data-mono text-[9px] text-[#ff0800ff] uppercase">Round</div>
                  </div>
                  <div className="flex-shrink-0 flex items-center justify-center">
                    <CircuitSvgMap
                      country={item.country}
                      venue={item.circuitName}
                      width={72}
                      height={52}
                      strokeColor={isSelected ? "#ff0800ff" : "#ffffff"}
                      strokeWidth="5"
                      showPlaceholder={false}
                    />
                  </div>

                  <div className="flex-grow min-w-0">
                    <div className="flex justify-end items-start mb-1 gap-2">
                      <span
                        className="px-2 py-0.5 rounded-sm text-[9px] font-bold flex-shrink-0 uppercase"
                        style={completed
                          ? { backgroundColor: '#0a1a0a', color: '#37a528ff', border: '1px solid #00e67630' }
                          : { backgroundColor: '#1a0505', color: '#e10600', border: '1px solid #e1060030' }
                        }
                      >
                        {completed ? 'COMPLETED' : 'UPCOMING'}
                      </span>
                    </div>
                    <h3 className="font-label-caps text-[13px] text-white font-bold truncate">
                      {item.fullName || item.name}
                    </h3>
                    <p className="font-body-md text-[10px] text-[#444552] truncate">
                      {item.circuitName || 'F1 Circuit'}
                    </p>
                    <div className="flex justify-end mt-1">
                      <span className="font-data-mono text-[10px] text-white">
                        {item.date ? new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* MAIN CONTENT: Event Detail */}
      <section className="flex-1 bg-[#040406] flex flex-col overflow-y-auto custom-scrollbar">
        {activeRace ? (
          <div className="p-8 space-y-8">

            {/* HEADER */}
            <div className="flex justify-between items-start border-b border-[#1e2021] pb-4">
              <div>
                <h1 className="font-headline-md text-headline-md text-white uppercase tracking-tight leading-tight">
                  {activeRace.fullName || activeRace.name}
                </h1>
                <p className="font-data-mono text-[12px] text-[#ffffff] mt-1 uppercase">
                  {activeRace.dateRange || activeRace.date}
                </p>
              </div>
            </div>

            {/* TOP GRID: Schedules & Weather */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* Session Schedules */}
              <div className="col-span-1 lg:col-span-8">
                <div className="flex items-center gap-2 mb-4 border-b border-[#1e2021] pb-2">
                  <span className="material-symbols-outlined text-[#e10600] text-[18px]">schedule</span>
                  <h4 className="font-label-caps text-[20px] text-white">Session Schedules</h4>
                </div>

                <div className="space-y-2">
                  {activeRace.sessions && activeRace.sessions.length > 0 ? (
                    activeRace.sessions.map((session, i) => {
                      const sNameLower = String(session.name).toLowerCase();
                      const isRaceSession = sNameLower === 'race' || (sNameLower.includes('race') && !sNameLower.includes('sprint') && !sNameLower.includes('qualifying'));
                      const isQualifying = sNameLower.includes('qualifying') && !sNameLower.includes('sprint');
                      const isSprintQualifying = sNameLower.includes('sprint') && sNameLower.includes('qualifying');
                      const isPractice = sNameLower.includes('practice');

                      const sessionBadgeStyle = (() => {
                        if (isRaceSession) return { backgroundColor: '#e10600', color: '#ffffff', border: 'none' };
                        if (isSprintQualifying) return { backgroundColor: '#1a1400', color: '#ffea00', border: '1px solid #ffea0020' };
                        if (isQualifying) return { backgroundColor: '#14091a', color: '#d500f9', border: '1px solid #d500f920' };
                        if (isPractice) return { backgroundColor: '#091420', color: '#29b6f6', border: '1px solid #29b6f620' };
                        return { backgroundColor: '#091420', color: '#29b6f6', border: '1px solid #29b6f620' };
                      })();

                      return (
                        <div
                          key={`${session.name}_${i}`}
                          className={`flex items-center justify-between p-3 border rounded-[2px] bg-[#1a1c1d] ${isRaceSession ? 'border-[#e10600]/50' : 'border-[#1e2021]'
                            }`}
                        >
                          <span
                            className="px-3 py-1 font-bold text-[12px] uppercase rounded-[1px]"
                            style={sessionBadgeStyle}
                          >
                            {session.name}
                          </span>
                          <div className="text-right">
                            <div className="font-data-mono text-[11px] text-white">
                              {formatSessionTime(session.time)}
                            </div>
                            <div className="font-data-mono text-[10px] text-[#ffffff]">
                              ~ {formatSessionEndTime(session.time)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-[#ffffff] border border-[#1e2021] bg-[#1a1c1d] text-[11px] font-bold">
                      NO ACTIVE SESSION DATA FOR THIS GP WEEKEND
                    </div>
                  )}
                </div>
              </div>

              {/* Weather and Status (Upper Panels) */}
              <div className="col-span-1 lg:col-span-4 space-y-4">
                <div className="flex items-center gap-2 mb-4 border-b border-[#1e2021] pb-2">
                  <span className="material-symbols-outlined text-[#e10600] text-[18px]">cloudy_snowing</span>
                  <h4 className="font-label-caps text-[20px] text-white">Conditions</h4>
                </div>

                <div className="p-4 bg-[#0c0e10] border border-[#1e2021] rounded-[2px]">
                  <div className="font-label-caps text-[10px] text-[#ffffff] mb-3 uppercase tracking-wider">Forecast</div>
                  <div className="flex justify-between items-end">
                    <div className="font-data-mono text-[32px] text-white font-bold leading-none">{activeWeather.temp}</div>
                    <div className="font-data-mono text-[11px] text-[#00e676] uppercase font-bold">{activeWeather.desc}</div>
                  </div>
                </div>

                <div className="p-4 bg-[#0c0e10] border border-[#1e2021] rounded-[2px]">
                  <div className="font-label-caps text-[10px] text-[#ffffff] mb-3 uppercase tracking-wider">Alert Status</div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-[#81cfff] animate-pulse rounded-[1px]"></div>
                    <div className="font-data-mono text-[12px] text-white font-bold uppercase">Track Clear</div>
                  </div>
                </div>

                <div className="p-4 bg-[#0c0e10] border border-[#1e2021] rounded-[2px]">
                  <div className="font-label-caps text-[10px] text-[#ffffff] mb-3 uppercase tracking-wider">Tire Compounds</div>
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[11px] font-bold text-white">
                        {activeCompounds.hard}
                      </div>
                      <span className="text-[8px] text-[#ffffff] font-bold uppercase">Hard</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-8 h-8 rounded-full border-2 border-yellow-500 flex items-center justify-center text-[11px] font-bold text-yellow-500">
                        {activeCompounds.med}
                      </div>
                      <span className="text-[8px] text-[#ffffff] font-bold uppercase">Med</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-8 h-8 rounded-full border-2 border-[#e10600] flex items-center justify-center text-[11px] font-bold text-[#e10600]">
                        {activeCompounds.soft}
                      </div>
                      <span className="text-[8px] text-[#ffffff] font-bold uppercase">Soft</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* BOTTOM SECTION: Track Information */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* Track Stats */}
              <div className="col-span-1 lg:col-span-5">
                <div className="flex items-center gap-2 mb-4 border-b border-[#1e2021] pb-2">
                  <span className="material-symbols-outlined text-[#e10600] text-[18px]">info</span>
                  <h4 className="font-label-caps text-[20px] text-white">Track Information</h4>
                </div>

                <div className="space-y-4 pr-4">
                  <div className="flex justify-between items-center border-b border-[#1e2021]/30 pb-2">
                    <span className="font-body-md text-[#ffffff]">Circuit Length</span>
                    <span className="font-data-mono text-white text-[16px] font-bold">{activeStats.length}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-[#1e2021]/30 pb-2">
                    <span className="font-body-md text-[#ffffff]">First Grand Prix</span>
                    <span className="font-data-mono text-white text-[16px] font-bold">{activeStats.firstGp}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-[#1e2021]/30 pb-2">
                    <span className="font-body-md text-[#ffffff]">Number of Laps</span>
                    <span className="font-data-mono text-white text-[16px] font-bold">{activeStats.laps}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-[#1e2021]/30 pb-2">
                    <span className="font-body-md text-[#ffffff]">Total Corners</span>
                    <span className="font-data-mono text-white text-[16px] font-bold">{activeStats.corners || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-[#1e2021]/30 pb-2">
                    <span className="font-body-md text-[#ffffff]">Lap Record</span>
                    <div className="text-right">
                      <span className="font-data-mono text-white text-[16px] font-bold">{activeStats.record}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-b border-[#1e2021]/30 pb-2">
                    <span className="font-body-md text-[#ffffff]">Race Distance</span>
                    <span className="font-data-mono text-white text-[16px] font-bold">{activeStats.distance}</span>
                  </div>
                </div>
              </div>

              {/* Track Map */}
              <div className="col-span-1 lg:col-span-7 relative h-[460px] flex flex-col rounded-[2px] overflow-hidden" style={{ backgroundColor: '#09090d', border: '1px solid #14141f' }}>
                <div className="px-4 py-2 bg-[#1a1c1d] border-b border-[#1e2021]">
                  <span className="font-label-caps text-[15px] text-white uppercase tracking-wider font-bold">
                    Circuit
                  </span>
                </div>

                {/* Legend indicator */}
                <div className="absolute top-3 right-3 flex items-center gap-2 bg-[#1a1c1d]/90 px-2 py-1 rounded-[2px] border border-[#1e2021] z-10">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00e676] animate-pulse"></span>
                  <span className="font-data-mono text-[8px] text-[var(--color-text)] uppercase tracking-wider">Start/Finish</span>
                </div>

                <div className="flex-1 flex items-center justify-center p-4 pb-16 min-h-0 overflow-hidden">
                  <CircuitSvgMap
                    country={activeRace.country}
                    venue={activeRace.circuitName}
                    width={420}
                    height={300}
                    strokeColor="#e10600"
                    strokeWidth="3.5"
                    showMarkers={true}
                  />
                </div>

                <div className="absolute bottom-3 left-3 flex flex-col">
                  <span className="font-label-caps text-[10px] text-white font-bold uppercase">
                    {activeRace.circuitName || activeRace.name}
                  </span>
                  <span className="font-data-mono text-[8px] text-[#ffffff]">
                    {getTrackCoordinates(activeRace.country)}
                  </span>
                </div>
              </div>

            </div>

            {/* Technical Footer */}
            <div className="mt-8 pt-4 border-t border-[#1e2021] flex justify-between items-center text-[9px] font-data-mono text-[#444552]">
              <div>SYSTEM REF: CAL_2026_{activeRace.round}_GENERIC_{activeRace.shortName.toUpperCase()}</div>
              <div className="flex gap-2">
                <span>DATA_LINK: ESTABLISHED</span>
                <span>LATENCY: 14ms</span>
              </div>
            </div>

          </div>
        ) : (
          <div className="flex-grow flex items-center justify-center text-center p-12 text-[#ffffff] text-[11px] font-bold animate-pulse">
            SELECT A ROUND TO INSPECT TIMINGS
          </div>
        )}
      </section>

    </div>
  );
}
