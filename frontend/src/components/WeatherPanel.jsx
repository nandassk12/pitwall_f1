import React from 'react';
import { CloudRain } from 'lucide-react';

export default function WeatherPanel({ weather }) {
  return (
    <div style={{ display: 'flex', gap: '20px', fontSize: '11px', backgroundColor: 'var(--bg-secondary)', padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#29b6f6' }}><CloudRain size={14}/> WEATHER PROFILE:</div>
      <div>TRACK: <span style={{ color: '#fff' }}>{weather.trackTemp}°C</span></div>
      <div>AIR: <span style={{ color: '#fff' }}>{weather.airTemp}°C</span></div>
      <div>RAIN RISK: <span style={{ color: weather.rainRiskPercent > 50 ? '#ff1744' : '#00e676', fontWeight: 'bold' }}>{weather.rainRiskPercent}%</span></div>
    </div>
  );
}
