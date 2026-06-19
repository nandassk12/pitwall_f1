import { useState, useEffect } from 'react';
import {
  resolveCircuitId,
  fetchCircuitSvg,
  injectCircuitStyles,
} from '../utils/circuitMap';

export default function CircuitSvgMap({
  country = '',
  venue = '',
  circuitId = null,
  width = 280,
  height = 200,
  strokeColor = '#e10600',
  strokeWidth = '3',
  showPlaceholder = true,
  showMarkers = false,
}) {
  const [svgContent, setSvgContent] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setSvgContent(null);

    const id = circuitId || resolveCircuitId(country, venue);

    if (!id) {
      setLoading(false);
      setError(true);
      return;
    }

    fetchCircuitSvg(id).then(text => {
      if (text) {
        let styledText = injectCircuitStyles(text, {
          strokeColor,
          strokeWidth,
          width:  '100%',
          height: '100%',
        });

        // Inject Checkered Start/Finish line and optionally Turn Numbers for Austria (Spielberg) specifically AFTER styling
        if (id === 'austria') {
          let extraSvg = `
            <!-- Checkered Start/Finish Line -->
            <line x1="280" y1="358" x2="280" y2="384" stroke="#ffffff" stroke-width="10" stroke-linecap="butt" />
            <line x1="280" y1="358" x2="280" y2="384" stroke="#000000" stroke-width="10" stroke-linecap="butt" stroke-dasharray="4,4" />
            <text x="295" y="392" fill="#ffffff" font-size="12" font-family="monospace" font-weight="black" letter-spacing="1px">START/FINISH</text>
          `;

          if (showMarkers) {
            extraSvg += `
              <!-- Turn Number Badges (Rounded Numbers centered offset outward from track apices) -->
              <circle cx="50" cy="142" r="9" fill="var(--bg-primary)" stroke="#ffffff" stroke-width="1.5" />
              <text x="50" y="142" fill="#ffffff" font-size="10" font-family="monospace" font-weight="black" text-anchor="middle" dominant-baseline="central">1</text>
              
              <circle cx="18" cy="130" r="9" fill="var(--bg-primary)" stroke="#ffffff" stroke-width="1.5" />
              <text x="18" y="130" fill="#ffffff" font-size="10" font-family="monospace" font-weight="black" text-anchor="middle" dominant-baseline="central">2</text>
              
              <circle cx="326" cy="135" r="9" fill="var(--bg-primary)" stroke="#ffffff" stroke-width="1.5" />
              <text x="326" y="135" fill="#ffffff" font-size="10" font-family="monospace" font-weight="black" text-anchor="middle" dominant-baseline="central">3</text>
              
              <circle cx="170" cy="190" r="9" fill="var(--bg-primary)" stroke="#ffffff" stroke-width="1.5" />
              <text x="170" y="190" fill="#ffffff" font-size="10" font-family="monospace" font-weight="black" text-anchor="middle" dominant-baseline="central">4</text>
              
              <circle cx="195" cy="280" r="9" fill="var(--bg-primary)" stroke="#ffffff" stroke-width="1.5" />
              <text x="195" y="280" fill="#ffffff" font-size="10" font-family="monospace" font-weight="black" text-anchor="middle" dominant-baseline="central">5</text>
              
              <circle cx="268" cy="262" r="9" fill="var(--bg-primary)" stroke="#ffffff" stroke-width="1.5" />
              <text x="268" y="262" fill="#ffffff" font-size="10" font-family="monospace" font-weight="black" text-anchor="middle" dominant-baseline="central">6</text>
              
              <circle cx="458" cy="230" r="9" fill="var(--bg-primary)" stroke="#ffffff" stroke-width="1.5" />
              <text x="458" y="230" fill="#ffffff" font-size="10" font-family="monospace" font-weight="black" text-anchor="middle" dominant-baseline="central">7</text>
              
              <circle cx="476" cy="280" r="9" fill="var(--bg-primary)" stroke="#ffffff" stroke-width="1.5" />
              <text x="476" y="280" fill="#ffffff" font-size="10" font-family="monospace" font-weight="black" text-anchor="middle" dominant-baseline="central">8</text>
              
              <circle cx="482" cy="305" r="9" fill="var(--bg-primary)" stroke="#ffffff" stroke-width="1.5" />
              <text x="482" y="305" fill="#ffffff" font-size="10" font-family="monospace" font-weight="black" text-anchor="middle" dominant-baseline="central">9</text>
              
              <circle cx="375" cy="365" r="9" fill="var(--bg-primary)" stroke="#ffffff" stroke-width="1.5" />
              <text x="375" y="365" fill="#ffffff" font-size="10" font-family="monospace" font-weight="black" text-anchor="middle" dominant-baseline="central">10</text>
            `;
          }
          styledText = styledText.replace('</svg>', `${extraSvg}</svg>`);
        }

        setSvgContent(styledText);
      } else {
        setError(true);
      }
      setLoading(false);
    });
  }, [country, venue, circuitId, strokeColor, strokeWidth, showMarkers]);

  const containerStyle = {
    width,
    height,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    position:       'relative',
    overflow:       'hidden',
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <span style={{
          fontSize:    '9px',
          color:       '#333344',
          fontFamily:  'monospace',
          letterSpacing: '1px',
        }}>
          LOADING CIRCUIT...
        </span>
      </div>
    );
  }

  if (error || !svgContent) {
    if (!showPlaceholder) return null;
    return (
      <div style={{
        ...containerStyle,
        border:       '1px solid var(--border-color)',
        borderRadius: '4px',
      }}>
        <span style={{
          fontSize:    '9px',
          color:       '#333344',
          fontFamily:  'monospace',
          letterSpacing: '1px',
          textAlign:   'center',
          padding:     '8px',
        }}>
          CIRCUIT MAP<br/>UNAVAILABLE
        </span>
      </div>
    );
  }

  return (
    <div
      style={containerStyle}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}
