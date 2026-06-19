import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CircuitSvgMap from '../components/CircuitSvgMap';
import NavBar from '../components/NavBar';
import { getTeamColor } from '../components/teamColours';
import API_BASE from '../config';
import { getTrackStats } from '../utils/circuitShapes';


export default function HomePage() {
  // Next Race states
  const [nextRace, setNextRace] = useState(null);
  const [countdownMs, setCountdownMs] = useState(null);

  // Latest Completed Race states
  const [latestRace, setLatestRace] = useState(null);

  // Championship Standings states
  const [driverStandings, setDriverStandings] = useState([]);
  const [constructorStandings, setConstructorStandings] = useState([]);
  const [standingsLoading, setStandingsLoading] = useState(true);
  const [standingsError, setStandingsError] = useState(false);

  // 1. Fetch next race details on mount and poll every 60s
  useEffect(() => {
    const fetchNextRace = () => {
      fetch(`${API_BASE}/api/next-race`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setNextRace(data);
            setCountdownMs(data.countdownMs);
          }
        })
        .catch((err) => console.error('[HomePage] Next race fetch error:', err));
    };

    fetchNextRace();
    const interval = setInterval(fetchNextRace, 60000);
    return () => clearInterval(interval);
  }, []);

  // Update countdown every second
  useEffect(() => {
    if (countdownMs === null || countdownMs <= 0) return;

    const timer = setInterval(() => {
      setCountdownMs((prev) => (prev && prev > 1000 ? prev - 1000 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [countdownMs]);

  // 2. Fetch latest completed race from Ergast/Jolpica
  useEffect(() => {
    fetch('https://api.jolpi.ca/ergast/f1/current/last/results.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.MRData?.RaceTable?.Races?.length > 0) {
          const race = data.MRData.RaceTable.Races[0];
          const results = race.Results || [];

          // Find winner
          const winnerResult = results[0];
          const winnerName = winnerResult
            ? `${winnerResult.Driver.givenName} ${winnerResult.Driver.familyName}`
            : 'Unknown';
          const winnerTeam = winnerResult ? winnerResult.Constructor.name : '';

          // Find fastest lap
          const fastest = results.find((r) => r.FastestLap?.rank === '1');
          const fastestLapDriver = fastest ? `${fastest.Driver.givenName[0]}. ${fastest.Driver.familyName}` : 'N/A';
          const fastestLapTime = fastest ? fastest.FastestLap.Time.time : '';

          // Find pole position (Qualifying winner or grid 1)
          const poleResult = results.find((r) => String(r.grid) === '1');
          const poleName = poleResult ? `${poleResult.Driver.givenName[0]}. ${poleResult.Driver.familyName}` : 'N/A';

          // Build podium P1, P2, P3
          const podium = results.slice(0, 3).map((r, i) => ({
            pos: i + 1,
            code: r.Driver.code || r.Driver.familyName.slice(0, 3).toUpperCase(),
            team: r.Constructor.name,
            number: r.number || r.Driver.permanentNumber || '',
          }));

          setLatestRace({
            name: race.raceName,
            circuit: race.Circuit.circuitName,
            winner: winnerName,
            winnerTeam: winnerTeam,
            fastestLapDriver,
            fastestLapTime,
            poleName,
            laps: race.Laps || results[0]?.laps || 66,
            podium,
          });
        }
      })
      .catch((err) => console.error('[HomePage] Latest race fetch error:', err));
  }, []);

  // 3. Fetch WDC & WCC snapshots
  useEffect(() => {
    setStandingsLoading(true);
    setStandingsError(false);

    Promise.all([
      fetch('https://api.jolpi.ca/ergast/f1/current/driverStandings.json').then((r) => (r.ok ? r.json() : null)),
      fetch('https://api.jolpi.ca/ergast/f1/current/constructorStandings.json').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([driversData, constructorsData]) => {
        if (driversData && constructorsData) {
          const wdcList = driversData.MRData?.StandingsTable?.StandingsLists[0]?.DriverStandings || [];
          const wccList = constructorsData.MRData?.StandingsTable?.StandingsLists[0]?.ConstructorStandings || [];

          setDriverStandings(
            wdcList.slice(0, 3).map((d) => ({
              pos: d.position,
              name: `${d.Driver.givenName} ${d.Driver.familyName}`,
              code: d.Driver.code || d.Driver.familyName.slice(0, 3).toUpperCase(),
              team: d.Constructors[0]?.name || 'Unknown',
              points: d.points,
            }))
          );

          setConstructorStandings(
            wccList.slice(0, 3).map((c) => ({
              pos: c.position,
              name: c.Constructor.name,
              engine: c.Constructor.name === 'Red Bull Racing' ? 'HONDA RBPT' : c.Constructor.name.toUpperCase(),
              points: c.points,
            }))
          );
        } else {
          setStandingsError(true);
        }
      })
      .catch((err) => {
        console.error('[HomePage] Standings fetch error:', err);
        setStandingsError(true);
      })
      .finally(() => setStandingsLoading(false));
  }, []);

  // Compute countdown ticker display strings
  const getCountdownParts = () => {
    if (countdownMs === null || countdownMs <= 0) {
      return { days: '00', hours: '00', mins: '00', secs: '00' };
    }
    const totalSecs = Math.floor(countdownMs / 1000);
    const secs = totalSecs % 60;
    const totalMins = Math.floor(totalSecs / 60);
    const mins = totalMins % 60;
    const totalHours = Math.floor(totalMins / 60);
    const hours = totalHours % 24;
    const days = Math.floor(totalHours / 24);

    return {
      days: String(days).padStart(2, '0'),
      hours: String(hours).padStart(2, '0'),
      mins: String(mins).padStart(2, '0'),
      secs: String(secs).padStart(2, '0'),
    };
  };

  const parts = getCountdownParts();

  const splitEventName = (name) => {
    if (!name) return { main: 'AUSTRIAN', suffix: 'GRAND PRIX' };
    const uppercaseName = name.toUpperCase();
    const gpIndex = uppercaseName.indexOf('GRAND PRIX');
    if (gpIndex !== -1) {
      return {
        main: uppercaseName.slice(0, gpIndex).trim(),
        suffix: 'GRAND PRIX',
      };
    }
    const words = uppercaseName.split(' ');
    if (words.length > 1) {
      return {
        main: words.slice(0, -1).join(' '),
        suffix: words[words.length - 1],
      };
    }
    return { main: uppercaseName, suffix: '' };
  };

  const eventParts = splitEventName(nextRace?.eventName);
  const activeStats = nextRace ? getTrackStats(nextRace.country, nextRace.eventName || nextRace.circuitName) : null;
  const isGeneric = activeStats && activeStats.trackId === 'generic';

  const blockStyle = {
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid #1c1c28',
    borderTop: '2px solid #e10600',
    borderRadius: '4px',
    padding: '16px 20px',
    minWidth: '72px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const numStyle = {
    fontSize: '32px',
    fontWeight: '900',
    color: '#ffffff',
    fontFamily: 'monospace',
    lineHeight: 1,
  };

  const labelStyle = {
    fontSize: '9px',
    color: '#555666',
    letterSpacing: '3px',
    marginTop: '6px',
    fontFamily: 'monospace',
  };

  const separatorStyle = {
    fontSize: '24px',
    color: '#333344',
    fontWeight: 'bold',
    alignSelf: 'flex-start',
    marginTop: '8px',
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] f1-grid-pattern text-[var(--color-text)] font-mono selection:bg-red-600 selection:text-white pb-24 overflow-y-auto">
      <NavBar />

      <main className="max-w-[1280px] mx-auto px-edge-margin py-12 space-y-12">

        {/* ROW 1: UP NEXT CRITICAL DATA BLOCK */}
        <section className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-8 relative overflow-hidden rounded-[4px]">
          <div className="grid md:grid-cols-[55%_45%] gap-10 items-center">

            {/* Left: Info, Title & Timer */}
            <div className="space-y-8">
              <div className="space-y-4">
                <div>
                  <p className="text-[13px] text-[#e10600] font-bold tracking-[3px] uppercase mb-3">
                    ■ UP NEXT
                  </p>
                  <h1 className="text-[40px] md:text-[56px] font-black tracking-tight leading-none text-white uppercase font-display-lg">
                    {eventParts.main}{' '}
                    <span className="text-[#e10600]">
                      {eventParts.suffix.split(' ')[0]}
                      {eventParts.suffix.split(' ')[1] && <><br />{eventParts.suffix.split(' ')[1]}</>}
                    </span>
                  </h1>
                </div>
                <p className="text-[13px] text-[var(--color-muted)] font-bold tracking-[0.5px]">
                  {nextRace?.circuitName ? `${nextRace.circuitName.toUpperCase()}, ${nextRace.country.toUpperCase()}` : '—'}
                  {nextRace?.round ? ` | ROUND ${nextRace.round} OF 24` : ''}
                </p>
              </div>

              {/* Countdown Timer */}
              <div className="flex flex-col items-start space-y-4">
                <div className="flex gap-4 items-center">
                  {/* DAYS */}
                  <div style={blockStyle}>
                    <span style={numStyle}>{parts.days}</span>
                    <span style={labelStyle}>DAYS</span>
                  </div>

                  <span style={separatorStyle}>:</span>

                  {/* HOURS */}
                  <div style={blockStyle}>
                    <span style={numStyle}>{parts.hours}</span>
                    <span style={labelStyle}>HRS</span>
                  </div>

                  <span style={separatorStyle}>:</span>

                  {/* MINUTES */}
                  <div style={blockStyle}>
                    <span style={numStyle}>{parts.mins}</span>
                    <span style={labelStyle}>MIN</span>
                  </div>

                  <span style={separatorStyle}>:</span>

                  {/* SECONDS */}
                  <div style={blockStyle}>
                    <span style={numStyle}>{parts.secs}</span>
                    <span style={labelStyle}>SEC</span>
                  </div>
                </div>
                <div className="text-left space-y-1">
                  <p className="text-[12px] text-[var(--color-muted)] font-bold tracking-[2px] uppercase">
                    UNTIL {nextRace?.sessionName?.toUpperCase() || 'PRACTICE 1'}
                  </p>
                  <Link
                    className="text-[13px] text-[#e10600] font-bold hover:text-white transition-colors tracking-[1px]"
                    to="/calendar"
                  >
                    VIEW FULL WEEKEND SCHEDULE →
                  </Link>
                </div>
              </div>
            </div>

            {/* Right: Map Display Box */}
            <div className="border border-[var(--border-color)] bg-[var(--bg-primary)] flex flex-col items-center justify-center h-[420px] relative rounded-[2px] overflow-hidden p-4">
              <div className="scanning-line"></div>
              {!nextRace ? (
                <div className="flex flex-col items-center justify-center">
                  <span className="material-symbols-outlined text-[#e10600] text-[32px] mb-2 opacity-80 animate-pulse">map</span>
                  <span className="text-[12px] text-[var(--color-muted)] font-bold tracking-[3px] uppercase animate-pulse">
                    LOADING CIRCUIT MAP...
                  </span>
                </div>
              ) : (
                <>
                  <CircuitSvgMap
                    country={nextRace.country}
                    venue={nextRace.circuitName}
                    width="100%"
                    height={380}
                    strokeColor="#e10600"
                    strokeWidth="5"
                  />
                  {activeStats && (
                    <div className="absolute top-4 right-4 text-[13px] text-[var(--color-text)] font-bold font-mono text-right pointer-events-none select-none z-10 leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      <p>LENGTH: {activeStats.length.toUpperCase()}</p>
                      <p>TURNS: {activeStats.corners}</p>
                      <p>RECORD: {activeStats.record.split(' ')[0]}</p>
                    </div>
                  )}
                </>
              )}
            </div>

          </div>
        </section>

        {/* ROW 2: HISTORICAL SESSION RECAP */}
        <section className="grid md:grid-cols-[55%_45%] gap-8">

          {/* Left: Summary Metrics */}
          <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-8 flex flex-col justify-between rounded-[4px]">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <p className="text-[13px] text-[#e10600] font-bold tracking-[2.5px] uppercase">
                  ■ LATEST EVENT RESULTS
                </p>
                <Link
                  className="text-[13px] text-[#e10600] font-bold hover:text-white transition-colors tracking-[0.5px]"
                  to="/analytics"
                >
                  ANALYZE THIS RACE TELEMETRY →
                </Link>
              </div>

              {latestRace ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-white font-black text-[26px] uppercase leading-tight font-display-lg">
                      {latestRace.name}
                    </h2>
                    <p className="text-[var(--color-muted)] text-[13px] font-bold uppercase tracking-[0.5px]">
                      {latestRace.circuit}
                    </p>
                  </div>

                  {/* Structured metrics grid */}
                  <div className="divide-y divide-[var(--border-color)] border-t border-b border-[var(--border-color)] text-[14px] py-1 font-bold">
                    <div className="flex justify-between py-3">
                      <span className="text-[var(--color-muted)] tracking-[0.5px]">WINNER</span>
                      <span className="text-white">
                        {latestRace.winner} <span className="text-[var(--color-muted)]">/ {latestRace.winnerTeam.toUpperCase()}</span>
                      </span>
                    </div>
                    <div className="flex justify-between py-3">
                      <span className="text-[var(--color-muted)] tracking-[0.5px]">FASTEST LAP</span>
                      <span className="text-white">
                        {latestRace.fastestLapDriver} <span className="text-[#e10600] font-black">{latestRace.fastestLapTime}</span>
                      </span>
                    </div>
                    <div className="flex justify-between py-3">
                      <span className="text-[var(--color-muted)] tracking-[0.5px]">POLE POSITION</span>
                      <span className="text-white">{latestRace.poleName}</span>
                    </div>
                    <div className="flex justify-between py-3">
                      <span className="text-[var(--color-muted)] tracking-[0.5px]">LAPS</span>
                      <span className="text-white">{latestRace.laps}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-[var(--color-muted)] text-[13px] font-bold animate-pulse">
                  FETCHING HISTORICAL RECORD...
                </div>
              )}
            </div>
          </div>

          {/* Right: Podium Finishers Boxes */}
          <div className="grid grid-cols-3 gap-4 items-end">
            {latestRace?.podium?.length === 3 ? (
              [latestRace.podium[1], latestRace.podium[0], latestRace.podium[2]].map((p) => {
                const medalLabel = p.pos === 1 ? 'P1' : p.pos === 2 ? 'P2' : 'P3';
                const medalColor = p.pos === 1 ? '#ffd700' : p.pos === 2 ? '#c0c0c0' : '#cd7f32';
                const cardHeight = p.pos === 1 ? 'h-[260px]' : p.pos === 2 ? 'h-[220px]' : 'h-[185px]';
                const isP1 = p.pos === 1;
                const teamColor = getTeamColor(p.team);

                const p1Classes = isP1
                  ? "transform -translate-y-2 border-t-2 border-t-[#e10600] shadow-[0_4px_25px_rgba(225,6,0,0.15)] hover:-translate-y-4 hover:shadow-[0_4px_35px_rgba(225,6,0,0.3)] hover:border-[#e10600]/60"
                  : "hover:-translate-y-1 hover:shadow-[0_4px_15px_rgba(255,255,255,0.05)] hover:border-[#e10600]/40";

                const glowStyle = {
                  color: teamColor,
                  textShadow: `0 0 10px ${teamColor}88, 0 0 25px ${teamColor}55`,
                };

                return (
                  <div
                    key={p.pos}
                    className={`border border-[var(--border-color)] bg-[var(--bg-secondary)] py-5 px-4 flex flex-col items-center justify-between text-center rounded-[4px] transition-all duration-300 relative overflow-hidden ${cardHeight} ${p1Classes}`}
                  >
                    {p.number && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
                        <span className="text-[100px] font-black text-white/[0.03] font-display-lg leading-none transform translate-y-2">
                          {p.number}
                        </span>
                      </div>
                    )}
                    <span style={{ color: medalColor }} className="text-[20px] font-black tracking-[1px] z-10">{medalLabel}</span>
                    <span style={glowStyle} className="text-[34px] font-black tracking-tighter uppercase font-display-lg my-4 z-10">
                      {p.code}
                    </span>
                    <span className="text-[var(--color-muted)] text-[13px] font-bold tracking-[1px] uppercase truncate w-full z-10" title={p.team}>
                      {p.team}
                    </span>
                  </div>
                );
              })
            ) : latestRace?.podium ? (
              latestRace.podium.map((p) => {
                const medalLabel = p.pos === 1 ? 'P1' : p.pos === 2 ? 'P2' : 'P3';
                const medalColor = p.pos === 1 ? '#ffd700' : p.pos === 2 ? '#c0c0c0' : '#cd7f32';
                const cardHeight = p.pos === 1 ? 'h-[260px]' : p.pos === 2 ? 'h-[220px]' : 'h-[185px]';
                const isP1 = p.pos === 1;
                const teamColor = getTeamColor(p.team);

                const p1Classes = isP1
                  ? "transform -translate-y-2 border-t-2 border-t-[#e10600] shadow-[0_4px_25px_rgba(225,6,0,0.15)] hover:-translate-y-4 hover:shadow-[0_4px_35px_rgba(225,6,0,0.3)] hover:border-[#e10600]/60"
                  : "hover:-translate-y-1 hover:shadow-[0_4px_15px_rgba(255,255,255,0.05)] hover:border-[#e10600]/40";

                const glowStyle = {
                  color: teamColor,
                  textShadow: `0 0 10px ${teamColor}88, 0 0 25px ${teamColor}55`,
                };

                return (
                  <div
                    key={p.pos}
                    className={`border border-[var(--border-color)] bg-[var(--bg-secondary)] py-5 px-4 flex flex-col items-center justify-between text-center rounded-[4px] transition-all duration-300 relative overflow-hidden ${cardHeight} ${p1Classes}`}
                  >
                    {p.number && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
                        <span className="text-[100px] font-black text-white/[0.03] font-display-lg leading-none transform translate-y-2">
                          {p.number}
                        </span>
                      </div>
                    )}
                    <span style={{ color: medalColor }} className="text-[20px] font-black tracking-[1px] z-10">{medalLabel}</span>
                    <span style={glowStyle} className="text-[34px] font-black tracking-tighter uppercase font-display-lg my-4 z-10">
                      {p.code}
                    </span>
                    <span className="text-[var(--color-muted)] text-[13px] font-bold tracking-[1px] uppercase truncate w-full z-10" title={p.team}>
                      {p.team}
                    </span>
                  </div>
                );
              })
            ) : (
              [2, 1, 3].map((pos) => {
                const cardHeight = pos === 1 ? 'h-[260px]' : pos === 2 ? 'h-[220px]' : 'h-[185px]';
                const staggerClass = pos === 1 ? 'transform -translate-y-2 border-t-2 border-t-[#e10600]' : '';
                return (
                  <div
                    key={pos}
                    className={`border border-[var(--border-color)] bg-[var(--bg-secondary)] py-5 px-4 flex flex-col items-center justify-center text-center animate-pulse rounded-[4px] ${cardHeight} ${staggerClass}`}
                  >
                    <span className="text-[var(--color-muted)] text-[20px] font-bold">P{pos}</span>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ROW 3: CHAMPIONSHIP TOP CONTENDERS */}
        <section className="grid md:grid-cols-2 gap-10">

          {/* Drivers Column */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
              <span className="text-[13px] text-[#e10600] font-bold tracking-[2.5px] uppercase">■ TOP DRIVERS</span>
              <Link
                className="text-[12px] text-[var(--color-muted)] font-bold hover:text-white transition-colors uppercase tracking-[1.5px]"
                to="/championship?tab=drivers"
              >
                VIEW FULL STANDINGS →
              </Link>
            </div>

            {standingsLoading ? (
              <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-8 text-center text-[var(--color-muted)] text-[13px] font-bold">
                FETCHING DRIVER RECORDS...
              </div>
            ) : standingsError ? (
              <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-8 text-center text-[#ff3d00] text-[13px] font-bold">
                STANDINGS CORRUPTED
              </div>
            ) : (
              <div className="space-y-3">
                {driverStandings.map((d) => (
                  <div
                    key={d.pos}
                    className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 flex items-center justify-between text-[14px] font-bold hover:bg-[#e10600]/5 hover:translate-x-1 transition-all duration-300 rounded-[2px]"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-[#e10600] font-black text-[15px]">{String(d.pos).padStart(2, '0')}</span>
                      <div className="flex flex-col">
                        <span className="text-white text-[15px] font-bold uppercase">{d.name}</span>
                        <span className="text-[var(--color-muted)] text-[11px] uppercase tracking-[0.5px]">{d.team}</span>
                      </div>
                    </div>
                    <span className="text-white text-[16px] font-black">{d.points}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Constructors Column */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-3">
              <span className="text-[13px] text-[#e10600] font-bold tracking-[2.5px] uppercase">■ TOP CONSTRUCTORS</span>
              <Link
                className="text-[12px] text-[var(--color-muted)] font-bold hover:text-white transition-colors uppercase tracking-[1.5px]"
                to="/championship?tab=constructors"
              >
                VIEW FULL STANDINGS →
              </Link>
            </div>

            {standingsLoading ? (
              <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-8 text-center text-[var(--color-muted)] text-[13px] font-bold">
                FETCHING CONSTRUCTOR RECORDS...
              </div>
            ) : standingsError ? (
              <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-8 text-center text-[#ff3d00] text-[13px] font-bold">
                STANDINGS CORRUPTED
              </div>
            ) : (
              <div className="space-y-3">
                {constructorStandings.map((c) => (
                  <div
                    key={c.pos}
                    className="border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 flex items-center justify-between text-[14px] font-bold hover:bg-[#e10600]/5 hover:translate-x-1 transition-all duration-300 rounded-[2px]"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-[#e10600] font-black text-[15px]">{String(c.pos).padStart(2, '0')}</span>
                      <div className="flex flex-col">
                        <span className="text-white text-[15px] font-bold uppercase">{c.name}</span>
                        <span className="text-[var(--color-muted)] text-[11px] uppercase tracking-[0.5px]">{c.engine}</span>
                      </div>
                    </div>
                    <span className="text-white text-[16px] font-black">{c.points}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </section>

      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-[var(--bg-secondary)] border-t border-[var(--border-color)] flex justify-around p-2 z-50">
        <Link className="flex flex-col items-center p-2 text-primary" to="/home">
          <span className="material-symbols-outlined">dashboard</span>
          <span className="text-[10px] font-bold">DASH</span>
        </Link>
        <Link className="flex flex-col items-center p-2 text-secondary hover:text-white" to="/telemetry">
          <span className="material-symbols-outlined">speed</span>
          <span className="text-[10px] font-bold">LIVE</span>
        </Link>
        <Link className="flex flex-col items-center p-2 text-secondary hover:text-white" to="/analytics">
          <span className="material-symbols-outlined">analytics</span>
          <span className="text-[10px] font-bold">DATA</span>
        </Link>
        <Link className="flex flex-col items-center p-2 text-[var(--color-muted)] hover:text-white" to="/calendar">
          <span className="material-symbols-outlined">settings</span>
          <span className="text-[10px] font-bold">SET</span>
        </Link>
      </nav>
    </div>
  );
}
