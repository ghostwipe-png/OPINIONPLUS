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
  Star,
  Heart,
  MessageCircle,
  Play,
  FileText,
  GraduationCap,
} from 'lucide-react';
import BreakingTicker from '../components/BreakingTicker';
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

// Each content type gets its own card style
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

function useRevealOnView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); observer.disconnect(); }
    }, { threshold });
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, inView];
}

function CountUp({ end, inView, duration = 1400 }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let frame, start = null;
    const step = (ts) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setValue(Math.floor(progress * end));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [inView, end, duration]);
  return <>{value.toLocaleString()}</>;
}

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
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Image area */}
      <div className="h-44 w-full overflow-hidden bg-ink-100 relative">
        {imageUrl ? (
          <img src={imageUrl} alt={story.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-ink-50 gap-2">
            <TypeIcon size={32} className="text-ink-300" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-400">{style.label}</span>
          </div>
        )}
        {/* Type badge */}
        <span className={`absolute top-3 left-3 font-bold text-[9px] uppercase px-2.5 py-1 rounded-md tracking-wider flex items-center gap-1.5 ${style.badge}`}>
          <TypeIcon size={10} /> {style.label}
        </span>
        {/* Sponsored glow */}
        {story.type === 'sponsored' && (
          <div className="absolute inset-0 bg-gradient-to-t from-amber-500/10 to-transparent pointer-events-none" />
        )}
      </div>

      {/* Content */}
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

  const [statsRef, statsInView] = useRevealOnView(0.4);

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

  const featuredStory = stories[0];
  const gridStories = stories.slice(1);

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

      {/* HERO */}
      <section className="relative bg-[#1C1917] text-white pt-16 pb-16 px-5 overflow-hidden min-h-[70vh] md:min-h-[90vh] flex flex-col justify-between">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1600&auto=format&fit=crop&q=80')] bg-cover bg-center md:bg-fixed opacity-25 mix-blend-luminosity pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1C1917] via-[#1C1917]/90 to-transparent pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-[420px] h-[420px] rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10 w-full">
          <div className="max-w-3xl mb-12">
            <h1 className="editorial-h text-4xl sm:text-6xl font-black tracking-tight text-white mb-6 leading-tight">
              {HERO_WORDS.map((word, i) => (
                <span key={i} className="inline-block fade-up-in mr-3" style={{ animationDelay: `${i * 80}ms` }}>{word}</span>
              ))}
            </h1>
            <p className="text-white/80 text-base sm:text-lg font-medium leading-relaxed max-w-2xl fade-up-in" style={{ animationDelay: `${HERO_WORDS.length * 80 + 200}ms` }}>
              Find compelling independent stories, in-depth documentaries, official campus news, press releases, sponsored features, and masthead solutions.
            </p>
          </div>

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
                <Link href="/services/press-release" className="inline-flex items-center gap-1.5 border border-white/40 text-white font-bold uppercase text-[10px] tracking-wider px-4 py-3 rounded-full hover:bg-white hover:text-ink transition-colors"><Megaphone size={12} className="text-signal" /> Press Release</Link>
                <Link href="/services/sponsored" className="inline-flex items-center gap-1.5 border border-white/40 text-white font-bold uppercase text-[10px] tracking-wider px-4 py-3 rounded-full hover:bg-white hover:text-ink transition-colors"><MonitorPlay size={12} className="text-signal" /> Sponsored</Link>
              </div>
            </div>
            <div className="space-y-3 sm:border-l sm:border-white/20 sm:pl-6">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 block">Partners & Creators</span>
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/pricing" className="inline-block border border-white/40 text-white font-bold uppercase text-xs tracking-wider px-6 py-3.5 rounded-full hover:bg-white hover:text-ink transition-colors">Pricing & Solutions</Link>
              </div>
            </div>
          </div>

          <div ref={statsRef} className="flex flex-wrap gap-x-12 gap-y-6 pt-8 mt-8 border-t border-white/10">
            <div><div className="text-3xl sm:text-4xl font-black text-white tabular-nums"><CountUp end={1247} inView={statsInView} /></div><div className="text-[11px] uppercase tracking-widest text-white/50 font-bold mt-1">Stories published today</div></div>
            <div><div className="text-3xl sm:text-4xl font-black text-white tabular-nums"><CountUp end={89} inView={statsInView} /></div><div className="text-[11px] uppercase tracking-widest text-white/50 font-bold mt-1">Active campuses</div></div>
            <div><div className="text-3xl sm:text-4xl font-black text-white tabular-nums"><CountUp end={12400} inView={statsInView} /></div><div className="text-[11px] uppercase tracking-widest text-white/50 font-bold mt-1">Readers online</div></div>
          </div>
        </div>

        <button onClick={scrollToFeed} className="relative z-10 mx-auto mt-10 flex flex-col items-center gap-2 text-white/60 hover:text-white transition-colors" style={{ opacity: Math.max(0, 1 - scrollY / 250) }} aria-label="Scroll to stories">
          <span className="text-[10px] uppercase tracking-widest font-bold">Discover stories</span>
          <ChevronDown size={20} className="bounce-arrow" />
        </button>
      </section>

      {/* FEATURED STORY */}
      {!loading && featuredStory && (
        <section className="max-w-7xl mx-auto px-5 w-full pt-10">
          {(() => {
            const imageUrl = featuredStory.coverImage || featuredStory.cover_image || '';
            const authorName = featuredStory.author || featuredStory.publisher_name || 'OpinionPlus Staff';
            const excerpt = featuredStory.excerpt || (typeof featuredStory.body === 'string' ? featuredStory.body.slice(0, 180) : 'Explore the full narrative and insights...');
            const fStyle = CARD_STYLES[featuredStory.type] || CARD_STYLES.story;
            return (
              <div className="group rounded-2xl overflow-hidden border border-wire/40 shadow-[0_8px_40px_rgba(0,0,0,0.08)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.15)] hover:ring-2 hover:ring-amber-400/40 transition-all duration-500 flex flex-col md:flex-row bg-white">
                <div className="md:w-[60%] h-64 md:h-[400px] overflow-hidden bg-ink-100 relative">
                  {imageUrl ? (
                    <img src={imageUrl} alt={featuredStory.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-ink text-white font-black text-sm uppercase tracking-widest">OpinionPlus</div>
                  )}
                </div>
                <div className="md:w-[40%] bg-[#1C1917] text-white p-8 md:p-10 flex flex-col justify-center gap-4">
                  <span className="inline-flex items-center gap-1.5 w-fit bg-gradient-to-r from-amber-400 to-amber-600 text-[#1C1917] font-bold uppercase text-[10px] tracking-widest px-3 py-1.5 rounded-full">
                    <Star size={11} fill="currentColor" /> Editor's Pick · {fStyle.label}
                  </span>
                  <h2 className="text-2xl font-black leading-tight">{featuredStory.title}</h2>
                  <p className="text-white/70 text-sm leading-relaxed line-clamp-3">{excerpt}</p>
                  <div className="flex items-center gap-3 pt-1">
                    <AuthorAvatar name={authorName} dark />
                    <span className="text-xs font-semibold text-white/80">{authorName}</span>
                  </div>
                  <Link href={`/story/${featuredStory.id}`} className="mt-2 inline-flex items-center gap-2 w-fit bg-gradient-to-r from-amber-400 to-amber-600 text-[#1C1917] font-bold uppercase text-xs tracking-wider px-6 py-3 rounded-full hover:brightness-110 transition-all shadow-lg">
                    Read featured story <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            );
          })()}
        </section>
      )}

      {/* UNIFIED CONTENT GRID — All types visible together, each styled distinctly */}
      <div id="feed-section" className="scroll-mt-24 flex-1 max-w-7xl mx-auto px-5 w-full pt-10">
        <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-sm">
          <FilterBar filter={filter} onFilterChange={setFilter} filters={FILTERS} filterLabels={FILTER_LABELS} />
        </div>

        {loading ? (
          <div className="space-y-10 py-12">
            <div className="h-64 md:h-[380px] rounded-2xl bg-wire/20 relative overflow-hidden"><div className="absolute inset-0 shimmer" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (<CardSkeleton key={i} />))}
            </div>
          </div>
        ) : stories.length === 0 ? (
          <div className="border-none rounded-2xl p-20 flex flex-col items-center text-center my-10 bg-white shadow-sm">
            <div className="w-16 h-16 rounded-full bg-ink-100 flex items-center justify-center mb-5"><Newspaper size={28} className="text-ink-300" /></div>
            <p className="editorial-h text-2xl font-black mb-2 text-ink">No stories yet</p>
            <p className="text-sm text-ink-500 font-medium max-w-sm">Try a different category, or check back soon — new stories land here as soon as they publish.</p>
          </div>
        ) : (
          <div className="py-8 space-y-10">
            {/* SINGLE UNIFIED GRID — All content types together */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
              {gridStories.map((story, i) => (
                <StoryCard key={story.id} story={story} index={i} />
              ))}
            </div>

            {/* LOAD MORE */}
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