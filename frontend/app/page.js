// app/page.js
'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { Loader2, ArrowRight, Newspaper, Megaphone, MonitorPlay } from 'lucide-react';
import BreakingTicker from '../components/BreakingTicker';
import FilterBar from '../components/FilterBar';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const PAGE_SIZE = 20;

const FILTERS = ['all', 'story', 'documentary', 'press_release', 'sponsored'];
const FILTER_LABELS = {
  all: 'All Content',
  story: 'Stories',
  documentary: 'Documentaries',
  press_release: 'Press Releases',
  sponsored: 'Sponsored',
};

export default function HomePage() {
  const [filter, setFilter] = useState('all');
  const [stories, setStories] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchStories = useCallback(async (currentCursor = null, isReset = false) => {
    if (isReset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let url = `${API_BASE}/stories?limit=${PAGE_SIZE}`;
      if (filter !== 'all') {
        url += `&type=${filter}`;
      }

      if (currentCursor) {
        url += `&cursor=${encodeURIComponent(currentCursor)}`;
      }

      url += `${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;

      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();

      if (data.stories) {
        setStories((prev) => (isReset ? data.stories : [...prev, ...data.stories]));
        setCursor(data.nextCursor);
        setHasMore(!!data.nextCursor);
      }
    } catch (e) {
      console.error('Failed to fetch paginated stories:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter]);

  useEffect(() => {
    setCursor(null);
    setHasMore(true);
    fetchStories(null, true);

    const handleRevalidate = () => {
      fetchStories(null, true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleRevalidate();
      }
    };

    window.addEventListener('focus', handleRevalidate);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleRevalidate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [filter, fetchStories]);

  return (
    <div className="bg-paper min-h-screen pb-16 flex flex-col">
      <BreakingTicker />

      {/* 1. CORPORATE HERO SECTION */}
      <section className="relative bg-[#1C1917] text-white pt-16 pb-24 px-5 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1600&auto=format&fit=crop&q=80')] bg-cover bg-center opacity-25 mix-blend-luminosity pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1C1917] via-[#1C1917]/90 to-transparent pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="max-w-3xl mb-12">
            <h1 className="editorial-h text-4xl sm:text-6xl font-black tracking-tight text-white mb-6 leading-tight">
              Anything’s possible when you have the narrative.
            </h1>
            <p className="text-white/80 text-base sm:text-lg font-medium leading-relaxed max-w-2xl">
              Find compelling independent stories, in-depth documentaries, official press releases, sponsored features, and masthead solutions.
            </p>
          </div>

          {/* DUAL-COLUMN CTA SECTION & QUICK SERVICE LINKS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-white/20 max-w-5xl relative">
            <div className="space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 block">For Readers & Viewers</span>
              <div>
                <Link href="#feed-section" className="inline-flex items-center gap-2 bg-white text-ink font-bold uppercase text-xs tracking-wider px-6 py-3.5 rounded-full hover:bg-signal hover:text-white transition-colors shadow-lg">
                  Explore feed <ArrowRight size={14} />
                </Link>
              </div>
            </div>

            <div className="space-y-3 sm:border-l sm:border-white/20 sm:pl-6">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 block">Publish Announcements</span>
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/services/press-release" className="inline-flex items-center gap-1.5 border border-white/40 text-white font-bold uppercase text-[10px] tracking-wider px-4 py-3 rounded-full hover:bg-white hover:text-ink transition-colors">
                  <Megaphone size={12} className="text-signal" /> Press Release
                </Link>
                <Link href="/services/sponsored" className="inline-flex items-center gap-1.5 border border-white/40 text-white font-bold uppercase text-[10px] tracking-wider px-4 py-3 rounded-full hover:bg-white hover:text-ink transition-colors">
                  <MonitorPlay size={12} className="text-signal" /> Sponsored
                </Link>
              </div>
            </div>

            <div className="space-y-3 sm:border-l sm:border-white/20 sm:pl-6">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 block">Partners & Creators</span>
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/pricing" className="inline-block border border-white/40 text-white font-bold uppercase text-xs tracking-wider px-6 py-3.5 rounded-full hover:bg-white hover:text-ink transition-colors">
                  Pricing & Solutions
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. MAIN CONTENT SECTION */}
      <div id="feed-section" className="scroll-mt-24 flex-1 max-w-7xl mx-auto px-5 w-full pt-10">
        <FilterBar filter={filter} onFilterChange={setFilter} filters={FILTERS} filterLabels={FILTER_LABELS} />

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 py-12">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-72 rounded-xl bg-wire/20" />
            ))}
          </div>
        ) : stories.length === 0 ? (
          <div className="border-none rounded-2xl p-20 flex flex-col items-center text-center my-10 bg-white shadow-sm">
            <Newspaper size={40} className="text-ink-300 mb-4" />
            <p className="text-2xl font-bold mb-2 text-ink">No stories found.</p>
            <p className="text-sm text-ink-500 mb-6 font-medium">Check back later or try adjusting the category filter.</p>
          </div>
        ) : (
          <div className="py-8 space-y-12">
            {/* ELEGANT CARDS MATCHING REFERENCE DESIGN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
              {stories.map((story) => {
                const imageUrl = story.coverImage || story.cover_image || '';
                return (
                  <div 
                    key={story.id} 
                    className="bg-white rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.1)] transition-all duration-300 flex flex-col justify-between group border border-wire/40"
                  >
                    {/* Top Full-Width Image Preview */}
                    <div className="h-48 w-full overflow-hidden bg-ink-100 relative">
                      {imageUrl ? (
                        <img 
                          src={imageUrl} 
                          alt={story.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-ink text-white font-black text-xs uppercase tracking-widest">
                          OpinionPlus
                        </div>
                      )}
                      <span className="absolute top-3 left-3 bg-ink/80 backdrop-blur-sm text-white font-bold text-[9px] uppercase px-2.5 py-1 rounded-md tracking-wider">
                        {story.type?.replace('_', ' ') || 'Story'}
                      </span>
                    </div>

                    {/* Content Section */}
                    <div className="p-6 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-base font-bold text-ink group-hover:text-signal transition-colors line-clamp-2 leading-snug mb-2.5">
                          {story.title}
                        </h3>
                        <p className="text-ink-600 text-xs line-clamp-3 leading-relaxed mb-6 font-medium">
                          {story.excerpt || story.body?.slice(0, 120) || 'Explore the full narrative and insights...'}
                        </p>
                      </div>

                      {/* Action Pill Button */}
                      <div>
                        <Link 
                          href={`/story/${story.id}`}
                          className="inline-flex items-center justify-between w-full bg-[#A32A29] hover:bg-ink text-white font-bold uppercase text-[10px] tracking-wider px-5 py-3 rounded-full transition-colors shadow-sm group/btn"
                        >
                          <span>Read story</span>
                          <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <div className="pt-10 text-center flex justify-center">
                <button 
                  onClick={() => fetchStories(cursor, false)} 
                  disabled={loadingMore}
                  className="bg-white border border-wire/60 text-ink font-bold uppercase tracking-wider text-xs px-10 py-4 rounded-full hover:bg-ink hover:text-white hover:border-ink transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                >
                  {loadingMore && <Loader2 size={14} className="animate-spin" />}
                  {loadingMore ? 'Loading more...' : 'Load more stories'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}