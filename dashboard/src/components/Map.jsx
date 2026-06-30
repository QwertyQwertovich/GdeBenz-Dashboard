import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';

// ─── SVG pattern injection ────────────────────────────────────────────────────
// We inject defs into the Leaflet overlay SVG after the layer renders
function InjectDefs() {
  const map = useMap();
  useEffect(() => {
    const tryInject = () => {
      const svg = map.getPanes().overlayPane?.querySelector('svg');
      if (!svg || svg.querySelector('#gdebenz-defs')) return;
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      defs.id = 'gdebenz-defs';
      defs.innerHTML = `
        <!-- sparse hatch: moderate data gap -->
        <pattern id="hatch-sparse" patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(45)">
          <rect width="12" height="12" fill="transparent"/>
          <line x1="6" y1="0" x2="6" y2="12" stroke="rgba(255,255,255,0.30)" stroke-width="2"/>
        </pattern>
        <!-- medium hatch: low data -->
        <pattern id="hatch-medium" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
          <rect width="8" height="8" fill="transparent"/>
          <line x1="4" y1="0" x2="4" y2="8" stroke="rgba(255,255,255,0.40)" stroke-width="2"/>
        </pattern>
        <!-- dense crosshatch: very low data -->
        <pattern id="hatch-dense" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="transparent"/>
          <line x1="3" y1="0" x2="3" y2="6" stroke="rgba(255,255,255,0.50)" stroke-width="2"/>
          <line x1="0" y1="3" x2="6" y2="3" stroke="rgba(255,255,255,0.30)" stroke-width="1"/>
        </pattern>
      `;
      svg.prepend(defs);
    };
    // Try immediately and also on any layer add
    tryInject();
    map.on('layeradd', tryInject);
    return () => map.off('layeradd', tryInject);
  }, [map]);
  return null;
}

// ─── Quality helpers ──────────────────────────────────────────────────────────
// Returns a quality level 0–3 based on coverage (% of stations with known status)
// 0 = no data, 1 = very low (<20%), 2 = low (20–50%), 3 = sufficient (≥50%)
function qualityLevel(rStats) {
  if (!rStats || rStats.total === 0) return 0;
  const unknown = rStats.unknown || 0;
  const known = rStats.total - unknown;
  if (known === 0) return 0;
  const cov = known / rStats.total;
  if (cov < 0.2) return 1;
  if (cov < 0.5) return 2;
  return 3;
}

function hatchId(level) {
  if (level === 1) return 'url(#hatch-dense)';
  if (level === 2) return 'url(#hatch-medium)';
  if (level === 3) return 'url(#hatch-sparse)'; // barely visible on good data
  return null;
}

function getCoverage(rStats) {
  if (!rStats || rStats.total === 0) return 0;
  return 1 - (rStats.unknown || 0) / rStats.total;
}

function getScore(rStats) {
  if (!rStats || rStats.total === 0) return -1;
  const known = rStats.total - (rStats.unknown || 0);
  if (known === 0) return -1;
  return ((rStats.no || 0) + (rStats.queue || 0) * 0.5) / known;
}

function scoreToColor(score) {
  if (score === -1) return '#1e293b';
  if (score < 0.05) return '#10b981';
  if (score < 0.2)  return '#34d399';
  if (score < 0.35) return '#fbbf24';
  if (score < 0.55) return '#f97316';
  return '#ef4444';
}

// ─── Component ────────────────────────────────────────────────────────────────
const ChoroplethMap = ({ stats, onRegionClick, lang = 'ru' }) => {
  const [geoJson, setGeoJson] = useState(null);
  const hatchLayerRef = useRef(null);

  useEffect(() => {
    axios.get('/russia.geojson').then(res => setGeoJson(res.data)).catch(console.error);
  }, []);

  const getRS = (name) => stats?.regions?.[name] || null;

  const baseStyle = (feature) => {
    const rStats = getRS(feature.properties.name);
    const score = getScore(rStats);
    const ql = qualityLevel(rStats);
    const cov = getCoverage(rStats);
    // Good data regions: fully opaque. Lower data: slightly dimmer but still colored
    const opacity = score === -1 ? 0.3 : 0.4 + cov * 0.5;
    return {
      fillColor: scoreToColor(score),
      fillOpacity: opacity,
      weight: 1,
      color: 'rgba(30,41,59,0.7)',
      opacity: 1,
    };
  };

  // Overlay style: transparent fill with hatch pattern for low-data regions
  const overlayStyle = (feature) => {
    const rStats = getRS(feature.properties.name);
    const ql = qualityLevel(rStats);
    const pattern = hatchId(ql);
    if (!pattern || ql === 3) return { fillOpacity: 0, weight: 0, opacity: 0 };
    return {
      fillColor: pattern,
      fillOpacity: 1,
      weight: ql < 2 ? 1.5 : 1,
      color: ql === 1 ? 'rgba(251,191,36,0.6)' : 'rgba(100,116,139,0.4)',
      opacity: 1,
      dashArray: null,
    };
  };

  const buildTooltip = (name, rStats) => {
    if (!rStats || rStats.total === 0) {
      return `<div style="font-family:Inter,sans-serif;padding:4px"><b>${name}</b><br/><span style="color:#64748b">${lang === 'en' ? 'No data' : 'Нет данных'}</span></div>`;
    }
    const known = rStats.total - (rStats.unknown || 0);
    const yesP = known > 0 ? Math.round((rStats.yes || 0) / known * 100) : 0;
    const noP  = known > 0 ? Math.round((rStats.no  || 0) / known * 100) : 0;
    const covPct = Math.round(getCoverage(rStats) * 100);
    const ql = qualityLevel(rStats);
    const qualBadge = ql >= 3
      ? `<span style="color:#10b981;font-size:11px">✔ ${lang === 'en' ? 'Sufficient data' : 'Данных достаточно'}</span>`
      : ql === 2
        ? `<span style="color:#f59e0b;font-size:11px">〰 ${lang === 'en' ? `Low data (${covPct}% coverage)` : `Мало данных (${covPct}% охват)`}</span>`
        : `<span style="color:#ef4444;font-size:11px">⚠ ${lang === 'en' ? `Very low data (${covPct}% coverage)` : `Очень мало данных (${covPct}% охват)`}</span>`;
    return `<div style="font-family:Inter,sans-serif;min-width:190px;padding:4px">
      <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:5px">${name}</div>
      <div style="color:#334155;font-size:12px;margin-bottom:3px">${lang === 'en' ? 'Total' : 'Всего'}: <b>${rStats.total}</b> | ${lang === 'en' ? 'Known' : 'Известно'}: <b>${known}</b></div>
      <div style="color:#10b981;font-size:12px">✔ ${lang === 'en' ? 'Fuel OK' : 'Есть'}: ${rStats.yes||0} (${yesP}%)</div>
      <div style="color:#ef4444;font-size:12px">✘ ${lang === 'en' ? 'No fuel' : 'Нет'}: ${rStats.no||0} (${noP}%)</div>
      <div style="color:#f59e0b;font-size:12px">⏳ ${lang === 'en' ? 'Queue' : 'Очереди'}: ${rStats.queue||0}</div>
      <div style="margin-top:5px">${qualBadge}</div>
      ${onRegionClick ? `<div style="color:#3b82f6;font-size:11px;margin-top:3px">${lang === 'en' ? 'Click for details →' : 'Нажмите для деталей →'}</div>` : ''}
    </div>`;
  };

  const onEachBase = (feature, layer) => {
    const name = feature.properties.name;
    const rStats = getRS(name);
    layer.bindTooltip(buildTooltip(name, rStats), { sticky: true });
    const bs = baseStyle(feature);
    layer.on({
      mouseover: e => e.target.setStyle({ fillOpacity: Math.min(1, (bs.fillOpacity||0.5) + 0.2), weight: 2, color: 'rgba(255,255,255,0.4)' }),
      mouseout:  e => e.target.setStyle(bs),
      click: () => onRegionClick && onRegionClick(name),
    });
  };

  const onEachOverlay = (feature, layer) => {
    const name = feature.properties.name;
    const rStats = getRS(name);
    layer.bindTooltip(buildTooltip(name, rStats), { sticky: true });
    layer.on({ click: () => onRegionClick && onRegionClick(name) });
  };

  const LEGEND = [
    { color: '#10b981', label: lang === 'en' ? '<5% no fuel' : '<5% нет топлива' },
    { color: '#34d399', label: '5–20%' },
    { color: '#fbbf24', label: '20–35%' },
    { color: '#f97316', label: '35–55%' },
    { color: '#ef4444', label: lang === 'en' ? '>55% (critical)' : '>55% (критично)' },
    { color: '#1e293b', border: '1px solid #334155', label: lang === 'en' ? 'No data' : 'Нет данных' },
  ];

  const HATCH_LEGEND = [
    { pattern: 'dense', label: lang === 'en' ? '<20% coverage (very low)' : '<20% охват (очень мало)' },
    { pattern: 'medium', label: lang === 'en' ? '20–50% coverage (low)' : '20–50% охват (мало)' },
    { pattern: 'sufficient', label: lang === 'en' ? '≥50% coverage (OK)' : '≥50% охват (достаточно)' },
  ];

  return (
    <div className="map-container" style={{ height: '100%', width: '100%', minHeight: '450px', position: 'relative' }}>
      {/* Legend */}
      <div style={{
        position: 'absolute', zIndex: 1000, bottom: '24px', left: '16px',
        background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px',
        padding: '10px 14px', fontSize: '12px', color: '#f8fafc', pointerEvents: 'none',
        maxWidth: '210px'
      }}>
        <div style={{ fontWeight: 700, marginBottom: '7px', color: '#e2e8f0' }}>{lang === 'en' ? '% stations no fuel' : '% АЗС без топлива'}</div>
        {LEGEND.map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
            <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: l.color, border: l.border || 'none', flexShrink: 0 }} />
            <span style={{ color: '#94a3b8', fontSize: '11px' }}>{l.label}</span>
          </div>
        ))}
        <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '6px', fontWeight: 600, color: '#e2e8f0', marginBottom: '5px' }}>
          {lang === 'en' ? 'Data coverage' : 'Охват данных'}
        </div>
        {/* Dense hatch swatch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
          <svg width="14" height="14" style={{ flexShrink: 0 }}>
            <defs>
              <pattern id="leg-dense" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
                <rect width="4" height="4" fill="#1e3a5f"/>
                <line x1="2" y1="0" x2="2" y2="4" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5"/>
                <line x1="0" y1="2" x2="4" y2="2" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8"/>
              </pattern>
            </defs>
            <rect width="14" height="14" fill="url(#leg-dense)" rx="2"/>
          </svg>
          <span style={{ color: '#94a3b8', fontSize: '11px' }}>{lang === 'en' ? '<20% (very low)' : '<20% (очень мало)'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
          <svg width="14" height="14" style={{ flexShrink: 0 }}>
            <defs>
              <pattern id="leg-medium" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="#1e3a5f"/>
                <line x1="3" y1="0" x2="3" y2="6" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5"/>
              </pattern>
            </defs>
            <rect width="14" height="14" fill="url(#leg-medium)" rx="2"/>
          </svg>
          <span style={{ color: '#94a3b8', fontSize: '11px' }}>{lang === 'en' ? '20–50% (low)' : '20–50% (мало)'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '14px', height: '14px', borderRadius: '2px', background: '#10b981', flexShrink: 0 }} />
          <span style={{ color: '#94a3b8', fontSize: '11px' }}>{lang === 'en' ? '≥50% (OK)' : '≥50% (достаточно)'}</span>
        </div>
      </div>

      {!geoJson && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ color: '#94a3b8' }}>{lang === 'en' ? 'Loading map...' : 'Загрузка карты...'}</div>
        </div>
      )}

      <MapContainer
        center={[61.5, 95.0]} zoom={3}
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
        zoomControl={true}
      >
        <InjectDefs />
        {geoJson && (
          <>
            {/* Base layer: status colors */}
            <GeoJSON
              key={`base-${JSON.stringify(stats?.regions)}`}
              data={geoJson}
              style={baseStyle}
              onEachFeature={onEachBase}
            />
            {/* Overlay layer: hatch patterns for low-data regions */}
            <GeoJSON
              key={`overlay-${JSON.stringify(stats?.regions)}`}
              data={geoJson}
              style={overlayStyle}
              onEachFeature={onEachOverlay}
              interactive={false}
            />
          </>
        )}
      </MapContainer>
    </div>
  );
};

export default ChoroplethMap;
