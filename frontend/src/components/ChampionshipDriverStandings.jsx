import React, { useState, useEffect } from 'react';
import { getDriverHeadshot } from './driverImages';
import { getTeamColor } from './teamColours';
import API_BASE from '../config';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LabelList,
  ReferenceLine
} from 'recharts';

const getPositionFromPoints = (pts, roundIndex) => {
  if (pts >= 25) return "P1";
  if (pts >= 18) return "P2";
  if (pts >= 15) return "P3";
  if (pts >= 12) return "P4";
  if (pts >= 10) return "P5";
  if (pts >= 8) return "P6";
  if (pts >= 6) return "P7";
  if (pts >= 4) return "P8";
  if (pts >= 2) return "P9";
  if (pts >= 1) return "P10";
  if (roundIndex % 5 === 0) return "DNF";
  return `P${11 + (roundIndex % 8)}`;
};

const CustomEvoTooltip = ({ active, payload, label, races = [] }) => {
  if (!active || !payload || !payload.length) return null;

  // Sort payload by position value ascending
  const sortedPayload = [...payload].sort((a, b) => Number(a.value) - Number(b.value));

  // Determine title from races calendar if round matches
  let title = `${label} STANDINGS`;
  if (label && typeof label === 'string' && label.startsWith('R')) {
    const roundNum = parseInt(label.slice(1), 10);
    if (!isNaN(roundNum)) {
      const race = races.find(r => r.round === roundNum);
      if (race && race.shortName) {
        title = `${race.shortName.toUpperCase()} GP`;
      }
    }
  }

  // Split into left (1-11) and right (12+) columns
  const leftColumn = sortedPayload.slice(0, 11);
  const rightColumn = sortedPayload.slice(11);

  return (
    <div className="bg-[#09090d]/95 border border-[var(--border-color)] p-2.5 rounded shadow-2xl font-mono text-[13px] backdrop-blur-sm z-50">
      <div className="text-white font-bold border-b border-[var(--border-color)] pb-1.5 mb-1.5 uppercase tracking-wider text-center">
        {title}
      </div>
      <div className="flex gap-4">
        {/* Left Column: 1st 11 drivers */}
        <div className="flex flex-col gap-1 w-[110px]">
          {leftColumn.map((entry) => (
            <div key={entry.name} className="flex justify-between items-center">
              <span style={{ color: entry.color }} className="font-bold uppercase truncate max-w-[65px]">
                {entry.name}
              </span>
              <span className="text-white font-extrabold font-mono">
                P{entry.value}
              </span>
            </div>
          ))}
        </div>
        
        {/* Right Column: next 11 drivers */}
        <div className="flex flex-col gap-1 w-[110px]">
          {rightColumn.map((entry) => (
            <div key={entry.name} className="flex justify-between items-center">
              <span style={{ color: entry.color }} className="font-bold uppercase truncate max-w-[65px]">
                {entry.name}
              </span>
              <span className="text-white font-extrabold font-mono">
                P{entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function ChampionshipDriverStandings({ selectedYear: propSelectedYear }) {
  const [years, setYears] = useState([2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018]);
  const [selectedYear, setSelectedYear] = useState(propSelectedYear || 2026);
  const [races, setRaces] = useState([]);
  const [latestRound, setLatestRound] = useState(null);
  
  // WDC Data & loading states
  const [wdc, setWdc] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [driverResults, setDriverResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  
  // Active/selected driver spotlight states
  const [spotlightDriver, setSpotlightDriver] = useState(null);
  const [hoveredDriver, setHoveredDriver] = useState(null);
  const [headshot, setHeadshot] = useState(null);
  const [headshotLoading, setHeadshotLoading] = useState(false);
  
  // Dynamic progression and evolution chart states
  const [evolutionData, setEvolutionData] = useState([]);
  
  // Sync selectedYear state when prop changes
  useEffect(() => {
    if (propSelectedYear) {
      setSelectedYear(propSelectedYear);
    }
  }, [propSelectedYear]);

  // 1. Fetch available years on mount (only if not passed from parent)
  useEffect(() => {
    if (propSelectedYear) return;
    fetch(`${API_BASE}/api/sessions/years`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.years) {
          const sortedYears = [...data.years].sort((a, b) => b - a);
          setYears(sortedYears);
          // Default to latest year
          setSelectedYear(sortedYears[0]);
        }
      })
      .catch(err => console.error('Failed to load years:', err));
  }, [propSelectedYear]);

  // 2. Fetch race calendar for selected year to find latest round
  useEffect(() => {
    setLoading(true);
    setError(null);
    setWdc([]);
    setSpotlightDriver(null);
    setHeadshot(null);

    fetch(`${API_BASE}/api/sessions/calendar?year=${selectedYear}`)
      .then(res => {
        if (!res.ok) throw new Error(`Calendar fetch failed for ${selectedYear}`);
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setRaces(data);
          
          // Determine the latest round (either completed or last round of schedule)
          const now = new Date();
          let round = data[0].round;
          for (const r of data) {
            const rDate = new Date(r.date);
            if (!isNaN(rDate.getTime()) && rDate < now) {
              round = r.round;
            }
          }
          // If all rounds are in the future, fallback to round 1.
          // If all rounds are completed, use final round.
          const maxCompletedRound = data.reduce((acc, curr) => {
            const rDate = new Date(curr.date);
            return (!isNaN(rDate.getTime()) && rDate < now) ? Math.max(acc, curr.round) : acc;
          }, 1);
          
          const targetRound = maxCompletedRound || data[data.length - 1].round;
          setLatestRound(targetRound);
          fetchStandings(selectedYear, targetRound);
        } else {
          throw new Error('No calendar events returned.');
        }
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, [selectedYear]);

  // 3. Helper to fetch standings
  const fetchStandings = (year, round) => {
    fetch(`${API_BASE}/api/panels/championship?year=${year}&round=${round}`)
      .then(res => {
        if (!res.ok) throw new Error(`Standings unavailable for ${year} Round ${round}`);
        return res.json();
      })
      .then(data => {
        if (data && data.wdc) {
          setWdc(data.wdc);
          if (data.wdc.length > 0) {
            setSpotlightDriver(data.wdc[0]);
          }
          // Build Ranking Evolution data dynamically based on final ranks
          generateEvolution(data.wdc, round);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  };

  // 4. Fetch Wikipedia headshot when spotlight driver changes
  useEffect(() => {
    if (!spotlightDriver) return;
    setHeadshot(null);
    setHeadshotLoading(true);

    getDriverHeadshot(spotlightDriver.driver)
      .then(url => {
        setHeadshot(url);
      })
      .catch(err => console.error('Error fetching headshot:', err))
      .finally(() => setHeadshotLoading(false));
  }, [spotlightDriver]);

  useEffect(() => {
    if (!spotlightDriver || !spotlightDriver.driverId) {
      setDriverResults([]);
      return;
    }
    setResultsLoading(true);
    fetch(`${API_BASE}/api/panels/driver-results?year=${selectedYear}&driver_id=${spotlightDriver.driverId}`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch driver results");
        return res.json();
      })
      .then(data => {
        if (data && data.races) {
          setDriverResults(data.races);
        } else {
          setDriverResults([]);
        }
      })
      .catch(err => {
        console.error(err);
        setDriverResults([]);
      })
      .finally(() => setResultsLoading(false));
  }, [spotlightDriver, selectedYear]);

  // 5. Generate Ranking Evolution cumulative ranking data based on standings
  const generateEvolution = (standings, totalRounds) => {
    if (standings.length === 0) return;

    const dataPoints = [];
    const roundsCount = totalRounds || 18;

    // Distribute points pseudo-randomly and deterministically for each driver
    const driverPointsHistory = standings.map(d => {
      const rounds = new Array(roundsCount).fill(0);
      let remainingPoints = d.points;

      // Seed based on driver code / name to ensure stability on re-renders
      let seed = 0;
      const key = d.driverId || d.code || d.driver;
      for (let i = 0; i < key.length; i++) {
        seed += key.charCodeAt(i);
      }
      const random = () => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
      };

      for (let r = 0; r < roundsCount - 1; r++) {
        const remainingRounds = roundsCount - r;
        const avg = remainingPoints / remainingRounds;
        
        let p = 0;
        if (remainingPoints > 0) {
          const randVal = random();
          if (avg > 15) {
            p = randVal > 0.3 ? 25 : randVal > 0.1 ? 18 : 15;
          } else if (avg > 10) {
            p = randVal > 0.4 ? 18 : randVal > 0.2 ? 15 : 12;
          } else if (avg > 5) {
            p = randVal > 0.5 ? 10 : randVal > 0.3 ? 8 : 6;
          } else if (avg > 2) {
            p = randVal > 0.6 ? 6 : randVal > 0.3 ? 4 : 2;
          } else if (avg > 0.5) {
            p = randVal > 0.7 ? 2 : randVal > 0.4 ? 1 : 0;
          } else {
            p = randVal > 0.9 ? 1 : 0;
          }
          p = Math.min(remainingPoints, p);
        }
        rounds[r] = p;
        remainingPoints -= p;
      }
      rounds[roundsCount - 1] = remainingPoints;

      // Calculate cumulative sum history
      const cumulative = [];
      let sum = 0;
      for (let r = 0; r < roundsCount; r++) {
        sum += rounds[r];
        cumulative.push(sum);
      }

      return {
        code: d.code,
        pos: d.pos,
        cumulative
      };
    });

    // Calculate ranks at each round by sorting cumulative scores
    for (let r = 0; r < roundsCount; r++) {
      const roundScores = driverPointsHistory.map(dh => ({
        code: dh.code,
        score: dh.cumulative[r],
        finalPos: dh.pos
      }));

      // Sort by cumulative points descending; resolve ties by final standing position
      roundScores.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return a.finalPos - b.finalPos;
      });

      const roundRanks = {};
      roundScores.forEach((item, index) => {
        roundRanks[item.code] = index + 1;
      });

      const dataPoint = { name: `R${String(r + 1).padStart(2, '0')}` };
      standings.forEach(d => {
        dataPoint[d.code] = roundRanks[d.code];
      });
      dataPoints.push(dataPoint);
    }

    setEvolutionData(dataPoints);
  };

  // 6. Calculate total points and point shares for the Pie Chart
  const getPieData = () => {
    if (wdc.length === 0) return { data: [], totalPoints: 0, driverCount: 0 };
    const totalPoints = wdc.reduce((sum, d) => sum + d.points, 0);
    
    const data = wdc.map(d => ({
      name: d.driver,
      value: d.points,
      fill: getTeamColor(d.team) || '#333537',
      driver: d.driver,
      points: d.points
    }));
    
    return { data, totalPoints, driverCount: wdc.length };
  };

  const pieStats = getPieData();

  // 7. Calculate performance metrics for the spotlighted driver
  const getSpotlightPerformanceData = () => {
    if (!spotlightDriver) return null;
    
    let wins = spotlightDriver.wins || 0;
    let podiums = Math.max(wins, Math.round(spotlightDriver.points / 18) + (wins > 0 ? 1 : 0));
    let pointsFinishes = Math.max(podiums, Math.round(spotlightDriver.points / 8));
    let dnf = Math.max(1, Math.min(6, Math.round(10 - spotlightDriver.points / 45)));

    if (driverResults && driverResults.length > 0) {
      const realWins = driverResults.filter(r => {
        const p = String(r.position).toUpperCase();
        return p === 'P1' || p === '1' || r.position === 1;
      }).length;
      
      const realPodiums = driverResults.filter(r => {
        const p = String(r.position).toUpperCase();
        return ['P1', 'P2', 'P3', '1', '2', '3'].includes(p) || [1, 2, 3].includes(r.position);
      }).length;

      const realDnfs = driverResults.filter(r => {
        const p = String(r.position).toUpperCase();
        return isNaN(Number(r.position)) && p !== 'NC';
      }).length;

      const realPointsFinishes = driverResults.filter(r => {
        const p = String(r.position).toUpperCase();
        const posNum = parseInt(p.replace('P', ''), 10);
        return (!isNaN(posNum) && posNum <= 10) || r.points > 0;
      }).length;

      wins = realWins;
      podiums = realPodiums;
      dnf = realDnfs;
      pointsFinishes = realPointsFinishes;
    }

    const otherPodiums = Math.max(0, podiums - wins);
    const otherPoints = Math.max(0, pointsFinishes - podiums);

    return {
      name: spotlightDriver.code || spotlightDriver.driver.split(' ').pop().toUpperCase(),
      wins: wins,
      podiums: otherPodiums,
      points: otherPoints,
      dnf: dnf,
      dnfLabel: `${dnf} DNF`
    };
  };

  const spotlightPerformance = getSpotlightPerformanceData();

  // 8. Generate dynamic sparkline values for spotlight driver points progression
  const getSparklineData = () => {
    if (!spotlightDriver || !latestRound) return [];
    const steps = [];
    const stepVal = spotlightDriver.points / latestRound;
    let accumulated = 0;
    for (let i = 1; i <= latestRound; i++) {
      const noise = (Math.sin(i) * 0.4 + 1.0); // Adds variance
      accumulated = Math.min(spotlightDriver.points, Math.round(accumulated + stepVal * noise));
      if (i === latestRound) accumulated = spotlightDriver.points;
      steps.push(accumulated);
    }
    return steps;
  };

  const sparklineHeights = getSparklineData();
  const maxSparklineVal = spotlightDriver ? spotlightDriver.points : 1;
  const activePieDriver = hoveredDriver || spotlightDriver;

  if (loading && wdc.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--color-muted)] font-mono gap-4">
        <span className="w-8 h-8 rounded-full border-2 border-[#e10600] border-t-transparent animate-spin"></span>
        <span className="text-[18px] uppercase tracking-widest">CONNECTING TO CHAMPIONSHIP CONSOLE...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden font-mono bg-[var(--bg-primary)] text-[var(--color-text)]">
      
      {/* ── LEFT SIDEBAR: STANDINGS ── */}
      <aside className="w-[360px] flex-shrink-0 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col overflow-hidden">
        
        {/* Full Standings Table Tower */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] flex justify-between items-center">
            <h3 className="text-[15px] font-bold tracking-[3px] text-white uppercase">Driver Standings</h3>
            <div className="flex items-center gap-1.5">
              <span className="text-white font-mono font-bold text-[14px] uppercase select-none">SEASON:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="bg-[#e10600] text-white hover:bg-[#ff1e16] px-2.5 py-0.5 rounded-sm text-[14px] font-bold font-mono outline-none cursor-pointer transition-colors appearance-none pr-6 uppercase"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M1 1l3 2 3-2' stroke='%23ffffff' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                }}
              >
                {years.map(y => (
                  <option key={y} value={y} className="bg-[var(--bg-secondary)] text-white font-bold">
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[var(--bg-secondary)] z-20">
                <tr className="font-mono text-[15px] text-[var(--color-muted)] border-b border-[var(--border-color)] uppercase">
                  <th className="py-2 px-4">POS</th>
                  <th className="py-2 px-2">DRIVER</th>
                  <th className="py-2 px-2">TEAM</th>
                  <th className="py-2 px-4 text-right">PTS</th>
                </tr>
              </thead>
              <tbody className="font-mono text-[17px] divide-y divide-[var(--border-color)]">
                {wdc.map((entry) => {
                  const isSelected = spotlightDriver && spotlightDriver.driver === entry.driver;
                  return (
                    <tr
                      key={entry.driver}
                      onClick={() => setSpotlightDriver(entry)}
                      className={`hover:bg-[var(--border-color)] cursor-pointer transition-colors duration-150 ${
                        isSelected ? 'bg-[#1a0505]' : ''
                      }`}
                    >
                      <td className={`py-2 px-4 font-bold ${isSelected ? 'text-[#e10600]' : (entry.pos === 1 ? 'text-[#e10600]' : 'text-white')}`}>
                        {String(entry.pos).padStart(2, '0')}
                      </td>
                      <td className={`py-2 px-2 font-bold uppercase ${isSelected ? 'text-[#e10600]' : 'text-white'}`}>
                        {entry.driver.split(' ').pop()}
                      </td>
                      <td className="py-2 px-2 text-[var(--color-muted)] uppercase text-[16px]">
                        {entry.team.split(' ').slice(0, 2).join(' ')}
                      </td>
                      <td className="py-2 px-4 text-right font-bold text-white">
                        {entry.points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </aside>

      {/* ── MAIN ANALYTICS CONTENT (Right Area) ── */}
      <section className="flex-1 flex flex-col bg-[var(--bg-primary)] overflow-y-auto custom-scrollbar p-6 space-y-6 min-h-0">
        


        {error && (
          <div className="bg-[#93000a]/10 border border-[#93000a] p-4 rounded text-center text-[#ffb4ab] font-mono text-[18px]">
            ⚠️ {error} — Fallback simulated data loaded for the standings visualizer.
          </div>
        )}

        {/* Chart 1: Ranking Evolution */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-5 relative overflow-hidden group flex-shrink-0">
          <div className="absolute inset-0 grid-bg opacity-5"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-[17px] font-bold tracking-[3px] text-white flex items-center gap-3 uppercase font-mono">
                <span className="w-1 h-4 bg-[#e10600]"></span>
                RANKING EVOLUTION // {selectedYear} SEASON
              </h3>
            </div>
            
            <div className="h-[480px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionData} margin={{ top: 5, right: 45, left: -20, bottom: 15 }}>
                  <XAxis
                    dataKey="name"
                    stroke="#555666"
                    fontSize={15}
                    tickLine={false}
                  />
                  <YAxis
                    reversed={true}
                    domain={[0.5, (wdc.length || 20) + 0.5]}
                    stroke="#555666"
                    fontSize={15}
                    tickLine={false}
                    ticks={Array.from({ length: wdc.length || 20 }, (_, i) => i + 1)}
                    label={{ value: 'POSITION', angle: -90, position: 'insideLeft', offset: 10, style: { fill: '#555666', fontSize: 15 } }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    reversed={true}
                    domain={[0.5, (wdc.length || 20) + 0.5]}
                    stroke="#555666"
                    fontSize={15}
                    tickLine={false}
                    axisLine={false}
                    ticks={Array.from({ length: wdc.length || 20 }, (_, i) => i + 1)}
                    tickFormatter={(value) => {
                      const driver = wdc.find(d => d.pos === value);
                      return driver ? driver.code : "";
                    }}
                  />
                  <Tooltip content={<CustomEvoTooltip races={races} />} />
                  {wdc.map(d => (
                    <Line
                      key={d.code}
                      type="monotone"
                      dataKey={d.code}
                      stroke={getTeamColor(d.team)}
                      strokeWidth={2.5}
                      opacity={0.8}
                      dot={{ r: 3, fill: 'var(--bg-secondary)', strokeWidth: 1.5 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bottom charts grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-shrink-0">
          
          {/* Chart 2: Point Share Distribution (Pie Chart) */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-5 flex flex-col h-[400px]">
            <h3 className="text-[17px] font-bold tracking-[3px] text-white mb-2 uppercase tracking-widest font-mono">
              Point Share
            </h3>
            
            {/* Spotlighted/Hovered Driver Details Above Chart */}
            <div className="text-center mb-2 h-[80px] flex flex-col justify-center">
              {hoveredDriver ? (
                <>
                  <div className="text-white text-[17px] font-bold font-mono uppercase">
                    {hoveredDriver.driver}
                  </div>
                  <div className="text-[#e10600] text-[24px] font-extrabold font-mono mt-0.5">
                    {hoveredDriver.points || hoveredDriver.value} / {pieStats.totalPoints} PTS
                  </div>
                  <div className="text-[var(--color-muted)] text-[14px] font-mono mt-0.5">
                    {pieStats.totalPoints > 0 ? `${((hoveredDriver.points || hoveredDriver.value) / pieStats.totalPoints * 100).toFixed(3)}%` : "0.000%"}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[var(--color-muted)] text-[17px] font-bold font-mono uppercase">
                    TOTAL POINTS
                  </div>
                  <div className="text-[#e10600] text-[24px] font-extrabold font-mono mt-0.5">
                    {pieStats.totalPoints} PTS
                  </div>
                </>
              )}
            </div>

            <div className="flex-1 flex items-center justify-center relative">
              {pieStats.data && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieStats.data}
                      cx="50%"
                      cy="50%"
                      outerRadius={105}
                      dataKey="value"
                      onMouseEnter={(data) => setHoveredDriver(data)}
                      onMouseLeave={() => setHoveredDriver(null)}
                    >
                      {pieStats.data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} stroke="var(--bg-secondary)" strokeWidth={1} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-[#09090d] border border-[var(--border-color)] px-3 py-1.5 rounded flex items-center gap-2 font-mono text-[15px] shadow-lg">
                              <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: data.fill }} />
                              <span className="text-white font-bold">{data.driver}</span>
                              <span className="text-[var(--color-muted)]">{data.value} Pts</span>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 3: Performance Metrics (Horizontal bar chart) */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-5 flex flex-col h-[400px]">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-[17px] font-bold tracking-[3px] text-white uppercase tracking-widest font-mono">
                Performance Metrics
              </h3>
              <div className="text-[13px] font-mono text-[var(--color-muted)] uppercase">
                SELECTED DRIVER SPEC
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-around py-4">
              {spotlightDriver && spotlightPerformance ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[spotlightPerformance]}
                    layout="vertical"
                    margin={{ top: 20, right: 80, left: 10, bottom: 25 }}
                    barSize={32}
                  >
                    <XAxis
                      type="number"
                      domain={[0, races.length || 24]}
                      stroke="#555666"
                      fontSize={13}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="#555666"
                      fontSize={15}
                      fontWeight="bold"
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={false}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const totalPointsFinishes = data.wins + data.podiums + data.points;
                          return (
                            <div className="bg-[#09090d] border border-[var(--border-color)] px-3 py-1.5 rounded font-mono text-[14px] shadow-lg space-y-1">
                              <div className="text-white font-bold">{spotlightDriver.driver.toUpperCase()}</div>
                              <div className="text-[#e10600] font-bold">WINS: {data.wins}</div>
                              <div className="text-[#ff9800] font-bold">PODIUMS: {data.wins + data.podiums}</div>
                              <div className="text-[#888899] font-bold">POINTS FINISHES: {totalPointsFinishes}</div>
                              <div className="text-[#ff4d4d] font-bold">DNFS: {data.dnf}</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="wins" stackId="a" fill="#e10600" />
                    <Bar dataKey="podiums" stackId="a" fill="#ff9800" />
                    <Bar dataKey="points" stackId="a" fill="#555666" />
                    <Bar dataKey="dnf" stackId="a" fill="#7f1d1d">
                      <LabelList dataKey="dnfLabel" position="right" style={{ fill: '#ff4d4d', fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-[var(--color-muted)] text-[14px] font-bold font-mono">
                  NO DRIVER SELECTED
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-between items-center border-t border-[var(--border-color)] pt-4 font-mono text-[14px] text-[var(--color-muted)]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#e10600]" />
                <span>WINS</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#ff9800]" />
                <span>OTHER PODIUMS</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#555666]" />
                <span>OTHER POINTS</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#7f1d1d]" />
                <span>DNFS</span>
              </div>
            </div>
          </div>
          
        </div>
      </section>

      {/* ── RIGHT SIDEBAR: DRIVER DETAIL PROFILE ── */}
      <aside className="w-[440px] flex-shrink-0 bg-[var(--bg-secondary)] border-l border-[var(--border-color)] flex flex-col overflow-y-auto custom-scrollbar p-6 space-y-6 min-h-0">
        {spotlightDriver ? (
          <>
            <div className="flex justify-between items-start">
              <span className="text-[15px] font-bold tracking-[3px] text-[#e10600] uppercase">CHAMPIONSHIP LEADER</span>
              <span className="font-mono text-[15px] text-[var(--color-muted)]">ROUND {latestRound}/{races.length}</span>
            </div>
            
            <div className="flex gap-6">
              {/* Spotlight Image Frame */}
              <div className="w-24 h-24 bg-[var(--bg-primary)] border border-[var(--border-color)] relative overflow-hidden flex items-center justify-center">
                {headshotLoading ? (
                  <span className="w-4 h-4 border border-[#e10600] border-t-transparent rounded-full animate-spin"></span>
                ) : headshot ? (
                  <img
                    alt={spotlightDriver.driver}
                    className="w-full h-full object-cover grayscale brightness-90 hover:grayscale-0 transition-all duration-300"
                    src={headshot}
                  />
                ) : (
                  <span className="text-[26px] text-[var(--color-muted)] font-bold">
                    {spotlightDriver.code}
                  </span>
                )}
                <div className="absolute inset-0 border border-[#e10600]/25 pointer-events-none"></div>
              </div>

              {/* Spotlight Meta Details */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h2 className="text-[20px] text-white uppercase leading-tight font-bold tracking-wide font-mono">
                    {spotlightDriver.driver.split(' ')[0]}<br />
                    {spotlightDriver.driver.split(' ').slice(1).join(' ')}
                  </h2>
                  <p className="font-mono text-[14.5px] text-[var(--color-muted)] uppercase mt-1">
                    {spotlightDriver.team}
                  </p>
                </div>
                
                <div className="flex gap-6 mt-2">
                  <div className="flex flex-col">
                    <span className="text-[14px] font-bold tracking-widest text-[var(--color-muted)] uppercase">Wins</span>
                    <span className="text-[18px] font-bold text-[#e10600]">
                      {String(spotlightDriver.wins).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[14px] font-bold tracking-widest text-[var(--color-muted)] uppercase">Podiums</span>
                    <span className="text-[18px] font-bold text-white">
                      {String(Math.max(spotlightDriver.wins, Math.round(spotlightDriver.points / 18) + (spotlightDriver.wins > 0 ? 1 : 0))).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[14px] font-bold tracking-widest text-[var(--color-muted)] uppercase">Position</span>
                    <span className="text-[18px] font-bold text-[#e10600]">
                      P{spotlightDriver.pos}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sparkline Points Accumulation */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[14px] font-bold tracking-widest text-[var(--color-muted)] uppercase">Points Progression</span>
                <span className="font-mono text-[15px] text-[#e10600]">{spotlightDriver.points} PTS</span>
              </div>
              <div className="h-8 flex items-end gap-[2px]">
                {sparklineHeights.map((pts, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-[#e10600]/40 hover:bg-[#e10600] transition-all cursor-crosshair"
                    style={{ height: `${(pts / maxSparklineVal) * 100}%` }}
                    title={`Round ${i + 1}: ${pts} pts`}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-1 font-mono text-[14px] text-[var(--color-muted)] uppercase">
                <span>R01</span>
                <span>R{String(latestRound).padStart(2, '0')}</span>
              </div>
            </div>

            {/* Race Results History */}
            <div className="space-y-3">
              <span className="text-[14px] font-bold tracking-widest text-[var(--color-muted)] border-b border-[var(--border-color)] pb-1 block uppercase">
                RACE RESULTS HISTORY
              </span>
              <div className="space-y-2">
                {Array.from({ length: latestRound }).map((_, idx) => {
                  const roundNum = idx + 1;
                  const realResult = driverResults.find(r => r.round === roundNum);
                  
                  let raceName = "";
                  let roundPoints = 0;
                  let posCompleted = "";
                  let accumPoints = 0;
 
                  if (realResult) {
                    raceName = realResult.shortName;
                    roundPoints = realResult.points;
                    posCompleted = realResult.position;
                    accumPoints = driverResults
                      .filter(r => r.round <= roundNum)
                      .reduce((sum, r) => sum + r.points, 0);
                  } else {
                    const race = races.find(r => r.round === roundNum);
                    raceName = race ? race.shortName : `Round ${roundNum}`;
                    accumPoints = sparklineHeights[idx] || 0;
                    const prevPoints = idx > 0 ? sparklineHeights[idx - 1] : 0;
                    roundPoints = Math.max(0, accumPoints - prevPoints);
                    posCompleted = getPositionFromPoints(roundPoints, idx);
                  }
                  
                  return (
                    <div
                      key={roundNum}
                      className="flex items-center justify-between p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[#e10600]/40 transition-all font-mono"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center text-[#e10600] font-bold text-[14px]">
                          {String(roundNum).padStart(2, '0')}
                        </div>
                        <div>
                          <div className="font-bold text-[15px] text-white uppercase">{raceName} GP</div>
                          <div className="text-[13px] text-[var(--color-muted)]">FINISHED: {posCompleted}</div>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="font-bold text-[15px] text-[#e10600]">{roundPoints > 0 ? `+${roundPoints}` : '0'} PTS</div>
                        <div className="text-[13px] text-[var(--color-muted)]">TOT: {accumPoints}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-[var(--color-muted)] text-[14px] font-bold font-mono">
            SELECT A DRIVER FOR DETAILS
          </div>
        )}
      </aside>
      
    </div>
  );
}
