import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import ChoroplethMap from './components/Map';
import CityMap from './components/CityMap';
import Stats from './components/Stats';
import { Filters } from './components/Filters';
import { Fuel } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

// Priority regions always shown first in the dropdown
const PINNED_REGIONS = {
  'russia':       { name: 'Вся Россия',          lat: 61.524,  lon: 105.318 },
  'spb':          { name: 'Санкт-Петербург',      lat: 59.9343, lon: 30.3351 },
  'msk':          { name: 'Москва',               lat: 55.7558, lon: 37.6173 },
  'crimea':       { name: 'Республика Крым',      lat: 45.2828, lon: 34.2081 },
  'sevastopol':   { name: 'Севастополь',          lat: 44.6166, lon: 33.5254 },
  'dpr':          { name: 'ДНР',                  lat: 48.0159, lon: 37.8028 },
  'lpr':          { name: 'ЛНР',                  lat: 48.574,  lon: 39.3078 },
  'zaporizhzhia': { name: 'Запорожская область',  lat: 47.1685, lon: 35.6989 },
  'kherson':      { name: 'Херсонская область',   lat: 46.5445, lon: 33.3934 },
};

function App() {
  const [stats, setStats] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cityMap, setCityMap] = useState(PINNED_REGIONS);
  const [regionBounds, setRegionBounds] = useState({}); // name -> bounds from geojson
  const [filters, setFilters] = useState({ city: 'russia', brand: [], fuel: [] });

  // Load region list
  useEffect(() => {
    axios.get(`${API_URL}/regions`).then(res => {
      const fetched = [...res.data].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      const newMap = { ...PINNED_REGIONS };
      const boundsMap = {};
      fetched.forEach((r, i) => {
        boundsMap[r.name] = r.bounds;
        const exists = Object.values(PINNED_REGIONS).some(p => p.name === r.name);
        if (!exists) {
          newMap[`region_${i}`] = { name: r.name, lat: r.lat, lon: r.lon };
        } else {
          // Update lat/lon from computed centroid
          const key = Object.keys(PINNED_REGIONS).find(k => PINNED_REGIONS[k].name === r.name);
          if (key) newMap[key] = { ...newMap[key], lat: r.lat, lon: r.lon };
        }
      });
      setCityMap(newMap);
      setRegionBounds(boundsMap);
    }).catch(console.error);
  }, []);

  // Fetch stats
  useEffect(() => {
    const city = cityMap[filters.city];
    if (!city) return;
    setLoading(true);
    setStats(null);
    setConfidence(null);

    const params = new URLSearchParams();
    const regionName = city.name;
    if (regionName !== 'Вся Россия') params.append('region', regionName);
    (filters.brand || []).forEach(b => params.append('brand', b));
    (filters.fuel || []).forEach(f => params.append('fuel', f));

    axios.get(`${API_URL}/stats?${params.toString()}`)
      .then(res => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));

    // Fetch confidence separately (it makes external requests)
    if (regionName !== 'Вся Россия') {
      axios.get(`${API_URL}/confidence?${params.toString()}`)
        .then(res => setConfidence(res.data))
        .catch(console.error);
    }
  }, [filters, cityMap]);

  // Handle click on map region
  const handleRegionClick = useCallback((regionName) => {
    // Find key in cityMap
    const key = Object.keys(cityMap).find(k => cityMap[k].name === regionName);
    if (key) {
      setFilters(prev => ({ ...prev, city: key, brand: [], fuel: [] }));
    }
  }, [cityMap]);

  const isRussia = filters.city === 'russia';
  const regionName = cityMap[filters.city]?.name;
  const currentBounds = regionBounds[regionName];

  return (
    <div className="app-container">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', padding: '10px', borderRadius: '12px' }}>
            <Fuel color="white" size={24} />
          </div>
          <div>
            <h1>GdeBenz Dashboard</h1>
            {!isRussia && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
              <button
                onClick={() => setFilters(prev => ({ ...prev, city: 'russia' }))}
                style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '13px', padding: 0 }}
              >
                ← Вся Россия
              </button>
              {' / '}
              <span style={{ color: '#94a3b8' }}>{regionName}</span>
            </div>}
          </div>
        </div>
        <div style={{ color: '#94a3b8', fontSize: '14px' }}>
          Сбор данных: <b style={{ color: '#10b981' }}>Активен</b>
        </div>
      </header>

      <main className="main-content">
        {/* Sidebar */}
        <aside className="sidebar">
          <Filters filters={filters} setFilters={setFilters} cities={cityMap} />
        </aside>

        {/* Main area */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0, overflow: 'auto' }}>
          {isRussia ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 430px', gap: '16px', flex: 1, minHeight: '500px' }}>
              <ChoroplethMap stats={stats} onRegionClick={handleRegionClick} />
              <div style={{ overflowY: 'auto' }}>
                <Stats stats={stats} loading={loading} isFullPage={false} regionName="Вся Россия" confidence={null} />
              </div>
            </div>
          ) : (
            /* Region mode: Stats left + CityMap right, side by side */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '16px', minHeight: 0 }}>
              <div style={{ overflow: 'auto', minHeight: 0 }}>
                <Stats stats={stats} loading={loading} isFullPage={true} regionName={regionName} confidence={confidence} />
              </div>
              <div style={{ minHeight: '600px' }}>
                <CityMap regionName={regionName} filters={filters} bounds={currentBounds} />
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
