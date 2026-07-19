import Link from 'next/link';
import { useState } from 'react';
import { Heart, MessageSquare, Star, Film, FileText, ExternalLink, ImageOff } from 'lucide-react';
import { useStore } from '../lib/store';

function avgRating(ratings) {
  const vals = Object.values(ratings || {});
  if (!vals.length) return null;
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

// Rough reading-time estimate from the excerpt/body length. This is a display
// nicety only — it never blocks rendering if excerpt is missing.
function estimateReadMinutes(story) {
  const text = `${story.excerpt || ''} ${story.body || ''}`.replace(/<[^>]*>/g, '');
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return minutes;
}

// Thin left-border color per source/type — purely visual categorization,
// doesn't touch any existing data model.
const CATEGORY_COLORS = {
  'BBC Africa': '#BB1919',
  'Al Jazeera': '#FDB813',
  'Nation Africa': '#003876',
  'Capital FM': '#8E44AD',
  'Tuko': '#E0492B',
  documentary: '#C99A3B',
  story: '#14171F',
};

const HOUR_MS = 60 * 60 * 1000;

export default function StoryCard({ story, loading = false }) {
  const { users } = useStore();
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  if (loading) return <StoryCardSkeleton />;

  const author = users.find((u) => u.id === story.authorId);
  const rating = avgRating(story.ratings);
  const date = new Date(story.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const isNews = story.authorId === 'u_newsdesk';
  const sourceMatch = isNews ? story.body?.match(/Original source: <a[^>]*>([^<]+)<\/a>/) : null;
  const sourceName = sourceMatch ? sourceMatch[1] : null;
  const linkMatch = isNews ? story.body?.match(/href="(https:\/\/[^"]+)"/) : null;
  const originalLink = linkMatch ? linkMatch[1] : null;
  const cardLink = isNews && originalLink ? originalLink : `/story/${story.id}`;
  const cardTarget = isNews && originalLink ? '_blank' : '_self';

  const isBreaking = Date.now() - new Date(story.createdAt).getTime() < HOUR_MS;
  const readMinutes = estimateReadMinutes(story);
  const categoryColor = CATEGORY_COLORS[sourceName] || CATEGORY_COLORS[story.type] || '#DAD5C8';
  const showImage = story.coverImage && !story.mediaBlocked && !imgError;

  return (
    <article
      className="contain-card border-b border-wire py-3 hover:bg-ink-50/50 hover:shadow-sm transition-all duration-150 px-2 -mx-1 rounded-sm"
      style={{ borderLeft: `3px solid ${categoryColor}` }}
    >
      <div className="flex items-start gap-3 pl-1">
        {(story.coverImage && !story.mediaBlocked) && (
          <Link
            href={cardLink}
            target={cardTarget}
            rel={cardTarget === '_blank' ? 'noopener' : ''}
            className="shrink-0 relative w-16 h-16 sm:w-20 sm:h-20 rounded-sm overflow-hidden focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none"
          >
            {!imgLoaded && !imgError && (
              <div className="absolute inset-0 skeleton rounded-sm" aria-hidden="true" />
            )}
            {showImage ? (
              <img
                src={story.coverImage}
                alt=""
                loading="lazy"
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
                className={`w-full h-full object-cover transition-transform duration-150 hover:scale-[1.03] ${imgLoaded ? 'img-fade-in opacity-100' : 'opacity-0'}`}
              />
            ) : (
              <div
                className="w-full h-full grid place-items-center"
                style={{ backgroundColor: `${categoryColor}22` }}
                aria-hidden="true"
              >
                <ImageOff size={18} style={{ color: categoryColor }} />
              </div>
            )}
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-ink-400 flex items-center gap-1 leading-[1.4] tracking-[-0.01em]">
              {isNews ? <ExternalLink size={10} /> : story.type === 'documentary' ? <Film size={10} /> : <FileText size={10} />}
              {isNews ? 'News' : story.type}
              {sourceName && <span className="text-ink-300">· {sourceName}</span>}
            </span>
            <span className="text-[10px] text-ink-400">{date}</span>
            <span className="text-[10px] text-ink-400">· {readMinutes} min read</span>
            {isBreaking && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-signal">
                <span className="w-1.5 h-1.5 rounded-full bg-signal pulse-dot" aria-hidden="true" />
                Breaking
              </span>
            )}
          </div>
          <Link
            href={cardLink}
            target={cardTarget}
            rel={cardTarget === '_blank' ? 'noopener' : ''}
            className="focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none rounded-sm"
          >
            <h3 className="text-sm font-semibold leading-[1.4] tracking-[-0.01em] hover:text-signal transition-colors line-clamp-2 mb-0.5">
              {story.title}
            </h3>
          </Link>
          <p className="text-xs text-ink-500 line-clamp-2 mb-1">{story.excerpt}</p>
          <div className="flex items-center gap-3 text-[11px] text-ink-400">
            {author && <span className="text-ink-600 font-medium text-[11px]">{author.publisherName}</span>}
            <span className="flex items-center gap-1"><Heart size={11} /> {story.likes.length}</span>
            <span className="flex items-center gap-1"><MessageSquare size={11} /> {story.comments.length}</span>
            {rating && <span className="flex items-center gap-1"><Star size={11} fill="#C99A3B" stroke="#C99A3B" /> {rating}</span>}
          </div>
        </div>
      </div>
    </article>
  );
}

// Shimmer placeholder — same shape as a real card so grids don't jump when
// content arrives. Exported so page.js can render N of these while loading.
export function StoryCardSkeleton() {
  return (
    <article className="border-b border-wire py-3 px-2 -mx-1" style={{ borderLeft: '3px solid #DAD5C8' }} aria-hidden="true">
      <div className="flex items-start gap-3 pl-1">
        <div className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-sm skeleton" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-2.5 w-24 rounded-full skeleton" />
          <div className="h-3.5 w-4/5 rounded-full skeleton" />
          <div className="h-3 w-full rounded-full skeleton" />
          <div className="h-3 w-2/3 rounded-full skeleton" />
        </div>
      </div>
    </article>
  );
}
