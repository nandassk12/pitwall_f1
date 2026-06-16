import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ErrorBoundary from './ErrorBoundary';
import PitStrategy from './PitStrategy';
import SectorAnalysis from './SectorAnalysis';
import LapComparison from './LapComparison';
import RacePaceAnalysis from './RacePaceAnalysis';
import PowerAeroPanel from './PowerAeroPanel';
import TrackDominanceMap from './TrackDominanceMap';
import ChampionshipBoard from './ChampionshipBoard';
import AdvancedTelemetryCharts from './AdvancedTelemetryCharts';
import RaceControl from './RaceControl';

const TABS = [
  { id: 'pit',       label: '⏱ PIT STRATEGY'       },
  { id: 'sector',    label: '◈ SECTOR ANALYSIS'     },
  { id: 'lap',       label: '⇌ LAP COMPARISON'     },
  { id: 'dominance', label: '🗺 TRACK DOMINANCE'   },
  { id: 'pace',      label: '⚡ RACE PACE'          },
  { id: 'power',     label: '🔋 POWER & AERO'       },
  { id: 'advanced',  label: '📊 ADVANCED CHARTS'    },
  { id: 'champ',     label: '🏆 CHAMPIONSHIP'       },
  { id: 'rc',        label: '🚦 RACE CONTROL'       },
];

export default function AnalyticsTabs({ drivers = [], activeDriver = '', sessionYear = null, sessionRound = null, raceControl = null }) {
  const [activeTab, setActiveTab] = useState('pit');

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'pit':
        return <PitStrategy />;
      case 'sector':
        return <SectorAnalysis drivers={drivers} activeDriver={activeDriver} />;
      case 'lap':
        return <LapComparison drivers={drivers} activeDriver={activeDriver} />;
      case 'dominance':
        return <TrackDominanceMap />;
      case 'pace':
        return <RacePaceAnalysis />;
      case 'power':
        return <PowerAeroPanel />;
      case 'advanced':
        return <AdvancedTelemetryCharts drivers={drivers} activeDriver={activeDriver} />;
      case 'champ':
        return <ChampionshipBoard sessionYear={sessionYear} sessionRound={sessionRound} />;
      case 'rc':
        return <RaceControl raceControl={raceControl} />;
      default:
        return null;
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      marginTop: '15px',
      width: '100%',
    }}>
      {/* Tab bar header */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid #14141f',
        backgroundColor: '#09090d',
        borderRadius: '6px 6px 0 0',
        padding: '5px 5px 0 5px',
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 20px',
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                letterSpacing: '1px',
                backgroundColor: isActive ? '#0d0d14' : 'transparent',
                color: isActive ? '#e10600' : '#888899',
                border: 'none',
                borderBottom: isActive ? '2px solid #e10600' : '2px solid transparent',
                marginBottom: '-2px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Lazy mounted active content with ErrorBoundary and Framer Motion */}
      <div style={{ minHeight: '200px' }}>
        <ErrorBoundary>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {renderActiveTabContent()}
            </motion.div>
          </AnimatePresence>
        </ErrorBoundary>
      </div>
    </div>
  );
}
