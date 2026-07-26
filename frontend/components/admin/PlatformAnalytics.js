'use client';

import { useState, useEffect } from 'react';
import { BarChart3, Film, Radio, Play, Users, Eye, Clock, Loader2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function PlatformAnalytics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [vidRes, healthRes] = await Promise.all([
        fetch(`${API_BASE}/videos?limit=1`, { credentials: 'include' }).then(r => r.json()).catch(() => ({ total: 0 })),
        fetch(`${API_BASE}/health`, { credentials: 'include' }).then(r => r.json()).catch(() => ({ services: [] })),
      ]);
      setStats({
        totalVideos: vidRes.total || 0,
        services: healthRes.services || [],
      });
    } catch {
      setStats({ totalVideos: 0, services: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={28} className="animate-spin text-signal" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-ink">Platform Analytics</h2>
        <p className="text-xs text-ink-500 mt-0.5">Aggregated metrics across all content types and features.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border border-wire rounded-sm p-5 bg-paper">
          <div className="flex items-center gap-2 mb-3">
            <Film size={18} className="text-signal" />
            <span className="text-xs font-bold uppercase tracking-wider text-ink-400">Total Videos</span>
          </div>
          <p className="text-2xl font-black text-ink">{stats?.totalVideos || 0}</p>
        </div>
        <div className="border border-wire rounded-sm p-5 bg-paper">
          <div className="flex items-center gap-2 mb-3">
            <Play size={18} className="text-signal" />
            <span className="text-xs font-bold uppercase tracking-wider text-ink-400">Shorts</span>
          </div>
          <p className="text-2xl font-black text-ink">—</p>
        </div>
        <div className="border border-wire rounded-sm p-5 bg-paper">
          <div className="flex items-center gap-2 mb-3">
            <Radio size={18} className="text-signal" />
            <span className="text-xs font-bold uppercase tracking-wider text-ink-400">Live Rooms</span>
          </div>
          <p className="text-2xl font-black text-ink">—</p>
        </div>
        <div className="border border-wire rounded-sm p-5 bg-paper">
          <div className="flex items-center gap-2 mb-3">
            <Users size={18} className="text-signal" />
            <span className="text-xs font-bold uppercase tracking-wider text-ink-400">Active Users</span>
          </div>
          <p className="text-2xl font-black text-ink">—</p>
        </div>
      </div>

      <div className="border border-wire rounded-sm p-6 bg-paper">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink mb-4 flex items-center gap-2">
          <BarChart3 size={14} className="text-signal" /> Service Health Summary
        </h3>
        <div className="space-y-2">
          {(stats?.services || []).map(s => (
            <div key={s.provider} className="flex items-center justify-between text-xs border-b border-wire pb-2">
              <span className="font-bold text-ink capitalize">{s.provider.replace(/_/g, ' ')}</span>
              <span className={`font-bold uppercase tracking-wider ${s.status === 'ok' ? 'text-emerald-600' : s.status === 'degraded' ? 'text-amber-600' : 'text-signal'}`}>
                {s.status} {s.latencyMs > 0 && `(${s.latencyMs}ms)`}
              </span>
            </div>
          ))}
          {(!stats?.services || stats.services.length === 0) && (
            <p className="text-xs text-ink-400">No health data available. Check the Health Monitor tab.</p>
          )}
        </div>
      </div>
    </div>
  );
}