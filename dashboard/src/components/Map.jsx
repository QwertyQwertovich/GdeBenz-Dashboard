import React, { useEffect, useState } from 'react';
import { MapContainer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';

// Allows clicking a region on the map to select it
const RegionClickHandler = ({ onRegionClick }) => {
  return null; // handled via onEachFeature
};

const ChoroplethMap = ({ stats, onRegionClick }) => {
  const [geoJson, setGeoJson] = useState(null);

  useEffect(() => {
    axios.get('/russia.geojson').then(res => setGeoJson(res.data)).catch(console.error);
  }, []);

  if (!geoJson || !stats || !stats.regions) {
    return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Загрузка карты...</div>;
  }

  const getRegionScore = (regionName) => {
    const rStats = stats.regions[regionName];
    if (!rStats || rStats.total === 0) return -1;
    const badCount = (rStats.no || 0) + (rStats.queue || 0) * 0.5;
    return badCount / rStats.total;
  };

  const getColor = (score) => {
    if (score === -1) return '#1e293b';
    if (score < 0.05) return '#10b981';
    if (score < 0.2) return '#34d399';
    if (score < 0.35) return '#fbbf24';
    if (score < 0.55) return '#f97316';
    return '#ef4444';
  };

  const style = (feature) => {
    const score = getRegionScore(feature.properties.name);
    return {
      fillColor: getColor(score),
      weight: 1,
      opacity: 1,
      color: 'rgba(15,23,42,0.6)',
      fillOpacity: 0.75
    };
  };

  const onEachFeature = (feature, layer) => {
    const regionName = feature.properties.name;
    const rStats = stats.regions[regionName];

    let html = `<b style="color:#0f172a">${regionName}</b><br/><span style="color:#64748b">Нет данных</span>`;
    if (rStats && rStats.total > 0) {
      const yesP = ((rStats.yes || 0) / rStats.total * 100).toFixed(0);
      const noP = ((rStats.no || 0) / rStats.total * 100).toFixed(0);
      html = `
        <div style="font-family: Inter, sans-serif; min-width:160px">
          <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:4px">${regionName}</div>
          <div style="color:#334155;font-size:12px">Всего АЗС: <b>${rStats.total}</b></div>
          <div style="color:#10b981;font-size:12px">Топливо: ${rStats.yes || 0} (${yesP}%)</div>
          <div style="color:#ef4444;font-size:12px">Нет: ${rStats.no || 0} (${noP}%)</div>
          <div style="color:#f59e0b;font-size:12px">Очереди: ${rStats.queue || 0}</div>
          ${onRegionClick ? '<div style="color:#3b82f6;font-size:11px;margin-top:4px">Нажмите для деталей →</div>' : ''}
        </div>`;
    }
    layer.bindTooltip(html, { sticky: true });

    if (onRegionClick) {
      layer.on('click', () => onRegionClick(regionName));
    }

    layer.on({
      mouseover: (e) => { e.target.setStyle({ fillOpacity: 1, weight: 2 }); },
      mouseout: (e) => { e.target.setStyle({ fillOpacity: 0.75, weight: 1 }); }
    });
  };

  return (
    <div className="map-container" style={{ height: '100%', width: '100%', minHeight: '400px' }}>
      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: '30px', left: '20px', zIndex: 1000,
        background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
        padding: '10px 14px', fontSize: '12px', color: '#f8fafc'
      }}>
        <div style={{ fontWeight: 600, marginBottom: '6px' }}>Ситуация с топливом</div>
        {[
          { color: '#10b981', label: 'Хорошо (<5% нет)' },
          { color: '#34d399', label: 'Норма (<20%)' },
          { color: '#fbbf24', label: 'Напряжённо (<35%)' },
          { color: '#f97316', label: 'Плохо (<55%)' },
          { color: '#ef4444', label: 'Критично (>55%)' },
          { color: '#1e293b', label: 'Нет данных' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
            <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: l.color, border: '1px solid rgba(255,255,255,0.1)' }} />
            <span style={{ color: '#cbd5e1' }}>{l.label}</span>
          </div>
        ))}
      </div>

      <MapContainer
        center={[61.5, 95.0]}
        zoom={3}
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
        zoomControl={true}
      >
        <GeoJSON key={JSON.stringify(stats.regions)} data={geoJson} style={style} onEachFeature={onEachFeature} />
      </MapContainer>
    </div>
  );
};

export default ChoroplethMap;
