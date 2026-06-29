import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const STATUS_COLORS = {
  yes: '#10b981',
  low: '#facc15',
  queue: '#f59e0b',
  no: '#ef4444',
  unknown: '#475569'
};

const STATUS_LABELS = {
  yes: 'Есть топливо',
  low: 'Заканчивается',
  queue: 'Очередь',
  no: 'Нет топлива',
  unknown: 'Нет данных'
};

const CityMap = ({ regionName, filters }) => {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!regionName || regionName === 'Вся Россия') return;
    setLoading(true);
    const params = new URLSearchParams({ region: regionName });
    (filters.brand || []).forEach(b => params.append('brand', b));
    (filters.fuel || []).forEach(f => params.append('fuel', f));
    axios.get(`${API_URL}/stations_map?${params.toString()}`)
      .then(res => setStations(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [regionName, filters]);

  if (!regionName || regionName === 'Вся Россия') return null;

  // Compute rough center from stations
  let center = [55.75, 37.62];
  if (stations.length > 0) {
    const lats = stations.map(s => s.lat).filter(Boolean);
    const lons = stations.map(s => s.lon).filter(Boolean);
    if (lats.length) center = [
      lats.reduce((a, b) => a + b) / lats.length,
      lons.reduce((a, b) => a + b) / lons.length
    ];
  }

  return (
    <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', minHeight: '350px', position: 'relative' }}>
      <div style={{
        position: 'absolute', top: '12px', left: '12px', zIndex: 1000,
        background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
        padding: '6px 12px', fontSize: '13px', fontWeight: 600, color: '#f8fafc'
      }}>
        {loading ? 'Загрузка...' : `АЗС на карте: ${stations.length}`}
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: '20px', left: '12px', zIndex: 1000,
        background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
        padding: '8px 12px', fontSize: '11px', color: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '3px'
      }}>
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: STATUS_COLORS[key] }} />
            <span style={{ color: '#cbd5e1' }}>{label}</span>
          </div>
        ))}
      </div>

      <MapContainer
        key={regionName}
        center={center}
        zoom={8}
        style={{ height: '350px', width: '100%', background: '#0f172a' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        {stations.map(s => (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lon]}
            radius={5}
            pathOptions={{
              color: STATUS_COLORS[s.status] || STATUS_COLORS.unknown,
              fillColor: STATUS_COLORS[s.status] || STATUS_COLORS.unknown,
              fillOpacity: 0.85,
              weight: 1
            }}
          >
            <Tooltip>
              <div style={{ fontSize: '12px' }}>
                <b>{s.brand || 'Неизвестно'}</b><br />
                {STATUS_LABELS[s.status] || 'Нет данных'}<br />
                {s.fuels_now && <span>Топливо: {s.fuels_now}</span>}
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
};

export default CityMap;
