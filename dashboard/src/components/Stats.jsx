import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line
} from "recharts";

const API_URL = "http://localhost:5000/api";

const SC = { yes: "#10b981", low: "#facc15", queue: "#f59e0b", no: "#ef4444", unknown: "#475569" };

const LABELS = {
  ru: { yes: "Топливо есть", low: "Заканчивается", queue: "Очереди", no: "Нет топлива", unknown: "Нет данных" },
  en: { yes: "Fuel available", low: "Running low", queue: "Queue", no: "No fuel", unknown: "No data" },
};

const UI = {
  ru: {
    totalStations: "Всего АЗС", fuelAvail: "Топливо есть", noFuel: "Нет топлива",
    withoutUnknown: "Без \"Нет данных\"", stations: "АЗС",
    confidence: "Уверенность данных", avgConf: "Уверенность АЗС", reportsPerStation: "Репортов / АЗС",
    totalReports: "Репортов за 24ч (всего)", est: "оценка на базе", azs: "АЗС",
    avgByRegion: "средняя по региону", per24h: "за 24 часа",
    high: "Высокая", med: "Средняя", low: "Низкая", vlow: "Очень низкая",
    distribByStatus: "Распределение по статусам", topBrands: "Топ брендов (Разбивка)",
    dynamics: "Динамика по времени", loading: "Загрузка статистики...",
  },
  en: {
    totalStations: "Total stations", fuelAvail: "Fuel available", noFuel: "No fuel",
    withoutUnknown: "Exclude \"No data\"", stations: "stations",
    confidence: "Data confidence", avgConf: "Station confidence", reportsPerStation: "Reports / station",
    totalReports: "Reports 24h (total)", est: "estimated from", azs: "stations",
    avgByRegion: "avg by region", per24h: "per 24 hours",
    high: "High", med: "Medium", low: "Low", vlow: "Very low",
    distribByStatus: "Status distribution", topBrands: "Top brands (breakdown)",
    dynamics: "Time dynamics", loading: "Loading statistics...",
  },
};

const TT_STYLE = { backgroundColor: "#1e293b", border: "none", borderRadius: "8px", color: "#f8fafc", fontSize: "12px" };

const CustomCheckbox = ({ checked, onChange, label }) => (
  <div onClick={() => onChange(!checked)} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", userSelect: "none" }}>
    <div style={{
      width: "16px", height: "16px", borderRadius: "4px",
      border: checked ? "none" : "1px solid #64748b",
      background: checked ? "#3b82f6" : "rgba(15,23,42,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "all 0.2s ease"
    }}>
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
    <span style={{ fontSize: "12px", color: checked ? "#ffffff" : "#94a3b8", transition: "color 0.2s ease" }}>{label}</span>
  </div>
);

const KpiCard = ({ label, value, color, sub }) => (
  <div style={{
    flex: 1, minWidth: "100px",
    background: "rgba(15,23,42,0.7)", border: `1px solid ${color ? color + "30" : "rgba(255,255,255,0.08)"}`,
    borderRadius: "10px", padding: "12px 14px"
  }}>
    <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.3px" }}>{label}</div>
    <div style={{ fontSize: "24px", fontWeight: 800, color: color || "#f8fafc", lineHeight: 1 }}>{value ?? "—"}</div>
    {sub && <div style={{ fontSize: "11px", color: "#475569", marginTop: "3px" }}>{sub}</div>}
  </div>
);

const ConfidenceBlock = ({ confidence, lang = "ru" }) => {
  const u = UI[lang] || UI.ru;
  if (!confidence) return (
    <div className="glass-panel" style={{ padding: "14px 16px", opacity: 0.5 }}>
      <div style={{ fontSize: "12px", color: "#64748b" }}>{u.loading}</div>
    </div>
  );
  const { avg_real_count, total_real_estimated, avg_confidence_pct, stations_sampled } = confidence;
  let trustColor = "#9aa3b2", trustLabel = u.vlow;
  if (avg_confidence_pct >= 70) { trustColor = "#22c55e"; trustLabel = u.high; }
  else if (avg_confidence_pct >= 40) { trustColor = "#7dbe3f"; trustLabel = u.med; }
  else if (avg_confidence_pct >= 20) { trustColor = "#e0a52e"; trustLabel = u.low; }
  
  const gaugeData = [
    { name: 'Conf', value: avg_confidence_pct, fill: trustColor },
    { name: 'Rem', value: 100 - avg_confidence_pct, fill: 'rgba(255,255,255,0.05)' }
  ];

  return (
    <div className="glass-panel" style={{ padding: "14px 16px", marginBottom: "14px" }}>
      <div style={{ fontSize: "13px", fontWeight: 700, color: "#94a3b8", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
        {u.confidence}
        <span style={{ fontSize: "12px", padding: "2px 8px", borderRadius: "999px", background: trustColor + "20", color: trustColor, fontWeight: 600 }}>{trustLabel}</span>
      </div>
      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "center" }}>
        {/* Gauge Chart */}
        <div style={{ position: "relative", width: "120px", height: "120px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={gaugeData} cx="50%" cy="50%"
                innerRadius={45} outerRadius={55}
                startAngle={225} endAngle={-45}
                dataKey="value" stroke="none" cornerRadius={5}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: "24px", fontWeight: 800, color: trustColor, lineHeight: 1 }}>{avg_confidence_pct}%</span>
          </div>
        </div>
        
        {/* Stats */}
        <div style={{ flex: 1, display: "flex", gap: "10px", flexWrap: "wrap", minWidth: "200px" }}>
          <KpiCard label={u.reportsPerStation} value={avg_real_count} sub={u.per24h} />
          <KpiCard label={u.totalReports} value={total_real_estimated?.toLocaleString("ru")} sub={`${u.est} ${stations_sampled} ${u.azs}`} />
        </div>
      </div>
    </div>
  );
};

// Custom bar label showing count + %
const BarLabelPct = ({ x, y, width, value, total }) => {
  if (!value || !total || width < 20) return null;
  const pct = ((value / total) * 100).toFixed(0);
  return (
    <text x={x + width / 2} y={y - 3} fill="#94a3b8" textAnchor="middle" fontSize={9}>
      {pct}%
    </text>
  );
};

const Stats = ({ stats, loading, isFullPage, apiRegionName, displayName, confidence, lang = "ru" }) => {
  const [ignoreUnknown, setIgnoreUnknown] = useState(false);
  const [showPct, setShowPct] = useState(false);
  const [stackBrands, setStackBrands] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const u = UI[lang] || UI.ru;
  const SL = LABELS[lang] || LABELS.ru;

  useEffect(() => {
    if (apiRegionName) {
      axios.get(`${API_URL}/history?region=${encodeURIComponent(apiRegionName)}`)
        .then(res => setHistoryData(res.data))
        .catch(console.error);
    }
  }, [apiRegionName]);

  if (loading) return (
    <div className="glass-panel" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "24px" }}>
      <div className="loading-spinner" />
      <span style={{ color: "#94a3b8" }}>{u.loading}</span>
    </div>
  );
  if (!stats) return null;

  const rawStatus = stats.status || {};
  let pieData = Object.entries(rawStatus)
    .map(([key, value]) => ({ name: SL[key] || key, value, key }))
    .filter(d => d.value > 0);
  if (ignoreUnknown) pieData = pieData.filter(d => d.key !== "unknown");

  const totalFiltered = pieData.reduce((s, d) => s + d.value, 0);
  const knownTotal = totalFiltered - (ignoreUnknown ? 0 : (rawStatus.unknown || 0));
  const yesCount = rawStatus.yes || 0;
  const noCount = rawStatus.no || 0;
  const yesPercent = knownTotal > 0 ? ((yesCount / knownTotal) * 100).toFixed(1) : "0.0";
  const noPercent = knownTotal > 0 ? ((noCount / knownTotal) * 100).toFixed(1) : "0.0";

  const rawBrands = stats.brands_breakdown || {};
  const brandData = Object.keys(rawBrands).map(brand => {
    const b = rawBrands[brand];
    const total = ignoreUnknown
      ? (b.yes||0)+(b.low||0)+(b.queue||0)+(b.no||0)
      : b.total||0;
    return { name: brand, yes: b.yes||0, low: b.low||0, queue: b.queue||0, no: b.no||0, unknown: ignoreUnknown?0:(b.unknown||0), total };
  }).sort((a, b) => b.total - a.total).slice(0, 10);

  const histProcessed = historyData.map(d => {
    // Append Z to parse as UTC
    const time = new Date(d.time.replace(" ", "T") + "Z").toLocaleTimeString(lang === 'en' ? 'en-US' : 'ru-RU', { hour: "2-digit", minute: "2-digit" });
    const u_val = ignoreUnknown ? 0 : d.unknown;
    const total = (d.yes || 0) + (d.no || 0) + (d.low || 0) + (d.queue || 0) + (u_val || 0);
    if (showPct && total > 0) {
      return {
        time,
        [SL.yes]: Math.round((d.yes || 0) / total * 100),
        [SL.no]: Math.round((d.no || 0) / total * 100),
        [SL.low]: Math.round((d.low || 0) / total * 100),
        [SL.queue]: Math.round((d.queue || 0) / total * 100),
        [SL.unknown]: Math.round((u_val || 0) / total * 100),
      };
    }
    return {
      time,
      [SL.yes]: d.yes || 0,
      [SL.no]: d.no || 0,
      [SL.low]: d.low || 0,
      [SL.queue]: d.queue || 0,
      [SL.unknown]: u_val || 0,
    };
  });

  // Custom tooltip showing count + %
  const BrandTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const total = payload.reduce((s, p) => s + (p.value||0), 0);
    return (
      <div style={{ ...TT_STYLE, padding: "10px 12px" }}>
        <div style={{ fontWeight: 700, marginBottom: "6px" }}>{label}</div>
        {payload.map(p => (
          <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: "16px", fontSize: "12px", color: p.fill }}>
            <span>{p.name}:</span>
            <span>{p.value} ({total > 0 ? ((p.value/total)*100).toFixed(0) : 0}%)</span>
          </div>
        ))}
        <div style={{ marginTop: "4px", fontSize: "11px", color: "#64748b", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "4px" }}>
          Total: {total}
        </div>
      </div>
    );
  };

  return (
    <div className="glass-panel stats-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>{displayName}</h2>
        <CustomCheckbox checked={ignoreUnknown} onChange={setIgnoreUnknown} label={u.withoutUnknown} />
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <KpiCard label={u.totalStations} value={totalFiltered.toLocaleString("ru")} />
        <KpiCard label={u.fuelAvail} value={`${yesPercent}%`} color="#10b981" sub={`${yesCount.toLocaleString("ru")} ${u.stations}`} />
        <KpiCard label={u.noFuel} value={`${noPercent}%`} color="#ef4444" sub={`${noCount.toLocaleString("ru")} ${u.stations}`} />
      </div>

      {isFullPage && <ConfidenceBlock confidence={confidence} lang={lang} />}

      <div style={{ display: "grid", gridTemplateColumns: isFullPage ? "1fr 1.5fr" : "1fr", gap: "20px" }}>
        {/* Pie */}
        <div>
          <h3 style={{ fontSize: "13px", color: "#64748b", marginBottom: "6px", fontWeight: 600 }}>{u.distribByStatus}</h3>
          <div style={{ height: isFullPage ? "300px" : "260px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData} cx="50%" cy="50%"
                  innerRadius={isFullPage ? 85 : 70} outerRadius={isFullPage ? 120 : 100}
                  paddingAngle={3} dataKey="value"
                  label={({ name, percent, value }) => percent > 0.04 ? `${(percent*100).toFixed(0)}% (${value})` : ""}
                  labelLine={false}
                >
                  {pieData.map(e => <Cell key={e.key} fill={SC[e.key] || "#8884d8"} />)}
                </Pie>
                <Tooltip contentStyle={TT_STYLE} formatter={(v, n) => [v.toLocaleString("ru"), n]} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Brand bars */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <h3 style={{ fontSize: "13px", color: "#64748b", margin: 0, fontWeight: 600 }}>{u.topBrands}</h3>
            <CustomCheckbox checked={stackBrands} onChange={setStackBrands} label="%" />
          </div>
          <div style={{ height: isFullPage ? "300px" : "260px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={brandData} margin={{ top: 18, right: 10, left: -20, bottom: 65 }} stackOffset={stackBrands ? "expand" : "none"}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#334155" tick={{ fill: "#e2e8f0", fontSize: 11 }} angle={-45} textAnchor="end" interval={0} />
                <YAxis stroke="#334155" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={val => stackBrands ? `${(val * 100).toFixed(0)}%` : val} />
                <Tooltip content={<BrandTooltip />} />
                <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "65px" }} />
                <Bar dataKey="yes" name={SL.yes} stackId="a" fill={SC.yes} />
                <Bar dataKey="low" name={SL.low} stackId="a" fill={SC.low} />
                <Bar dataKey="queue" name={SL.queue} stackId="a" fill={SC.queue} />
                <Bar dataKey="no" name={SL.no} stackId="a" fill={SC.no} />
                {!ignoreUnknown && <Bar dataKey="unknown" name={SL.unknown} stackId="a" fill={SC.unknown} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* History — Line Chart */}
        {histProcessed.length > 0 && (
          <div style={{ gridColumn: isFullPage ? "1 / -1" : undefined }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <h3 style={{ fontSize: "13px", color: "#64748b", margin: 0, fontWeight: 600 }}>{u.dynamics}</h3>
              <CustomCheckbox checked={showPct} onChange={setShowPct} label="%" />
            </div>
            <div style={{ height: "220px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={histProcessed} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="time" stroke="#334155" tick={{ fill: "#64748b", fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis stroke="#334155" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={val => showPct ? `${val}%` : val} />
                  <Tooltip contentStyle={TT_STYLE} formatter={(value, name) => [showPct ? `${value}%` : value, name]} />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                  <Line type="monotone" dataKey={SL.yes} stroke={SC.yes} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey={SL.low} stroke={SC.low} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey={SL.queue} stroke={SC.queue} strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey={SL.no} stroke={SC.no} strokeWidth={2} dot={false} />
                  {!ignoreUnknown && <Line type="monotone" dataKey={SL.unknown} stroke={SC.unknown} strokeWidth={1} dot={false} strokeDasharray="4 4" />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Stats;
