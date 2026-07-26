'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Play, Film, Loader2, ChevronDown } from 'lucide-react';
import VideoCard from '../../components/VideoCard';
import BreakingTicker from '../../components/BreakingTicker';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const FILTERS = ['all', 'news', 'documentary', 'entertainment', 'educational', 'music', 'sports', 'technology'];
const FILTER_LABELS = {
  all: 'All',
  news: 'News',
  documentary: 'Documentary',
  entertainment: 'Entertainment',
  educational: 'Educational',
  music: 'Music',
  sports: 'Sports',
  technology: 'Technology',
};
const SORT_OPTIONS = [
  { value: 'latest', label: 'Latest' },
  { value: 'trending', label: 'Trending' },
];

export default function VideosPage() {
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('latest');
  const [sortOpen, setSortOpen] = useState(false);
  const [videos, setVideos] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const sentinelRef = useRef(null);

  const fetchVideos = useCallback(async (selectedFilter, pageNum, selectedSort, isReset = false) => {
    if (isReset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let url = `${API_BASE}/videos?page=${pageNum}&limit=12`;
      if (selectedFilter !== 'all') {
        url += `&category=${selectedFilter}`;
      }
      if (selectedSort && selectedSort !== 'latest') {
        url += `&sort=${selectedSort}`;
      }

      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();

      if (data && Array.isArray(data.videos)) {
        let list = data.videos;
        if (selectedSort === 'trending') {
          list = [...list].sort((a, b) => (b.views || 0) - (a.views || 0));
        }
        setVideos((prev) => (isReset ? list : [...(prev || []), ...list]));
        setTotalPages(data.totalPages || 1);
      } else {
        if (isReset) setVideos([]);
      }
    } catch (e) {
      console.error('Failed to fetch videos:', e);
      if (isReset) setVideos([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    fetchVideos(filter, 1, sort, true);
  }, [filter, sort, fetchVideos]);

  const loadMore = useCallback(() => {
    setPage((prevPage) => {
      if (prevPage < totalPages && !loadingMore) {
        const nextPage = prevPage + 1;
        fetchVideos(filter, nextPage, sort, false);
        return nextPage;
      }
      return prevPage;
    });
  }, [totalPages, loadingMore, filter, sort, fetchVideos]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '400px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore]);

  const safeVideos = Array.isArray(videos) ? videos : [];

  return (
    <div className="bg-paper min-h-screen pb-20 flex flex-col">
      <BreakingTicker />

      <section className="relative bg-ink text-white pt-16 pb-16 px-5 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=1600&auto=format&fit=crop&q=80')] bg-cover bg-center opacity-20 pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-signal text-white font-bold text-xs uppercase tracking-widest px-3 py-1 rounded-sm mb-4">
              <Play size={14} fill="currentColor" /> Stream Network
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-4">Videos</h1>
            <p className="text-white/80 text-sm sm:text-base font-medium leading-relaxed">
              Watch stories come to life. Documentaries, news reports, and more.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <Link
                href="/shorts"
                className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white font-bold uppercase text-xs tracking-wider px-5 py-3 rounded-full hover:bg-signal hover:border-signal transition-all"
              >
                <Play size={14} fill="currentColor" /> Watch Shorts
              </Link>
              <Link
                href="/upload/video"
                className="inline-flex items-center gap-2 bg-signal text-white font-bold uppercase text-xs tracking-wider px-5 py-3 rounded-full hover:bg-signal/90 transition-all"
              >
                Upload Video
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-5 w-full pt-10 flex-1">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-none flex-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                  filter === f ? 'bg-ink text-white shadow-md' : 'bg-white border border-wire text-ink-600 hover:border-ink'
                }`}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>

          <div className="relative shrink-0">
            <button
              onClick={() => setSortOpen(!sortOpen)}
              className="flex items-center gap-1.5 border border-wire bg-white px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider text-ink-600 hover:border-ink transition-colors"
            >
              {SORT_OPTIONS.find((s) => s.value === sort)?.label || 'Latest'}
              <ChevronDown size={14} className={`transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-wire rounded-sm shadow-lg overflow-hidden z-20 min-w-[140px]">
                {SORT_OPTIONS.map((opt) => (
                  <button key={opt.value} onClick={() => { setSort(opt.value); setSortOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-ink-50 transition-colors ${sort === opt.value ? 'text-signal' : 'text-ink'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 py-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-wire/20 h-72 rounded-sm" />
            ))}
          </div>
        ) : safeVideos.length === 0 ? (
          <div className="border border-wire bg-white rounded-sm p-20 flex flex-col items-center text-center my-10 shadow-sm">
            <Film size={48} className="text-ink-300 mb-4" />
            <p className="text-2xl font-bold mb-2 text-ink uppercase tracking-tight">No videos yet</p>
            <p className="text-xs text-ink-500 font-medium max-w-sm">
              Be the first creator to upload a video broadcast or documentary to the platform.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {safeVideos.map((vid) => (
                <VideoCard key={vid.id} video={vid} showPublisher={true} />
              ))}
            </div>

            <div ref={sentinelRef} className="h-1" />

            {page < totalPages && (
              <div className="pt-2 text-center flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="bg-white border border-wire text-ink font-bold uppercase tracking-wider text-xs px-10 py-4 rounded-full hover:bg-ink hover:text-white transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {loadingMore && <Loader2 size={14} className="animate-spin" />}
                  {loadingMore ? 'Loading...' : 'Load more videos'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}