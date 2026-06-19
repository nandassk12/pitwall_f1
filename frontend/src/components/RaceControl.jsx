import React, { useMemo, useState } from 'react';

// ── Colour map for flag badge backgrounds ─────────────────────────────────────
const FLAG_BG = {
  'YELLOW':              'rgba(255, 214, 0, 0.15)',
  'DOUBLE YELLOW':       'rgba(255, 214, 0, 0.22)',
  'RED':                 'rgba(225, 6, 0, 0.15)',
  'GREEN':               'rgba(0, 230, 118, 0.12)',
  'BLUE':                'rgba(68, 138, 255, 0.12)',
  'SAFETY CAR':          'rgba(255, 143, 0, 0.15)',
  'VIRTUAL SAFETY CAR':  'rgba(255, 143, 0, 0.12)',
  'VSC ENDING':          'rgba(255, 179, 0, 0.12)',
  'DRS ENABLED':         'rgba(0, 229, 255, 0.10)',
  'DRS DISABLED':        'rgba(136, 136, 153, 0.10)',
  'CHEQUERED':           'rgba(245, 245, 247, 0.08)',
  'CLEAR':               'rgba(0, 230, 118, 0.10)',
  'MEDICAL CAR':         'rgba(255, 143, 0, 0.15)',
};

const FLAG_ICONS = {
  'YELLOW':              '🟡',
  'DOUBLE YELLOW':       '🟡🟡',
  'RED':                 '🔴',
  'GREEN':               '🟢',
  'BLUE':                '🔵',
  'SAFETY CAR':          '🚗',
  'VIRTUAL SAFETY CAR':  '🚗',
  'VSC ENDING':          '🚗',
  'DRS ENABLED':         '✅',
  'DRS DISABLED':        '🚫',
  'CHEQUERED':           '🏁',
  'CLEAR':               '🟢',
  'MEDICAL CAR':         '🏥',
};

const CATEGORY_FILTERS = ['ALL', 'Flag', 'SafetyCar', 'Drs', 'Other'];

function getBg(flag) {
  return FLAG_BG[flag] || 'rgba(136,136,153,0.08)';
}

function getIcon(flag) {
  return FLAG_ICONS[flag] || '📢';
}

function formatTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toISOString().substr(11, 8); // HH:MM:SS
  } catch {
    return '—';
  }
}

// ── Individual message row ────────────────────────────────────────────────────
function RaceControlRow({ msg }) {
  const bg    = getBg(msg.flag);
  const icon  = getIcon(msg.flag);
  const color = msg.flagColor || '#888899';

  return (
    <div style={{
      display:       'grid',
      gridTemplateColumns: '48px 60px 140px 1fr',
      gap:           '10px',
      alignItems:    'center',
      padding:       '8px 12px',
      borderLeft:    `3px solid ${color}`,
      backgroundColor: bg,
      borderRadius:  '3px',
      marginBottom:  '4px',
      fontFamily:    'monospace',
      fontSize:      '11px',
    }}>

      {/* Lap number */}
      <span style={{ color: '#888899', textAlign: 'center' }}>
        {msg.lap != null ? `L${msg.lap}` : '—'}
      </span>

      {/* Time */}
      <span style={{ color: '#555666', fontSize: '10px' }}>
        {formatTime(msg.date)}
      </span>

      {/* Badge */}
      <span style={{
        display:        'flex',
        alignItems:     'center',
        gap:            '5px',
        color:          color,
        fontWeight:     'bold',
        letterSpacing:  '0.5px',
        fontSize:       '10px',
        whiteSpace:     'nowrap',
        overflow:       'hidden',
        textOverflow:   'ellipsis',
      }}>
        <span>{icon}</span>
        <span>{msg.badge || msg.category}</span>
      </span>

      {/* Message text + driver */}
      <span style={{ color: '#c8c8d8', lineHeight: '1.4' }}>
        {msg.message}
        {msg.driverNumber != null && (
          <span style={{
            marginLeft:      '8px',
            color:           '#888899',
            fontSize:        '10px',
            backgroundColor: 'var(--border-color)',
            padding:         '1px 5px',
            borderRadius:    '3px',
          }}>
            #{msg.driverNumber}
          </span>
        )}
        {msg.sector != null && (
          <span style={{
            marginLeft:      '6px',
            color:           '#555666',
            fontSize:        '10px',
          }}>
            S{msg.sector}
          </span>
        )}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RaceControl({ raceControl }) {
  const [filter,   setFilter]   = useState('ALL');
  const [reversed, setReversed] = useState(true); // newest first by default

  const data     = raceControl || {};
  const messages = data.messages || [];
  const available = data.available ?? false;

  // Apply category filter then direction
  const visible = useMemo(() => {
    let list = messages;
    if (filter !== 'ALL') {
      const fl = filter.toLowerCase();
      list = list.filter(m => (m.category || '').toLowerCase().includes(fl));
    }
    return reversed ? [...list].reverse() : list;
  }, [messages, filter, reversed]);

  // ── Not available state ───────────────────────────────────────────────────
  if (!available) {
    return (
      <div style={{
        padding:       '40px 20px',
        textAlign:     'center',
        fontFamily:    'monospace',
        color:         '#555666',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius:  '6px',
        border:        '1px solid var(--border-color)',
      }}>
        <div style={{ fontSize: '28px', marginBottom: '12px' }}>📡</div>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#888899', marginBottom: '6px' }}>
          RACE CONTROL — NOT AVAILABLE
        </div>
        <div style={{ fontSize: '10px', letterSpacing: '1px' }}>
          OpenF1 data is only available for sessions from the 2023 season onwards.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'var(--bg-secondary)',
      border:          '1px solid var(--border-color)',
      borderRadius:    '6px',
      fontFamily:      'monospace',
      overflow:        'hidden',
    }}>

      {/* Header bar */}
      <div style={{
        display:         'flex',
        justifyContent:  'space-between',
        alignItems:      'center',
        padding:         '10px 14px',
        borderBottom:    '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-tertiary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#e10600', fontWeight: 'bold', fontSize: '11px', letterSpacing: '1.5px' }}>
            ◆ RACE CONTROL
          </span>
          <span style={{
            fontSize:        '10px',
            color:           '#888899',
            backgroundColor: 'var(--border-color)',
            padding:         '2px 8px',
            borderRadius:    '10px',
          }}>
            {messages.length} messages
          </span>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {/* Category filter pills */}
          {CATEGORY_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding:         '3px 10px',
                fontSize:        '9px',
                fontFamily:      'monospace',
                fontWeight:      'bold',
                letterSpacing:   '0.8px',
                backgroundColor: filter === f ? '#e10600' : 'transparent',
                color:           filter === f ? '#fff' : '#888899',
                border:          filter === f ? '1px solid #e10600' : '1px solid var(--border-color)',
                borderRadius:    '3px',
                cursor:          'pointer',
                transition:      'all 0.12s ease',
              }}
            >
              {f}
            </button>
          ))}

          {/* Direction toggle */}
          <button
            onClick={() => setReversed(r => !r)}
            title={reversed ? 'Showing newest first' : 'Showing oldest first'}
            style={{
              padding:         '3px 10px',
              fontSize:        '10px',
              fontFamily:      'monospace',
              backgroundColor: 'transparent',
              color:           '#555666',
              border:          '1px solid var(--border-color)',
              borderRadius:    '3px',
              cursor:          'pointer',
              transition:      'color 0.12s ease',
            }}
          >
            {reversed ? '↓ NEWEST' : '↑ OLDEST'}
          </button>
        </div>
      </div>

      {/* Column header */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: '48px 60px 140px 1fr',
        gap:                 '10px',
        padding:             '6px 12px',
        borderBottom:        '1px solid var(--border-color)',
        fontSize:            '9px',
        color:               '#555666',
        letterSpacing:       '1px',
        fontWeight:          'bold',
      }}>
        <span>LAP</span>
        <span>TIME</span>
        <span>FLAG / TYPE</span>
        <span>MESSAGE</span>
      </div>

      {/* Scrollable message log */}
      <div style={{
        maxHeight:   '420px',
        overflowY:   'auto',
        padding:     '8px 10px',
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--border-color) transparent',
      }}>
        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#555666', padding: '30px', fontSize: '11px' }}>
            No messages match the selected filter.
          </div>
        ) : (
          visible.map((msg, i) => (
            <RaceControlRow key={i} msg={msg} />
          ))
        )}
      </div>

      {/* Footer stats */}
      <div style={{
        display:         'flex',
        gap:             '20px',
        padding:         '8px 14px',
        borderTop:       '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-tertiary)',
        fontSize:        '9px',
        color:           '#555666',
        letterSpacing:   '0.8px',
      }}>
        {['Flag', 'SafetyCar', 'Drs'].map(cat => {
          const count = messages.filter(m =>
            (m.category || '').toLowerCase().includes(cat.toLowerCase())
          ).length;
          return (
            <span key={cat}>
              {cat.toUpperCase()}: <span style={{ color: '#888899' }}>{count}</span>
            </span>
          );
        })}
        <span style={{ marginLeft: 'auto' }}>
          SHOWING: <span style={{ color: '#888899' }}>{visible.length} / {messages.length}</span>
        </span>
      </div>
    </div>
  );
}
