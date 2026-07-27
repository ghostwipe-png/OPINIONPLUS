// components/PressReleaseAnalytics.js
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Eye, Users, Share2, MessageSquareText, Mail, MousePointerClick, Clock, MapPin, Loader2, Download, AlertTriangle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const REFRESH_MS = 30000;

function toCsv(analytics, releaseId) {
  const rows = [
    ['Metric', 'Value'],
    ['Release ID', releaseId],
    ['Views', analytics.views ?? 0],
    ['Unique Views', analytics.unique_views ?? 0],
    ['Shares', analytics.shares ?? 0],
    ['SMS Sent', analytics.sms_sent ?? 0],
    ['Email Sent', analytics.email_sent ?? 0],
    ['Click Throughs', analytics.click_throughs ?? 0],
    ['Avg Read Time (s)', analytics.avg_read_time_seconds ?? 0],
    [],
    ['Date', 'Views'],
    ...Object.entries(analytics.daily_views || {}).sort(([a], [b]) => a.localeCompare(b)),
    [],
    ['Region', 'Views'],
    ...Object.entries(analytics.geo_data || {}).sort(([, a], [, b]) => b - a),
  ];
  return rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="border border-wire bg-white p-4 rounded-sm shadow-sm">
      <div className="flex items-center gap-2 text-ink-400 mb-1">
        <Icon size={13} />
        <p className="text-[9px] font-bold uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-xl font-black text-ink">{value}</p>
    </div>
  );
}

export default function PressReleaseAnalytics({ releaseId }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const intervalRef = useRef(null);

  const fetchAnalytics = useCallback(async (isInitial = false) => {
    if (!releaseId) return;
    if (isInitial) setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/services/press-release/${releaseId}/analytics`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setAnalytics(data.analytics);
      } else {
        setError(data.error || 'Failed to load analytics.');
      }
    } catch (e) {
      setError('Network error while loading analytics.');
    }
    if (isInitial) setLoading(false);
  }, [releaseId]);

  useEffect(() => {
    fetchAnalytics(true);
    intervalRef.current = setInterval(() => fetchAnalytics(false), REFRESH_MS);
    return () => clearInterval(intervalRef.current);
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border border-wire bg-white p-4 rounded-sm h-20 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-signal rounded-sm flex items-start gap-3">
        <AlertTriangle size={16} className="text-signal shrink-0 mt-0.5" />
        <p className="text-sm font-medium text-signal">{error}</p>
      </div>
    );
  }

  const hasData = analytics && (analytics.views > 0 || Object.keys(analytics.geo_data || {}).length > 0);
  const dailyEntries = Object.entries(analytics?.daily_views || {}).sort(([a], [b]) => a.localeCompare(b)).slice(-7);
  const maxDailyViews = Math.max(1, ...dailyEntries.map(([, v]) => v));
  const geoEntries = Object.entries(analytics?.geo_data || {}).sort(([, a], [, b]) => b - a).slice(0, 8);

  if (!hasData) {
    return (
      <div className="border border-wire bg-white p-10 text-center rounded-sm shadow-sm">
        <Eye size={32} className="text-ink-300 mx-auto mb-3" />
        <p className="text-sm font-bold text-ink-600 uppercase tracking-wider">No analytics data yet</p>
        <p className="text-xs font-medium text-ink-400 mt-1">Views and engagement will appear here once readers visit this release.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard icon={Eye} label="Views" value={analytics.views} />
        <StatCard icon={Users} label="Unique Views" value={analytics.unique_views} />
        <StatCard icon={Share2} label="Shares" value={analytics.shares} />
        <StatCard icon={MessageSquareText} label="SMS Sent" value={analytics.sms_sent} />
        <StatCard icon={Mail} label="Email Sent" value={analytics.email_sent} />
        <StatCard icon={Clock} label="Avg Read Time" value={`${analytics.avg_read_time_seconds || 0}s`} />
      </div>

      {dailyEntries.length > 0 && (
        <div className="border border-wire bg-white p-5 rounded-sm shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-4">Views — Last {dailyEntries.length} Days</p>
          <div className="flex items-end gap-2 h-32">
            {dailyEntries.map(([date, count]) => (
              <div key={date} className="flex-1 flex flex-col items-center gap-1 group">
                <span className="text-[9px] font-bold text-ink-400 opacity-0 group-hover:opacity-100 transition-opacity">{count}</span>
                <div
                  className="w-full bg-signal rounded-sm transition-all"
                  style={{ height: `${Math.max(4, (count / maxDailyViews) * 100)}%` }}
                />
                <span className="text-[8px] font-bold text-ink-300 uppercase">{date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {geoEntries.length > 0 && (
        <div className="border border-wire bg-white p-5 rounded-sm shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-4 flex items-center gap-1.5"><MapPin size={12} /> Geography</p>
          <div className="space-y-2">
            {geoEntries.map(([region, count]) => (
              <div key={region} className="flex items-center gap-3">
                <span className="text-xs font-bold text-ink-600 w-28 shrink-0 truncate">{region}</span>
                <div className="flex-1 h-2 bg-wire/40 rounded-sm overflow-hidden">
                  <div className="h-full bg-ink rounded-sm" style={{ width: `${(count / geoEntries[0][1]) * 100}%` }} />
                </div>
                <span className="text-xs font-black text-ink w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => downloadCsv(toCsv(analytics, releaseId), `press-release-${releaseId}-analytics.csv`)}
        className="text-[11px] font-bold uppercase tracking-wider text-ink px-4 py-2 border border-wire rounded-sm hover:border-ink transition-colors flex items-center gap-2"
      >
        <Download size={14} /> Export CSV
      </button>
    </div>
  );
}
