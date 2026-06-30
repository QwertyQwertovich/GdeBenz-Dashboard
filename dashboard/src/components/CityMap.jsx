import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const STATUS_COLORS = {
  yes: '#10b981', low: '#facc15', queue: '#f59e0b', no: '#ef4444', unknown: '#475569'
};
const STATUS_LABELS = {
  yes: 'Есть топливо', low: 'Заканчивается', queue: 'Очередь', no: 'Нет топлива', unknown: 'Нет данных'
};

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
  }, [bounds, map]);
  return null;
}

const CityMap = ({ regionName, filters, bounds }) => {
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
          {loading ? 'Загрузка...' : `Карта АЗС: ${stations.length}`}
        </span>
        {/* Mini legend */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {['yes', 'low', 'queue', 'no'].map(k => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: STATUS_COLORS[k] }} />
              <span style={{ fontSize: '10px', color: '#64748b' }}>{STATUS_LABELS[k]}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <MapContainer
          key={regionName}
          center={center}
          zoom={7}
          style={{ height: '100%', width: '100%', minHeight: '380px', background: '#0f172a' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; CARTO'
          />
          {bounds && <BoundsUpdater bounds={bounds} />}
          {stations.map(s => (
            <CircleMarker
              key={s.id}
              center={[s.lat, s.lon]}
              radius={5}
              pathOptions={{
                color: STATUS_COLORS[s.status] || STATUS_COLORS.unknown,
                fillColor: STATUS_COLORS[s.status] || STATUS_COLORS.unknown,
                fillOpacity: 0.85, weight: 1
              }}
            >
              <Tooltip>
                <div style={{ fontSize: '12px', color: '#0f172a' }}>
                  <b>{s.brand || 'Неизвестно'}</b><br />
                  {STATUS_LABELS[s.status] || 'Нет данных'}
                  {s.fuels_now && <><br /><span>Топливо: {s.fuels_now}</span></>}
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
