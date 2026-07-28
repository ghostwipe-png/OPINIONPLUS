// components/SponsoredPerformanceChart.js
'use client';

import { useEffect, useState, useCallback } from 'react';
import { BarChart3, MapPin, AlertTriangle, Download, Loader2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function fmtDate(d) {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

export default function SponsoredPerformanceChart({ campaignId }) {
  const [range, setRange] = useState(7);
  const [daily, setDaily] = useState([]);
  const [geo, setGeo] = useState([]);
  const [creatives, setCreatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hover, setHover] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      fetch(`${API_BASE}/sponsored-service/campaigns/${campaignId}/stats/daily`, { credentials: 'include' }).then(r => r.json()),
      fetch(`${API_BASE}/sponsored-service/campaigns/${campaignId}/stats/geo`, { credentials: 'include' }).then(r => r.json()),
      fetch(`${API_BASE}/sponsored-service/campaigns/${campaignId}/creatives`, { credentials: 'include' }).then(r => r.json()).catch(() => ({ creatives: [] })),
    ])
      .then(([dailyRes, geoRes, creativesRes]) => {
        setDaily(dailyRes.daily || []);
        setGeo(geoRes.geo || []);
        setCreatives(creativesRes.creatives || []);
      })
      .catch(() => setError('Could not load performance data.'))
      .finally(() => setLoading(false));
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  const handleExport = () => {
    window.open(`${API_BASE}/sponsored-service/campaigns/${campaignId}/report/export`, '_blank');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2 h-40 items-end">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="flex-1 bg-wire/20 animate-pulse rounded-sm" style={{ height: `${40 + i * 10}%` }} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-signal rounded-sm flex items-start gap-3">
        <AlertTriangle size={16} className="text-signal shrink-0 mt-0.5" />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-signal mb-1">Report Error</p>
          <p className="text-sm font-medium text-signal">{error}</p>
          <button onClick={load} className="text-xs font-bold text-ink underline mt-2">Retry</button>
        </div>
      </div>
    );
  }

  const windowed = daily.slice(-range);

  if (windowed.length === 0 && geo.length === 0) {
    return (
      <div className="border border-wire bg-white p-12 text-center rounded-sm">
        <BarChart3 size={40} className="text-ink-300 mx-auto mb-4" />
        <p className="text-sm font-bold text-ink-600 uppercase tracking-wider">No Performance Data Yet</p>
        <p className="text-xs text-ink-400 mt-1">Data will populate once your campaign starts serving.</p>
      </div>
    );
  }

  const maxDaily = Math.max(1, ...windowed.map(d => Math.max(d.impressions || 0, d.clicks || 0)));
  const maxGeo = Math.max(1, ...geo.map(g => g.impressions || 0));
  const totalImp = creatives.reduce((s, c) => s + (c.impressions || 0), 0);
  const totalClk = creatives.reduce((s, c) => s + (c.clicks || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          <button onClick={() => setRange(7)} className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm border ${range === 7 ? 'bg-ink text-white border-ink' : 'border-wire text-ink hover:border-ink'}`}>7 Days</button>
          <button onClick={() => setRange(30)} className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm border ${range === 30 ? 'bg-ink text-white border-ink' : 'border-wire text-ink hover:border-ink'}`}>30 Days</button>
        </div>
        <button onClick={handleExport} className="border border-wire bg-white text-ink font-bold uppercase text-xs tracking-wider px-4 py-2 rounded-sm hover:border-ink transition-colors flex items-center gap-2">
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="border border-wire bg-white p-5 rounded-sm shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-4">Impressions &amp; Clicks</p>
        {windowed.length === 0 ? (
          <p className="text-xs text-ink-400">No daily data in this range.</p>
        ) : (
          <div className="flex items-end gap-3 h-40 overflow-x-auto">
            {windowed.map((d, i) => (
              <div key={i} className="flex flex-col items-center justify-end h-full min-w-[28px] relative"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                {hover === i && (
                  <div className="absolute -top-10 text-[9px] font-bold font-mono text-ink bg-white border border-wire px-1.5 py-1 rounded-sm whitespace-nowrap z-10">
                    {(d.impressions || 0).toLocaleString()} imp / {(d.clicks || 0).toLocaleString()} clk
                  </div>
                )}
                <div className="flex items-end gap-0.5 h-full">
                  <div className="w-2.5 bg-ink rounded-sm" style={{ height: `${Math.max(3, ((d.impressions || 0) / maxDaily) * 100)}%` }} />
                  <div className="w-2.5 bg-ink/40 rounded-sm" style={{ height: `${Math.max(3, ((d.clicks || 0) / maxDaily) * 100)}%` }} />
                </div>
                <span className="text-[9px] font-bold text-ink-400 mt-1">{fmtDate(d.date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border border-wire bg-white p-5 rounded-sm shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-4 flex items-center gap-2"><MapPin size={14} /> Geographic Distribution</p>
        {geo.length === 0 ? (
          <p className="text-xs text-ink-400">No geographic data yet.</p>
        ) : (
          <div className="space-y-2">
            {geo.slice(0, 8).map((g, i) => {
              const pct = (g.impressions || 0) / maxGeo;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-ink w-28 shrink-0 truncate">{g.county || g.region}</span>
                  <div className="flex-1 h-4 bg-wire/20 rounded-sm overflow-hidden">
                    <div className="h-full bg-signal rounded-sm" style={{ width: `${Math.max(4, pct * 100)}%`, opacity: 0.4 + 0.6 * pct }} />
                  </div>
                  <span className="text-xs font-mono text-ink-500 w-14 text-right shrink-0">{(g.impressions || 0).toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {creatives.length > 1 && (
        <div className="border border-wire bg-white p-5 rounded-sm shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-4">Creative A/B Comparison</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {creatives.map(c => (
              <div key={c.id} className="border border-wire rounded-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-sm text-ink truncate">{c.headline}</p>
                  {c.is_control === 1 && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-ink text-white shrink-0 ml-2">Control</span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px] font-bold uppercase text-ink-500">
                  <span>Imp: {(c.impressions || 0).toLocaleString()}</span>
                  <span>Clk: {(c.clicks || 0).toLocaleString()}</span>
                  <span>CTR: {c.impressions ? (((c.clicks || 0) / c.impressions) * 100).toFixed(2) : '0.00'}%</span>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-wire mt-4 pt-4 flex justify-between text-xs font-bold uppercase tracking-wider text-ink">
            <span>Total: {totalImp.toLocaleString()} imp</span>
            <span>{totalClk.toLocaleString()} clicks</span>
            <span>{totalImp ? ((totalClk / totalImp) * 100).toFixed(2) : '0.00'}% CTR</span>
          </div>
        </div>
      )}
    </div>
  );
}
