'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, MessageCircle } from 'lucide-react';
import { useStore } from '../lib/store';
import BreakingTicker from '../components/BreakingTicker';
import HeroGrid from '../components/HeroGrid';
import FilterBar from '../components/FilterBar';
import MagazineRow, { MagazineRowSkeleton } from '../components/MagazineRow';
import SocialBar from '../components/SocialBar';
import { getCategoryStyle } from '../components/categoryStyle';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const PAGE_SIZE = 20;

const FILTERS = ['all', 'story', 'documentary', 'news'];
const FILTER_LABELS = {
  all: 'All',
  story: 'Style hunter',
  documentary: 'Vogue',
  news: 'Health & Fitness',
};

// Helper component for the large featured post in the main feed
function FeaturedFeedCard({ story }) {
  const { users } = useStore();
  if (!story) return null;
  const author = users?.find((u) => u.id === story.authorId);
  const { bg, text, label } = getCategoryStyle(story);

  return (
    <Link href={`/story/${story.id}`} className="block group focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none">
      <div className="relative w-full aspect-[4/3] rounded-sm overflow-hidden mb-4 bg-ink-100">
        {story.coverImage ? (
          <img src={story.coverImage} alt={story.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full transition-transform duration-500 group-hover:scale-105" style={{ backgroundColor: bg, opacity: 0.2 }} />
        )}
        <span className="absolute bottom-0 left-0 text-[10px] font-bold uppercase px-2 py-1 z-10" style={{ backgroundColor: '#1C1917', color: '#FFFFFF' }}>
          {label}
        </span>
      </div>
      <h3 className="text-xl sm:text-2xl font-bold text-ink leading-tight mb-2 group-hover:text-signal transition-colors">
        {story.title}
      </h3>
      <div className="flex items-center gap-2 text-xs font-medium text-ink-500 mb-3">
        <span className="text-ink font-bold">{author?.publisherName || author?.name || 'OPINIONPLUS'}</span>
        <span>-</span>
        <span>{new Date(story.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        <div className="ml-auto bg-ink text-white text-[10px] px-1.5 py-0.5 rounded-sm flex items-center gap-1">
           <MessageCircle size={10} fill="currentColor" /> {story.comments?.length || 0}
        </div>
      </div>
      <p className="text-sm text-ink-600 line-clamp-3 leading-relaxed">
        {story.excerpt || story.body?.replace(/<[^>]*>?/gm, '').substring(0, 150) + '...'}
      </p>
    </Link>
  );
}

export default function HomePage() {
  const { stories, ready } = useStore();
  const [filter, setFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [trending, setTrending] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/stories/trending`)
      .then((r) => (r.ok ? r.json() : { stories: [] }))
      .then((data) => { if (!cancelled) setTrending(data.stories || []); })
      .catch(() => { if (!cancelled) setTrending([]); });
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    return (stories || [])
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
    <div className="bg-paper min-h-screen pb-16">
      <BreakingTicker />
      <HeroGrid />

      {/* TRENDING SECTION */}
      {trending.length > 0 && (
        <section className="max-w-6xl mx-auto px-5 pt-10 pb-4">
          <div className="flex items-center gap-2 mb-6 border-b-2 border-ink pb-2">
            <TrendingUp size={20} className="text-signal" />
            <h2 className="text-lg font-bold uppercase tracking-wide">Trending this week</h2>
          </div>
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
            {trending.slice(0, 3).map((s) => (
              <MagazineRow key={`trending-${s.id}`} story={s} />
            ))}
          </div>
        </section>
      )}

      {/* FILTER BAR - "DON'T MISS" */}
      <FilterBar filter={filter} onFilterChange={setFilter} filters={FILTERS} filterLabels={FILTER_LABELS} />

      {/* 2-COLUMN MAIN LAYOUT */}
      <section className="max-w-6xl mx-auto px-5" aria-label="Main Feed">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mt-2">
          
          {/* LEFT COLUMN: 70% MAIN FEED */}
          <div className="lg:col-span-8">
            {!ready ? (
              <div className="flex flex-col gap-4">{Array.from({ length: 4 }).map((_, i) => <MagazineRowSkeleton key={i} />)}</div>
            ) : visible.length === 0 ? (
              <div className="border border-dashed border-wire rounded-sm p-16 flex flex-col items-center text-center">
                <p className="text-2xl font-bold mb-3">Nothing published yet.</p>
                <Link href="/publish" className="bg-signal text-white font-semibold px-6 py-2.5 rounded-sm hover:bg-signal/90 inline-block">Publish your story</Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* First item is large featured card */}
                  {paged.length > 0 && (
                    <div className="md:col-span-1">
                      <FeaturedFeedCard story={paged[0]} />
                    </div>
                  )}
                  {/* Remaining items stack as a list next to it */}
                  <div className="md:col-span-1 flex flex-col pt-0 sm:-mt-5">
                    {paged.slice(1, 5).map((s) => (
                      <MagazineRow key={s.id} story={s} />
                    ))}
                  </div>
                </div>

                {/* If there are more than 5 items, stack them beneath in a grid */}
                {paged.length > 5 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8 border-t border-wire pt-8">
                    {paged.slice(5).map((s) => (
                      <div key={s.id} className="md:col-span-1 border-b border-wire/40 pb-5 mb-5 last:border-0 last:pb-0 last:mb-0">
                         <FeaturedFeedCard story={s} />
                      </div>
                    ))}
                  </div>
                )}

                {hasMore && (
                  <div className="mt-8 border-t border-wire pt-8 text-center">
                    <button onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="border-2 border-ink text-ink font-bold uppercase tracking-wider text-xs px-8 py-3 rounded-sm hover:bg-ink hover:text-white transition-colors">
                      Load more
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* RIGHT COLUMN: 30% SIDEBAR */}
          <aside className="lg:col-span-4 lg:pl-4">
            <SocialBar />
            
            {/* Ad Placeholder */}
            <div className="mt-10 mb-8">
              <p className="text-center text-[10px] text-ink-400 mb-2 uppercase tracking-widest">- Advertisement -</p>
              <div className="bg-ink-800 w-full aspect-[6/5] flex flex-col items-center justify-center text-white p-6 text-center relative overflow-hidden group cursor-pointer rounded-sm">
                 <div className="absolute inset-0 bg-gradient-to-br from-[#1a237e] to-[#c2185b] opacity-80 group-hover:scale-105 transition-transform duration-700" />
                 <div className="relative z-10 flex flex-col items-center">
                   <p className="text-lg font-medium mb-1 leading-tight">Best Selling <span className="font-bold text-white">BLOG</span> and <br/><span className="font-bold text-white">MAGAZINE</span></p>
                   <p className="text-sm text-white/90 mb-6 font-medium tracking-wide">Theme of All Time</p>
                   <button className="border border-white/50 text-xs uppercase tracking-wider px-6 py-2 hover:bg-white hover:text-ink transition-colors font-bold rounded-sm">BUY NOW </button>
                 </div>
                 <p className="absolute bottom-3 left-3 text-[10px] text-white/60 relative z-10 font-medium">300 x 250 Ad</p>
              </div>
            </div>
          </aside>

        </div>
      </section>
    </div>
  );
}