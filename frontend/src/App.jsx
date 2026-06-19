import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage    from './pages/LandingPage';
import HomePage       from './pages/HomePage';
import CalendarPage   from './pages/CalendarPage';
import ChampionshipPage from './pages/ChampionshipPage';
import NewsPage       from './pages/NewsPage';
import TelemetryPage  from './pages/TelemetryPage';
import AnalyticsPage  from './pages/AnalyticsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/"             element={<LandingPage />} />
      <Route path="/home"         element={<HomePage />} />
      <Route path="/calendar"     element={<CalendarPage />} />
      <Route path="/championship" element={<ChampionshipPage />} />
      <Route path="/news"         element={<NewsPage />} />
      <Route path="/telemetry"    element={<TelemetryPage />} />
      <Route path="/analytics"    element={<AnalyticsPage />} />
      <Route path="*"             element={<Navigate to="/" replace />} />
    </Routes>
  );
}
