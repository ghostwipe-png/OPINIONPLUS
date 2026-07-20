'use client';

import Link from 'next/link';
import { Heart, MessageCircle, Star } from 'lucide-react';
import { useStore } from '../lib/store';
import { getCategoryStyle } from './categoryStyle';

function formatDate(d) {
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (e) {
    return '';
  }
}

function avgRating(ratings) {
  const vals = Object.values(ratings || {});
  if (!vals.length) return null;
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

export default function MagazineRow({ story }) {
  const { users } = useStore();
  if (!story) return null;
  
  const author = users.find((u) => u.id === story.authorId);
  const { bg, text, label } = getCategoryStyle(story);
  const rating = avgRating(story.ratings);

  return (
    <Link
      href={`/story/${story.id}`}
      className="flex gap-4 py-4 border-b border-wire focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none rounded-sm"
    >
      <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-sm overflow-hidden shrink-0">
        {story.coverImage ? (
          <img
            src={story.coverImage}
            alt={story.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: bg, opacity: 0.2 }} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <span
          className="inline-block text-[10px] font-semibold uppercase px-2 py-0.5 rounded-sm mb-1.5"
          style={{ backgroundColor: bg, color: text }}
        >
          {label}
        </span>
        <p className="text-sm sm:text-base font-bold text-ink leading-snug line-clamp-2 hover:text-signal transition-colors">
          {story.title}
        </p>
        <p className="text-xs text-ink-500 mt-1">{author?.publisherName || author?.name || 'OPINIONPLUS'}</p>
        <div className="flex items-center gap-3 text-xs text-ink-400 mt-1">
          <span>{formatDate(story.createdAt)}</span>
          <span className="flex items-center gap-1">
            <Heart size={12} /> {story.likes?.length ?? 0}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle size={12} /> {story.comments?.length ?? 0}
          </span>
          {rating && (
            <span className="flex items-center gap-1">
              <Star size={12} /> {rating}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function MagazineRowSkeleton() {
  return (
    <div className="flex gap-4 py-4 border-b border-wire animate-pulse">
      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-sm bg-ink-100 shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3 w-16 bg-ink-100 rounded-sm" />
        <div className="h-4 w-3/4 bg-ink-100 rounded-sm" />
        <div className="h-4 w-1/2 bg-ink-100 rounded-sm" />
        <div className="h-3 w-1/3 bg-ink-100 rounded-sm" />
      </div>
    </div>
  );
}