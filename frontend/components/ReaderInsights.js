'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Users, TrendingUp, MapPin, RefreshCw, BarChart3 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
let csrfToken = null;

async function fetchCsrfToken() {
  if (csrfToken) return csrfToken;
  try {
    const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
    const data = await res.json();
    csrfToken = data.token;
    return csrfToken;
  } catch (e) { return ''; }
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (options.method && options.method !== 'GET') {
    const token = await fetchCsrfToken();
    if (token) headers['X-CSRF-Token'] = token;
  }
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include', headers, ...options });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'API request failed');
  }
  return res.json();
}

function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-24 bg-ink-50 rounded-md border border-wire/60" />
      ))}
    </div>
  );
}

export default function ReaderInsights({ userId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api('/users/me/reader-insights');
      setData(res);
    } catch (e) {
      setError(e.message || 'Failed to load reader insights.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="py-2">
        <Skeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center text-center py-10 gap-4">
        <p className="text-sm font-bold text-red-500">{error}</p>
        <button
          onClick={load}
          className="bg-ink text-white font-bold uppercase text-xs tracking-widest px-5 py-2.5 rounded-sm hover:bg-signal transition-colors flex items-center gap-2"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const topReaders = data?.topReaders || [];
  const viewsOverTime = data?.viewsOverTime || [];
  const geography = data?.geography || [];
  const maxViews = Math.max(1, ...viewsOverTime.map((v) => v.views || 0));
  const isEmpty = topReaders.length === 0 && viewsOverTime.length === 0 && geography.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center text-center py-10 gap-3">
        <BarChart3 size={28} className="text-ink-300" />
        <p className="text-sm font-medium text-ink-500">No reader data yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Readers */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users size={16} className="text-signal" />
          <h4 className="text-xs font-black uppercase tracking-widest text-ink">Top Readers</h4>
        </div>
        {topReaders.length === 0 ? (
          <p className="text-xs font-medium text-ink-400 italic">No engaged readers yet.</p>
        ) : (
          <div className="space-y-2">
            {topReaders.map((r) => (
              <div key={r.id} className="flex items-center justify-between bg-ink-50 border border-wire/60 rounded-sm px-4 py-2.5">
                <span className="text-sm font-bold text-ink">{r.publisher_name || 'Anonymous Reader'}</span>
                <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wide">
                  {r.like_count || 0} likes · {r.comment_count || 0} comments
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Views Over Time */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-signal" />
          <h4 className="text-xs font-black uppercase tracking-widest text-ink">Views Over Time (30 days)</h4>
        </div>
        {viewsOverTime.length === 0 ? (
          <p className="text-xs font-medium text-ink-400 italic">No view data for the last 30 days.</p>
        ) : (
          <div className="flex items-end gap-1 h-32 border-b border-wire pb-1 overflow-x-auto">
            {viewsOverTime.map((v) => (
              <div
                key={v.day}
                title={`${v.views} views on ${v.day}`}
                className="flex-1 min-w-[6px] bg-signal/70 hover:bg-signal rounded-t-sm transition-colors"
                style={{ height: `${Math.max(4, (v.views / maxViews) * 100)}%` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Geography */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <MapPin size={16} className="text-signal" />
          <h4 className="text-xs font-black uppercase tracking-widest text-ink">Reader Geography</h4>
        </div>
        {geography.length === 0 ? (
          <p className="text-xs font-medium text-ink-400 italic">No geographic data yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {geography.map((g) => (
              <div key={g.region} className="flex items-center justify-between bg-ink-50 border border-wire/60 rounded-sm px-4 py-2.5">
                <span className="text-sm font-bold text-ink">{g.region}</span>
                <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wide">{g.views} views</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
