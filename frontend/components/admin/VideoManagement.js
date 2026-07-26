'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Film, Search, Trash2, Eye, Loader2, ExternalLink } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function VideoManagement({ showToast, runGated }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', '50');
      if (categoryFilter !== 'all') params.append('category', categoryFilter);

      const res = await fetch(`${API_BASE}/videos?${params}`, { credentials: 'include' });
      const data = await res.json();
      setVideos(Array.isArray(data.videos) ? data.videos : []);
      setTotalPages(data.totalPages || 1);
    } catch (e) {
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVideos(); }, [page, categoryFilter]);

  const deleteVideo = async (id) => {
    try {
      const token = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/)?.[1] || '';
      const res = await fetch(`${API_BASE}/videos/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-CSRF-Token': token },
      });
      if (res.ok) {
        showToast('Video deleted');
        fetchVideos();
      }
    } catch {
      showToast('Failed to delete video', 'error');
    }
  };

  const filteredVideos = videos.filter(v => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (v.title || '').toLowerCase().includes(q) || (v.user_name || '').toLowerCase().includes(q);
  });

  const categories = ['all', 'news', 'documentary', 'entertainment', 'educational', 'music', 'sports', 'technology'];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-ink">Video Management</h2>
        <p className="text-xs text-ink-500 mt-0.5">View, search, and manage all platform videos.</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center bg-paper p-4 border border-wire rounded-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-2.5 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or creator..."
            className="w-full border border-wire rounded-sm pl-9 pr-3 py-2 text-xs font-medium"
          />
        </div>
        <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} className="text-xs font-bold uppercase tracking-wider border border-wire rounded-sm px-3 py-2">
          {categories.map(c => (
            <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>
          ))}
        </select>
        {loading && <Loader2 size={16} className="animate-spin text-signal" />}
      </div>

      <div className="border border-wire rounded-sm divide-y divide-wire bg-paper">
        {!loading && filteredVideos.length === 0 && (
          <div className="p-12 text-center">
            <Film size={32} className="mx-auto text-ink-300 mb-3" />
            <p className="text-sm font-bold text-ink">No videos found</p>
          </div>
        )}
        {filteredVideos.map(v => (
          <div key={v.id} className="p-4 flex items-center justify-between gap-4 hover:bg-ink-50/30 transition-colors">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-24 h-14 shrink-0 rounded-sm overflow-hidden bg-ink-100">
                {v.thumbnail_url ? (
                  <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Film size={18} className="text-ink-300" /></div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-ink truncate">{v.title}</p>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-ink text-white">{v.category}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${v.status === 'ready' ? 'bg-emerald-100 text-emerald-800' : v.status === 'processing' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-signal'}`}>{v.status}</span>
                </div>
                <p className="text-xs text-ink-500 mt-0.5">{v.user_name} · {v.views || 0} views · {Math.floor((v.duration_seconds || 0) / 60)}:{(v.duration_seconds || 0) % 60} · {v.privacy}</p>
                <p className="text-[11px] text-ink-400">{new Date(v.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/videos/${v.id}`} target="_blank" className="border border-wire bg-white hover:border-ink p-2 rounded-sm text-ink transition-colors" title="View">
                <ExternalLink size={14} />
              </Link>
              <button onClick={() => runGated(`Delete "${v.title}"?`, () => deleteVideo(v.id))} className="border border-red-200 bg-red-50 hover:bg-signal text-signal hover:text-white p-2 rounded-sm transition-colors" title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-xs font-bold">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="border border-wire px-4 py-2 rounded-sm disabled:opacity-30">Previous</button>
          <span className="text-ink-400">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="border border-wire px-4 py-2 rounded-sm disabled:opacity-30">Next</button>
        </div>
      )}
    </div>
  );
}