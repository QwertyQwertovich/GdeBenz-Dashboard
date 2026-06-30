import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const Filters = ({ filters, setFilters, cities, lang }) => {
  const [brands, setBrands] = useState([]);
  const [fuels, setFuels] = useState([]);

  const currentRegion = cities[filters.city]?.name;

  useEffect(() => {
    const rp = currentRegion && currentRegion !== 'Вся Россия' ? `?region=${encodeURIComponent(currentRegion)}` : '';
    axios.get(`${API_URL}/brands${rp}`).then(res => setBrands(res.data)).catch(console.error);
    axios.get(`${API_URL}/fuels${rp}`).then(res => setFuels(res.data)).catch(console.error);
  }, [filters.city]);

  const handleCityChange = (e) => {
    setFilters(prev => ({ ...prev, city: e.target.value, brand: [], fuel: [] }));
  };

  const toggleBrand = (brand) => {
    setFilters(prev => {
      const cur = prev.brand || [];
      return { ...prev, brand: cur.includes(brand) ? cur.filter(b => b !== brand) : [...cur, brand] };
    });
  };

  const handleFuelChange = (e) => {
    setFilters(prev => ({ ...prev, fuel: e.target.value ? [e.target.value] : [] }));
  };

  const selectedBrands = filters.brand || [];

  return (
    <div className="glass-panel" style={{ marginBottom: '0' }}>
      {/* Region selector */}
      <div className="filter-group">
        <label>{lang === 'en' ? 'Region / City' : 'Регион / Город'}</label>
        <select value={filters.city} onChange={handleCityChange}>
          {Object.entries(cities || {}).map(([key, c]) => (
            <option key={key} value={key}>{lang === 'en' ? (c.enName || c.name) : c.name}</option>
          ))}
        </select>
      </div>

      {/* Fuel selector */}
      <div className="filter-group">
        <label>{lang === 'en' ? 'Fuel type' : 'Вид топлива'}</label>
        <select value={filters.fuel?.[0] || ''} onChange={handleFuelChange}>
          <option value="">{lang === 'en' ? 'Any' : 'Любое'}</option>
          {fuels.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {/* Brand multi-select */}
      <div className="filter-group" style={{ marginBottom: 0 }}>
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            {lang === 'en' ? 'Gas Station Brand' : 'Бренд АЗС'}
            {selectedBrands.length > 0 && <span style={{ color: '#3b82f6', marginLeft: '5px' }}>({selectedBrands.length})</span>}
          </span>
          {selectedBrands.length > 0 && (
            <button
              onClick={() => setFilters(prev => ({ ...prev, brand: [] }))}
              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '11px', cursor: 'pointer', padding: 0 }}
            >
              {lang === 'en' ? 'Reset' : 'Сбросить'}
            </button>
          )}
        </label>
        <div style={{
          overflowY: 'auto',
          background: 'rgba(15,23,42,0.6)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '6px'
        }}>
          {brands.length === 0 && (
            <div style={{ padding: '8px', color: '#475569', fontSize: '12px', textAlign: 'center' }}>
              {lang === 'en' ? 'Loading...' : 'Загрузка...'}
            </div>
          )}
          {brands.map(b => (
            <div
              key={b.name}
              onClick={() => toggleBrand(b.name)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '5px 8px', cursor: 'pointer', borderRadius: '5px',
                background: selectedBrands.includes(b.name) ? 'rgba(59,130,246,0.15)' : 'transparent',
                transition: 'background 0.12s', userSelect: 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <input
                  type="checkbox"
                  readOnly
                  checked={selectedBrands.includes(b.name)}
                  style={{ accentColor: '#3b82f6', flexShrink: 0, pointerEvents: 'none' }}
                />
                <span style={{ fontSize: '13px', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.name}
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', flexShrink: 0, marginLeft: '6px' }}>{b.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export { Filters };
