'use client';

import Link from 'next/link';
import { Film, FileText, Heart, Clock } from 'lucide-react';

export default function StoryCard({ story, imagePosition = 'right' }) {
  if (!story) return null;

  const date = story.createdAt 
    ? new Date(story.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) 
    : '';
  const isDoc = story.type === 'documentary';

  return (
    <Link 
      href={`/story/${story.id}`}
      className="group block bg-white border border-wire rounded-sm p-5 hover:border-ink transition-all shadow-sm hover:shadow-md"
    >
      <div className={`flex flex-col sm:flex-row gap-5 items-start ${imagePosition === 'left' ? 'sm:flex-row-reverse' : ''}`}>
        
        {/* Text Content */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-ink-400 flex-wrap">
            <span className="flex items-center gap-1 text-ink-600 bg-ink-50 px-2 py-0.5 rounded-sm border border-wire">
              {isDoc ? <Film size={11} className="text-signal" /> : <FileText size={11} />}
              {story.type || 'story'}
            </span>
            <span>•</span>
            <span>{date}</span>
            {story.authorName && (
              <>
                <span>•</span>
                <span className="truncate">{story.authorName}</span>
              </>
            )}
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-ink group-hover:text-signal transition-colors line-clamp-2 tracking-tight">
            {story.title}
          </h3>

          {story.excerpt && (
            <p className="text-xs sm:text-sm text-ink-600 line-clamp-2 font-medium leading-relaxed">
              {story.excerpt}
            </p>
          )}

          <div className="flex items-center gap-4 pt-1 text-[11px] font-bold uppercase tracking-wider text-ink-400">
            {story.likes && (
              <span className="flex items-center gap-1">
                <Heart size={12} className="text-signal" /> {story.likes.length} Likes
              </span>
            )}
            <span className="flex items-center gap-1 group-hover:text-ink transition-colors">
              <Clock size={12} /> Read Story →
            </span>
          </div>
        </div>

        {/* Thumbnail Image Side-by-Side */}
        {story.coverImage && !story.mediaBlocked && (
          <div className="w-full sm:w-48 h-40 sm:h-32 shrink-0 rounded-sm overflow-hidden border border-wire bg-ink-50 shadow-sm">
            <img 
              src={story.coverImage} 
              alt={story.title || 'Story cover image'} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
            />
          </div>
        )}

      </div>
    </Link>
  );
}