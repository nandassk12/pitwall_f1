import React, { useState, useEffect, useMemo } from 'react';
import { scaleLinear } from 'd3';
import { line, curveCatmullRomClosed } from 'd3';
import API_BASE from '../config';

const PAD = 16;

export default function CircuitMap({
  circuitGeometry,
  allPositions = [],
  activeDriver = '',
  simState = null,
  width = 270,
  height = 210,
  dominanceData = null,
  domDriverA = '',
  domDriverB = ''
}) {
  const [hoveredDriver, setHoveredDriver] = useState(null);
  const [circuitMeta,   setCircuitMeta]   = useState(null);


  // ── Fetch circuit metadata once when geometry is available ────────────────
  useEffect(() => {
    if (!circuitGeometry) return;
    fetch(`${API_BASE}/api/circuit/metadata`)
      .then(r => r.json())
      .then(data => {
        if (!data.error) setCircuitMeta(data);
      })
      .catch(err => console.error('Circuit metadata fetch failed:', err));
  }, [circuitGeometry]);

  // ── D3 scales ─────────────────────────────────────────────────────────────
  const xScale = useMemo(() => scaleLinear([0, 1], [PAD, width  - PAD]), [width]);
  const yScale = useMemo(() => scaleLinear([0, 1], [height - PAD, PAD]), [height]);

  // ── Circuit outline path ───────────────────────────────────────────────────
  const lineGen = useMemo(() =>
    line()
      .x(d => xScale(d.x))
      .y(d => yScale(d.y))
      .curve(curveCatmullRomClosed.alpha(0.5)),
    [xScale, yScale]
  );

  const pathD = useMemo(() => {
    if (!circuitGeometry?.points?.length) return '';
    return lineGen(circuitGeometry.points) || '';
  }, [circuitGeometry, lineGen]);

  // ── Resolve effective positions ────────────────────────────────────────────
  const effectivePositions = useMemo(() => {
    const posDict = simState?.positions;
    if (posDict && Object.keys(posDict).length > 0) {
      return Object.entries(posDict).map(([driver, data]) => ({
        driver,
        x:         data.x,
        y:         data.y,
        teamColor: data.teamColor,
        position:  data.position,
        compound:  data.compound,
        carNumber: null,
        speed:     null,
        gear:      null,
      }));
    }
    return allPositions;
  }, [simState, allPositions]);

  // ── DRS zone polyline strings ──────────────────────────────────────────────
  // Pre-compute SVG polyline points strings for each DRS zone segment
  const drsPolylines = useMemo(() => {
    if (!circuitMeta?.drsZones) return [];
    return circuitMeta.drsZones.map(zone =>
      zone.segmentPoints
        .map(pt => `${xScale(pt.x).toFixed(1)},${yScale(pt.y).toFixed(1)}`)
        .join(' ')
    );
  }, [circuitMeta, xScale, yScale]);

  // ── Track direction arrow data ─────────────────────────────────────────────
  // Pick a point ~5% along the track outline to place the direction arrow
  const arrowData = useMemo(() => {
    const pts = circuitGeometry?.points;
    if (!pts || pts.length < 10) return null;
    const i  = Math.floor(pts.length * 0.05);
    const i2 = Math.floor(pts.length * 0.08);
    return {
      x1: xScale(pts[i].x),  y1: yScale(pts[i].y),
      x2: xScale(pts[i2].x), y2: yScale(pts[i2].y),
    };
  }, [circuitGeometry, xScale, yScale]);

  // ── Early return: no data yet ──────────────────────────────────────────────
  if (!circuitGeometry) {
    return (
      <div style={cardStyle}>
        <div style={headerStyle}>CIRCUIT — LIVE MAP</div>
        <div style={{ ...svgWrapStyle(width, height), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '10px', color: '#555666', letterSpacing: '1px' }}>AWAITING GEOMETRY...</span>
        </div>
      </div>
    );
  }

  // ── Hover tooltip data ─────────────────────────────────────────────────────
  const hoveredPos = effectivePositions.find(p => p.driver === hoveredDriver);

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span>CIRCUIT — LIVE MAP</span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {circuitMeta && (
            <span style={{ color: '#555666', fontSize: '9px' }}>
              T{circuitMeta.totalCorners} · {circuitMeta.drsZones?.length ?? 0} DRS
            </span>
          )}
          {effectivePositions.length > 0 && (
            <span style={{ color: '#555666', fontSize: '9px', fontWeight: 'normal' }}>
              {effectivePositions.length} CARS
            </span>
          )}
        </div>
      </div>

      <div style={svgWrapStyle(width, height)}>
        <svg width={width} height={height} style={{ display: 'block' }}>

          {/* ── SVG Definitions ─────────────────────────────────────────── */}
          <defs>
            <filter id="glow-active" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-drs" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Checkered pattern for start/finish */}
            <pattern id="checker" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
              <rect x="0" y="0" width="2" height="2" fill="#fff" />
              <rect x="2" y="2" width="2" height="2" fill="#fff" />
              <rect x="2" y="0" width="2" height="2" fill="#e10600" />
              <rect x="0" y="2" width="2" height="2" fill="#e10600" />
            </pattern>
          </defs>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* LAYER 1 — TRACK OUTLINE                                       */}
          {/* ═══════════════════════════════════════════════════════════════ */}

          {dominanceData?.segments?.length > 0 ? (
            dominanceData.segments.map((seg) => {
              const ptsString = (seg.points || [])
                .map(pt => `${xScale(pt?.x ?? 0).toFixed(1)},${yScale(pt?.y ?? 0).toFixed(1)}`)
                .join(' ');
              return (
                <polyline
                  key={`seg-${seg.index}`}
                  points={ptsString}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={3}
                  strokeOpacity={seg.opacity}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <title>
                    {(() => {
                      if (seg.ranking && seg.ranking.length > 0) {
                        const p1 = seg.ranking[0];
                        const p2 = seg.ranking[1];
                        const p1Driver = p1.driver ?? 'Unknown';
                        const p1Speed = (p1.meanSpeed ?? 0).toFixed(0);
                        const p2Part = p2 ? ` vs ${p2.driver ?? 'Unknown'} ${(p2.meanSpeed ?? 0).toFixed(0)} km/h` : ' km/h';
                        const deltaPart = p2 ? `\nΔ${(p2.delta ?? 0).toFixed(1)}s` : '';
                        return `Seg ${seg.index + 1}: ${p1Driver} ${p1Speed}${p2Part}${deltaPart}`;
                      }
                      const driverA = seg.driverA ?? domDriverA ?? 'A';
                      const speedA = (seg.speedA ?? 0).toFixed(0);
                      const driverB = seg.driverB ?? domDriverB ?? 'B';
                      const speedB = (seg.speedB ?? 0).toFixed(0);
                      const delta = (seg.delta ?? 0).toFixed(1);
                      return `Seg ${seg.index + 1}: ${driverA} ${speedA} vs ${driverB} ${speedB} km/h\nΔ${delta} km/h`;
                    })()}
                  </title>
                </polyline>
              );
            })
          ) : (
            <>
              {/* Tarmac base */}
              {pathD && (
                <path d={pathD} fill="none" stroke="#1c1c2e" strokeWidth={10}
                  strokeLinecap="round" strokeLinejoin="round" />
              )}
              {/* Kerb line */}
              {pathD && (
                <path d={pathD} fill="none" stroke="#26263a" strokeWidth={5}
                  strokeLinecap="round" strokeLinejoin="round" />
              )}
              {/* Racing-line dashes */}
              {pathD && (
                <path d={pathD} fill="none" stroke="#2e2e44" strokeWidth={2}
                  strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray="6 4" opacity={0.5} />
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* LAYER 2 — DRS ZONES                                           */}
          {/* ═══════════════════════════════════════════════════════════════ */}

          {drsPolylines.map((pts, i) => (
            <g key={`drs-${i}`}>
              {/* Glow halo behind DRS strip */}
              <polyline
                points={pts}
                fill="none"
                stroke="#00bcd4"
                strokeWidth={7}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.18}
                filter="url(#glow-drs)"
              />
              {/* Solid DRS strip */}
              <polyline
                points={pts}
                fill="none"
                stroke="#00bcd4"
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.75}
              />
              {/* DRS label at midpoint */}
              {circuitMeta.drsZones[i] && (() => {
                const mx = xScale(circuitMeta.drsZones[i].midX);
                const my = yScale(circuitMeta.drsZones[i].midY);
                return (
                  <g>
                    <rect x={mx - 10} y={my - 9} width={20} height={10}
                      rx={2} fill="#001f25" stroke="#00bcd4" strokeWidth={0.5} opacity={0.9} />
                    <text x={mx} y={my - 1} textAnchor="middle"
                      fill="#00bcd4" fontSize={6} fontFamily="monospace" fontWeight="bold">
                      DRS
                    </text>
                  </g>
                );
              })()}
            </g>
          ))}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* LAYER 3 — SECTOR MARKERS                                      */}
          {/* ═══════════════════════════════════════════════════════════════ */}

          {circuitMeta?.sectors?.map(sector => {
            const sx = xScale(sector.x);
            const sy = yScale(sector.y);
            // Skip S3 — it overlaps the start/finish marker
            if (sector.name === 'S3') return null;
            return (
              <g key={sector.name}>
                {/* Dashed ring */}
                <circle cx={sx} cy={sy} r={10}
                  fill="none" stroke={sector.color}
                  strokeWidth={1.2} strokeDasharray="3 2" opacity={0.7} />
                {/* Solid dot at centre */}
                <circle cx={sx} cy={sy} r={2}
                  fill={sector.color} opacity={0.9} />
                {/* Label */}
                <text x={sx} y={sy + 20} textAnchor="middle"
                  fill={sector.color} fontSize={7} fontFamily="monospace"
                  fontWeight="bold" opacity={0.9}>
                  {sector.name}
                </text>
              </g>
            );
          })}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* LAYER 4 — CORNER NUMBERS                                      */}
          {/* ═══════════════════════════════════════════════════════════════ */}

          {circuitMeta?.corners?.map(corner => {
            const cx = xScale(corner.x);
            const cy = yScale(corner.y);
            return (
              <g key={`corner-${corner.number}`}>
                {/* Tiny white badge */}
                <circle cx={cx} cy={cy} r={7}
                  fill="rgba(255,255,255,0.08)"
                  stroke="rgba(255,255,255,0.30)"
                  strokeWidth={0.6} />
                <text x={cx} y={cy + 3} textAnchor="middle"
                  fill="rgba(255,255,255,0.80)" fontSize={5.5}
                  fontFamily="monospace" fontWeight="bold">
                  {corner.number}
                </text>
              </g>
            );
          })}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* LAYER 5 — START / FINISH LINE                                 */}
          {/* ═══════════════════════════════════════════════════════════════ */}

          {circuitMeta?.startFinish && (() => {
            const sfx = xScale(circuitMeta.startFinish.x);
            const sfy = yScale(circuitMeta.startFinish.y);
            return (
              <g>
                {/* Checkered line across track */}
                <line x1={sfx - 9} y1={sfy - 4} x2={sfx + 9} y2={sfy + 4}
                  stroke="url(#checker)" strokeWidth={5}
                  strokeLinecap="butt" />
                {/* Bold red accent line */}
                <line x1={sfx - 9} y1={sfy - 4} x2={sfx + 9} y2={sfy + 4}
                  stroke="#e10600" strokeWidth={1.5} opacity={0.9} />
                {/* Pill background for label */}
                <rect x={sfx - 18} y={sfy - 19} width={36} height={10}
                  rx={2} fill="#1a0000" stroke="#e10600"
                  strokeWidth={0.6} opacity={0.92} />
                <text x={sfx} y={sfy - 11} textAnchor="middle"
                  fill="#e10600" fontSize={5.5} fontFamily="monospace"
                  fontWeight="bold" letterSpacing="0.3">
                  S/F LINE
                </text>
              </g>
            );
          })()}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* LAYER 6 — TRACK DIRECTION ARROW                               */}
          {/* ═══════════════════════════════════════════════════════════════ */}

          {arrowData && (() => {
            const { x1, y1, x2, y2 } = arrowData;
            const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            return (
              <g transform={`translate(${mx},${my}) rotate(${angle})`}
                opacity={0.7}>
                {/* Arrow body */}
                <line x1={-8} y1={0} x2={6} y2={0}
                  stroke="#e10600" strokeWidth={1.5} />
                {/* Arrowhead */}
                <polygon points="6,0 2,-3 2,3"
                  fill="#e10600" />
              </g>
            );
          })()}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* LAYER 7 — DRIVER DOTS (always on top)                         */}
          {/* ═══════════════════════════════════════════════════════════════ */}

          {effectivePositions.map(pos => {
            const cx = xScale(pos.x ?? 0);
            const cy = yScale(pos.y ?? 0);
            const isActive  = pos.driver === activeDriver;
            const isHovered = pos.driver === hoveredDriver;
            const r         = isActive ? 7 : 5;
            const color     = pos.teamColor;

            return (
              <g
                key={pos.driver}
                onMouseEnter={() => setHoveredDriver(pos.driver)}
                onMouseLeave={() => setHoveredDriver(null)}
                style={{ cursor: 'crosshair' }}
              >
                {/* Active driver: outer pulse ring */}
                {isActive && (
                  <circle cx={cx} cy={cy} r={13}
                    fill="none" stroke={color}
                    strokeWidth={1.5} opacity={0.35} />
                )}

                {/* Car dot with smooth transition */}
                <g transform={`translate(${cx}, ${cy})`}
                  style={{ transition: 'transform 0.8s ease' }}>
                  <circle r={r}
                    fill={color}
                    stroke={isActive ? '#ffffff' : 'var(--bg-primary)'}
                    strokeWidth={isActive ? 1.5 : 0.8}
                    filter={isActive ? 'url(#glow-active)' : undefined} />
                </g>

                {/* Driver code label */}
                {(isActive || isHovered) && (
                  <text x={cx + r + 4} y={cy + 3}
                    fontSize={8} fontFamily="monospace" fontWeight="bold"
                    fill={color} style={{ pointerEvents: 'none' }}>
                    {pos.driver}
                  </text>
                )}
              </g>
            );
          })}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* LAYER 8 — HOVER TOOLTIP (topmost)                             */}
          {/* ═══════════════════════════════════════════════════════════════ */}

          {hoveredPos && (() => {
            const tx   = xScale(hoveredPos.x ?? 0);
            const ty   = yScale(hoveredPos.y ?? 0);
            const flip = tx > width - 105;
            const rx   = flip ? tx - 98 : tx + 12;
            const ry   = Math.max(8, ty - 22);
            const isSimMode = simState?.positions && Object.keys(simState.positions).length > 0;
            const line2 = isSimMode
              ? `P${hoveredPos.position} · ${hoveredPos.compound}`
              : `${hoveredPos.speed} KMH · G${hoveredPos.gear}`;

            return (
              <g style={{ pointerEvents: 'none' }}>
                <rect x={rx} y={ry} width={90} height={34}
                  rx={3} fill="var(--bg-secondary)" stroke="#2a2a3e" strokeWidth={1} />
                <text x={rx + 7} y={ry + 13} fontSize={9}
                  fontFamily="monospace" fontWeight="bold" fill={hoveredPos.teamColor}>
                  {hoveredPos.driver}{hoveredPos.carNumber ? `  #${hoveredPos.carNumber}` : ''}
                </text>
                <text x={rx + 7} y={ry + 25} fontSize={8}
                  fontFamily="monospace" fill="#666677">
                  {line2}
                </text>
              </g>
            );
          })()}

        </svg>
      </div>
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────
const cardStyle = {
  backgroundColor: 'var(--bg-secondary)',
  border:          '1px solid var(--border-color)',
  borderRadius:    '6px',
  padding:         '12px',
  display:         'flex',
  flexDirection:   'column',
  alignItems:      'center',
};

const headerStyle = {
  fontSize:        '10px',
  fontWeight:      'bold',
  color:           '#555666',
  width:           '100%',
  marginBottom:    '8px',
  display:         'flex',
  justifyContent:  'space-between',
  alignItems:      'center',
  letterSpacing:   '0.5px',
};

const svgWrapStyle = (w, h) => ({
  width:           `${w}px`,
  height:          `${h}px`,
  backgroundColor: 'var(--bg-primary)',
  borderRadius:    '4px',
  border:          '1px solid var(--border-color)',
  overflow:        'hidden',
});
