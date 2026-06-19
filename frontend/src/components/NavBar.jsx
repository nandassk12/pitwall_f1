import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Logo from './Logo';

export default function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);

  // Nav link style helper
  const getLinkStyle = (path) => {
    const isActive = location.pathname === path;
    return {
      fontSize: '13px',
      fontFamily: 'monospace',
      letterSpacing: '1.2px',
      textDecoration: 'none',
      textTransform: 'uppercase',
      color: isActive ? '#ff0000ff' : '#ffffffff',
      fontWeight: 'bold',
      transition: 'color 0.15s ease',
      cursor: 'pointer',
      padding: '0 10px',
      display: 'flex',
      alignItems: 'center',
      height: '48px',
      borderBottom: isActive ? '2px solid #e10600' : 'none',
    };
  };

  return (
    <nav
      style={{
        height: '48px',
        backgroundColor: '#09090d',
        borderBottom: '1px solid #14141f',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: 'monospace',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* LEFT: F1 Brand Logo */}
      <Logo size="md" onClick={() => navigate('/home')} />

      {/* CENTER: Navigation Links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', height: '48px' }}>
        <Link to="/home" style={getLinkStyle('/home')}>
          Home
        </Link>
        <Link to="/calendar" style={getLinkStyle('/calendar')}>
          Calendar
        </Link>

        {/* Championship Dropdown */}
        <div
          onMouseEnter={() => setShowDropdown(true)}
          onMouseLeave={() => setShowDropdown(false)}
          style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '48px' }}
        >
          <Link to="/championship" style={getLinkStyle('/championship')}>
            Championship
          </Link>

          {showDropdown && (
            <div
              style={{
                position: 'absolute',
                backgroundColor: '#09090d',
                border: '1px solid #14141f',
                borderRadius: '4px',
                padding: '8px',
                top: '48px',
                left: '50%',
                transform: 'translateX(-50%)',
                minWidth: '200px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                zIndex: 101,
              }}
            >
              <Link
                to="/championship?tab=drivers"
                onClick={() => setShowDropdown(false)}
                style={{
                  color: '#888899',
                  textDecoration: 'none',
                  fontSize: '12px',
                  padding: '6px 10px',
                  display: 'block',
                  transition: 'color 0.15s ease, background-color 0.15s ease',
                  borderRadius: '2px',
                }}
                onMouseEnter={(e) => {
                  e.target.style.color = '#ffffff';
                  e.target.style.backgroundColor = '#14141f';
                }}
                onMouseLeave={(e) => {
                  e.target.style.color = '#888899';
                  e.target.style.backgroundColor = 'transparent';
                }}
              >
                Driver Standings
              </Link>
              <Link
                to="/championship?tab=constructors"
                onClick={() => setShowDropdown(false)}
                style={{
                  color: '#888899',
                  textDecoration: 'none',
                  fontSize: '12px',
                  padding: '6px 10px',
                  display: 'block',
                  transition: 'color 0.15s ease, background-color 0.15s ease',
                  borderRadius: '2px',
                }}
                onMouseEnter={(e) => {
                  e.target.style.color = '#ffffff';
                  e.target.style.backgroundColor = '#14141f';
                }}
                onMouseLeave={(e) => {
                  e.target.style.color = '#888899';
                  e.target.style.backgroundColor = 'transparent';
                }}
              >
                Constructor Standings
              </Link>
            </div>
          )}
        </div>

        <Link to="/news" style={getLinkStyle('/news')}>
          News
        </Link>
        <Link to="/telemetry" style={getLinkStyle('/telemetry')}>
          Telemetry
        </Link>
        <Link to="/analytics" style={getLinkStyle('/analytics')}>
          Analytics
        </Link>
      </div>

      {/* Spacer to keep center nav links aligned as before */}
      <div style={{ width: '90px' }} />
    </nav>
  );
}
