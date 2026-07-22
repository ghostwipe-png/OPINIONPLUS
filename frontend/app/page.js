'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { Loader2, Search, ArrowRight, Tag, Newspaper, X, Sparkles, CheckCircle } from 'lucide-react';
import { useStore } from '../lib/store';
import BreakingTicker from '../components/BreakingTicker';
import FilterBar from '../components/FilterBar';
import StoryCard from '../components/StoryCard';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const PAGE_SIZE = 16;

const FILTERS = ['all', 'story', 'documentary'];
const FILTER_LABELS = {
  all: 'All Stories & Documentaries',
  story: 'Stories',
  documentary: 'Documentaries',
};

export default function HomePage() {
  const [filter, setFilter] = useState('all');
  const [stories, setStories] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTopic, setSearchTopic] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');

  const fetchStories = useCallback(async (currentCursor = null, isReset = false, queryTerm = '') => {
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
      if (queryTerm.trim()) {
        url += `&search=${encodeURIComponent(queryTerm.trim())}`;
      }

      if (currentCursor) {
        url += `&cursor=${encodeURIComponent(currentCursor)}`;
      }

      const res = await fetch(url);
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
    fetchStories(null, true, activeSearchTerm);
  }, [filter, activeSearchTerm, fetchStories]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const combined = [searchQuery, searchTopic].filter(Boolean).join(' ');
    setActiveSearchTerm(combined);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchTopic('');
    setActiveSearchTerm('');
  };

  return (
    <div className="bg-paper min-h-screen pb-16 flex flex-col">
      <BreakingTicker />

      {/* 1. CORPORATE HERO SECTION */}
      <section className="relative bg-[#1C1917] text-white pt-16 pb-40 px-5 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1600&auto=format&fit=crop&q=80')] bg-cover bg-center opacity-25 mix-blend-luminosity pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1C1917] via-[#1C1917]/90 to-transparent pointer-events-none" />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="max-w-3xl mb-12">
            <h1 className="editorial-h text-4xl sm:text-6xl font-black tracking-tight text-white mb-6 leading-tight">
              Anything’s possible when you have the narrative.
            </h1>
            <p className="text-white/80 text-base sm:text-lg font-medium leading-relaxed max-w-2xl">
              Find compelling independent stories, in-depth documentaries, and the masthead solutions you need to share your truth with the world.
            </p>
          </div>

          {/* DUAL-COLUMN CTA SECTION */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-6 border-t border-white/20 max-w-4xl relative">
            <div className="space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 block">For Readers & Viewers</span>
              <div>
                <Link href="#feed-section" className="inline-flex items-center gap-2 bg-white text-ink font-bold uppercase text-xs tracking-wider px-8 py-3.5 rounded-full hover:bg-signal hover:text-white transition-colors shadow-lg">
                  Explore main story <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            <div className="space-y-3 sm:pl-8 sm:border-l sm:border-white/20">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 block">For Creators & Publishers</span>
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/publish" className="inline-block border border-white/40 text-white font-bold uppercase text-xs tracking-wider px-6 py-3.5 rounded-full hover:bg-white hover:text-ink transition-colors">
                  Find your next publish
                </Link>
                <Link href="/pricing" className="inline-block border border-white/40 text-white font-bold uppercase text-xs tracking-wider px-6 py-3.5 rounded-full hover:bg-white hover:text-ink transition-colors">
                  Explore partner solutions
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. REDESIGNED ELEGANT FLOATING SEARCH MODULE */}
      <div className="max-w-5xl mx-auto px-5 -mt-16 relative z-30 mb-12">
        <form onSubmit={handleSearchSubmit} className="bg-white rounded-xl shadow-2xl border border-wire p-4 sm:p-5 flex flex-col md:flex-row items-center gap-3 backdrop-blur-md bg-white/95">
          
          {/* Keyword Search Input */}
          <div className="flex items-center gap-3 flex-1 w-full bg-[#F4F4F6] px-5 py-3.5 rounded-full border border-wire/60 focus-within:border-signal transition-colors">
            <Search size={18} className="text-signal shrink-0" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, keyword, or author..."
              className="w-full text-sm font-medium text-ink bg-transparent outline-none placeholder:text-ink-400"
            />
          </div>

          {/* Topic / Category Input */}
          <div className="flex items-center gap-3 flex-1 w-full bg-[#F4F4F6] px-5 py-3.5 rounded-full border border-wire/60 focus-within:border-signal transition-colors">
            <Tag size={18} className="text-signal shrink-0" />
            <input 
              type="text"
              value={searchTopic}
              onChange={(e) => setSearchTopic(e.target.value)}
              placeholder="Filter by topic or category..."
              className="w-full text-sm font-medium text-ink bg-transparent outline-none placeholder:text-ink-400"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button 
              type="submit"
              className="flex-1 md:flex-none bg-[#E0492B] hover:bg-ink text-white font-bold uppercase tracking-wider text-xs px-8 py-4 rounded-full transition-colors shrink-0 shadow-md flex items-center justify-center gap-2"
            >
              <Sparkles size={14} /> Search
            </button>
            {activeSearchTerm && (
              <button 
                type="button"
                onClick={handleClearSearch}
                className="bg-ink-100 hover:bg-ink hover:text-white text-ink p-4 rounded-full transition-colors shrink-0"
                title="Clear Search"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </form>

        {activeSearchTerm && (
          <div className="mt-3 flex items-center justify-between text-xs font-bold text-white px-4">
            <span>Showing live results for: &ldquo;{activeSearchTerm}&rdquo;</span>
            <button onClick={handleClearSearch} className="text-signal hover:underline underline-offset-2">Reset search</button>
          </div>
        )}
      </div>

      {/* 3. MAIN CONTENT SECTION */}
      <div id="feed-section" className="scroll-mt-24 flex-1 max-w-6xl mx-auto px-5 w-full">
        <FilterBar filter={filter} onFilterChange={setFilter} filters={FILTERS} filterLabels={FILTER_LABELS} />

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 py-12">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-80 rounded-sm" />
            ))}
          </div>
        ) : stories.length === 0 ? (
          <div className="border border-dashed border-wire rounded-sm p-20 flex flex-col items-center text-center my-10 bg-white">
            <Newspaper size={40} className="text-ink-300 mb-4" />
            <p className="text-2xl font-bold mb-2 text-ink">No matching stories found.</p>
            <p className="text-sm text-ink-500 mb-6 font-medium">Try adjusting your keywords or clearing the search filter.</p>
            {activeSearchTerm && (
              <button onClick={handleClearSearch} className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-8 py-3.5 rounded-sm hover:bg-signal/90 transition-colors shadow-md">
                View all stories
              </button>
            )}
          </div>
        ) : (
          <div className="py-6 space-y-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {stories.map((story) => (
                <div key={story.id} className="bg-white border border-wire rounded-sm p-4 shadow-sm hover:shadow-md transition-shadow">
                  <StoryCard story={story} />
                </div>
              ))}
            </div>

            {hasMore && (
              <div className="pt-8 text-center border-t border-wire">
                <button 
                  onClick={() => fetchStories(cursor, false, activeSearchTerm)} 
                  disabled={loadingMore}
                  className="border-2 border-ink text-ink font-bold uppercase tracking-wider text-xs px-10 py-3.5 rounded-sm hover:bg-ink hover:text-white transition-colors flex items-center justify-center gap-2 mx-auto disabled:opacity-50 shadow-sm"
                >
                  {loadingMore && <Loader2 size={14} className="animate-spin text-signal" />}
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