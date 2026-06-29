import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';

const API_URL = 'http://localhost:5000/api';

const STATUS_COLORS = {
  yes: '#10b981',
  low: '#facc15',
  queue: '#f59e0b',
  no: '#ef4444',
  unknown: '#475569'
};

const STATUS_LABELS = {
  yes: 'Топливо есть',
  low: 'Заканчивается',
  queue: 'Очереди',
  no: 'Нет топлива',
  unknown: 'Нет данных'
};

// Compact percentage card matching old screenshot style
const KpiCard = ({ label, value, color }) => (
  <div style={{
    flex: 1, background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px', padding: '14px 18px'
  }}>
    <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>{label}</div>
    <div style={{ fontSize: '28px', fontWeight: 800, color: color || '#f8fafc' }}>{value}</div>
  </div>
);

const Stats = ({ stats, loading, isFullPage, regionName }) => {
  const [ignoreUnknown, setIgnoreUnknown] = useState(false);
  const [historyData, setHistoryData] = useState([]);

  useEffect(() => {
    if (regionName) {
      axios.get(`${API_URL}/history?region=${encodeURIComponent(regionName)}`)
        .then(res => setHistoryData(res.data))
        .catch(console.error);
    }
  }, [regionName]);

  if (loading) return (
    <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '24px' }}>
      <div className="loading-spinner" />
      <span style={{ color: '#94a3b8' }}>Загрузка...</span>
    </div>
  );
  if (!stats) return null;

  const rawStatus = stats.status || {};

  // Pie data
  let pieData = Object.entries(rawStatus)
    .map(([key, value]) => ({ name: STATUS_LABELS[key] || key, value, key }))
    .filter(d => d.value > 0);
  if (ignoreUnknown) pieData = pieData.filter(d => d.key !== 'unknown');

  const totalFiltered = pieData.reduce((s, d) => s + d.value, 0);
  const yesCount = rawStatus.yes || 0;
  const noCount = rawStatus.no || 0;
  const yesPercent = totalFiltered > 0 ? ((yesCount / totalFiltered) * 100).toFixed(1) : '0.0';
  const noPercent = totalFiltered > 0 ? ((noCount / totalFiltered) * 100).toFixed(1) : '0.0';

  // Brand stacked bar data (top 10, vertical)
  const rawBrands = stats.brands_breakdown || {};
  let brandData = Object.keys(rawBrands).map(brand => {
    const b = rawBrands[brand];
    return {
      name: brand,
      yes: b.yes || 0,
      low: b.low || 0,
      queue: b.queue || 0,
      no: b.no || 0,
      unknown: ignoreUnknown ? 0 : (b.unknown || 0),
      total: ignoreUnknown
        ? (b.yes || 0) + (b.low || 0) + (b.queue || 0) + (b.no || 0)
        : b.total || 0
    };
  }).sort((a, b) => b.total - a.total).slice(0, 10);

  // History stacked bar
  const historyProcessed = historyData.map(d => {
    const time = new Date(d.time);
    const label = `${time.getDate()}.${time.getMonth()+1} ${String(time.getHours()).padStart(2,'0')}:00`;
    return {
      time: label,
      'Топливо есть': d.yes || 0,
      'Заканчивается': d.low || 0,
      'Очереди': d.queue || 0,
      'Нет топлива': d.no || 0,
      ...(ignoreUnknown ? {} : { 'Нет данных': d.unknown || 0 })
    };
  });

  const tooltipStyle = { backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc', fontSize: '13px' };

  return (
    <div className={`glass-panel stats-panel ${isFullPage ? 'full-page' : ''}`} style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
          {regionName || 'Статистика'}
        </h2>
        <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#94a3b8' }}>
          <input type="checkbox" checked={ignoreUnknown} onChange={e => setIgnoreUnknown(e.target.checked)} />
          Без "Нет данных"
        </label>
      </div>

      {/* KPI row */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <KpiCard label="Всего АЗС" value={totalFiltered} />
        <KpiCard label="Топливо есть (%)" value={`${yesPercent}%`} color="#10b981" />
        <KpiCard label="Нет топлива (%)" value={`${noPercent}%`} color="#ef4444" />
        {stats.confidence_views > 0 && (
          <KpiCard label="Уверенность (репорты/АЗС)" value={stats.confidence_views} color="#3b82f6" />
        )}
      </div>

      {/* Two-column layout on full page */}
      <div style={{ display: isFullPage ? 'grid' : 'flex', gridTemplateColumns: isFullPage ? '1fr 1fr' : undefined, flexDirection: 'column', gap: '24px' }}>

        {/* Pie chart */}
        <div>
          <h3 style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>Распределение по статусам</h3>
          <div style={{ height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData} cx="50%" cy="50%"
                  innerRadius={75} outerRadius={105}
                  paddingAngle={3} dataKey="value"
                  label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.key} fill={STATUS_COLORS[entry.key] || '#8884d8'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(val, name) => [val, name]} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stacked bar brands */}
        <div>
          <h3 style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>Топ брендов (Разбивка)</h3>
          <div style={{ height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={brandData} margin={{ top: 5, right: 10, left: -20, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '45px' }} />
                <Bar dataKey="yes" name="Топливо есть" stackId="a" fill={STATUS_COLORS.yes} />
                <Bar dataKey="low" name="Заканчивается" stackId="a" fill={STATUS_COLORS.low} />
                <Bar dataKey="queue" name="Очереди" stackId="a" fill={STATUS_COLORS.queue} />
                <Bar dataKey="no" name="Нет топлива" stackId="a" fill={STATUS_COLORS.no} />
                {!ignoreUnknown && <Bar dataKey="unknown" name="Нет данных" stackId="a" fill={STATUS_COLORS.unknown} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* History chart (full page only, spans full width) */}
        {isFullPage && historyProcessed.length > 0 && (
          <div style={{ gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>Динамика по времени</h3>
            <div style={{ height: '220px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={historyProcessed} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="time" stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="Топливо есть" stackId="b" fill={STATUS_COLORS.yes} />
                  <Bar dataKey="Заканчивается" stackId="b" fill={STATUS_COLORS.low} />
                  <Bar dataKey="Очереди" stackId="b" fill={STATUS_COLORS.queue} />
                  <Bar dataKey="Нет топлива" stackId="b" fill={STATUS_COLORS.no} />
                  {!ignoreUnknown && <Bar dataKey="Нет данных" stackId="b" fill={STATUS_COLORS.unknown} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Stats;
