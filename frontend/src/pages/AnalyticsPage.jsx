import NavBar from '../components/NavBar';
import PitwallDashboard from '../components/PitwallDashboard';

export default function AnalyticsPage() {
  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }}>
      <NavBar />
      <PitwallDashboard />
    </div>
  );
}
