// app/page.js
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Loader2,
  ArrowRight,
  Newspaper,
  Megaphone,
  MonitorPlay,
  ChevronDown,
  Heart,
  MessageCircle,
  Play,
  FileText,
  GraduationCap,
} from 'lucide-react';
import BreakingTicker from '../components/BreakingTicker';
import BreakingNewsBanner from '../components/BreakingNewsBanner';
import FilterBar from '../components/FilterBar';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const PAGE_SIZE = 20;

const FILTERS = ['all', 'story', 'documentary', 'campus', 'press_release', 'sponsored'];
const FILTER_LABELS = {
  all: 'All Content',
  story: 'Stories',
  documentary: 'Documentaries',
  campus: 'Campus',
  press_release: 'Press Releases',
  sponsored: 'Sponsored',
};

const CARD_STYLES = {
  story: {
    badge: 'bg-ink text-white',
    icon: FileText,
    accent: 'border-t-4 border-t-ink',
    label: 'Story',
  },
  documentary: {
    badge: 'bg-purple-600 text-white',
    icon: Play,
    accent: 'border-t-4 border-t-purple-600',
    label: 'Documentary',
  },
  campus: {
    badge: 'bg-emerald-600 text-white',
    icon: GraduationCap,
    accent: 'border-t-4 border-t-emerald-600',
    label: 'Campus',
  },
  press_release: {
    badge: 'bg-blue-600 text-white',
    icon: Megaphone,
    accent: 'border-t-4 border-t-blue-600',
    label: 'Press Release',
  },
  sponsored: {
    badge: 'bg-amber-500 text-[#0A0807]',
    icon: MonitorPlay,
    accent: 'border-t-4 border-t-amber-500 bg-amber-50/30',
    label: 'Sponsored',
  },
};

const HERO_WORDS = "Anything's possible when you have the narrative.".split(' ');

function AuthorAvatar({ name, dark = false }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${dark ? 'bg-white/15 text-white' : 'bg-ink-100 text-ink'}`}>
      {initial}
    </div>
  );
}

function StoryCard({ story, index = 0 }) {
  const imageUrl = story.coverImage || story.cover_image || '';
  const style = CARD_STYLES[story.type] || CARD_STYLES.story;
  const TypeIcon = style.icon;
  const authorName = story.author || story.publisher_name || 'OpinionPlus Staff';
  const likes = Array.isArray(story.likes) ? story.likes.length : (story.like_count ?? 0);
  const comments = Array.isArray(story.comments) ? story.comments.length : (story.comment_count ?? 0);

  return (
    <div
      className={`fade-up-in bg-white rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 flex flex-col justify-between group border border-wire/40 ${style.accent}`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="h-44 w-full overflow-hidden bg-ink-100 relative">
        {imageUrl ? (
          <img src={imageUrl} alt={story.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-ink-50 gap-2">
            <TypeIcon size={32} className="text-ink-300" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-400">{style.label}</span>
          </div>
        )}
        <span className={`absolute top-3 left-3 font-bold text-[9px] uppercase px-2.5 py-1 rounded-md tracking-wider flex items-center gap-1.5 ${style.badge}`}>
          <TypeIcon size={10} /> {style.label}
        </span>
        {story.type === 'sponsored' && (
          <div className="absolute inset-0 bg-gradient-to-t from-amber-500/10 to-transparent pointer-events-none" />
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold text-ink group-hover:text-signal transition-colors line-clamp-2 leading-snug mb-2">
            {story.title}
          </h3>
          <p className="text-ink-500 text-[11px] line-clamp-2 leading-relaxed mb-4 font-medium">
            {story.excerpt || (typeof story.body === 'string' ? story.body.slice(0, 100) : 'Explore the full narrative...')}
          </p>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AuthorAvatar name={authorName} />
              <span className="text-[10px] font-semibold text-ink-400 truncate max-w-[90px]">{authorName}</span>
            </div>
            <div className="flex items-center gap-3 text-ink-300 shrink-0">
              <span className="flex items-center gap-1 text-[10px] font-semibold"><Heart size={11} /> {likes}</span>
              <span className="flex items-center gap-1 text-[10px] font-semibold"><MessageCircle size={11} /> {comments}</span>
            </div>
          </div>
        </div>

        <Link
          href={`/story/${story.id}`}
          className="inline-flex items-center justify-between w-full border border-ink/15 text-ink font-bold uppercase text-[10px] tracking-wider px-4 py-2.5 rounded-full hover:bg-ink hover:text-white transition-all duration-300 shadow-sm group/btn"
        >
          <span>Read {style.label.toLowerCase()}</span>
          <ArrowRight size={12} className="group-hover/btn:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden bg-white border border-wire/40 h-72 relative">
      <div className="absolute inset-0 bg-wire/20" />
      <div className="absolute inset-0 shimmer" />
    </div>
  );
}

export default function HomePage() {
  const [filter, setFilter] = useState('all');
  const [stories, setStories] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  const fetchStories = useCallback(async (currentCursor = null, isReset = false) => {
    if (isReset) { setLoading(true); } else { setLoadingMore(true); }
    try {
      let url = `${API_BASE}/stories?limit=${PAGE_SIZE}`;
      if (filter !== 'all') url += `&type=${filter}`;
      if (currentCursor) url += `&cursor=${encodeURIComponent(currentCursor)}`;
      url += `${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (data.stories) {
        setStories((prev) => (isReset ? data.stories : [...prev, ...data.stories]));
        setCursor(data.nextCursor);
        setHasMore(!!data.nextCursor);
        if (typeof data.total === 'number') setTotalCount(data.total);
        else if (typeof data.totalCount === 'number') setTotalCount(data.totalCount);
      }
    } catch (e) {
      console.error('Failed to fetch paginated stories:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter]);

  useEffect(() => {
    setCursor(null); setHasMore(true); setTotalCount(null);
    fetchStories(null, true);
    const revalidate = () => fetchStories(null, true);
    const onVisible = () => { if (document.visibilityState === 'visible') revalidate(); };
    window.addEventListener('focus', revalidate);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener('focus', revalidate); document.removeEventListener('visibilitychange', onVisible); };
  }, [filter, fetchStories]);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) { window.requestAnimationFrame(() => { setScrollY(window.scrollY); ticking = false; }); ticking = true; }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToFeed = () => {
    document.getElementById('feed-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-paper min-h-screen pb-16 flex flex-col">
      <style jsx global>{`
        @keyframes fadeUpIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up-in { animation: fadeUpIn 0.6s ease-out both; }
        @keyframes bounceArrow { 0%,100% { transform: translateY(0); } 50% { transform: translateY(8px); } }
        .bounce-arrow { animation: bounceArrow 1.8s ease-in-out infinite; }
        @keyframes shimmerMove { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .shimmer { background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%); animation: shimmerMove 1.6s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .fade-up-in,.bounce-arrow,.shimmer { animation: none !important; } }
      `}</style>

      <BreakingTicker />
      <BreakingNewsBanner />

      {/* COMPACT HERO */}
      <section className="relative bg-[#1C1917] text-white pt-12 pb-12 px-5 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#1C1917] via-[#1C1917]/95 to-[#1C1917]/80 pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <h1 className="editorial-h text-3xl sm:text-5xl font-black tracking-tight text-white mb-4 leading-tight">
            {HERO_WORDS.map((word, i) => (
              <span key={i} className="inline-block fade-up-in mr-2" style={{ animationDelay: `${i * 60}ms` }}>{word}</span>
            ))}
          </h1>
          <p className="text-white/70 text-sm sm:text-base font-medium max-w-xl mx-auto fade-up-in" style={{ animationDelay: `${HERO_WORDS.length * 60 + 150}ms` }}>
            Independent stories, documentaries, campus news, press releases, and sponsored features — all in one place.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6 fade-up-in" style={{ animationDelay: `${HERO_WORDS.length * 60 + 300}ms` }}>
            <button onClick={scrollToFeed} className="bg-amber-500 hover:bg-white hover:text-ink text-white font-extrabold uppercase text-xs tracking-wider px-6 py-3 rounded-full transition-all shadow-lg flex items-center gap-2">
              Explore Feed <ArrowRight size={14} />
            </button>
            <Link href="/publish" className="border border-white/30 hover:border-white text-white font-bold uppercase text-xs tracking-wider px-6 py-3 rounded-full transition-all">
              Start Publishing
            </Link>
          </div>
        </div>
      </section>

      {/* CONTENT GRID */}
      <div id="feed-section" className="scroll-mt-24 flex-1 max-w-7xl mx-auto px-5 w-full pt-8">
        <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-sm">
          <FilterBar filter={filter} onFilterChange={setFilter} filters={FILTERS} filterLabels={FILTER_LABELS} />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 py-8">
            {Array.from({ length: 8 }).map((_, i) => (<CardSkeleton key={i} />))}
          </div>
        ) : stories.length === 0 ? (
          <div className="border-none rounded-2xl p-20 flex flex-col items-center text-center my-10 bg-white shadow-sm">
            <div className="w-16 h-16 rounded-full bg-ink-100 flex items-center justify-center mb-5">
              <Newspaper size={28} className="text-ink-300" />
            </div>
            <p className="editorial-h text-2xl font-black mb-2 text-ink">No stories yet</p>
            <p className="text-sm text-ink-500 font-medium max-w-sm">Try a different category, or check back soon.</p>
          </div>
        ) : (
          <div className="py-8 space-y-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
              {stories.map((story, i) => (
                <StoryCard key={story.id} story={story} index={i} />
              ))}
            </div>

            <div className="pt-4 text-center flex flex-col items-center gap-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">
                Showing {stories.length}{totalCount ? ` of ${totalCount}` : ''} {stories.length === 1 ? 'story' : 'stories'}
              </p>
              {hasMore && (
                <button onClick={() => fetchStories(cursor, false)} disabled={loadingMore}
                  className="bg-white border border-amber-500/60 text-ink font-bold uppercase tracking-wider text-xs px-10 py-4 rounded-full hover:bg-gradient-to-r hover:from-amber-400 hover:to-amber-600 hover:text-[#1C1917] hover:border-transparent transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm">
                  {loadingMore && <Loader2 size={14} className="animate-spin" />}
                  {loadingMore ? 'Loading more...' : 'Load more stories'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}