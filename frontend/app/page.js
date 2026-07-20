'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { useStore } from '../lib/store';
import BreakingTicker from '../components/BreakingTicker';
import HeroGrid from '../components/HeroGrid';
import FilterBar from '../components/FilterBar';
import MagazineRow, { MagazineRowSkeleton } from '../components/MagazineRow';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const PAGE_SIZE = 20;

const FILTERS = ['all', 'story', 'documentary', 'news'];
const FILTER_LABELS = {
  all: 'Top Stories',
  story: 'Stories',
  documentary: 'Documentaries',
  news: 'News',
};

export default function HomePage() {
  const { stories, ready } = useStore();
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('list');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [trending, setTrending] = useState([]);

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

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [filter]);

  const paged = visible.slice(0, visibleCount);
  const hasMore = visibleCount < visible.length;

  return (
    <div>
      <BreakingTicker />

      <HeroGrid />

      <FilterBar
        filter={filter}
        onFilterChange={setFilter}
        filters={FILTERS}
        filterLabels={FILTER_LABELS}
      />

      {trending.length > 0 && (
        <section className="max-w-6xl mx-auto px-5 pt-10" aria-labelledby="trending-heading">
          <h2 id="trending-heading" className="wire-tag mb-2 flex items-center gap-1.5">
            <TrendingUp size={12} /> Trending this week
          </h2>
          <div className="grid gap-x-8 sm:grid-cols-3">
            {trending.slice(0, 3).map((s) => (
              <MagazineRow key={`trending-${s.id}`} story={s} />
            ))}
          </div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-5 py-12" aria-labelledby="feed-heading">
        <h2 id="feed-heading" className="sr-only">The feed</h2>

        {!ready ? (
          <div className="flex flex-col">
            {Array.from({ length: 6 }).map((_, i) => <MagazineRowSkeleton key={i} />)}
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
            <div className="flex flex-col">
              {paged.map((s) => (
                <MagazineRow key={s.id} story={s} />
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
