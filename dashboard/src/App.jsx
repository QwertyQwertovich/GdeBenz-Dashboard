import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import axios from 'axios';
import ChoroplethMap from './components/Map';
import CityMap from './components/CityMap';
import Stats from './components/Stats';
import { Filters } from './components/Filters';
import TimeSlider from './components/TimeSlider';
import { Fuel } from 'lucide-react';

const API_URL = import.meta.env.PROD ? "/api" : "http://localhost:5000/api";

// ─── i18n ──────────────────────────────────────────────────────────────────
export const LangCtx = createContext({ lang: 'ru', t: k => k });

const STRINGS = {
  ru: {
    title: 'GdeBenz Dashboard',
    allRussia: 'Вся Россия',
    collectStatus: 'Сбор данных:',
    active: 'Активен',
    backToRussia: '← Вся Россия',
    loading: 'Загрузка...',
  },
  en: {
    title: 'GdeBenz Dashboard',
    allRussia: 'All Russia',
    collectStatus: 'Data collection:',
    active: 'Active',
    backToRussia: '← All Russia',
    loading: 'Loading...',
  },
};

const PINNED_REGIONS = {
  'russia':       { name: 'Вся Россия',          enName: 'All Russia',         lat: 61.524,  lon: 105.318 },
  'spb':          { name: 'Санкт-Петербург',      enName: 'St. Petersburg',     lat: 59.9343, lon: 30.3351 },
  'msk':          { name: 'Москва',               enName: 'Moscow',             lat: 55.7558, lon: 37.6173 },
};

function App() {
  const [stats, setStats] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeAt, setTimeAt] = useState(null);
  const [cityMap, setCityMap] = useState(PINNED_REGIONS);
  const [regionBounds, setRegionBounds] = useState({});
  const [filters, setFilters] = useState({ city: 'russia', brand: [], fuel: [] });
  const [lang, setLang] = useState('ru');

  const t = useCallback((key) => STRINGS[lang]?.[key] ?? STRINGS.ru[key] ?? key, [lang]);
  const langCtxValue = { lang, t };

  useEffect(() => {
    axios.get(`${API_URL}/regions`).then(res => {
      const fetched = [...res.data].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      const newMap = { ...PINNED_REGIONS };
      const boundsMap = {};
      fetched.forEach((r, i) => {
        boundsMap[r.name] = r.bounds;
        const exists = Object.values(PINNED_REGIONS).some(p => p.name === r.name);
        if (!exists) {
          newMap[`region_${i}`] = { name: r.name, enName: r.name_latin || r.name, lat: r.lat, lon: r.lon };
        } else {
          const key = Object.keys(PINNED_REGIONS).find(k => PINNED_REGIONS[k].name === r.name);
          if (key) newMap[key] = { ...newMap[key], enName: r.name_latin || newMap[key].enName || r.name, lat: r.lat, lon: r.lon };
        }
      });
      setCityMap(newMap);
      setRegionBounds(boundsMap);
    }).catch(console.error);
  }, []);

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
    if (timeAt) params.append('time_at', timeAt);

    axios.get(`${API_URL}/stats?${params.toString()}`)
      .then(res => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));

    axios.get(`${API_URL}/confidence?${params.toString()}`)
      .then(res => setConfidence(res.data))
      .catch(console.error);
  }, [filters, cityMap, timeAt]);

  const handleRegionClick = useCallback((regionName) => {
    const key = Object.keys(cityMap).find(k => cityMap[k].name === regionName);
    if (key) setFilters(prev => ({ ...prev, city: key, brand: [], fuel: [] }));
  }, [cityMap]);

  const isRussia = filters.city === 'russia';
  const regionName = cityMap[filters.city]?.name;
  const regionDisplayName = lang === 'en' ? (cityMap[filters.city]?.enName || regionName) : regionName;
  const currentBounds = regionBounds[regionName];

  return (
    <LangCtx.Provider value={langCtxValue}>
      <div className="app-container">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', padding: '10px', borderRadius: '12px' }}>
              <Fuel color="white" size={24} />
            </div>
            <div>
              <h1>{t('title')}</h1>
              {!isRussia && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                <button
                  onClick={() => setFilters(prev => ({ ...prev, city: 'russia' }))}
                  style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                >
                  {t('backToRussia')}
                </button>
                {' / '}
                <span style={{ color: '#94a3b8' }}>{regionDisplayName}</span>
              </div>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Language toggle */}
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '3px' }}>
              {['ru', 'en'].map(l => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  style={{
                    background: lang === l ? 'rgba(59,130,246,0.3)' : 'transparent',
                    border: 'none', borderRadius: '5px', color: lang === l ? '#60a5fa' : '#64748b',
                    cursor: 'pointer', fontSize: '12px', fontWeight: 700, padding: '4px 10px',
                    textTransform: 'uppercase', transition: 'all 0.15s'
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '14px' }}>
              {t('collectStatus')} <b style={{ color: '#10b981' }}>{t('active')}</b>
            </div>
          </div>
        </header>

        <main className="main-content">
          <aside className="sidebar">
            <TimeSlider timeAt={timeAt} setTimeAt={setTimeAt} lang={lang} />
            <Filters filters={filters} setFilters={setFilters} cities={cityMap} lang={lang} />
          </aside>

          <section style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0, overflow: 'auto', flex: 1 }}>
            {isRussia ? (
              <div className="map-stats-grid">
                <div style={{ display: 'flex', flexDirection: 'column', minHeight: '400px' }}>
                  <ChoroplethMap stats={stats} onRegionClick={handleRegionClick} lang={lang} cityMap={cityMap} />
                </div>
                <div style={{ overflowY: 'auto' }}>
                  <Stats stats={stats} loading={loading} isFullPage={false}
                    apiRegionName="Вся Россия"
                    displayName={lang === 'en' ? 'All Russia' : 'Вся Россия'}
                    confidence={confidence} lang={lang} />
                </div>
              </div>
            ) : (
              /* Region mode: Stats left, CityMap right (2x) */
              <div className="region-layout-grid">
                <div className="region-stats-col">
                  <Stats stats={stats} loading={loading} isFullPage={true}
                    apiRegionName={regionName}
                    displayName={regionDisplayName}
                    confidence={confidence} lang={lang} />
                </div>
                <div className="region-map-col">
                  <CityMap regionName={regionName} filters={filters} bounds={currentBounds} lang={lang} timeAt={timeAt} />
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </LangCtx.Provider>
  );
}

export default App;
