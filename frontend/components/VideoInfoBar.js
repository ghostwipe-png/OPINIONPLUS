'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Heart, ThumbsDown, Share2, Bookmark, BookmarkCheck,
  UserPlus, UserMinus, AlertTriangle, ChevronDown, ChevronUp,
  Copy, Check, MessageCircle
} from 'lucide-react';

function formatCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function VideoInfoBar({
  video,
  likesCount,
  userLiked,
  onLike,
  onDislike,
  isSubscribed,
  subscriberCount,
  onSubscribe,
  onShare,
  onReport,
  inWatchLater,
  onToggleWatchLater,
}) {
  const [showDesc, setShowDesc] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const description = video?.description || 'No description provided for this broadcast.';
  const isLongDesc = description.length > 150;

  return (
    <div className="space-y-4">
      {/* Title */}
      <h1 className="text-xl sm:text-2xl font-bold text-ink leading-tight">
        {video?.title}
      </h1>

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-wire">
        {/* Left: Meta */}
        <div className="flex items-center gap-3 text-sm text-ink-500">
          <span>{formatCount(video?.views || 0)} views</span>
          <span className="text-wire">•</span>
          <span>{formatDate(video?.created_at)}</span>
          {video?.category && (
            <>
              <span className="text-wire">•</span>
              <span className="bg-ink-50 text-ink-600 text-xs font-semibold uppercase px-2 py-0.5 rounded-sm">
                {video.category}
              </span>
            </>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Like/Dislike */}
          <div className="flex items-center border border-wire rounded-full overflow-hidden bg-ink-50/50">
            <button
              onClick={onLike}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                userLiked ? 'text-ink bg-white' : 'text-ink-500 hover:text-ink hover:bg-white'
              }`}
              aria-label="Like"
            >
              <Heart size={16} fill={userLiked ? 'currentColor' : 'none'} />
              <span>{formatCount(likesCount)}</span>
            </button>
            <div className="w-px h-5 bg-wire" />
            <button
              onClick={onDislike}
              className="px-3 py-2 text-ink-500 hover:text-ink hover:bg-white transition-colors"
              aria-label="Dislike"
            >
              <ThumbsDown size={16} />
            </button>
          </div>

          {/* Watch Later */}
          <button
            onClick={onToggleWatchLater}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              inWatchLater
                ? 'bg-ink-50 text-ink border border-ink'
                : 'bg-ink-50/50 text-ink-500 border border-wire hover:border-ink hover:text-ink'
            }`}
            aria-label={inWatchLater ? 'Remove from Watch Later' : 'Save to Watch Later'}
          >
            {inWatchLater ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
            <span className="hidden sm:inline">{inWatchLater ? 'Saved' : 'Watch Later'}</span>
          </button>

          {/* Share */}
          <button
            onClick={onShare || handleCopyLink}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-ink-50/50 text-ink-500 border border-wire hover:border-ink hover:text-ink transition-colors"
            aria-label="Share"
          >
            {copied ? <Check size={16} className="text-emerald-600" /> : <Share2 size={16} />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
          </button>

          {/* Report */}
          {onReport && (
            <button
              onClick={onReport}
              className="p-2 rounded-full text-ink-400 hover:text-signal hover:bg-signal/5 transition-colors"
              aria-label="Report"
              title="Report"
            >
              <AlertTriangle size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Channel Bar */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-wire">
        <div className="flex items-center gap-3">
          <Link
            href={`/profile/${video?.user_id}`}
            className="w-10 h-10 rounded-full bg-ink text-white font-bold grid place-items-center text-sm shrink-0 hover:ring-2 ring-signal transition-all"
          >
            {video?.user_name?.charAt(0)?.toUpperCase() || 'C'}
          </Link>
          <div>
            <Link
              href={`/profile/${video?.user_id}`}
              className="font-semibold text-ink hover:text-signal transition-colors text-sm"
            >
              {video?.user_name}
            </Link>
            <p className="text-xs text-ink-400">
              {formatCount(subscriberCount)} subscriber{subscriberCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {onSubscribe && (
          <button
            onClick={onSubscribe}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold transition-all ${
              isSubscribed
                ? 'bg-ink-50 text-ink border border-wire hover:bg-ink-100'
                : 'bg-ink text-white hover:bg-signal'
            }`}
          >
            {isSubscribed ? <UserMinus size={16} /> : <UserPlus size={16} />}
            {isSubscribed ? 'Subscribed' : 'Subscribe'}
          </button>
        )}
      </div>

      {/* Description */}
      <div className={`bg-ink-50/50 rounded-sm p-4 transition-all ${!showDesc && isLongDesc ? 'cursor-pointer hover:bg-ink-50' : ''}`}>
        <div className={`text-sm text-ink-700 leading-relaxed whitespace-pre-wrap ${!showDesc && isLongDesc ? 'line-clamp-3' : ''}`}>
          {description}
        </div>
        {isLongDesc && (
          <button
            onClick={() => setShowDesc(!showDesc)}
            className="mt-2 text-xs font-semibold text-ink-500 hover:text-ink flex items-center gap-1 transition-colors"
          >
            {showDesc ? (
              <>
                Show less <ChevronUp size={14} />
              </>
            ) : (
              <>
                Show more <ChevronDown size={14} />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}