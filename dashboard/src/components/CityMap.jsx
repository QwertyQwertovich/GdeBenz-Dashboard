import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';

const API_URL = import.meta.env.PROD ? "/api" : "http://localhost:5000/api";

const STATUS_COLORS = {
  yes: '#10b981', low: '#facc15', queue: '#f59e0b', no: '#ef4444', unknown: '#475569'
};
const STATUS_LABELS_RU = {
  yes: 'Есть топливо', low: 'Мало топлива', queue: 'Очередь', no: 'Нет топлива', unknown: 'Нет данных'
};
const STATUS_LABELS_EN = {
  yes: 'Fuel OK', low: 'Low fuel', queue: 'Queue', no: 'No fuel', unknown: 'No data'
};
const getStatusLabels = (lang) => lang === 'en' ? STATUS_LABELS_EN : STATUS_LABELS_RU;

// Component to fit the map to bounds when they change
function BoundsUpdater({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      try {
        map.fitBounds([
          [bounds.minLat, bounds.minLon],
          [bounds.maxLat, bounds.maxLon]
        ], { padding: [30, 30], maxZoom: 10 });
      } catch(e) {}
    }
    setTimeout(() => { map.invalidateSize(); }, 300);
  }, [bounds, map]);
  
  // Observe container resizes to fix Leaflet rendering bugs (e.g. missing tiles)
  useEffect(() => {
    if (!map.getContainer()) return;
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  return null;
}


const StatusCheckbox = ({ checked, onChange, label, color }) => (
  <div onClick={() => onChange(!checked)} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
    <div style={{
      width: '14px', height: '14px', borderRadius: '50%',
      border: checked ? 'none' : `1px solid ${color}80`,
      background: checked ? color : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.2s ease',
      opacity: checked ? 1 : 0.5
    }}>
      {checked && (
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />
      )}
    </div>
    <span style={{ fontSize: '11px', color: checked ? '#e2e8f0' : '#64748b', transition: 'color 0.2s ease', whiteSpace: 'nowrap' }}>{label}</span>
  </div>
);

const CityMap = ({ regionName, filters, bounds, lang, timeAt }) => {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mapStyle, setMapStyle] = useState('dark');
  const [visibleStatuses, setVisibleStatuses] = useState({ yes: true, low: true, queue: true, no: true, unknown: true });
  const labels = getStatusLabels(lang);

  useEffect(() => {
    if (!regionName || regionName === 'Вся Россия') return;
    setLoading(true);
    const params = new URLSearchParams({ region: regionName });
    (filters.brand || []).forEach(b => params.append('brand', b));
    (filters.fuel || []).forEach(f => params.append('fuel', f));
    if (timeAt) params.append('time_at', timeAt);
    axios.get(`${API_URL}/stations_map?${params.toString()}`)
      .then(res => setStations(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [regionName, filters, timeAt]);

  if (!regionName || regionName === 'Вся Россия') return null;

  // Initial center from bounds or fallback
  let center = [55.75, 37.62];
  if (bounds) {
    center = [(bounds.minLat + bounds.maxLat) / 2, (bounds.minLon + bounds.maxLon) / 2];
  } else if (stations.length > 0) {
    const lats = stations.map(s => s.lat).filter(Boolean);
    const lons = stations.map(s => s.lon).filter(Boolean);
    if (lats.length) center = [
      lats.reduce((a, b) => a + b) / lats.length,
      lons.reduce((a, b) => a + b) / lons.length
    ];
  }

  return (
    <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', position: 'relative', height: '100%', minHeight: '580px', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', background: 'rgba(15,23,42,0.9)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
      }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
          {loading ? (lang === 'en' ? 'Loading...' : 'Загрузка...') : (lang === 'en' ? `Gas Stations: ${stations.length}` : `Карта АЗС: ${stations.length}`)}
        </span>
        {/* Mini legend */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            onClick={() => setMapStyle(prev => prev === 'dark' ? 'light' : 'dark')}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '4px',
              background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.5)', 
              color: '#60a5fa', padding: '4px 8px', borderRadius: '6px', 
              fontSize: '11px', cursor: 'pointer', marginRight: '10px',
              transition: 'all 0.2s', fontWeight: 500
            }}
          >
            {mapStyle === 'dark' ? (lang === 'en' ? '☀️ Light map' : '☀️ Светлая карта') : (lang === 'en' ? '🌙 Dark map' : '🌙 Темная карта')}
          </button>
          {['yes', 'low', 'queue', 'no'].map(k => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ 
                width: '8px', height: '8px', borderRadius: '50%', 
                background: k === 'low' ? 'linear-gradient(90deg, #facc15 50%, #10b981 50%)' : STATUS_COLORS[k] 
              }} />
              <span style={{ fontSize: '10px', color: '#64748b' }}>{labels[k]}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            <linearGradient id="half-low" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="50%" stopColor="#facc15" />
              <stop offset="50%" stopColor="#10b981" />
            </linearGradient>
          </defs>
        </svg>
        <MapContainer
          key={regionName}
          center={center}
          zoom={7}
          style={{ height: '100%', width: '100%', minHeight: '380px', background: '#0f172a' }}
          attributionControl={false}
        >
          <TileLayer
            url={mapStyle === 'light' 
              ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            }
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          {bounds && <BoundsUpdater bounds={bounds} />}
          {stations.map(s => (
            <CircleMarker
              key={s.id}
              center={[s.lat, s.lon]}
              radius={5}
              pathOptions={{
                color: STATUS_COLORS[s.status] || STATUS_COLORS.unknown,
                fillColor: s.status === 'low' ? 'url(#half-low)' : (STATUS_COLORS[s.status] || STATUS_COLORS.unknown),
                fillOpacity: 0.85, weight: 1
              }}
            >
              <Tooltip>
                <div style={{ fontSize: '12px', color: '#0f172a' }}>
                  <b>{s.brand || (lang === 'en' ? 'Unknown' : 'Неизвестно')}</b><br />
                  {labels[s.status] || (lang === 'en' ? 'No data' : 'Нет данных')}
                  {s.fuels_now && <><br /><span>{lang === 'en' ? 'Fuel:' : 'Топливо:'} {s.fuels_now}</span></>}
                </div>
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default CityMap;
