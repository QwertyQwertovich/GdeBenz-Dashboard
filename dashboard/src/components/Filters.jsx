import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const Filters = ({ filters, setFilters, cities }) => {
  const [brands, setBrands] = useState([]);
  const [fuels, setFuels] = useState([]);

  const currentRegion = cities[filters.city]?.name;

  useEffect(() => {
    // Reload brands and fuels when region changes
    const regionParam = currentRegion && currentRegion !== 'Вся Россия' ? `?region=${encodeURIComponent(currentRegion)}` : '';
    axios.get(`${API_URL}/brands${regionParam}`).then(res => setBrands(res.data)).catch(console.error);
    axios.get(`${API_URL}/fuels${regionParam}`).then(res => setFuels(res.data)).catch(console.error);
  }, [filters.city]);

  const handleCityChange = (e) => {
    setFilters(prev => ({ ...prev, city: e.target.value, brand: [], fuel: [] }));
  };

  const handleBrandChange = (brand) => {
    setFilters(prev => {
      const cur = prev.brand || [];
      if (cur.includes(brand)) return { ...prev, brand: cur.filter(b => b !== brand) };
      return { ...prev, brand: [...cur, brand] };
    });
  };

  const handleFuelChange = (e) => {
    const { value } = e.target;
    setFilters(prev => ({ ...prev, fuel: value ? [value] : [] }));
  };

  const selectedBrands = filters.brand || [];

  return (
    <div className="glass-panel" style={{ marginBottom: '20px' }}>
      <div className="filter-group">
        <label>Регион / Город</label>
        <select value={filters.city} onChange={handleCityChange}>
          {Object.entries(cities || {}).map(([key, c]) => (
            <option key={key} value={key}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label>Вид топлива</label>
        <select value={filters.fuel?.[0] || ''} onChange={handleFuelChange}>
          <option value="">Любое</option>
          {fuels.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label>Бренд АЗС {selectedBrands.length > 0 && <span style={{ color: '#3b82f6' }}>({selectedBrands.length})</span>}</label>
        <div style={{
          maxHeight: '180px', overflowY: 'auto', background: 'rgba(15,23,42,0.6)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px'
        }}>
          {brands.map(b => (
            <label key={b.name} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 6px', cursor: 'pointer', borderRadius: '4px',
              background: selectedBrands.includes(b.name) ? 'rgba(59,130,246,0.15)' : 'transparent',
              transition: 'background 0.15s'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={selectedBrands.includes(b.name)}
                  onChange={() => handleBrandChange(b.name)}
                  style={{ accentColor: '#3b82f6' }}
                />
                <span style={{ fontSize: '13px', color: '#f1f5f9' }}>{b.name}</span>
              </div>
              <span style={{ fontSize: '11px', color: '#64748b' }}>{b.count}</span>
            </label>
          ))}
        </div>
        {selectedBrands.length > 0 && (
          <button
            onClick={() => setFilters(prev => ({ ...prev, brand: [] }))}
            style={{
              marginTop: '6px', width: '100%', padding: '5px', background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
              color: '#94a3b8', fontSize: '12px', cursor: 'pointer'
            }}
          >
            Сбросить выбор
          </button>
        )}
      </div>
    </div>
  );
};

export { Filters };
