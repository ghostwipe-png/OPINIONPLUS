'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Play, Shuffle, Lock, Globe, EyeOff, ListVideo, Film, Loader2, ChevronRight, Trash2, Pencil } from 'lucide-react';
import { useAuth } from '../../../lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function PlaylistPage({ params }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const { user } = useAuth();

  const [playlist, setPlaylist] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentVideoId, setCurrentVideoId] = useState(null);
  const [shuffleMode, setShuffleMode] = useState(false);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/playlists/${id}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Playlist not found');
        const data = await res.json();
        if (!cancelled) {
          setPlaylist(data.playlist);
          setVideos(data.videos || []);
          if (data.videos && data.videos.length > 0) {
            setCurrentVideoId(data.videos[0].id);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load playlist');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id]);

  const isOwner = user && playlist && user.id === playlist.user_id;

  const handleDeletePlaylist = async () => {
    if (!confirm('Delete this playlist? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API_BASE}/playlists/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        window.location.href = '/library?tab=playlists';
      }
    } catch (e) {
      alert('Failed to delete playlist');
    }
  };

  const handleShuffle = () => {
    if (videos.length < 2) return;
    const shuffled = [...videos].sort(() => Math.random() - 0.5);
    setVideos(shuffled);
    setShuffleMode(true);
    setCurrentVideoId(shuffled[0].id);
  };

  const handlePlayAll = () => {
    if (videos.length > 0) {
      setCurrentVideoId(videos[0].id);
      setShuffleMode(false);
      // Re-sort by position
      setVideos([...videos].sort((a, b) => (a.position || 0) - (b.position || 0)));
    }
  };

  if (loading) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-signal" />
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="bg-paper min-h-screen py-24 text-center px-5">
        <ListVideo size={48} className="mx-auto text-ink-300 mb-4" />
        <h1 className="text-2xl font-black text-ink uppercase mb-2">Playlist Not Found</h1>
        <p className="text-xs text-ink-500 mb-6">{error || 'This playlist may have been removed or made private.'}</p>
        <Link href="/videos" className="bg-ink text-white font-bold uppercase text-xs px-6 py-3 rounded-sm">
          Back to Videos
        </Link>
      </div>
    );
  }

  const PrivacyIcon = playlist.privacy === 'private' ? Lock : playlist.privacy === 'unlisted' ? EyeOff : Globe;
  const privacyLabel = playlist.privacy === 'private' ? 'Private' : playlist.privacy === 'unlisted' ? 'Unlisted' : 'Public';

  const currentVideo = videos.find(v => v.id === currentVideoId);

  return (
    <div className="bg-paper min-h-screen pb-24">
      {/* Header */}
      <div className="bg-ink text-white">
        <div className="max-w-7xl mx-auto px-5 py-12 sm:py-16">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Playlist thumbnail */}
            <div className="w-full md:w-56 lg:w-64 aspect-video bg-ink-700 rounded-sm overflow-hidden shrink-0 flex items-center justify-center">
              {videos.length > 0 && videos[0].thumbnail_url ? (
                <img src={videos[0].thumbnail_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <ListVideo size={48} className="text-ink-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <PrivacyIcon size={14} className="text-white/60" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">{privacyLabel}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">{playlist.title}</h1>
              {playlist.description && (
                <p className="text-white/70 text-sm mb-4 max-w-xl">{playlist.description}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-white/60">
                <Link href={`/profile/${playlist.user_id}`} className="font-semibold text-white hover:underline">
                  {playlist.user_name}
                </Link>
                <span>•</span>
                <span>{videos.length} video{videos.length === 1 ? '' : 's'}</span>
                <span>•</span>
                <span>Updated {new Date(playlist.updated_at).toLocaleDateString()}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-5 flex-wrap">
                <button
                  onClick={handlePlayAll}
                  className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-6 py-3 rounded-sm hover:bg-signal/90 transition-colors flex items-center gap-2 shadow-md"
                >
                  <Play size={14} fill="currentColor" /> Play All
                </button>
                <button
                  onClick={handleShuffle}
                  className="bg-white/10 text-white font-bold uppercase text-xs tracking-wider px-6 py-3 rounded-sm hover:bg-white/20 transition-colors flex items-center gap-2"
                >
                  <Shuffle size={14} /> Shuffle
                </button>
                {isOwner && (
                  <>
                    <button
                      onClick={handleDeletePlaylist}
                      className="bg-transparent text-white/60 hover:text-signal font-bold uppercase text-xs tracking-wider px-4 py-3 rounded-sm transition-colors flex items-center gap-1.5"
                      title="Delete playlist"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Video Player */}
      {currentVideo && (
        <div className="w-full bg-black">
          <div className="max-w-7xl mx-auto aspect-video relative max-h-[60vh]">
            <iframe
              src={`https://iframe.mediadelivery.net/embed/${currentVideo.bunny_library_id}/${currentVideo.bunny_video_id}?autoplay=true`}
              loading="lazy"
              style={{ border: 'none', position: 'absolute', top: 0, left: 0, height: '100%', width: '100%' }}
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen={true}
              title={currentVideo.title}
            />
          </div>
        </div>
      )}

      {/* Video List */}
      <div className="max-w-7xl mx-auto px-5 pt-8">
        {videos.length === 0 ? (
          <div className="text-center py-16">
            <Film size={48} className="mx-auto text-ink-300 mb-4" />
            <p className="text-lg font-bold text-ink mb-2">No videos in this playlist</p>
            <p className="text-xs text-ink-500">Videos added to this playlist will appear here.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {videos.map((video, index) => (
              <button
                key={video.id}
                onClick={() => setCurrentVideoId(video.id)}
                className={`w-full flex items-center gap-4 p-3 rounded-sm text-left transition-colors group ${
                  currentVideoId === video.id
                    ? 'bg-ink-50 border-l-2 border-signal'
                    : 'hover:bg-ink-50 border-l-2 border-transparent'
                }`}
              >
                {/* Index */}
                <span className="w-6 text-center text-xs font-mono text-ink-400 shrink-0">
                  {shuffleMode ? '🎲' : index + 1}
                </span>

                {/* Thumbnail */}
                <div className="w-28 sm:w-36 shrink-0 aspect-video rounded-sm overflow-hidden bg-ink-100">
                  {video.thumbnail_url ? (
                    <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film size={18} className="text-ink-300" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className={`text-sm font-semibold line-clamp-2 leading-snug ${
                    currentVideoId === video.id ? 'text-signal' : 'text-ink group-hover:text-signal'
                  }`}>
                    {video.title}
                  </h4>
                  <p className="text-xs text-ink-500 mt-1">{video.user_name}</p>
                  <p className="text-xs text-ink-400">
                    {video.views || 0} views
                    {video.duration_seconds > 0 && (
                      <> · {Math.floor(video.duration_seconds / 60)}:{String(video.duration_seconds % 60).padStart(2, '0')}</>
                    )}
                  </p>
                </div>

                <ChevronRight size={16} className="text-ink-300 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}