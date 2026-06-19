import React from 'react';
import { useSearchParams } from 'react-router-dom';
import NavBar from '../components/NavBar';
import ChampionshipDriverStandings from '../components/ChampionshipDriverStandings';
import ChampionshipConstructorStandings from '../components/ChampionshipConstructorStandings';

export default function ChampionshipPage() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'drivers'; // 'drivers' | 'constructors'

  return (
    <div className="h-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--color-text)] font-mono flex flex-col">
      <NavBar />
      
      {/* ── MAIN VIEWPORT CONTAINER ── */}
      <main className="flex-1 min-h-0">
        {tab === 'constructors' ? (
          <ChampionshipConstructorStandings />
        ) : (
          <ChampionshipDriverStandings />
        )}
      </main>
    </div>
  );
}
