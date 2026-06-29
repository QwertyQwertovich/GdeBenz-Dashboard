import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ChoroplethMap from './components/Map';
import CityMap from './components/CityMap';
import Stats from './components/Stats';
import { Filters } from './components/Filters';
import { Fuel } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

const PINNED_REGIONS = {
  'russia':       { name: 'Вся Россия',          lat: 61.524,  lon: 105.318, radius: 100 },
  'spb':          { name: 'Санкт-Петербург',      lat: 59.9343, lon: 30.3351, radius: 0.5 },
  'msk':          { name: 'Москва',               lat: 55.7558, lon: 37.6173, radius: 0.5 },
  'crimea':       { name: 'Республика Крым',      lat: 45.2828, lon: 34.2081, radius: 1.5 },
  'sevastopol':   { name: 'Севастополь',          lat: 44.6166, lon: 33.5254, radius: 0.5 },
  'dpr':          { name: 'ДНР',                  lat: 48.0159, lon: 37.8028, radius: 1.0 },
  'lpr':          { name: 'ЛНР',                  lat: 48.574,  lon: 39.3078, radius: 1.0 },
  'zaporizhzhia': { name: 'Запорожская область',  lat: 47.1685, lon: 35.6989, radius: 1.5 },
  'kherson':      { name: 'Херсонская область',   lat: 46.5445, lon: 33.3934, radius: 1.5 },
};

function App() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cityMap, setCityMap] = useState(PINNED_REGIONS);
  const [filters, setFilters] = useState({ city: 'russia', brand: [], fuel: [] });

  // Load region list from API
  useEffect(() => {
    axios.get(`${API_URL}/regions`).then(res => {
      const fetched = [...res.data].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      const newMap = { ...PINNED_REGIONS };
      fetched.forEach((r, i) => {
        const exists = Object.values(PINNED_REGIONS).some(p => p.name === r.name);
        if (!exists) {
          newMap[`region_${i}`] = { name: r.name, lat: r.lat, lon: r.lon, radius: Math.max(r.radius, 0.5) };
        }
      });
      setCityMap(newMap);
    }).catch(console.error);
  }, []);

  // Fetch stats whenever filter changes
  useEffect(() => {
    const city = cityMap[filters.city];
    if (!city) return;
    setLoading(true);
    setStats(null);

    const params = new URLSearchParams();
    const regionName = city.name;
    if (regionName !== 'Вся Россия') params.append('region', regionName);
    (filters.brand || []).forEach(b => params.append('brand', b));
    (filters.fuel || []).forEach(f => params.append('fuel', f));

    axios.get(`${API_URL}/stats?${params.toString()}`)
      .then(res => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters, cityMap]);

  const isRussia = filters.city === 'russia';
  const regionName = cityMap[filters.city]?.name;

  return (
    <div className="app-container">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', padding: '10px', borderRadius: '12px' }}>
            <Fuel color="white" size={24} />
          </div>
          <h1>GdeBenz Dashboard</h1>
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
            /* Russia mode: choropleth map + stats side by side */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '16px', flex: 1, minHeight: 0 }}>
              <ChoroplethMap stats={stats} />
              <div style={{ overflowY: 'auto' }}>
                <Stats stats={stats} loading={loading} isFullPage={false} regionName="Вся Россия" />
              </div>
            </div>
          ) : (
            /* City/Region mode: stats on top, station map below */
            <>
              <Stats stats={stats} loading={loading} isFullPage={true} regionName={regionName} />
              <CityMap regionName={regionName} filters={filters} />
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
