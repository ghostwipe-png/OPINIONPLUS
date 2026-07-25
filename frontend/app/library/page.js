'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  History, Clock, ThumbsUp, ListVideo, Film, Loader2,
  Trash2, Bookmark, Play, Eye, Search
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useSearchParams } from 'next/navigation';
import PlaylistCard from '../../components/PlaylistCard';
import VideoCard from '../../components/VideoCard';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

const TABS = [
  { key: 'history', label: 'History', icon: History },
  { key: 'watch-later', label: 'Watch Later', icon: Clock },
  { key: 'liked', label: 'Liked Videos', icon: ThumbsUp },
  { key: 'playlists', label: 'Playlists', icon: ListVideo },
  { key: 'my-videos', label: 'Your Videos', icon: Film },
];

function LibraryContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'history';
  const { user } = useAuth();

  const [tab, setTab] = useState(initialTab);
  const [history, setHistory] = useState([]);
  const [watchLater, setWatchLater] = useState([]);
  const [likedVideos, setLikedVideos] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [myVideos, setMyVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const fetches = [];

      if (tab === 'history') {
        fetches.push(
          fetch(`${API_BASE}/history`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : { history: [] })
            .then(d => setHistory(d.history || []))
        );
      }

      if (tab === 'watch-later') {
        fetches.push(
          fetch(`${API_BASE}/watch-later`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : { videos: [] })
            .then(d => setWatchLater(d.videos || []))
        );
      }

      if (tab === 'liked') {
        fetches.push(
          fetch(`${API_BASE}/videos`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : { videos: [] })
            .then(d => setLikedVideos((d.videos || []).filter(v => v.likes_count > 0).slice(0, 50)))
        );
      }

      if (tab === 'playlists') {
        fetches.push(
          fetch(`${API_BASE}/playlists`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : { playlists: [] })
            .then(d => setPlaylists(d.playlists || []))
        );
      }

      if (tab === 'my-videos') {
        fetches.push(
          fetch(`${API_BASE}/videos/user/videos`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : { videos: [] })
            .then(d => setMyVideos(d.videos || []))
        );
      }

      await Promise.all(fetches);
    } catch (e) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [tab, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const clearHistory = async () => {
    if (!confirm('Clear all watch history?')) return;
    try {
      await fetch(`${API_BASE}/history`, { method: 'DELETE', credentials: 'include' });
      setHistory([]);
    } catch (e) {}
  };

  const removeFromWatchLater = async (videoId) => {
    try {
      await fetch(`${API_BASE}/watch-later/${videoId}`, { method: 'DELETE', credentials: 'include' });
      setWatchLater(prev => prev.filter(v => v.id !== videoId));
    } catch (e) {}
  };

  const removeFromHistory = async (videoId) => {
    try {
      await fetch(`${API_BASE}/history/${videoId}`, { method: 'DELETE', credentials: 'include' });
      setHistory(prev => prev.filter(v => v.video_id !== videoId));
    } catch (e) {}
  };

  if (!user) {
    return (
      <div className="bg-paper min-h-screen flex flex-col items-center justify-center px-5 py-24">
        <History size={48} className="text-ink-300 mb-4" />
        <h1 className="text-2xl font-black text-ink uppercase mb-2">Sign in to view your library</h1>
        <p className="text-xs text-ink-500 mb-6">Access your history, watch later, playlists, and more.</p>
        <Link href="/login" className="bg-ink text-white font-bold uppercase text-xs px-6 py-3 rounded-sm">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="bg-paper min-h-screen pb-24">
      <div className="border-b border-wire bg-white">
        <div className="max-w-7xl mx-auto px-5 py-8">
          <h1 className="text-2xl font-black text-ink uppercase tracking-tight mb-6">Library</h1>
          <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-none">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${tab === t.key ? 'bg-ink text-white' : 'text-ink-500 hover:bg-ink-50 hover:text-ink'}`}>
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 pt-8">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-signal" /></div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-sm text-signal font-bold">{error}</p>
            <button onClick={loadData} className="mt-4 text-xs font-bold uppercase text-ink underline">Retry</button>
          </div>
        ) : (
          <>
            {tab === 'history' && (
              <div>
                {history.length > 0 && (
                  <div className="flex justify-end mb-4">
                    <button onClick={clearHistory} className="text-xs font-bold uppercase text-signal hover:underline flex items-center gap-1"><Trash2 size={12} /> Clear all history</button>
                  </div>
                )}
                {history.length === 0 ? <EmptyState icon={History} label="No watch history" /> : (
                  <div className="space-y-1">
                    {history.map((item) => (
                      <div key={item.video_id} className="flex items-center gap-4 p-2 rounded-sm hover:bg-ink-50 group">
                        <Link href={`/videos/${item.video_id}`} className="w-40 shrink-0 aspect-video rounded-sm overflow-hidden bg-ink-100">
                          {item.thumbnail_url ? <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Film size={18} className="text-ink-300" /></div>}
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link href={`/videos/${item.video_id}`} className="text-sm font-semibold text-ink hover:text-signal line-clamp-1">{item.title}</Link>
                          <p className="text-xs text-ink-500">{item.user_name}</p>
                        </div>
                        <button onClick={() => removeFromHistory(item.video_id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-ink-400 hover:text-signal"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {tab === 'watch-later' && (
              <div>
                {watchLater.length === 0 ? <EmptyState icon={Clock} label="No videos saved for later" /> : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {watchLater.map((v) => (
                      <div key={v.id} className="relative group">
                        <VideoCard video={v} showPublisher={true} />
                        <button onClick={() => removeFromWatchLater(v.id)} className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity hover:text-signal"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {tab === 'liked' && (
              <div>
                {likedVideos.length === 0 ? <EmptyState icon={ThumbsUp} label="No liked videos yet" /> : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {likedVideos.map((v) => <VideoCard key={v.id} video={v} showPublisher={true} />)}
                  </div>
                )}
              </div>
            )}
            {tab === 'playlists' && (
              <div>
                <div className="flex justify-end mb-4">
                  <button onClick={() => { const title = prompt('Playlist name:'); if (title) { fetch(`${API_BASE}/playlists`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) }).then(() => loadData()).catch(() => {}); } }} className="bg-ink text-white font-bold uppercase text-xs tracking-wider px-4 py-2 rounded-sm hover:bg-signal transition-colors">+ New Playlist</button>
                </div>
                {playlists.length === 0 ? <EmptyState icon={ListVideo} label="No playlists yet" /> : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {playlists.map((p) => <PlaylistCard key={p.id} playlist={p} />)}
                  </div>
                )}
              </div>
            )}
            {tab === 'my-videos' && (
              <div>
                {myVideos.length === 0 ? <EmptyState icon={Film} label="No videos uploaded yet" /> : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {myVideos.map((v) => <VideoCard key={v.id} video={v} showPublisher={false} />)}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, label }) {
  return (
    <div className="text-center py-20">
      <Icon size={48} className="mx-auto text-ink-300 mb-4" />
      <p className="text-sm font-bold text-ink-500 uppercase tracking-wider">{label}</p>
      <p className="text-xs text-ink-400 mt-1">Videos will appear here when available.</p>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-signal" />
      </div>
    }>
      <LibraryContent />
    </Suspense>
  );
}