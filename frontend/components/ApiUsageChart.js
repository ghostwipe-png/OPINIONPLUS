// components/ApiUsageChart.js
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, AlertTriangle, BarChart3 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function ApiUsageChart({ apiKeyId, days: initialDays = 7 }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState(initialDays);
  const [maxCalls, setMaxCalls] = useState(1);

  const fetchHistory = useCallback(async () => {
    if (!apiKeyId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api-service/usage/history?days=${days}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setHistory(data.history || []);
        const max = Math.max(1, ...(data.history || []).map(h => h.calls_count));
        setMaxCalls(max);
      } else {
        setError(data.error || 'Failed to load usage history.');
      }
    } catch (e) {
      setError('Network error while loading usage data.');
    }
    setLoading(false);
  }, [apiKeyId, days]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const totalCalls = history.reduce((sum, h) => sum + (h.calls_count || 0), 0);
  const totalErrors = history.reduce((sum, h) => sum + (h.error_count || 0), 0);

  if (loading) {
    return (
      <div className="border border-wire bg-white p-6 rounded-sm shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-4 w-24 bg-wire/40 rounded animate-pulse" />
        </div>
        <div className="flex items-end gap-2 h-32">
          {Array.from({ length: days }).map((_, i) => (
            <div key={i} className="flex-1 bg-wire/20 rounded-sm animate-pulse" style={{ height: `${20 + Math.random() * 60}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-wire bg-white p-6 rounded-sm shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} className="text-signal shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-signal">Failed to load chart</p>
            <p className="text-xs text-ink-500 mt-1">{error}</p>
            <button onClick={fetchHistory} className="text-xs font-bold text-ink underline mt-2">Retry</button>
          </div>
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="border border-wire bg-white p-10 rounded-sm shadow-sm text-center">
        <BarChart3 size={32} className="text-ink-300 mx-auto mb-3" />
        <p className="text-sm font-bold text-ink-600 uppercase tracking-wider">No usage data yet</p>
        <p className="text-xs font-medium text-ink-400 mt-1">Start making API calls to see your usage chart.</p>
      </div>
    );
  }

  return (
    <div className="border border-wire bg-white p-5 rounded-sm shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-600">
            API Calls — Last {days} Days
          </p>
          <p className="text-[10px] text-ink-400 mt-0.5">
            {totalCalls} total calls · {totalErrors} errors
          </p>
        </div>
        <div className="flex gap-1 border border-wire rounded-sm overflow-hidden">
          {[7, 30].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 transition-colors ${
                days === d ? 'bg-ink text-white' : 'bg-white text-ink-500 hover:bg-paper'
              }`}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-1.5 h-36">
        {history.map((entry) => {
          const count = entry.calls_count || 0;
          const errorCount = entry.error_count || 0;
          const heightPercent = maxCalls > 0 ? Math.max(4, (count / maxCalls) * 100) : 4;
          
          // Color based on usage level
          let barColor = 'bg-emerald-500';
          if (count > maxCalls * 0.8) barColor = 'bg-signal';
          else if (count > maxCalls * 0.5) barColor = 'bg-amber-500';

          return (
            <div key={entry.date} className="flex-1 flex flex-col items-center gap-1 group relative min-w-[20px]">
              {/* Tooltip on hover */}
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-ink text-white text-[9px] font-bold px-2 py-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                {entry.date}: {count} calls{errorCount > 0 ? ` · ${errorCount} errors` : ''}
              </div>
              
              <div
                className={`w-full ${barColor} rounded-t-sm transition-all group-hover:brightness-110`}
                style={{ height: `${heightPercent}%` }}
              />
              <span className="text-[8px] font-bold text-ink-300 uppercase leading-none">
                {entry.date.slice(5)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-wire">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          <span className="text-[8px] font-bold text-ink-400 uppercase">Normal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
          <span className="text-[8px] font-bold text-ink-400 uppercase">Medium</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-signal" />
          <span className="text-[8px] font-bold text-ink-400 uppercase">High</span>
        </div>
      </div>
    </div>
  );
}