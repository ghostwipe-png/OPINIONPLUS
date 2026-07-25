'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Play, Eye, Film, Loader2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function formatCount(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function RelatedVideoCard({ video }) {
  const [imgError, setImgError] = useState(false);

  const thumbnailSrc = video.thumbnail_url ||
    `https://${process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME || 'iframe.mediadelivery.net'}/${video.bunny_video_id}/thumbnail.jpg`;

  return (
    <Link
      href={`/videos/${video.id}`}
      className="flex gap-3 group hover:bg-ink-50/50 rounded-sm p-1 -m-1 transition-colors"
    >
      {/* Thumbnail */}
      <div className="relative w-40 sm:w-44 shrink-0 aspect-video rounded-sm overflow-hidden bg-ink-100">
        {!imgError ? (
          <img
            src={thumbnailSrc}
            alt={video.title}
            onError={() => setImgError(true)}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-ink-50">
            <Film size={20} className="text-ink-300" />
          </div>
        )}
        {video.duration_seconds > 0 && (
          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded-sm font-mono">
            {Math.floor(video.duration_seconds / 60)}:{String(video.duration_seconds % 60).padStart(2, '0')}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-ink group-hover:text-signal transition-colors line-clamp-2 leading-snug">
          {video.title}
        </h4>
        <p className="text-xs text-ink-500 mt-1">{video.user_name}</p>
        <p className="text-xs text-ink-400 mt-0.5">
          {formatCount(video.views)} views · {timeAgo(video.created_at)}
        </p>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="flex gap-3 animate-pulse p-1">
      <div className="w-40 sm:w-44 shrink-0 aspect-video rounded-sm bg-wire/20" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-wire/20 rounded w-full" />
        <div className="h-3.5 bg-wire/20 rounded w-3/4" />
        <div className="h-2.5 bg-wire/20 rounded w-1/2" />
      </div>
    </div>
  );
}

export default function RelatedVideos({ currentVideoId, category }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);

  useEffect(() => {
    if (!currentVideoId) return;

    let cancelled = false;
    setLoading(true);
    setError(false);

    (async () => {
      try {
        const params = new URLSearchParams();
        params.append('limit', '12');
        params.append('excludeId', currentVideoId);
        if (category && category !== 'all') {
          params.append('category', category);
        }

        const res = await fetch(`${API_BASE}/videos/recommendations?${params}`, {
          credentials: 'include',
        });

        if (!res.ok) throw new Error('Failed to fetch');

        const data = await res.json();
        if (!cancelled) {
          setVideos(Array.isArray(data.videos) ? data.videos : []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(true);
          setVideos([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [currentVideoId, category]);

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-ink uppercase tracking-widest border-b border-wire pb-3 mb-4">Related</h3>
        {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (error || videos.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-ink uppercase tracking-widest border-b border-wire pb-3 mb-4">Related</h3>
        <p className="text-xs text-ink-400 italic">No related videos available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-wire pb-3">
        <h3 className="text-sm font-bold text-ink uppercase tracking-widest">Related</h3>
        <label className="flex items-center gap-1.5 text-xs text-ink-400 cursor-pointer select-none">
          <span>Autoplay</span>
          <button
            role="switch"
            aria-checked={autoplayEnabled}
            onClick={() => setAutoplayEnabled(!autoplayEnabled)}
            className={`relative w-8 h-4 rounded-full transition-colors ${
              autoplayEnabled ? 'bg-ink' : 'bg-wire'
            }`}
          >
            <span
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform shadow-sm ${
                autoplayEnabled ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
        </label>
      </div>

      {/* Video List */}
      <div className="space-y-4">
        {videos.map((v, i) => (
          <div key={v.id}>
            {autoplayEnabled && i === 0 && (
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-2">
                Up next
              </p>
            )}
            <RelatedVideoCard video={v} />
          </div>
        ))}
      </div>
    </div>
  );
}