'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { LayoutList, LayoutGrid, TrendingUp } from 'lucide-react';
import { useStore } from '../lib/store';
import StoryCard, { StoryCardSkeleton } from '../components/StoryCard';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const PAGE_SIZE = 20;

export default function HomePage() {
  const { stories, ready } = useStore();
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('list'); // 'list' | 'grid' — persisted below
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [trending, setTrending] = useState([]);

  // Restore the person's preferred view on mount. Falls back silently if
  // localStorage is unavailable (private browsing, SSR, etc).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('op_feed_view');
      if (saved === 'list' || saved === 'grid') setView(saved);
    } catch (e) { /* ignore */ }
  }, []);

  const setViewAndSave = (v) => {
    setView(v);
    try { window.localStorage.setItem('op_feed_view', v); } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/stories/trending`)
      .then((r) => (r.ok ? r.json() : { stories: [] }))
      .then((data) => { if (!cancelled) setTrending(data.stories || []); })
      .catch(() => { if (!cancelled) setTrending([]); });
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    return stories
      .filter((s) => !s.deleted && s.privacy === 'public')
      .filter((s) => {
        if (filter === 'all') return true;
        if (filter === 'news') return s.authorId === 'u_newsdesk';
        return s.type === filter;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [stories, filter]);

  // Reset pagination whenever the filter changes so "Load more" starts fresh.
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [filter]);

  const paged = visible.slice(0, visibleCount);
  const hasMore = visibleCount < visible.length;

  return (
    <div>
      <section className="border-b border-wire">
        <div className="max-w-6xl mx-auto px-5 py-16 sm:py-20">
          <p className="wire-tag mb-4">Vol. 1 — Every voice, a masthead</p>
          <h1 className="editorial-h text-4xl sm:text-6xl font-black leading-[1.05] max-w-3xl">
            Tell your story. Put your name on it. Build the audience that follows it.
          </h1>
          <p className="text-ink-600 max-w-xl mt-5 text-base sm:text-lg">
            OpinionPlus gives every writer and filmmaker their own masthead — logo, byline, and a
            page that&apos;s unmistakably theirs — plus the feed, comments, and ratings to build a
            readership around it.
          </p>
          <div className="flex gap-3 mt-8">
            <Link href="/publish" className="btn-primary px-5 py-3 rounded-sm text-sm">
              Publish your story
            </Link>
            <Link href="/about" className="btn-outline px-5 py-3 rounded-sm text-sm">
              Read the mission
            </Link>
          </div>
        </div>
      </section>

      {trending.length > 0 && (
        <section className="max-w-6xl mx-auto px-5 pt-10" aria-labelledby="trending-heading">
          <h2 id="trending-heading" className="wire-tag mb-4 flex items-center gap-1.5">
            <TrendingUp size={12} /> Trending this week
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {trending.slice(0, 3).map((s) => (
              <StoryCard key={`trending-${s.id}`} story={s} />
            ))}
          </div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-5 py-12" aria-labelledby="feed-heading">
        <div className="sticky top-16 z-30 bg-paper/95 backdrop-blur -mx-5 px-5 py-3 mb-6 border-b border-wire flex items-center justify-between flex-wrap gap-4">
          <h2 id="feed-heading" className="editorial-h text-2xl font-bold">The feed</h2>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex gap-2 text-xs font-semibold" role="tablist" aria-label="Filter stories">
              {['all', 'story', 'documentary', 'news'].map((f) => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none ${
                    filter === f ? 'bg-ink text-paper border-ink' : 'border-wire text-ink-600'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'story' ? 'Stories' : f === 'documentary' ? 'Documentaries' : 'News'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 border border-wire rounded-full p-0.5">
              <button
                onClick={() => setViewAndSave('list')}
                aria-label="List view"
                aria-pressed={view === 'list'}
                className={`p-1.5 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none ${view === 'list' ? 'bg-ink text-paper' : 'text-ink-400'}`}
              >
                <LayoutList size={14} />
              </button>
              <button
                onClick={() => setViewAndSave('grid')}
                aria-label="Grid view"
                aria-pressed={view === 'grid'}
                className={`p-1.5 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none ${view === 'grid' ? 'bg-ink text-paper' : 'text-ink-400'}`}
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          </div>
        </div>

        {!ready ? (
          <div className={view === 'grid' ? 'grid gap-4 sm:grid-cols-2' : 'flex flex-col'}>
            {Array.from({ length: 6 }).map((_, i) => <StoryCardSkeleton key={i} />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="border border-dashed border-wire rounded-sm p-12 text-center">
            <svg width="120" height="80" viewBox="0 0 120 80" fill="none" className="mx-auto mb-5 text-ink-200" aria-hidden="true">
              <rect x="10" y="10" width="100" height="60" rx="3" stroke="currentColor" strokeWidth="2" />
              <line x1="20" y1="26" x2="80" y2="26" stroke="currentColor" strokeWidth="2" />
              <line x1="20" y1="38" x2="90" y2="38" stroke="currentColor" strokeWidth="2" />
              <line x1="20" y1="50" x2="60" y2="50" stroke="currentColor" strokeWidth="2" />
            </svg>
            <p className="editorial-h text-xl font-bold mb-2">Nothing published yet.</p>
            <p className="text-sm text-ink-400 mb-4">Be the first byline on this page.</p>
            <Link href="/publish" className="btn-primary px-4 py-2 rounded-sm text-sm inline-block">
              Publish your story
            </Link>
          </div>
        ) : (
          <>
            <div className={`transition-opacity duration-200 ${view === 'grid' ? 'grid gap-4 sm:grid-cols-2' : 'flex flex-col'}`}>
              {paged.map((s) => (
                <StoryCard key={s.id} story={s} />
              ))}
            </div>
            {hasMore && (
              <div className="text-center mt-8">
                <button
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="btn-outline px-5 py-2.5 rounded-sm text-sm"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
