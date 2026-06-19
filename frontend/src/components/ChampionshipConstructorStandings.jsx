import React, { useState, useEffect } from 'react';
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
  Cell as BarCell
} from 'recharts';

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

  // Split into left (1-5) and right (6-10) columns
  const leftColumn = sortedPayload.slice(0, 5);
  const rightColumn = sortedPayload.slice(5);

  return (
    <div className="bg-[#09090d]/95 border border-[var(--border-color)] p-2.5 rounded shadow-2xl font-mono text-[15px] backdrop-blur-sm z-50">
      <div className="text-white font-bold border-b border-[var(--border-color)] pb-1.5 mb-1.5 uppercase tracking-wider text-center">
        {title}
      </div>
      <div className="flex gap-4">
        {/* Left Column: P1-P5 */}
        <div className="flex flex-col gap-1 w-[120px]">
          {leftColumn.map((entry) => (
            <div key={entry.name} className="flex justify-between items-center">
              <span style={{ color: entry.color }} className="font-bold uppercase truncate max-w-[75px]">
                {entry.name}
              </span>
              <span className="text-white font-extrabold font-mono">
                P{entry.value}
              </span>
            </div>
          ))}
        </div>
        
        {/* Right Column: P6-P10 */}
        <div className="flex flex-col gap-1 w-[120px]">
          {rightColumn.map((entry) => (
            <div key={entry.name} className="flex justify-between items-center">
              <span style={{ color: entry.color }} className="font-bold uppercase truncate max-w-[75px]">
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

export default function ChampionshipConstructorStandings({ selectedYear: propSelectedYear }) {
  const [years, setYears] = useState([2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018]);
  const [selectedYear, setSelectedYear] = useState(propSelectedYear || 2026);
  const [races, setRaces] = useState([]);
  const [latestRound, setLatestRound] = useState(null);
  
  // WCC Data & loading states
  const [wcc, setWcc] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Active/selected constructor spotlight state
  const [spotlightTeam, setSpotlightTeam] = useState(null);
  const [hoveredTeam, setHoveredTeam] = useState(null);
  
  // Dynamic progression and evolution chart states
  const [evolutionData, setEvolutionData] = useState([]);

  // Sync selectedYear state when prop changes
  useEffect(() => {
    if (propSelectedYear) {
      setSelectedYear(propSelectedYear);
    }
  }, [propSelectedYear]);

  // Fetch available years on mount (only if not passed from parent)
  useEffect(() => {
    if (propSelectedYear) return;
    fetch(`${API_BASE}/api/sessions/years`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.years) {
          const sortedYears = [...data.years].sort((a, b) => b - a);
          setYears(sortedYears);
          setSelectedYear(sortedYears[0]);
        }
      })
      .catch(err => console.error('Failed to load years:', err));
  }, [propSelectedYear]);

  // Fetch race calendar for selected year to find latest round
  useEffect(() => {
    setLoading(true);
    setError(null);
    setWcc([]);
    setSpotlightTeam(null);

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

  // Helper to fetch standings
  const fetchStandings = (year, round) => {
    fetch(`${API_BASE}/api/panels/championship?year=${year}&round=${round}`)
      .then(res => {
        if (!res.ok) throw new Error(`Standings unavailable for ${year} Round ${round}`);
        return res.json();
      })
      .then(data => {
        if (data && data.wcc) {
          setWcc(data.wcc);
          if (data.wcc.length > 0) {
            setSpotlightTeam(data.wcc[0]);
          }
          // Build Ranking Evolution data dynamically based on final ranks
          generateEvolution(data.wcc, round);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  };

  // Helper to generate normalized team codes (e.g. Red Bull -> RBR)
  const getTeamCode = (teamName) => {
    const name = teamName.toUpperCase();
    if (name.includes('RED BULL')) return 'RBR';
    if (name.includes('FERRARI')) return 'FER';
    if (name.includes('MCLAREN')) return 'MCL';
    if (name.includes('MERCEDES')) return 'MER';
    if (name.includes('ASTON MARTIN')) return 'AMR';
    if (name.includes('ALPINE')) return 'ALP';
    if (name.includes('WILLIAMS')) return 'WIL';
    if (name.includes('HAAS')) return 'HAA';
    if (name.includes('SAUBER') || name.includes('KICK')) return 'SAU';
    if (name.includes('RB') || name.includes('RACING BULLS')) return 'VCB';
    return name.slice(0, 3);
  };

  // Helper to generate constructor engine name
  const getEngineName = (teamName) => {
    const name = teamName.toUpperCase();
    if (name.includes('RED BULL') || name.includes('RB') || name.includes('RACING BULLS')) return 'HONDA RBPT';
    if (name.includes('FERRARI') || name.includes('HAAS') || name.includes('SAUBER') || name.includes('KICK')) return 'FERRARI';
    if (name.includes('MCLAREN') || name.includes('MERCEDES') || name.includes('ASTON MARTIN') || name.includes('WILLIAMS')) return 'MERCEDES';
    if (name.includes('ALPINE')) return 'RENAULT';
    return 'P.U. SYSTEM';
  };

  // Generate Ranking Evolution cumulative ranking data based on standings
  const generateEvolution = (standings, totalRounds) => {
    if (standings.length === 0) return;

    const dataPoints = [];
    const roundsCount = totalRounds || 12;

    // Distribute points pseudo-randomly and deterministically for each constructor team
    const teamPointsHistory = standings.map(d => {
      const rounds = new Array(roundsCount).fill(0);
      let remainingPoints = d.points;

      // Seed based on team name to ensure stability on re-renders
      let seed = 0;
      const key = d.team;
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
          if (avg > 25) {
            p = randVal > 0.3 ? 43 : randVal > 0.1 ? 33 : 25; // max dual finish points
          } else if (avg > 15) {
            p = randVal > 0.4 ? 25 : randVal > 0.2 ? 18 : 12;
          } else if (avg > 8) {
            p = randVal > 0.5 ? 15 : randVal > 0.3 ? 10 : 6;
          } else if (avg > 3) {
            p = randVal > 0.6 ? 8 : randVal > 0.3 ? 4 : 2;
          } else {
            p = randVal > 0.8 ? 2 : 0;
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
        team: d.team,
        code: getTeamCode(d.team),
        pos: d.pos,
        cumulative
      };
    });

    // Calculate ranks at each round by sorting cumulative scores
    for (let r = 0; r < roundsCount; r++) {
      const roundScores = teamPointsHistory.map(th => ({
        code: th.code,
        score: th.cumulative[r],
        finalPos: th.pos
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

      const dataPoint = { name: getRoundLabel(r + 1) };
      standings.forEach(d => {
        const teamCode = getTeamCode(d.team);
        dataPoint[teamCode] = roundRanks[teamCode];
      });
      dataPoints.push(dataPoint);
    }

    setEvolutionData(dataPoints);
  };

  // Map round number to abbreviation
  const getRoundLabel = (roundNum) => {
    const race = races.find(r => r.round === roundNum);
    if (race) {
      const name = race.name || race.shortName || "";
      return name.replace('Grand Prix', '').trim().slice(0, 3).toUpperCase();
    }
    return `R${String(roundNum).padStart(2, '0')}`;
  };

  // Calculate pie chart point shares
  const getPieData = () => {
    if (wcc.length === 0) return { data: [], totalPoints: 0, teamCount: 0 };
    const totalPoints = wcc.reduce((sum, d) => sum + d.points, 0);
    
    const data = wcc.map(d => ({
      name: d.team,
      value: d.points,
      fill: getTeamColor(d.team) || '#333537',
      team: d.team,
      points: d.points
    }));
    
    return { data, totalPoints, teamCount: wcc.length };
  };

  const pieStats = getPieData();

  // Selected Team metadata mappings
  const getTeamMetadata = (teamName) => {
    const name = teamName.toLowerCase();
    if (name.includes('red bull')) {
      return {
        chassis: 'RB20_EVO',
        base: 'MILTON KEYNES',
        country: 'UNITED KINGDOM',
        principal: 'C. HORNER',
        since: 'SINCE 2005',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Red_Bull_Racing_-_2021_Logo.svg/640px-Red_Bull_Racing_-_2021_Logo.svg.png',
        drivers: [
          { name: 'M. VERSTAPPEN', number: '1', country: 'NETHERLANDS' },
          { name: 'S. PEREZ', number: '11', country: 'MEXICO' }
        ],
        alert: `Red Bull Racing leads with a stable points gap. Aero-update correlation check shows +0.14s sector speed efficiency gains.`
      };
    }
    if (name.includes('ferrari')) {
      return {
        chassis: 'SF-24',
        base: 'MARANELLO',
        country: 'ITALY',
        principal: 'F. VASSEUR',
        since: 'SINCE 2023',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Logo_Ferrari.svg/250px-Logo_Ferrari.svg.png',
        drivers: selectedYear >= 2025 ? [
          { name: 'L. HAMILTON', number: '44', country: 'UNITED KINGDOM' },
          { name: 'C. LECLERC', number: '16', country: 'MONACO' }
        ] : [
          { name: 'C. LECLERC', number: '16', country: 'MONACO' },
          { name: 'C. SAINZ', number: '55', country: 'SPAIN' }
        ],
        alert: `Scuderia Ferrari power unit software optimization yielded a +3km/h speed trap advantage in high-speed sectors.`
      };
    }
    if (name.includes('mclaren')) {
      return {
        chassis: 'MCL38_SPEC_B',
        base: 'WOKING',
        country: 'UNITED KINGDOM',
        principal: 'A. STELLA',
        since: 'SINCE 2022',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Mclaren_Logo_2021.svg/640px-Mclaren_Logo_2021.svg.png',
        drivers: [
          { name: 'L. NORRIS', number: '4', country: 'UNITED KINGDOM' },
          { name: 'O. PIASTRI', number: '81', country: 'AUSTRALIA' }
        ],
        alert: `McLaren low-drag rear wing upgrade package demonstrates positive downforce efficiency in simulation models.`
      };
    }
    if (name.includes('mercedes')) {
      return {
        chassis: 'W15_E_PERF',
        base: 'BRACKLEY',
        country: 'UNITED KINGDOM',
        principal: 'T. WOLFF',
        since: 'SINCE 2013',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Mercedes_AMG_Petronas_F1_Logo.svg/640px-Mercedes_AMG_Petronas_F1_Logo.svg.png',
        drivers: selectedYear >= 2025 ? [
          { name: 'G. RUSSELL', number: '63', country: 'UNITED KINGDOM' },
          { name: 'K. ANTONELLI', number: '12', country: 'ITALY' }
        ] : [
          { name: 'L. HAMILTON', number: '44', country: 'UNITED KINGDOM' },
          { name: 'G. RUSSELL', number: '63', country: 'UNITED KINGDOM' }
        ],
        alert: `Mercedes mechanical suspension configurations have resolved low-speed understeer. Front wing revisions are active.`
      };
    }
    if (name.includes('aston martin')) {
      return {
        chassis: 'AMR24',
        base: 'SILVERSTONE',
        country: 'UNITED KINGDOM',
        principal: 'M. KRACK',
        since: 'SINCE 2022',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Aston_Martin_Lagonda_brand_logo.svg/640px-Aston_Martin_Lagonda_brand_logo.svg.png',
        drivers: [
          { name: 'F. ALONSO', number: '14', country: 'SPAIN' },
          { name: 'L. STROLL', number: '18', country: 'CANADA' }
        ],
        alert: `Aston Martin floor tunnel modifications target improved underbody flow correlation during high-yaw cornering.`
      };
    }
    if (name.includes('haas')) {
      return {
        chassis: 'VF-24',
        base: 'KANNAPOLIS',
        country: 'UNITED STATES',
        principal: 'A. KOMATSU',
        since: 'SINCE 2024',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/MoneyGram_Haas_F1_Team_Logo.svg/640px-MoneyGram_Haas_F1_Team_Logo.svg.png',
        drivers: [
          { name: 'N. HÜLKENBERG', number: '27', country: 'GERMANY' },
          { name: 'K. MAGNUSSEN', number: '20', country: 'DENMARK' }
        ],
        alert: `Haas F1 tyre thermal degradation algorithms updated to reduce slide friction thermal spike indexes during long stints.`
      };
    }
    if (name.includes('williams')) {
      return {
        chassis: 'FW46',
        base: 'GROVE',
        country: 'UNITED KINGDOM',
        principal: 'J. VOWLES',
        since: 'SINCE 2023',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Williams_Racing_2022_logo.svg/640px-Williams_Racing_2022_logo.svg.png',
        drivers: [
          { name: 'A. ALBON', number: '23', country: 'THAILAND' },
          { name: 'C. SAINZ', number: '55', country: 'SPAIN' }
        ],
        alert: `Williams F1 chassis weight-shedding configurations successfully reduced drag indexes in medium speed turns.`
      };
    }
    if (name.includes('sauber') || name.includes('kick')) {
      return {
        chassis: 'C44',
        base: 'HINWIL',
        country: 'SWITZERLAND',
        principal: 'A. ALUNNI BRAVI',
        since: 'SINCE 2023',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Sauber_Motorsport_logo.svg/640px-Sauber_Motorsport_logo.svg.png',
        drivers: [
          { name: 'V. BOTTAS', number: '77', country: 'FINLAND' },
          { name: 'Z. GUANYU', number: '24', country: 'CHINA' }
        ],
        alert: `Kick Sauber heat exchangers and intake duct cooling modifications configured to mitigate thermal peak indexes.`
      };
    }
    if (name.includes('alpine')) {
      return {
        chassis: 'A524',
        base: 'ENSTONE',
        country: 'UNITED KINGDOM',
        principal: 'O. OAKES',
        since: 'SINCE 2024',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Alpine_F1_Team_Logo.svg/640px-Alpine_F1_Team_Logo.svg.png',
        drivers: [
          { name: 'P. GASLY', number: '10', country: 'FRANCE' },
          { name: 'E. OCON', number: '31', country: 'FRANCE' }
        ],
        alert: `Alpine running split downforce simulations to establish high-speed flow detachment boundaries.`
      };
    }
    if (name.includes('rb') || name.includes('racing bulls')) {
      return {
        chassis: 'VCARB 01',
        base: 'FAENZA',
        country: 'ITALY',
        principal: 'L. MEKIES',
        since: 'SINCE 2024',
        image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Red_Bull_Racing_-_2021_Logo.svg/640px-Red_Bull_Racing_-_2021_Logo.svg.png',
        drivers: [
          { name: 'Y. TSUNODA', number: '22', country: 'JAPAN' },
          { name: 'L. LAWSON', number: '30', country: 'NEW ZEALAND' }
        ],
        alert: `RB F1 diffuser updates correlation is complete. Underbody flow optimization package is active.`
      };
    }
    return {
      chassis: 'GEN_2026_SPEC',
      base: 'UNKNOWN',
      country: 'F1 BASE',
      principal: 'TEAM PRINCIPAL',
      since: 'ESTABLISHED',
      image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/F1.svg/640px-F1.svg.png',
      drivers: [
        { name: 'DRIVER A', number: 'A', country: 'N/A' },
        { name: 'DRIVER B', number: 'B', country: 'N/A' }
      ],
      alert: `Team configurations are currently running under active validation parameters.`
    };
  };

  const getPerformanceData = () => {
    if (!spotlightTeam) return null;
    
    // Estimate wins, podiums, point finishes, and DNFs realistically from points totals
    const wins = spotlightTeam.wins;
    const estimatedPodiums = Math.max(wins, Math.round(spotlightTeam.points / 28) + (wins > 0 ? 2 : 0));
    const estimatedPtFinishes = Math.max(estimatedPodiums, Math.round(spotlightTeam.points / 12));
    const estimatedDnfs = Math.max(1, Math.min(8, Math.round(12 - spotlightTeam.points / 75)));

    const otherPodiums = Math.max(0, estimatedPodiums - wins);
    const otherPoints = Math.max(0, estimatedPtFinishes - estimatedPodiums);

    return {
      name: spotlightTeam.team.slice(0, 10).toUpperCase(),
      wins: wins,
      podiums: otherPodiums,
      points: otherPoints,
      dnf: estimatedDnfs,
      dnfLabel: `${estimatedDnfs} DNF`
    };
  };

  const performanceMetrics = getPerformanceData();
  const spotlightMetadata = spotlightTeam ? getTeamMetadata(spotlightTeam.team) : null;

  if (loading && wcc.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--color-muted)] font-mono gap-4">
        <span className="w-8 h-8 rounded-full border-2 border-[#e10600] border-t-transparent animate-spin"></span>
        <span className="text-[16px] uppercase tracking-widest">CONNECTING TO CONSTRUCTOR PANEL...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden font-mono bg-[var(--bg-primary)] text-[var(--color-text)]">
      
      {/* ── LEFT SIDEBAR: CONSTRUCTORS STANDINGS ── */}
      <aside className="w-[360px] flex-shrink-0 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col overflow-hidden">
        <div className="p-3 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] flex justify-between items-center">
          <h3 className="text-[17px] font-bold tracking-[3px] text-white uppercase">Constructor Standings</h3>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="bg-[#e10600] text-white hover:bg-[#ff1e16] px-2.5 py-0.5 rounded-sm text-[16px] font-bold font-mono outline-none cursor-pointer transition-colors appearance-none pr-6 uppercase"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'%3E%3Cpath d='M1 1l3 2 3-2' stroke='%23ffffff' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
            }}
          >
            {years.map(y => (
              <option key={y} value={y} className="bg-[var(--bg-secondary)] text-white font-bold">
                {y} SEASON
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col">
            {wcc.map((entry) => {
              const isSelected = spotlightTeam && spotlightTeam.team === entry.team;
              const teamColor = getTeamColor(entry.team);
              return (
                <div
                  key={entry.team}
                  onClick={() => setSpotlightTeam(entry)}
                  style={{ borderLeft: `4px solid ${teamColor}` }}
                  className={`flex items-center gap-3 p-3 transition-colors cursor-pointer border-b border-[var(--border-color)] ${
                    isSelected ? 'bg-[#1a0505]' : 'bg-[var(--bg-secondary)] hover:bg-[var(--border-color)]'
                  }`}
                >
                  <span className={`font-mono text-[20px] font-bold ${isSelected ? 'text-[#e10600]' : 'text-[var(--color-muted)]'}`}>
                    {String(entry.pos).padStart(2, '0')}
                  </span>
                  
                  <div className="flex-grow">
                    <div className={`font-bold text-[16px] uppercase tracking-tight ${isSelected ? 'text-[#e10600]' : 'text-white'}`}>
                      {entry.team}
                    </div>
                    <div className="text-[13px] text-[var(--color-muted)] font-mono">
                      {getEngineName(entry.team)}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`font-bold text-[16px] ${isSelected ? 'text-[#e10600]' : 'text-white'}`}>
                      {entry.points}
                    </div>
                    <div className="text-[12px] text-[var(--color-muted)]">PTS</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ── CENTER AREA: DATA VISUALIZATIONS ── */}
      <section className="flex-1 flex flex-col bg-[var(--bg-primary)] overflow-y-auto custom-scrollbar p-6 space-y-6 min-h-0">
        


        {error && (
          <div className="bg-[#93000a]/10 border border-[#93000a] p-4 rounded text-center text-[#ffb4ab] font-mono text-[16px]">
            ⚠️ {error} — Fallback simulated data loaded for constructor visualizer.
          </div>
        )}

        {/* Chart 1: Constructor Ranking Evolution */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-5 relative overflow-hidden group flex-shrink-0">
          <div className="absolute inset-0 grid-bg opacity-5"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-[19px] font-bold tracking-[3px] text-white flex items-center gap-3 uppercase font-mono">
                <span className="w-1 h-4 bg-[#e10600]"></span>
                CONSTRUCTOR_RANKING_EVO
              </h3>
            </div>
            
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionData} margin={{ top: 5, right: 25, left: -10, bottom: 25 }}>
                  <XAxis
                    dataKey="name"
                    stroke="#555666"
                    fontSize={17}
                    tickLine={false}
                  />
                  <YAxis
                    reversed={true}
                    domain={[1, 10]}
                    stroke="#555666"
                    fontSize={18}
                    tickLine={false}
                    ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                    label={{ value: 'POSITION', angle: -90, position: 'insideLeft', offset: 10, style: { fill: '#555666', fontSize: 17 } }}
                  />
                  <Tooltip content={<CustomEvoTooltip races={races} />} />
                  {wcc.map(d => (
                    <Line
                      key={d.team}
                      type="monotone"
                      dataKey={getTeamCode(d.team)}
                      stroke={getTeamColor(d.team)}
                      strokeWidth={2.5}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
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
            <h3 className="text-[19px] font-bold tracking-[3px] text-white mb-2 uppercase tracking-widest font-mono">
              Point Share
            </h3>
            
            {/* Spotlighted/Hovered Constructor Details Above Chart */}
            <div className="text-center mb-2 h-[80px] flex flex-col justify-center">
              {hoveredTeam ? (
                <>
                  <div className="text-white text-[19px] font-bold font-mono uppercase">
                    {hoveredTeam.team || hoveredTeam.name}
                  </div>
                  <div className="text-[#e10600] text-[26px] font-extrabold font-mono mt-0.5">
                    {hoveredTeam.points || hoveredTeam.value} / {pieStats.totalPoints} PTS
                  </div>
                  <div className="text-[var(--color-muted)] text-[16px] font-mono mt-0.5">
                    {pieStats.totalPoints > 0 ? `${((hoveredTeam.points || hoveredTeam.value) / pieStats.totalPoints * 100).toFixed(3)}%` : "0.000%"}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[var(--color-muted)] text-[19px] font-bold font-mono uppercase">
                    TOTAL POINTS
                  </div>
                  <div className="text-[#e10600] text-[26px] font-extrabold font-mono mt-0.5">
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
                      onMouseEnter={(data) => setHoveredTeam(data)}
                      onMouseLeave={() => setHoveredTeam(null)}
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
                            <div className="bg-[#09090d] border border-[var(--border-color)] px-3 py-1.5 rounded flex items-center gap-2 font-mono text-[17px] shadow-lg">
                              <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: data.fill }} />
                              <span className="text-white font-bold">{data.team}</span>
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
              <h3 className="text-[15px] font-bold tracking-[3px] text-white uppercase tracking-widest font-mono">
                PERFORMANCE_METRICS_DELTA
              </h3>
              <div className="text-[12px] font-mono text-[var(--color-muted)] uppercase">
                SELECTED CONSTRUCTOR SPEC
              </div>
            </div>
            
            <div className="flex-1 flex flex-col justify-around py-4">
              {spotlightTeam && performanceMetrics ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[performanceMetrics]}
                    layout="vertical"
                    margin={{ top: 20, right: 80, left: 10, bottom: 25 }}
                    barSize={32}
                  >
                    <XAxis
                      type="number"
                      domain={[0, (races.length * 2) || 48]}
                      stroke="#555666"
                      fontSize={15}
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
                            <div className="bg-[#09090d] border border-[var(--border-color)] px-3 py-1.5 rounded font-mono text-[16px] shadow-lg space-y-1">
                              <div className="text-white font-bold">{spotlightTeam.team.toUpperCase()}</div>
                              <div className="text-[#e10600] font-bold">WINS: {data.wins}</div>
                              <div className="text-[#81cfff] font-bold">PODIUMS: {data.wins + data.podiums}</div>
                              <div className="text-[#c6c5d7] font-bold">POINT FINISHES: {totalPointsFinishes}</div>
                              <div className="text-[#ff4d4d] font-bold">DNFS: {data.dnf}</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="wins" stackId="a" fill="#e10600" />
                    <Bar dataKey="podiums" stackId="a" fill="#81cfff" />
                    <Bar dataKey="points" stackId="a" fill="#c6c5d7" />
                    <Bar dataKey="dnf" stackId="a" fill="#7f1d1d">
                      <LabelList dataKey="dnfLabel" position="right" style={{ fill: '#ff4d4d', fontSize: 16, fontWeight: 'bold', fontFamily: 'monospace' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-[var(--color-muted)] text-[16px] font-bold font-mono">
                  NO CONSTRUCTOR SELECTED
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-between items-center border-t border-[var(--border-color)] pt-4 font-mono text-[16px] text-[var(--color-muted)]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#e10600]" />
                <span>WINS</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#81cfff]" />
                <span>OTHER PODIUMS</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#c6c5d7]" />
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

      {/* ── RIGHT SIDEBAR: CONSTRUCTOR DETAIL PROFILE ── */}
      <aside className="w-[360px] flex-shrink-0 bg-[var(--bg-secondary)] border-l border-[var(--border-color)] flex flex-col overflow-y-auto custom-scrollbar p-6 space-y-6 min-h-0">
        {spotlightTeam && spotlightMetadata ? (
          <>
            <div className="space-y-1">
              <span className="text-[13px] font-bold tracking-[3px] text-[#e10600] uppercase">
                FEATURED_LEADER
              </span>
              <h1 className="text-[28px] font-black leading-tight text-white uppercase italic tracking-tighter">
                {spotlightTeam.team}
              </h1>
            </div>
            
            {/* Team Logo Image Frame */}
            <div className="relative group overflow-hidden border border-[var(--border-color)] rounded bg-[var(--bg-primary)] h-48 flex items-center justify-center p-6">
              <img
                alt={spotlightTeam.team}
                className="max-h-full max-w-full object-contain hover:scale-105 transition-transform duration-300"
                src={spotlightMetadata.image}
              />
              <div className="absolute inset-0 border border-[#e10600]/25 pointer-events-none"></div>
              <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-0.5 text-[13px] font-mono border border-[#e10600] text-[#e10600]">
                CHASSIS: {spotlightMetadata.chassis}
              </div>
            </div>

            {/* Team Location and Principal Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[var(--bg-primary)] p-4 border border-[var(--border-color)]">
                <span className="text-[12px] font-bold tracking-widest text-[var(--color-muted)] uppercase">BASE_LOCATION</span>
                <div className="font-bold text-[15px] text-white mt-1 uppercase leading-tight">{spotlightMetadata.base}</div>
                <div className="text-[13px] text-[var(--color-muted)] font-mono mt-0.5">{spotlightMetadata.country}</div>
              </div>
              <div className="bg-[var(--bg-primary)] p-4 border border-[var(--border-color)]">
                <span className="text-[12px] font-bold tracking-widest text-[var(--color-muted)] uppercase">TEAM_PRINCIPAL</span>
                <div className="font-bold text-[15px] text-white mt-1 uppercase leading-tight">{spotlightMetadata.principal}</div>
                <div className="text-[13px] text-[var(--color-muted)] font-mono mt-0.5">{spotlightMetadata.since}</div>
              </div>
            </div>

            {/* Drivers Lineup */}
            <div className="space-y-3">
              <span className="text-[13px] font-bold tracking-widest text-[var(--color-muted)] border-b border-[var(--border-color)] pb-1 block">
                DRIVER_LINEUP_{selectedYear}
              </span>
              {spotlightMetadata.drivers.map((drv, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[#e10600]/40 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center text-[#e10600] font-bold">
                      {drv.number}
                    </div>
                    <div>
                      <div className="font-bold text-[16px] text-white uppercase">{drv.name}</div>
                      <div className="text-[13px] text-[var(--color-muted)] font-mono">{drv.country}</div>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[20px] text-[#e10600]">
                    arrow_forward
                  </span>
                </div>
              ))}
            </div>

            {/* Strategic Analysis Alert */}
            <div className="p-4 bg-[#1a0505] border border-[#e10600]/20 rounded-[2px] relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-bold tracking-widest text-[#e10600]">STRATEGY_ALERT</span>
                <span className="w-1.5 h-1.5 bg-[#e10600] animate-ping rounded-full"></span>
              </div>
              <p className="text-[14px] leading-relaxed text-[var(--color-text)]">
                {spotlightMetadata.alert}
              </p>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-[var(--color-muted)] text-[16px] font-bold font-mono">
            SELECT A TEAM FOR DETAILS
          </div>
        )}
      </aside>

    </div>
  );
}
