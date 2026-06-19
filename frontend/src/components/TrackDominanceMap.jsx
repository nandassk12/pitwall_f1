import React, { useState, useEffect, useRef } from 'react';
import API_BASE from '../config';

const SVG_W = 640;
const SVG_H = 480;
const SLOT_COLORS = ['#e10600', '#29b6f6', '#00e676', '#ffea00'];

const toSvgX = x => x * SVG_W;
const toSvgY = y => y * SVG_H;

const toPolylinePoints = (pts) =>
  (pts || []).map(p => `${toSvgX(p?.x ?? 0).toFixed(1)},${toSvgY(p?.y ?? 0).toFixed(1)}`).join(' ');

const formatDelta = (delta) =>
  (delta === undefined || delta === null || delta === 0) ? '—' : `+${(delta ?? 0).toFixed(3)}s`;

const formatSpeed = (s) => `${(s ?? 0).toFixed(1)} km/h`;

export default function TrackDominanceMap() {
  const [dominanceData, setDominanceData] = useState(null);
  const [circuitPoints, setCircuitPoints] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [hoveredSeg,    setHoveredSeg]    = useState(null);
  const [pinnedSeg,     setPinnedSeg]     = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/analytics/dominance`).then(r => r.json()),
      fetch(`${API_BASE}/api/circuit/geometry`).then(r => r.json()),
    ]).then(([dom, geo]) => {
      setDominanceData(dom);
      setCircuitPoints(geo.points || []);
      setLoading(false);
      // Auto-select first segment on load
      if (dom.segments?.length > 0) setHoveredSeg(0);
    }).catch(() => setLoading(false));
  }, []);

  const activeSeg = pinnedSeg ?? hoveredSeg;
  const activeSegData = dominanceData?.segments?.find(s => s.index === activeSeg);

  // Driver summary sorted by segmentsLed descending
  const driverSummaryList = dominanceData?.driverSummary
    ? Object.entries(dominanceData.driverSummary)
        .map(([drv, data]) => ({ driver: drv, ...data }))
        .sort((a, b) => b.segmentsLed - a.segmentsLed)
    : [];

  const handleSegmentClick = (segIndex) => {
    setPinnedSeg(prev => prev === segIndex ? null : segIndex);
  };

  const handleSegmentHover = (segIndex) => {
    if (pinnedSeg === null) setHoveredSeg(segIndex);
  };

  const handleSvgLeave = () => {
    if (pinnedSeg === null) setHoveredSeg(null);
  };

  if (loading) {
    return (
      <div style={{
        color: '#555666',
        fontSize: '11px',
        fontFamily: 'monospace',
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        LOADING DOMINANCE DATA...
      </div>
    );
  }

  if (!dominanceData || !dominanceData.segments || dominanceData.segments.length === 0) {
    return (
      <div style={{
        color: '#555666',
        fontSize: '11px',
        fontFamily: 'monospace',
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        NO DOMINANCE DATA — LOAD A SESSION FIRST
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '6px',
      padding: '15px',
      fontFamily: 'monospace',
    }}>

      {/* ── HEADER ── */}
      <div style={{ display:'flex', justifyContent:'space-between',
                    alignItems:'center', marginBottom:'8px' }}>
        <span style={{ color:'#fff', fontWeight:'bold', fontSize:'11px',
                       letterSpacing:'1px' }}>
          ◈ TRACK ZONE DOMINANCE
        </span>
        <span style={{ color:'#555666', fontSize:'9px' }}>
          FASTEST DRIVER COLOURS EACH ZONE · CLICK TO PIN
        </span>
      </div>

      <div style={{ color:'#555666', fontSize:'10px', marginBottom:'15px' }}>
        Each driver's fastest lap is split into {dominanceData.n_segments} equal-distance
        sections. The team whose driver was fastest through each zone colours that section.
        Tap/click a section to see the full ranking. Tap again to unpin.
      </div>

      {/* ── MAIN GRID: map left, ranking right ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr',
                    gap:'15px', alignItems:'start' }}>

        {/* ── LEFT: SVG Circuit Map ── */}
        <div style={{ backgroundColor:'var(--bg-primary)', border:'1px solid var(--border-color)',
                      borderRadius:'6px', padding:'10px', position:'relative' }}>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            style={{ width:'100%', height:'auto', cursor:'crosshair',
                     display:'block' }}
            onMouseLeave={handleSvgLeave}
          >
            {/* BASE CIRCUIT OUTLINE — grey underlay so gaps between
                segments don't show black background */}
            {circuitPoints.length > 1 && (
              <polyline
                points={toPolylinePoints(circuitPoints)}
                fill="none"
                stroke="#1c1c28"
                strokeWidth={6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* DOMINANCE SEGMENTS */}
            {dominanceData.segments.map(seg => {
              const isActive = seg.index === activeSeg;
              const opacity  = activeSeg === null ? 0.9
                             : isActive ? 1.0 : 0.25;
              const strokeW  = isActive ? 7 : 4;

              return (
                <g key={seg.index}>
                  {/* Wider invisible hit area for easier hover/click */}
                  <polyline
                    points={toPolylinePoints(seg.points)}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={16}
                    style={{ cursor:'pointer' }}
                    onMouseEnter={() => handleSegmentHover(seg.index)}
                    onClick={() => handleSegmentClick(seg.index)}
                  />
                  {/* Visible coloured segment */}
                  <polyline
                    points={toPolylinePoints(seg.points)}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={strokeW}
                    strokeOpacity={opacity}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transition:'stroke-opacity 0.15s ease,stroke-width 0.1s ease',
                             pointerEvents:'none' }}
                  />
                  {/* Segment label */}
                  <text
                    x={toSvgX(seg.midpoint.x)}
                    y={toSvgY(seg.midpoint.y)}
                    fontSize={isActive ? 12 : 9}
                    fontWeight={isActive ? 'bold' : 'normal'}
                    fill={isActive ? '#fff' : '#888899'}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ pointerEvents:'none', fontFamily:'monospace',
                             transition:'font-size 0.1s ease' }}
                  >
                    {seg.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Overlay hint when nothing selected */}
          {activeSeg === null && (
            <div style={{ position:'absolute', bottom:16, left:0, right:0,
                          textAlign:'center', fontSize:'10px', color:'#444552',
                          pointerEvents:'none' }}>
              TAP OR HOVER A SECTION TO SEE THE RANKING
            </div>
          )}
        </div>

        {/* ── RIGHT: Ranking Panel ── */}
        <div style={{ backgroundColor:'var(--bg-primary)', border:'1px solid var(--border-color)',
                      borderRadius:'6px', padding:'12px',
                      minHeight:'300px' }}>

          {!activeSegData ? (
            <div style={{ display:'flex', alignItems:'center',
                          justifyContent:'center', height:'300px',
                          color:'#444552', fontSize:'10px' }}>
              TAP OR HOVER A SECTION TO SEE THE RANKING
            </div>
          ) : (
            <>
              {/* Section header */}
              <div style={{ marginBottom:'12px',
                            borderBottom:'1px solid var(--border-color)', paddingBottom:'8px' }}>
                <div style={{ color:'#fff', fontWeight:'bold', fontSize:'16px' }}>
                  {activeSegData.label}
                </div>
                <div style={{ color:'#555666', fontSize:'9px', marginTop:'2px' }}>
                  {(activeSegData.startMeters ?? 0).toFixed(0)} m –{' '}
                  {(activeSegData.endMeters ?? 0).toFixed(0)} m ·{' '}
                  {(activeSegData.lengthMeters ?? 0).toFixed(0)} m long
                </div>
                <div style={{ color: activeSegData.color, fontSize:'10px',
                              fontWeight:'bold', marginTop:'4px' }}>
                  ■ {activeSegData.dominantDriver} — {activeSegData.dominantTeam}
                </div>
              </div>

              {/* Rankings list — scrollable */}
              <div style={{ maxHeight:'340px', overflowY:'auto' }}>
                {activeSegData.ranking.map((entry) => {
                  const isP1 = entry.position === 1;
                  return (
                    <div
                      key={entry.driver}
                      style={{
                        display:'flex',
                        alignItems:'center',
                        gap:'8px',
                        padding:'5px 6px',
                        marginBottom:'2px',
                        backgroundColor: isP1 ? 'var(--bg-tertiary)' : 'transparent',
                        borderLeft: `3px solid ${isP1 ? entry.teamColor : 'transparent'}`,
                        borderRadius:'3px',
                      }}
                    >
                      {/* Position */}
                      <span style={{ color: isP1 ? '#fff' : '#555666',
                                     fontSize:'10px', width:'14px',
                                     fontWeight: isP1 ? 'bold' : 'normal',
                                     flexShrink:0 }}>
                        {entry.position}
                      </span>

                      {/* Team color dot */}
                      <span style={{ width:'6px', height:'6px',
                                     borderRadius:'50%', flexShrink:0,
                                     backgroundColor: entry.teamColor,
                                     display:'inline-block' }} />

                      {/* Driver */}
                      <span style={{ color: isP1 ? '#fff' : '#aaa',
                                     fontSize:'10px', fontWeight: isP1 ? 'bold' : 'normal',
                                     width:'32px', flexShrink:0 }}>
                        {entry.driver}
                      </span>

                      {/* Team name */}
                      <span style={{ color:'#555666', fontSize:'8px',
                                     flex:1, overflow:'hidden',
                                     textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {entry.team}
                      </span>

                      {/* Mean speed */}
                      <span style={{ color: isP1 ? '#00e676' : '#888899',
                                     fontSize:'9px', width:'58px',
                                     textAlign:'right', flexShrink:0 }}>
                        {formatSpeed(entry.meanSpeed)}
                      </span>

                      {/* Delta */}
                      <span style={{ color: isP1 ? '#888' : '#ff3d00',
                                     fontSize:'9px', width:'48px',
                                     textAlign:'right', flexShrink:0 }}>
                        {isP1 ? '—' : formatDelta(entry.delta)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── BOTTOM: Segment dot navigator ── */}
      <div style={{ display:'flex', justifyContent:'center', gap:'6px',
                    marginTop:'12px', flexWrap:'wrap' }}>
        {dominanceData.segments.map(seg => (
          <button
            key={seg.index}
            onClick={() => handleSegmentClick(seg.index)}
            title={`${seg.label} — ${seg.dominantDriver}`}
            style={{
              width:'10px', height:'10px',
              borderRadius:'50%',
              backgroundColor: seg.index === activeSeg ? seg.color : '#1c1c28',
              border: seg.index === activeSeg ? `2px solid ${seg.color}` : '2px solid #1c1c28',
              cursor:'pointer',
              padding:0,
              transition:'background-color 0.15s ease',
              boxShadow: seg.index === activeSeg ? `0 0 6px ${seg.color}` : 'none',
            }}
          />
        ))}
      </div>

      {/* ── DRIVER SUMMARY STRIP ── */}
      <div style={{ marginTop:'15px', borderTop:'1px solid var(--border-color)',
                    paddingTop:'10px' }}>
        <div style={{ fontSize:'9px', color:'#555666', marginBottom:'8px',
                      letterSpacing:'1px' }}>
          SEGMENTS LED BY DRIVER
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
          {driverSummaryList.filter(d => d.segmentsLed > 0).map(d => (
            <div
              key={d.driver}
              style={{
                display:'flex', alignItems:'center', gap:'5px',
                padding:'3px 8px',
                backgroundColor:`${d.teamColor}18`,
                border:`1px solid ${d.teamColor}60`,
                borderRadius:'3px',
              }}
            >
              <span style={{ width:'6px', height:'6px', borderRadius:'50%',
                             backgroundColor:d.teamColor,
                             display:'inline-block', flexShrink:0 }} />
              <span style={{ color:'#fff', fontSize:'10px', fontWeight:'bold' }}>
                {d.driver}
              </span>
              <span style={{ color:d.teamColor, fontSize:'10px', fontWeight:'bold' }}>
                {d.segmentsLed}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
