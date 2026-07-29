'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Printer, RefreshCw, FileDown, Newspaper, Users, Eye } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

async function api(path) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'API request failed');
  }
  return res.json();
}

export default function PublisherMediaKit({ userId, publisherName, bio, stats, topStories }) {
  const [loading, setLoading] = useState(!stats);
  const [error, setError] = useState('');
  const [resolvedStats, setResolvedStats] = useState(stats || null);
  const [resolvedStories, setResolvedStories] = useState(topStories || []);
  const [printMode, setPrintMode] = useState(false);

  const load = useCallback(async () => {
    if (stats && topStories) return; // caller already provided data
    setLoading(true);
    setError('');
    try {
      const userRes = await api(`/users/${userId}`);
      setResolvedStats({
        totalStories: userRes.user?.storyCount ?? 0,
        followers: userRes.user?.followerCount ?? 0,
        totalViews: userRes.user?.totalViews ?? 0,
      });
    } catch (e) {
      setError(e.message || 'Failed to load media kit data.');
    } finally {
      setLoading(false);
    }
  }, [userId, stats, topStories]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePrint = () => {
    setPrintMode(true);
    // allow DOM to switch to print layout before invoking print dialog
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintMode(false), 500);
    }, 50);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-signal" size={28} />
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

  const s = resolvedStats || { totalStories: 0, followers: 0, totalViews: 0 };
  const stories = resolvedStories || [];

  return (
    <div className={printMode ? 'print:block' : ''}>
      {!printMode && (
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-ink">Media Kit</h3>
          <button
            onClick={handlePrint}
            className="bg-ink text-white font-bold uppercase text-xs tracking-widest px-5 py-2.5 rounded-sm hover:bg-signal transition-colors flex items-center gap-2 shadow-sm"
          >
            <FileDown size={14} /> Download Media Kit
          </button>
        </div>
      )}

      <div className="bg-white border border-wire rounded-md p-8 space-y-8 print:border-0 print:shadow-none">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-ink">{publisherName}</h2>
          <p className="text-sm text-ink-500 font-medium mt-2 leading-relaxed max-w-2xl">
            {bio || 'No bio provided yet.'}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center border border-wire rounded-sm py-4">
            <Newspaper size={18} className="mx-auto text-signal mb-2" />
            <p className="text-xl font-black text-ink">{s.totalStories}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Stories</p>
          </div>
          <div className="text-center border border-wire rounded-sm py-4">
            <Users size={18} className="mx-auto text-signal mb-2" />
            <p className="text-xl font-black text-ink">{s.followers}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Followers</p>
          </div>
          <div className="text-center border border-wire rounded-sm py-4">
            <Eye size={18} className="mx-auto text-signal mb-2" />
            <p className="text-xl font-black text-ink">{s.totalViews}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Total Views</p>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-ink-500 mb-3">Top Stories</h3>
          {stories.length === 0 ? (
            <p className="text-xs text-ink-400 italic">No stories to feature yet.</p>
          ) : (
            <ol className="space-y-2 list-decimal list-inside">
              {stories.slice(0, 5).map((story) => (
                <li key={story.id} className="text-sm font-medium text-ink">
                  {story.title}
                  <span className="text-ink-400 text-xs ml-2">
                    ({story.view_count || story.viewCount || 0} views)
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
