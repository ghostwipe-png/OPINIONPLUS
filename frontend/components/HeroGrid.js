'use client';

import Link from 'next/link';
import { Component, useMemo } from 'react';
import { useStore } from '../lib/store';
import { getCategoryStyle } from './categoryStyle';

function formatDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (e) {
    return '';
  }
}

function CategoryTag({ story }) {
  const { bg, text, label } = getCategoryStyle(story);
  return (
    <span
      className="absolute top-3 left-3 text-[10px] font-bold uppercase px-2.5 py-1 rounded-sm z-20 shadow-sm"
      style={{ backgroundColor: bg, color: text }}
    >
      {label}
    </span>
  );
}

function HeroCard({ story, headlineClass = "text-sm", imageClass = "h-full" }) {
  const { users } = useStore();
  if (!story) return null;

  const author = users?.find((u) => u.id === story.authorId);
  const { bg } = getCategoryStyle(story);

  return (
    <Link
      href={`/story/${story.id}`}
      className="relative block overflow-hidden rounded-sm group focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none w-full h-full bg-ink-800"
    >
      <div className={`relative w-full ${imageClass} overflow-hidden min-h-[140px] h-full`}>
        {story.coverImage ? (
          <img
            src={story.coverImage}
            alt={story.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-105" style={{ backgroundColor: bg, opacity: 0.7 }} />
        )}
        
        {/* Dark Gradient Overlay */}
        <div
          className="absolute inset-0 z-10"
          style={{
            background: 'linear-gradient(to top, rgba(28, 25, 23, 0.95) 0%, rgba(28, 25, 23, 0.4) 50%, rgba(28, 25, 23, 0) 100%)',
          }}
        />
        
        <CategoryTag story={story} />
        
        <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
          <h3 className={`text-white font-bold leading-tight line-clamp-3 mb-1.5 group-hover:text-signal transition-colors ${headlineClass}`}>
            {story.title}
          </h3>
          <p className="text-white/80 text-[11px] font-medium tracking-wide">
            {author?.publisherName || author?.name || 'OPINIONPLUS'} · {formatDate(story.createdAt)}
          </p>
        </div>
      </div>
    </Link>
  );
}

function HeroSkeleton({ className = '' }) {
  return <div className={`rounded-sm bg-ink-200/30 animate-pulse ${className}`} />;
}

class HeroGridBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    console.error('HeroGrid failed to render:', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <section className="max-w-6xl mx-auto px-5 pt-8 pb-6" aria-label="Top stories">
          <div className="rounded-sm border border-dashed border-wire p-8 text-center text-sm text-ink-400 font-medium">
            Top stories are unavailable right now.
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}

function HeroGridInner() {
  const { stories, ready } = useStore();

  const topStories = useMemo(() => {
    return (stories || [])
      .filter((s) => s && !s.deleted && s.privacy === 'public' && s?.authorId !== 'u_newsdesk')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [stories]);

  if (!ready) {
    return (
      <section className="max-w-6xl mx-auto px-5 pt-8 pb-6" aria-label="Top stories">
        <div className="grid gap-2 md:grid-cols-4 md:grid-rows-2 h-[500px]">
          <HeroSkeleton className="md:col-span-2 md:row-span-2 h-full" />
          <div className="md:col-span-2 md:row-span-2 grid grid-cols-2 grid-rows-2 gap-2 h-full">
            <HeroSkeleton className="col-span-2 h-full" />
            <HeroSkeleton className="col-span-1 h-full" />
            <HeroSkeleton className="col-span-1 h-full" />
          </div>
        </div>
      </section>
    );
  }

  if (topStories.length === 0) {
    return (
      <section className="max-w-6xl mx-auto px-5 pt-8 pb-6" aria-label="Top stories">
        <div className="rounded-sm border border-dashed border-wire p-16 flex flex-col items-center justify-center text-center">
          <p className="text-ink text-lg font-bold mb-2">No top stories to show yet.</p>
          <p className="text-ink-400 text-sm">When featured stories are published, they will appear here.</p>
        </div>
      </section>
    );
  }

  const [s1, s2, s3, s4, s5] = topStories;

  return (
    <section className="max-w-6xl mx-auto px-5 pt-8 pb-6" aria-label="Top stories">
      <div className="grid gap-1 md:gap-2 grid-cols-1 md:grid-cols-4 md:grid-rows-2 h-auto md:h-[520px]">
        
        {/* Story 1: Largest, left column */}
        {s1 && (
          <div className="md:col-span-2 md:row-span-2 h-[350px] md:h-full">
            <HeroCard story={s1} headlineClass="text-2xl sm:text-3xl lg:text-4xl" />
          </div>
        )}

        {/* Stories 2-5: Nested grid on the right */}
        {(s2 || s3 || s4 || s5) && (
          <div className="md:col-span-2 md:row-span-2 grid grid-cols-1 sm:grid-cols-2 grid-rows-2 gap-1 md:gap-2 h-[450px] md:h-full mt-1 md:mt-0">
            {s2 && (
              <div className={`h-full ${!s5 && s3 && s4 ? 'sm:col-span-2' : 'sm:col-span-1'}`}>
                <HeroCard story={s2} headlineClass={!s5 && s3 && s4 ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'} />
              </div>
            )}
            
            {s3 && (
              <div className="h-full sm:col-span-1">
                <HeroCard story={s3} headlineClass="text-base sm:text-lg" />
              </div>
            )}
            
            {s4 && (
              <div className="h-full sm:col-span-1">
                <HeroCard story={s4} headlineClass="text-base sm:text-lg" />
              </div>
            )}
            
            {s5 && (
              <div className="h-full sm:col-span-1">
                <HeroCard story={s5} headlineClass="text-base sm:text-lg" />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default function HeroGrid() {
  return (
    <HeroGridBoundary>
      <HeroGridInner />
    </HeroGridBoundary>
  );
}