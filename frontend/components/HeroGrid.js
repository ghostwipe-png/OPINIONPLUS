'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useStore } from '../lib/store';
import { getCategoryStyle } from './categoryStyle';

function formatDate(d) {
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
      className="absolute top-2 left-2 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-sm z-10"
      style={{ backgroundColor: bg, color: text }}
    >
      {label}
    </span>
  );
}

function HeroCard({ story, headlineClass, imageClass = 'h-full' }) {
  const { users } = useStore();
  if (!story) return null;
  
  const author = users.find((u) => u.id === story.authorId);
  const { bg } = getCategoryStyle(story);

  return (
    <Link
      href={`/story/${story.id}`}
      className="relative block overflow-hidden rounded-sm group focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none"
    >
      <div className={`relative w-full ${imageClass} overflow-hidden`}>
        {story.coverImage ? (
          <img
            src={story.coverImage}
            alt={story.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
          />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: bg, opacity: 0.25 }} />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.1) 100%)',
          }}
        />
        <CategoryTag story={story} />
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className={`text-white font-bold leading-snug line-clamp-2 ${headlineClass}`}>
            {story.title}
          </p>
          <p className="text-white text-[11px] opacity-80 mt-1">
            {author?.publisherName || author?.name || 'OPINIONPLUS'} · {formatDate(story.createdAt)}
          </p>
        </div>
      </div>
    </Link>
  );
}

function HeroSkeleton({ className = '' }) {
  return <div className={`rounded-sm bg-ink-100 animate-pulse ${className}`} />;
}

export default function HeroGrid() {
  const { stories, ready } = useStore();

  const top5 = useMemo(() => {
    return (stories || [])
      .filter((s) => !s.deleted && s.privacy === 'public')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
  }, [stories]);

  if (!ready) {
    return (
      <section className="max-w-6xl mx-auto px-5 pt-6">
        <div className="grid gap-2 md:grid-cols-5 md:grid-rows-2 md:h-[520px]">
          <HeroSkeleton className="h-64 md:col-span-3 md:row-span-2 md:h-full" />
          <HeroSkeleton className="h-40 md:col-span-2 md:h-full" />
        </div>
      </section>
    );
  }

  if (top5.length === 0) return null;

  const [s1, s2, s3, s4, s5] = top5;

  return (
    <section className="max-w-6xl mx-auto px-5 pt-6" aria-label="Top stories">
      <div className="grid gap-2 md:grid-cols-5 md:grid-rows-2 md:h-[520px]">
        {s1 && (
          <div className="md:col-span-3 md:row-span-2 h-64 md:h-full">
            <HeroCard story={s1} headlineClass="text-xl sm:text-2xl" imageClass="h-64 md:h-full" />
          </div>
        )}

        {(s2 || s3 || s4 || s5) && (
          <div className="md:col-span-2 md:row-span-2 grid gap-2 md:grid-rows-2 md:h-full">
            {s2 && (
              <div className="h-40 md:h-full">
                <HeroCard story={s2} headlineClass="text-base sm:text-lg" imageClass="h-40 md:h-full" />
              </div>
            )}

            {(s3 || s4 || s5) && (
              <div className="grid grid-cols-2 gap-2 md:h-full">
                {s3 && (
                  <div className="h-28 md:h-full">
                    <HeroCard story={s3} headlineClass="text-sm" imageClass="h-28 md:h-full" />
                  </div>
                )}
                {s4 && (
                  <div className="h-28 md:h-full">
                    <HeroCard story={s4} headlineClass="text-sm" imageClass="h-28 md:h-full" />
                  </div>
                )}
                {s5 && (
                  <div className="h-28 md:h-full col-span-2 sm:col-span-1">
                    <HeroCard story={s5} headlineClass="text-sm" imageClass="h-28 md:h-full" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}