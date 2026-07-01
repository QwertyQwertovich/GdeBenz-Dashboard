import React, { useState, useEffect } from "react";
import axios from "axios";

const API_URL = import.meta.env.PROD ? "/api" : import.meta.env.PROD ? "/api" : "http://localhost:5000/api";

const TimeSlider = ({ timeAt, setTimeAt, lang }) => {
  const [timestamps, setTimestamps] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    axios.get(`${API_URL}/time_bounds`).then(res => {
      const ts = res.data.timestamps || [];
      if (ts.length > 0) {
        setTimestamps(ts);
        if (!timeAt) {
          setCurrentIndex(ts.length - 1);
        } else {
          const idx = ts.findIndex(t => t === timeAt);
          if (idx !== -1) setCurrentIndex(idx);
          else setCurrentIndex(ts.length - 1);
        }
      }
    }).catch(e => console.error(e));
  }, []);

  // Sync external timeAt
  useEffect(() => {
    if (timestamps.length === 0) return;
    if (timeAt) {
      const idx = timestamps.findIndex(t => t === timeAt);
      if (idx !== -1) setCurrentIndex(idx);
    } else {
      setCurrentIndex(timestamps.length - 1);
    }
  }, [timeAt, timestamps]);

  if (timestamps.length === 0) return null;

  const handleChange = (e) => {
    setCurrentIndex(Number(e.target.value));
  };

  const handleRelease = (e) => {
    const val = Number(e.target.value);
    const dateStr = timestamps[val];
    if (val === timestamps.length - 1) {
      setTimeAt(null);
    } else {
      setTimeAt(dateStr);
    }
  };

  const handleReset = () => {
    setCurrentIndex(timestamps.length - 1);
    setTimeAt(null);
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    // Server returns UTC string like '2026-06-30 13:00:00'
    // Append Z so JS parses it as UTC and displays as local time
    const d = new Date(ts.replace(" ", "T") + "Z");
    return d.toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const isHistorical = timeAt !== null;

  return (
    <div style={{
      padding: "16px", background: "rgba(15,23,42,0.7)", borderRadius: "12px",
      border: "1px solid rgba(255,255,255,0.08)", marginBottom: "20px",
      display: "flex", flexDirection: "column", gap: "10px"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: "14px", color: "#f8fafc", fontWeight: 600 }}>
          {lang === 'en' ? 'Time Machine' : 'Машина времени'}
        </h3>
        <div style={{ fontSize: "12px", color: isHistorical ? "#facc15" : "#64748b", fontWeight: 600 }}>
          {isHistorical 
            ? `${lang === 'en' ? 'Data at:' : 'Данные на:'} ${formatTime(timestamps[currentIndex])}`
            : (lang === 'en' ? 'Live Data' : 'Текущие данные')
          }
        </div>
      </div>
      
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <span style={{ fontSize: "11px", color: "#64748b", whiteSpace: "nowrap" }}>{formatTime(timestamps[0])}</span>
        <input 
          type="range" 
          min={0} 
          max={timestamps.length - 1} 
          step={1} 
          value={currentIndex} 
          onChange={handleChange}
          onMouseUp={handleRelease}
          onTouchEnd={handleRelease}
          style={{ flex: 1, accentColor: "#3b82f6", cursor: "pointer" }}
        />
        <span style={{ fontSize: "11px", color: "#64748b", whiteSpace: "nowrap" }}>{formatTime(timestamps[timestamps.length - 1])}</span>
      </div>

      {isHistorical && (
        <button 
          onClick={handleReset}
          style={{
            alignSelf: "flex-end", padding: "4px 12px", borderRadius: "6px",
            background: "transparent", border: "1px solid #3b82f6", color: "#3b82f6",
            fontSize: "11px", cursor: "pointer", transition: "all 0.2s"
          }}
          onMouseEnter={e => { e.target.style.background = "rgba(59,130,246,0.1)"; }}
          onMouseLeave={e => { e.target.style.background = "transparent"; }}
        >
          {lang === 'en' ? 'Back to Live' : 'Вернуться к текущему времени'}
        </button>
      )}
    </div>
  );
};

export default TimeSlider;
