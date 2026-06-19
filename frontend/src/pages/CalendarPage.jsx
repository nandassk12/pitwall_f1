import NavBar from '../components/NavBar';
import CalendarPanel from '../components/CalendarPage';

export default function CalendarPage() {
  return (
    <div className="bg-[#111415] h-screen flex flex-col overflow-hidden text-[var(--color-text)] font-mono">
      <NavBar />
      <CalendarPanel />
    </div>
  );
}
