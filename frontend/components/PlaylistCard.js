'use client';

import Link from 'next/link';
import { Lock, Globe, EyeOff, Film, ListVideo } from 'lucide-react';

function PrivacyIcon({ privacy }) {
  switch (privacy) {
    case 'private':
      return <Lock size={12} className="text-signal" />;
    case 'unlisted':
      return <EyeOff size={12} className="text-amber-500" />;
    default:
      return <Globe size={12} className="text-emerald-500" />;
  }
}

function PrivacyLabel({ privacy }) {
  switch (privacy) {
    case 'private': return 'Private';
    case 'unlisted': return 'Unlisted';
    default: return 'Public';
  }
}

export default function PlaylistCard({ playlist }) {
  const videoCount = playlist.video_count || 0;
  const firstVideoThumb = playlist.thumbnail_url;

  return (
    <Link
      href={`/playlist/${playlist.id}`}
      className="group flex flex-col bg-white border border-wire/40 rounded-sm overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
    >
      {/* Thumbnail Area */}
      <div className="relative aspect-video w-full bg-ink-50 overflow-hidden">
        {firstVideoThumb ? (
          <img
            src={firstVideoThumb}
            alt={playlist.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-ink-50 to-wire/30">
            <ListVideo size={28} className="text-ink-300" />
          </div>
        )}

        {/* Video count overlay */}
        <div className="absolute bottom-0 right-0 bg-black/80 text-white text-[10px] font-semibold px-2 py-1 rounded-tl-sm flex items-center gap-1">
          <ListVideo size={12} />
          <span>{videoCount} video{videoCount === 1 ? '' : 's'}</span>
        </div>

        {/* Play All overlay on hover */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="bg-white text-ink text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-sm shadow-lg">
            Play All
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 sm:p-4 space-y-1.5">
        <h3 className="text-sm font-bold text-ink group-hover:text-signal transition-colors line-clamp-2 leading-snug">
          {playlist.title}
        </h3>
        <p className="text-xs text-ink-500 line-clamp-1">
          {playlist.description || 'No description'}
        </p>
        <div className="flex items-center justify-between text-[11px] text-ink-400 pt-1">
          <span className="flex items-center gap-1 font-medium">
            <PrivacyIcon privacy={playlist.privacy} />
            {PrivacyLabel({ privacy: playlist.privacy })}
          </span>
          <span>
            {playlist.updated_at
              ? new Date(playlist.updated_at).toLocaleDateString()
              : ''}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function PlaylistCardSkeleton() {
  return (
    <div className="bg-white border border-wire/40 rounded-sm overflow-hidden animate-pulse">
      <div className="aspect-video bg-wire/20 w-full" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-wire/30 rounded w-5/6" />
        <div className="h-3 bg-wire/20 rounded w-2/3" />
        <div className="h-3 bg-wire/20 rounded w-1/2" />
      </div>
    </div>
  );
}