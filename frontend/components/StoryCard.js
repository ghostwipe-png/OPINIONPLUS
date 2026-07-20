'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Film, FileText, Heart, Clock } from 'lucide-react';

export default function StoryCard({ story, imagePosition = 'right' }) {
  const [imgError, setImgError] = useState(false);

  // Safety check: Return null if story is invalid
  if (!story || typeof story !== 'object') return null;

  // Hybrid property mappings to prevent undefined errors
  const id = story.id || '#';
  const title = story.title || 'Untitled Story';
  const excerpt = story.excerpt || '';
  const type = story.type || 'story';
  const isDoc = type === 'documentary';

  const coverImage = story.coverImage || story.cover_image;
  const createdAt = story.createdAt || story.created_at;
  const authorName = story.authorName || story.publisherName || story.publisher_name || '';

  // Safe Date Formatter with error trap
  let formattedDate = '';
  try {
    if (createdAt) {
      const d = new Date(createdAt);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }
  } catch (e) {
    formattedDate = '';
  }

  // Safe Likes Counter supporting arrays or numbers
  let likesCount = 0;
  if (Array.isArray(story.likes)) {
    likesCount = story.likes.length;
  } else if (typeof story.likes === 'number') {
    likesCount = story.likes;
  } else if (typeof story.like_count === 'number') {
    likesCount = story.like_count;
  }

  return (
    <Link 
      href={`/story/${id}`}
      className="group block bg-white border border-wire rounded-sm p-5 hover:border-ink transition-all shadow-sm hover:shadow-md"
    >
      <div className={`flex flex-col sm:flex-row gap-5 items-start ${imagePosition === 'left' ? 'sm:flex-row-reverse' : ''}`}>
        
        {/* Text Content */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-ink-400 flex-wrap">
            <span className="flex items-center gap-1 text-ink-600 bg-ink-50 px-2 py-0.5 rounded-sm border border-wire">
              {isDoc ? <Film size={11} className="text-signal" /> : <FileText size={11} />}
              {type}
            </span>
            {formattedDate && (
              <>
                <span>•</span>
                <span>{formattedDate}</span>
              </>
            )}
            {authorName && (
              <>
                <span>•</span>
                <span className="truncate">{authorName}</span>
              </>
            )}
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-ink group-hover:text-signal transition-colors line-clamp-2 tracking-tight">
            {title}
          </h3>

          {excerpt && (
            <p className="text-xs sm:text-sm text-ink-600 line-clamp-2 font-medium leading-relaxed">
              {excerpt}
            </p>
          )}

          <div className="flex items-center gap-4 pt-1 text-[11px] font-bold uppercase tracking-wider text-ink-400">
            <span className="flex items-center gap-1">
              <Heart size={12} className="text-signal" /> {likesCount} Likes
            </span>
            <span className="flex items-center gap-1 group-hover:text-ink transition-colors">
              <Clock size={12} /> Read Story →
            </span>
          </div>
        </div>

        {/* Thumbnail Image Side-by-Side with error fallback */}
        {coverImage && !story.mediaBlocked && !imgError && (
          <div className="w-full sm:w-48 h-40 sm:h-32 shrink-0 rounded-sm overflow-hidden border border-wire bg-ink-50 shadow-sm">
            <img 
              src={coverImage} 
              alt={title} 
              onError={() => setImgError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
            />
          </div>
        )}

      </div>
    </Link>
  );
}