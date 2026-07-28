// components/SponsoredCampaignDashboard.js
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Eye, MousePointerClick, TrendingUp, Clock, AlertTriangle, BarChart3, Pause, Play, Edit3, FileText, Loader2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

const STATUS_STYLES = {
  draft: 'bg-ink-50 text-ink-500 border-ink-200',
  scheduled: 'bg-amber-50 text-amber-700 border-amber-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paused: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  cancelled: 'bg-red-50 text-signal border-red-200',
};

function StatCard({ icon: Icon, label, value, mono }) {
  return (
    <div className="border border-wire bg-white p-5 rounded-sm shadow-sm">
      <div className="flex items-center gap-2 text-ink-400 mb-2">
        <Icon size={14} />
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-2xl font-black text-ink ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

export default function SponsoredCampaignDashboard({ campaignId, onEdit, onPause, onResume, onViewReport }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoverIdx, setHoverIdx] = useState(null);
  const intervalRef = useRef(null);

  const fetchStats = useCallback(() => {
    fetch(`${API_BASE}/sponsored-service/campaigns/${campaignId}/stats`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setStats(data); setError(''); })
      .catch(() => setError('Could not load campaign statistics.'))
      .finally(() => setLoading(false));
  }, [campaignId]);

  useEffect(() => {
    setLoading(true);
    fetchStats();
    intervalRef.current = setInterval(fetchStats, 30000);
    return () => clearInterval(intervalRef.current);
  }, [fetchStats]);

  if (loading) {
    return (
      <div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-wire/20 animate-pulse rounded-sm" />)}
        </div>
        <div className="h-32 bg-wire/20 animate-pulse rounded-sm" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-signal rounded-sm flex items-start gap-3">
        <AlertTriangle size={16} className="text-signal shrink-0 mt-0.5" />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-signal mb-1">Dashboard Error</p>
          <p className="text-sm font-medium text-signal">{error}</p>
          <button onClick={() => { setLoading(true); fetchStats(); }} className="text-xs font-bold text-ink underline mt-2">Retry</button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="border border-wire bg-white p-12 text-center rounded-sm">
        <BarChart3 size={40} className="text-ink-300 mx-auto mb-4" />
        <p className="text-sm font-bold text-ink-600 uppercase tracking-wider">No Analytics Data Yet</p>
        <p className="text-xs text-ink-400 mt-1">Data will appear once your campaign starts serving impressions.</p>
      </div>
    );
  }

  const {
    status, impressions_served = 0, clicks = 0, ctr = 0, days_remaining = 0,
    days_total = 0, impressions_goal = 0, progress_percent = 0, daily = [],
  } = stats;

  const last7 = daily.slice(-7);
  const maxImp = Math.max(1, ...last7.map(d => d.impressions || 0));

  return (
    <div>
      {status === 'paused' && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-sm text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-2">
          <Pause size={14} /> Campaign Paused — not currently serving impressions
        </div>
      )}
      {status === 'completed' && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-sm text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-2">
          Campaign Complete — rotation has ended
        </div>
      )}

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}>
          {status || 'draft'}
        </span>
        <div className="flex gap-2 flex-wrap">
          {status === 'active' && onPause && (
            <button onClick={onPause} className="border border-wire bg-white text-ink font-bold uppercase text-xs tracking-wider px-4 py-2 rounded-sm hover:border-ink transition-colors flex items-center gap-2"><Pause size={14} /> Pause</button>
          )}
          {status === 'paused' && onResume && (
            <button onClick={onResume} className="border border-wire bg-white text-ink font-bold uppercase text-xs tracking-wider px-4 py-2 rounded-sm hover:border-ink transition-colors flex items-center gap-2"><Play size={14} /> Resume</button>
          )}
          {onEdit && (
            <button onClick={onEdit} className="border border-wire bg-white text-ink font-bold uppercase text-xs tracking-wider px-4 py-2 rounded-sm hover:border-ink transition-colors flex items-center gap-2"><Edit3 size={14} /> Edit</button>
          )}
          {onViewReport && (
            <button onClick={onViewReport} className="bg-ink text-white font-bold uppercase text-xs tracking-wider px-4 py-2 rounded-sm hover:bg-ink/90 transition-colors flex items-center gap-2"><FileText size={14} /> View Report</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Eye} label="Impressions Served" value={impressions_served.toLocaleString()} />
        <StatCard icon={MousePointerClick} label="Clicks" value={clicks.toLocaleString()} />
        <StatCard icon={TrendingUp} label="CTR" value={`${(ctr || 0).toFixed(2)}%`} mono />
        <StatCard icon={Clock} label="Days Remaining" value={`${days_remaining} of ${days_total}`} />
      </div>

      <div className="border border-wire bg-white p-5 rounded-sm shadow-sm mb-6">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-2">Impression Goal Progress</p>
        <div className="h-3 bg-wire/40 rounded-sm overflow-hidden">
          <div
            className="h-full bg-signal transition-all duration-500"
            style={{ width: `${Math.min(100, progress_percent || 0)}%` }}
          />
        </div>
        <p className="text-xs font-bold text-ink-600 mt-2 font-mono">
          {impressions_served.toLocaleString()} of {impressions_goal.toLocaleString()} impressions ({(progress_percent || 0).toFixed(1)}%)
        </p>
      </div>

      <div className="border border-wire bg-white p-5 rounded-sm shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-4">Last 7 Days</p>
        {last7.length === 0 ? (
          <p className="text-xs text-ink-400">No daily data yet.</p>
        ) : (
          <div className="flex items-end gap-2 h-28">
            {last7.map((d, i) => {
              const h = Math.max(4, Math.round((d.impressions / maxImp) * 100));
              const opacity = 0.3 + 0.4 * (d.impressions / maxImp);
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full relative"
                  onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}>
                  {hoverIdx === i && (
                    <div className="absolute -top-6 text-[10px] font-bold font-mono text-ink bg-white border border-wire px-1.5 py-0.5 rounded-sm whitespace-nowrap">
                      {d.impressions.toLocaleString()}
                    </div>
                  )}
                  <div className="w-full bg-ink rounded-sm" style={{ height: `${h}%`, opacity }} />
                  <span className="text-[9px] font-bold text-ink-400 mt-1 uppercase">
                    {d.date ? new Date(d.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }) : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
