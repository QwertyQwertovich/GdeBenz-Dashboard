import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';

// Inject SVG hatch pattern into leaflet pane after mount
function HatchPatternDef() {
  const map = useMap();
  useEffect(() => {
    const svg = map.getPanes().overlayPane?.querySelector('svg');
    if (!svg) return;
    const existingDefs = svg.querySelector('defs');
    const defs = existingDefs || document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <pattern id="hatch-low" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,0.18)" stroke-width="2"/>
      </pattern>
    `;
    if (!existingDefs) svg.prepend(defs);
  }, [map]);
  return null;
}

const ChoroplethMap = ({ stats, onRegionClick }) => {
  const [geoJson, setGeoJson] = useState(null);

  useEffect(() => {
    axios.get('/russia.geojson').then(res => setGeoJson(res.data)).catch(console.error);
  }, []);

  const getRegionStats = (name) => stats?.regions?.[name] || null;

  const getRegionScore = (rStats) => {
    if (!rStats || rStats.total === 0) return -1;
    const known = rStats.total - (rStats.unknown || 0);
    if (known === 0) return -1;
    const bad = (rStats.no || 0) + (rStats.queue || 0) * 0.5;
    return bad / known;
  };

  // Coverage: % of stations with a known status
  const getCoverage = (rStats) => {
    if (!rStats || rStats.total === 0) return 0;
    return 1 - (rStats.unknown || 0) / rStats.total;
  };

  // Data quality: coverage >= 50% counts as "enough data"
  // We use total stations as proxy for report count (more stations = more active area)
  // Threshold: total known >= 10 AND coverage >= 50%
  const hasEnoughData = (rStats) => {
    if (!rStats || rStats.total === 0) return false;
    const known = rStats.total - (rStats.unknown || 0);
    const coverage = getCoverage(rStats);
    return known >= 10 && coverage >= 0.5;
  };

  const scoreToColor = (score) => {
    if (score === -1) return '#1e293b';
    if (score < 0.05) return '#10b981';
    if (score < 0.2)  return '#34d399';
    if (score < 0.35) return '#fbbf24';
    if (score < 0.55) return '#f97316';
    return '#ef4444';
  };

  const buildTooltip = (name, rStats) => {
    if (!rStats || rStats.total === 0) {
      return `<div style="font-family:Inter,sans-serif;padding:4px"><b>${name}</b><br/><span style="color:#64748b">Нет данных</span></div>`;
    }
    const known = rStats.total - (rStats.unknown || 0);
    const yesP = known > 0 ? Math.round((rStats.yes || 0) / known * 100) : 0;
    const noP  = known > 0 ? Math.round((rStats.no  || 0) / known * 100) : 0;
    const covPct = Math.round(getCoverage(rStats) * 100);
    const enough = hasEnoughData(rStats);
    const qualityBadge = enough
      ? `<span style="color:#10b981;font-size:11px">✔ Данных достаточно</span>`
      : `<span style="color:#f59e0b;font-size:11px">⚠ Мало данных (охват ${covPct}%)</span>`;
    return `<div style="font-family:Inter,sans-serif;min-width:180px;padding:4px">
      <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:5px">${name}</div>
      <div style="color:#334155;font-size:12px;margin-bottom:3px">Всего АЗС: <b>${rStats.total}</b> | Известно: <b>${known}</b></div>
      <div style="color:#10b981;font-size:12px">✔ Есть: ${rStats.yes||0} (${yesP}%)</div>
      <div style="color:#ef4444;font-size:12px">✘ Нет: ${rStats.no||0} (${noP}%)</div>
      <div style="color:#f59e0b;font-size:12px">⏳ Очереди: ${rStats.queue||0}</div>
      <div style="margin-top:5px">${qualityBadge}</div>
      ${onRegionClick ? '<div style="color:#3b82f6;font-size:11px;margin-top:3px">Нажмите для деталей →</div>' : ''}
    </div>`;
  };

  const geoStyle = (feature) => {
    const rStats = getRegionStats(feature.properties.name);
    const score = getRegionScore(rStats);
    const enough = hasEnoughData(rStats);
    const coverage = getCoverage(rStats);

    // If no data at all → very dark
    if (score === -1) {
      return { fillColor: '#1e293b', fillOpacity: 0.4, weight: 1, color: 'rgba(100,116,139,0.4)', opacity: 1 };
    }

    const baseColor = scoreToColor(score);

    // Low data: dimmer (lower opacity) — clear visual that this region's data is uncertain
    const opacity = enough ? 0.82 : 0.28 + coverage * 0.3;

    return {
      fillColor: baseColor,
      fillOpacity: opacity,
      weight: enough ? 1 : 1.5,
      color: enough ? 'rgba(15,23,42,0.5)' : 'rgba(251,191,36,0.5)', // yellow border when low data
      opacity: 1,
      dashArray: enough ? null : '4 4', // dashed border = low data
    };
  };

  const onEachFeature = (feature, layer) => {
    const name = feature.properties.name;
    const rStats = getRegionStats(name);
    layer.bindTooltip(buildTooltip(name, rStats), { sticky: true });
    const baseStyle = geoStyle(feature);
    layer.on({
      mouseover: e => e.target.setStyle({
        fillOpacity: Math.min(1, (baseStyle.fillOpacity || 0.5) + 0.25),
        weight: 2,
        color: 'rgba(255,255,255,0.5)',
        dashArray: null,
      }),
      mouseout: e => e.target.setStyle(baseStyle),
      click: () => onRegionClick && onRegionClick(name)
    });
  };

  const LEGEND = [
    { color: '#10b981', label: '<5% нет топлива' },
    { color: '#34d399', label: '5–20%' },
    { color: '#fbbf24', label: '20–35%' },
    { color: '#f97316', label: '35–55%' },
    { color: '#ef4444', label: '>55% (критично)' },
    { color: '#1e293b', border: '1px solid #334155', label: 'Нет данных' },
  ];

  return (
    <div className="map-container" style={{ height: '100%', width: '100%', minHeight: '450px', position: 'relative' }}>
      {/* Legend */}
      <div style={{
        position: 'absolute', zIndex: 1000, bottom: '24px', left: '16px',
        background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px',
        padding: '10px 14px', fontSize: '12px', color: '#f8fafc', pointerEvents: 'none'
      }}>
        <div style={{ fontWeight: 700, marginBottom: '7px', color: '#e2e8f0' }}>% АЗС без топлива</div>
        {LEGEND.map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
            <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: l.color, border: l.border || 'none', flexShrink: 0 }} />
            <span style={{ color: '#94a3b8' }}>{l.label}</span>
          </div>
        ))}
        <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
            <div style={{ width: '14px', height: '8px', borderRadius: '2px', border: '1.5px dashed rgba(251,191,36,0.7)', background: 'transparent', flexShrink: 0 }} />
            <span style={{ color: '#94a3b8', fontSize: '11px' }}>Мало данных (&lt;50% охват)</span>
          </div>
          <div style={{ color: '#475569', fontSize: '11px', marginTop: '2px' }}>
            Яркость = полнота данных
          </div>
        </div>
      </div>

      {!geoJson && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ color: '#94a3b8' }}>Загрузка карты...</div>
        </div>
      )}

      <MapContainer
        center={[61.5, 95.0]} zoom={3}
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
        zoomControl={true}
      >
        {geoJson && (
          <GeoJSON
            key={JSON.stringify(stats?.regions)}
            data={geoJson}
            style={geoStyle}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default ChoroplethMap;
