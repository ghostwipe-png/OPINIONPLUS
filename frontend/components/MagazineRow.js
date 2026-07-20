'use client';

import Link from 'next/link';
import { useStore } from '../lib/store';
import { getCategoryStyle } from './categoryStyle';

function formatDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return '';
  }
}

export default function MagazineRow({ story }) {
  const { users } = useStore();
  if (!story) return null;
  
  const { bg, text, label } = getCategoryStyle(story);

  return (
    <Link
      href={`/story/${story.id}`}
      className="group flex gap-4 py-5 border-b border-wire/40 last:border-0 focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none rounded-sm transition-colors"
    >
      <div className="relative w-28 h-20 sm:w-32 sm:h-24 rounded-sm overflow-hidden shrink-0 bg-ink-100">
        {story.coverImage ? (
          <img
            src={story.coverImage}
            alt={story.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-105" style={{ backgroundColor: bg, opacity: 0.2 }} />
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <h3 className="text-sm sm:text-base font-bold text-ink leading-snug line-clamp-2 group-hover:text-signal transition-colors mb-1.5">
          {story.title}
        </h3>
        
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink-500">
          <span className="text-[9px] font-bold uppercase tracking-wider text-ink">
            {label}
          </span>
          <span className="text-wire-600">-</span>
          <span>{formatDate(story.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}

export function MagazineRowSkeleton() {
  return (
    <div className="flex gap-4 py-5 border-b border-wire/40 last:border-0 animate-pulse">
      <div className="w-28 h-20 sm:w-32 sm:h-24 rounded-sm bg-ink-200/40 shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col justify-center space-y-2">
        <div className="h-4 w-full bg-ink-200/40 rounded-sm" />
        <div className="h-4 w-[80%] bg-ink-200/40 rounded-sm" />
        <div className="h-3 w-24 bg-ink-200/40 rounded-sm mt-1" />
      </div>
    </div>
  );
}