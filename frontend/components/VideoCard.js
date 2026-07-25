'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Play, Eye, Film, Bookmark, BookmarkCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

let cachedCsrfToken = null;
async function getCsrfToken() {
  if (cachedCsrfToken) return cachedCsrfToken;
  try {
    const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
    const data = await res.json();
    cachedCsrfToken = data.csrfToken || data.token || '';
    return cachedCsrfToken;
  } catch {
    return '';
  }
}

export default function VideoCard({ video, showPublisher = true }) {
  const { user } = useAuth();
  const [savedLater, setSavedLater] = useState(false);
  const [savingLater, setSavingLater] = useState(false);

  const formatDuration = (secs) => {
    if (!secs || isNaN(secs)) return '00:00';
    const mins = Math.floor(secs / 60);
    const remainSecs = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remainSecs).padStart(2, '0')}`;
  };

  const getRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  // Bunny auto-thumbnail URL pattern as fallback
  const thumbnailSrc = video.thumbnail_url ||
    `https://${process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME}/${video.bunny_video_id}/thumbnail.jpg`;

  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user || !video?.id) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/watch-later/contains/${video.id}`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setSavedLater(!!data.inWatchLater);
      } catch {
        // ignore — quick action best-effort only
      }
    })();
    return () => { cancelled = true; };
  }, [user, video?.id]);

  const handleToggleWatchLater = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      window.location.href = '/login';
      return;
    }
    if (savingLater) return;
    setSavingLater(true);
    const nextVal = !savedLater;
    setSavedLater(nextVal);
    try {
      const token = await getCsrfToken();
      const res = await fetch(`${API_BASE}/watch-later/${video.id}`, {
        method: nextVal ? 'POST' : 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      });
      if (!res.ok) throw new Error('Request failed');
    } catch {
      setSavedLater(!nextVal); // revert on failure
    } finally {
      setSavingLater(false);
    }
  };

  return (
    <Link href={`/videos/${video.id}`} className="group flex flex-col bg-white border border-wire/40 rounded-sm overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] transition-all duration-300">
      <div className="relative aspect-video w-full bg-ink-100 overflow-hidden">
        {!imgError ? (
          <img
            src={thumbnailSrc}
            alt={video.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-ink to-ink-800 flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-full bg-signal/20 flex items-center justify-center">
              <Film size={24} className="text-signal" />
            </div>
            <span className="text-white/80 font-bold text-xs uppercase tracking-widest">Video Thumbnail</span>
          </div>
        )}

        {/* Category Badge */}
        <span className="absolute top-3 left-3 bg-ink/80 backdrop-blur-sm text-white font-bold text-[9px] uppercase px-2.5 py-1 rounded-sm tracking-wider">
          {video.category}
        </span>

        {/* Quick Watch-Later Action */}
        <button
          onClick={handleToggleWatchLater}
          title={savedLater ? 'Remove from Watch Later' : 'Save to Watch Later'}
          className={`absolute top-3 right-3 w-8 h-8 rounded-full grid place-content-center backdrop-blur-sm transition-all ${
            savedLater ? 'bg-signal text-white opacity-100' : 'bg-black/60 text-white opacity-0 group-hover:opacity-100'
          }`}
        >
          {savedLater ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
        </button>

        {/* Duration Badge */}
        {video.duration_seconds > 0 && (
          <span className="absolute bottom-3 right-3 bg-black/80 text-white font-mono text-[10px] px-2 py-0.5 rounded-sm">
            {formatDuration(video.duration_seconds)}
          </span>
        )}

        {/* Play Button Overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-signal text-white grid place-content-center shadow-lg transform group-hover:scale-110 transition-transform">
            <Play size={20} fill="currentColor" className="ml-0.5" />
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <h3 className="text-sm font-bold text-ink group-hover:text-signal transition-colors line-clamp-2 leading-snug mb-1.5">
            {video.title}
          </h3>
          <p className="text-xs text-ink-500 line-clamp-2 font-medium">
            {video.description || 'Watch full feature broadcast...'}
          </p>
        </div>

        <div className="pt-3 border-t border-wire/40 flex items-center justify-between text-[11px] text-ink-400 font-medium">
          {showPublisher && (
            <span className="truncate max-w-[60%] font-bold text-ink-600">{video.user_name}</span>
          )}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><Eye size={12} /> {video.views || 0}</span>
            <span>{getRelativeTime(video.created_at)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function VideoCardSkeleton() {
  return (
    <div className="bg-white border border-wire/40 rounded-sm overflow-hidden animate-pulse">
      <div className="aspect-video bg-wire/20 w-full" />
      <div className="p-5 space-y-3">
        <div className="h-4 bg-wire/30 rounded w-5/6" />
        <div className="h-3 bg-wire/20 rounded w-full" />
        <div className="h-3 bg-wire/20 rounded w-2/3" />
      </div>
    </div>
  );
}
