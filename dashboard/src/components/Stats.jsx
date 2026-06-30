import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';

const API_URL = 'http://localhost:5000/api';

const SC = { yes: '#10b981', low: '#facc15', queue: '#f59e0b', no: '#ef4444', unknown: '#475569' };
const SL = { yes: 'Топливо есть', low: 'Заканчивается', queue: 'Очереди', no: 'Нет топлива', unknown: 'Нет данных' };

const TT_STYLE = { backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' };

const KpiCard = ({ label, value, color, sub }) => (
  <div style={{
    flex: 1, minWidth: '100px',
    background: 'rgba(15,23,42,0.7)', border: `1px solid ${color ? color + '30' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: '10px', padding: '12px 14px'
  }}>
    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</div>
    <div style={{ fontSize: '24px', fontWeight: 800, color: color || '#f8fafc', lineHeight: 1 }}>{value ?? '—'}</div>
    {sub && <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>{sub}</div>}
  </div>
);

const ConfidenceBlock = ({ confidence }) => {
  if (!confidence) return (
    <div className="glass-panel" style={{ padding: '14px 16px', opacity: 0.5 }}>
      <div style={{ fontSize: '12px', color: '#64748b' }}>Загрузка показателей уверенности...</div>
    </div>
  );

  const { avg_real_count, total_real_estimated, avg_confidence_pct, stations_sampled, total_stations } = confidence;

  let trustColor = '#9aa3b2', trustLabel = 'Очень низкая';
  if (avg_confidence_pct >= 70) { trustColor = '#22c55e'; trustLabel = 'Высокая'; }
  else if (avg_confidence_pct >= 40) { trustColor = '#7dbe3f'; trustLabel = 'Средняя'; }
  else if (avg_confidence_pct >= 20) { trustColor = '#e0a52e'; trustLabel = 'Низкая'; }

  return (
    <div className="glass-panel" style={{ padding: '14px 16px', marginBottom: '14px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        Уверенность данных
        <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '999px', background: trustColor + '20', color: trustColor, fontWeight: 600 }}>
          {trustLabel}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <KpiCard label="Уверенность АЗС" value={`${avg_confidence_pct}%`} color={trustColor} sub="средняя по региону" />
        <KpiCard label="Репортов / АЗС" value={avg_real_count} sub="за 24 часа" />
        <KpiCard label="Репортов за 24ч (всего)" value={total_real_estimated?.toLocaleString('ru')} sub={`оценка на базе ${stations_sampled} АЗС`} />
      </div>
    </div>
  );
};

const Stats = ({ stats, loading, isFullPage, regionName, confidence }) => {
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
      <span style={{ color: '#94a3b8' }}>Загрузка статистики...</span>
    </div>
  );
  if (!stats) return null;

  const rawStatus = stats.status || {};
  let pieData = Object.entries(rawStatus)
    .map(([key, value]) => ({ name: SL[key] || key, value, key }))
    .filter(d => d.value > 0);
  if (ignoreUnknown) pieData = pieData.filter(d => d.key !== 'unknown');

  const totalFiltered = pieData.reduce((s, d) => s + d.value, 0);
  const knownTotal = totalFiltered - (ignoreUnknown ? 0 : (rawStatus.unknown || 0));
  const yesCount = rawStatus.yes || 0;
  const noCount = rawStatus.no || 0;
  const yesPercent = knownTotal > 0 ? ((yesCount / knownTotal) * 100).toFixed(1) : '0.0';
  const noPercent = knownTotal > 0 ? ((noCount / knownTotal) * 100).toFixed(1) : '0.0';

  const rawBrands = stats.brands_breakdown || {};
  const brandData = Object.keys(rawBrands).map(brand => {
    const b = rawBrands[brand];
    const total = ignoreUnknown
      ? (b.yes||0)+(b.low||0)+(b.queue||0)+(b.no||0)
      : b.total||0;
    return { name: brand, yes: b.yes||0, low: b.low||0, queue: b.queue||0, no: b.no||0, unknown: ignoreUnknown?0:(b.unknown||0), total };
  }).sort((a, b) => b.total - a.total).slice(0, 10);

  const histProcessed = historyData.map(d => {
    const t = new Date(d.time);
    return {
      time: `${t.getDate()}.${t.getMonth()+1} ${String(t.getHours()).padStart(2,'0')}:00`,
      'Топливо есть': d.yes||0, 'Заканчивается': d.low||0, 'Очереди': d.queue||0, 'Нет топлива': d.no||0,
      ...(ignoreUnknown ? {} : { 'Нет данных': d.unknown||0 })
    };
  });

  return (
    <div className={`glass-panel stats-panel`} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{regionName || 'Статистика'}</h2>
        <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#64748b', userSelect: 'none' }}>
          <input type="checkbox" checked={ignoreUnknown} onChange={e => setIgnoreUnknown(e.target.checked)} style={{ accentColor: '#3b82f6' }} />
          Без "Нет данных"
        </label>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <KpiCard label="Всего АЗС" value={totalFiltered.toLocaleString('ru')} />
        <KpiCard label="Топливо есть" value={`${yesPercent}%`} color="#10b981" sub={`${yesCount.toLocaleString('ru')} АЗС`} />
        <KpiCard label="Нет топлива" value={`${noPercent}%`} color="#ef4444" sub={`${noCount.toLocaleString('ru')} АЗС`} />
      </div>

      {isFullPage && <ConfidenceBlock confidence={confidence} />}

      <div style={{ display: 'grid', gridTemplateColumns: isFullPage ? '1fr 1.5fr' : '1fr', gap: '20px' }}>
        <div>
          <h3 style={{ fontSize: '13px', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>Распределение по статусам</h3>
          <div style={{ height: isFullPage ? '300px' : '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData} cx="50%" cy="50%"
                  innerRadius={isFullPage ? 85 : 70} outerRadius={isFullPage ? 120 : 100}
                  paddingAngle={3} dataKey="value"
                  label={({ name, percent }) => percent > 0.04 ? `${(percent*100).toFixed(0)}%` : ''}
                  labelLine={false}
                >
                  {pieData.map(e => <Cell key={e.key} fill={SC[e.key] || '#8884d8'} />)}
                </Pie>
                <Tooltip contentStyle={TT_STYLE} formatter={(v, n) => [v.toLocaleString('ru'), n]} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '13px', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>Топ брендов (Разбивка)</h3>
          <div style={{ height: isFullPage ? '300px' : '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={brandData} margin={{ top: 5, right: 10, left: -20, bottom: 65 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#334155" tick={{ fill: '#e2e8f0', fontSize: 11 }} angle={-45} textAnchor="end" interval={0} />
                <YAxis stroke="#334155" tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip contentStyle={TT_STYLE} />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '65px' }} />
                <Bar dataKey="yes" name="Топливо есть" stackId="a" fill={SC.yes} />
                <Bar dataKey="low" name="Заканчивается" stackId="a" fill={SC.low} />
                <Bar dataKey="queue" name="Очереди" stackId="a" fill={SC.queue} />
                <Bar dataKey="no" name="Нет топлива" stackId="a" fill={SC.no} />
                {!ignoreUnknown && <Bar dataKey="unknown" name="Нет данных" stackId="a" fill={SC.unknown} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {histProcessed.length > 0 && (
          <div style={{ gridColumn: isFullPage ? '1 / -1' : undefined }}>
            <h3 style={{ fontSize: '13px', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>Динамика по времени</h3>
            <div style={{ height: '220px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histProcessed} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="time" stroke="#334155" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis stroke="#334155" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Tooltip contentStyle={TT_STYLE} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Bar dataKey="Топливо есть" stackId="b" fill={SC.yes} />
                  <Bar dataKey="Заканчивается" stackId="b" fill={SC.low} />
                  <Bar dataKey="Очереди" stackId="b" fill={SC.queue} />
                  <Bar dataKey="Нет топлива" stackId="b" fill={SC.no} />
                  {!ignoreUnknown && <Bar dataKey="Нет данных" stackId="b" fill={SC.unknown} />}
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
