// app/admin/PressReleaseAdminTab.js
//
// Self-contained "Press Releases" tab for the admin dashboard. Your existing
// frontend/app/admin/page.js is large, so rather than reproduce the whole file,
// drop this component in alongside it and wire it into your TABS array — see
// ADMIN_WIRING.md in this same delivery for the exact 3-line diff.
//
// This component expects a backend endpoint for admin listing/search, which is
// NOT part of the existing services.js routes (those only expose a user's own
// history). Add this small admin-only route to backend/src/routes/services.js
// (documented in ADMIN_WIRING.md) before wiring this tab up, or point
// ADMIN_LIST_ENDPOINT below at wherever you'd rather serve it from.

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, AlertTriangle, Search, Eye, Trash2, Megaphone } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const ADMIN_LIST_ENDPOINT = `${API_BASE}/services/press-release/admin/list`;

const STATUS_FILTERS = ['all', 'draft', 'scheduled', 'published', 'deleted'];

const STATUS_STYLES = {
  draft: 'bg-ink-100 text-ink-500',
  scheduled: 'bg-amber-50 text-amber-700 border border-amber-200',
  published: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  deleted: 'bg-red-50 text-signal border border-red-200',
};

async function getCsrfToken() {
  try {
    const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
    const data = await res.json();
    return data.token || '';
  } catch (e) {
    return '';
  }
}

export default function PressReleaseAdminTab() {
  const [releases, setReleases] = useState([]);
  const [stats, setStats] = useState({ total: 0, publishedToday: 0, scheduled: 0, totalViews: 0 });
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (pageNum = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: '20' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search.trim()) params.set('q', search.trim());

      const res = await fetch(`${ADMIN_LIST_ENDPOINT}?${params.toString()}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load press releases.');

      setReleases(data.releases || []);
      setStats(data.stats || { total: 0, publishedToday: 0, scheduled: 0, totalViews: 0 });
      setTotalPages(data.totalPages || 1);
      setPage(data.page || 1);
    } catch (e) {
      setError(e.message || 'Failed to load press releases.');
    }
    setLoading(false);
  }, [statusFilter, search]);

  useEffect(() => { load(1); }, [load]);

  const handleDelete = async (release) => {
    if (!confirm(`Delete "${release.title}" by ${release.company}?`)) return;
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`${API_BASE}/services/press-release/${release.id}`, {
        method: 'DELETE', credentials: 'include', headers: { 'X-CSRF-Token': csrfToken },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete.');
      load(page);
    } catch (e) {
      alert(e.message || 'Failed to delete release.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b-2 border-wire pb-4">
        <Megaphone className="text-signal" size={22} />
        <h2 className="text-xl font-black text-ink uppercase tracking-tight">Press Releases</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Releases', value: stats.total },
          { label: 'Published Today', value: stats.publishedToday },
          { label: 'Scheduled', value: stats.scheduled },
          { label: 'Total Views', value: stats.totalViews },
        ].map(s => (
          <div key={s.label} className="border border-wire bg-white p-4 rounded-sm shadow-sm">
            <p className="text-2xl font-black text-ink">{s.value}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') load(1); }}
            placeholder="Search by title or company..."
            className="w-full border border-wire rounded-sm pl-9 pr-3 py-2 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-[10px] font-bold uppercase tracking-wider px-3 py-2 rounded-sm border transition-colors ${
                statusFilter === s ? 'bg-ink text-white border-ink' : 'border-wire text-ink-500 hover:border-ink'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-signal rounded-sm flex items-start gap-3">
          <AlertTriangle size={16} className="text-signal shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-signal">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 className="animate-spin text-ink" /></div>
      ) : releases.length === 0 ? (
        <div className="border border-wire bg-white p-12 text-center rounded-sm shadow-sm">
          <p className="text-sm font-bold text-ink-600 uppercase tracking-wider">No press releases match this filter</p>
        </div>
      ) : (
        <div className="border border-wire bg-white rounded-sm shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-wire text-left">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-ink-400">Title</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-ink-400">Company</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-ink-400">User</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-ink-400">Status</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-ink-400">Date</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-ink-400">Views</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-ink-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {releases.map(r => (
                <tr key={r.id} className="border-b border-wire last:border-0 hover:bg-paper/60">
                  <td className="px-4 py-3 font-bold text-ink max-w-xs truncate">{r.title}</td>
                  <td className="px-4 py-3 text-ink-600">{r.company}</td>
                  <td className="px-4 py-3 text-ink-500 text-xs">{r.user_email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm ${STATUS_STYLES[r.status] || STATUS_STYLES.draft}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-400 text-xs">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 font-bold text-ink">{r.views || 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <a href={`/services/press-release/${r.id}`} target="_blank" rel="noreferrer" className="p-1.5 rounded-sm border border-wire hover:border-ink transition-colors">
                        <Eye size={13} className="text-ink" />
                      </a>
                      <button onClick={() => handleDelete(r)} className="p-1.5 rounded-sm border border-wire hover:border-signal transition-colors">
                        <Trash2 size={13} className="text-ink-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button disabled={page <= 1} onClick={() => load(page - 1)} className="text-[11px] font-bold uppercase tracking-wider text-ink px-3 py-2 border border-wire rounded-sm disabled:opacity-40 hover:border-ink transition-colors">Previous</button>
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-400">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => load(page + 1)} className="text-[11px] font-bold uppercase tracking-wider text-ink px-3 py-2 border border-wire rounded-sm disabled:opacity-40 hover:border-ink transition-colors">Next</button>
        </div>
      )}
    </div>
  );
}
