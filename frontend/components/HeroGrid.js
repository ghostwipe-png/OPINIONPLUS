'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useStore } from '../lib/store';

const CATEGORY_COLORS = {
  story: { bg: '#1C1917', text: '#FFFFFF' },
  documentary: { bg: '#C99A3B', text: '#1C1917' },
  news: { bg: '#E0492B', text: '#FFFFFF' },
  default: { bg: '#6B7180', text: '#FFFFFF' },
};

function categoryColor(type) {
  return CATEGORY_COLORS[type] || CATEGORY_COLORS.default;
}

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (e) {
    return '';
  }
}

function HeroCard({ story, headlineClass, className = '' }) {
  const color = categoryColor(story.type);
  const label = story.type ? story.type.charAt(0).toUpperCase() + story.type.slice(1) : 'Story';

  return (
    <Link
      href={`/story/${story.id}`}
      className={`group relative block rounded-sm overflow-hidden focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none ${className}`}
    >
      <div className="absolute inset-0 transition-transform duration-300 group-hover:scale-[1.02]">
        {story.coverImage ? (
          <img
            src={story.coverImage}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full" style={{ backgroundColor: `${color.bg}33` }} />
        )}
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.1) 100%)',
        }}
      />
      <span
        className="absolute top-3 left-3 text-[10px] font-semibold uppercase px-2 py-0.5 rounded"
        style={{ backgroundColor: color.bg, color: color.text }}
      >
        {label}
      </span>
      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
        <h3 className={`text-white font-bold leading-tight line-clamp-2 ${headlineClass}`}>
          {story.title}
        </h3>
        <p className="text-white text-[11px] opacity-80 mt-1">{story.authorName || 'OPINIONPLUS'}</p>
        <p className="text-white text-[11px] opacity-80">{formatDate(story.createdAt)}</p>
      </div>
    </Link>
  );
}

function HeroSkeleton({ className = '' }) {
  return <div className={`rounded-sm overflow-hidden animate-pulse bg-ink-50/30 ${className}`} />;
}

export default function HeroGrid() {
  const { stories, ready } = useStore();

  const top5 = useMemo(() => {
    if (!stories) return [];
    return stories
      .filter((s) => !s.deleted && s.privacy === 'public')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
  }, [stories]);

  if (!ready) {
    return (
      <section className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-5 md:grid-rows-2 gap-3 md:h-[520px]">
          <HeroSkeleton className="md:col-span-3 md:row-span-2 h-64 md:h-auto" />
          <HeroSkeleton className="md:col-span-2 h-40 md:h-auto" />
          <HeroSkeleton className="md:col-span-2 h-40 md:h-auto" />
        </div>
      </section>
    );
  }

  if (top5.length === 0) return null;

  const [s1, s2, s3, s4, s5] = top5;

  return (
    <section className="max-w-7xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 md:grid-cols-5 md:grid-rows-2 gap-3 md:h-[520px]">
        {s1 && (
          <HeroCard
            story={s1}
            headlineClass="text-xl sm:text-2xl"
            className="md:col-span-3 md:row-span-2 h-64 md:h-auto"
          />
        )}

        {(s2 || s3 || s4 || s5) && (
          <div className="md:col-span-2 md:row-span-2 grid grid-cols-2 md:grid-cols-1 md:grid-rows-3 gap-3">
            {s2 && (
              <HeroCard
                story={s2}
                headlineClass="text-base sm:text-lg"
                className="col-span-2 md:col-span-1 md:row-span-1 h-40 md:h-auto"
              />
            )}
            <div className="col-span-2 md:col-span-1 md:row-span-2 grid grid-cols-2 gap-3">
              {s3 && (
                <HeroCard
                  story={s3}
                  headlineClass="text-sm sm:text-base"
                  className="col-span-2 sm:col-span-1 h-32 md:h-auto"
                />
              )}
              <div className="col-span-2 sm:col-span-1 grid grid-cols-2 gap-3">
                {s4 && <HeroCard story={s4} headlineClass="text-sm" className="h-32 md:h-auto" />}
                {s5 && <HeroCard story={s5} headlineClass="text-sm" className="h-32 md:h-auto" />}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
