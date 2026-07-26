'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Play, Pause, Volume2, VolumeX, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function ShortPlayer({ short, isActive, onActivate }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  const cdnHostname = process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME || 'iframe.mediadelivery.net';
  const hlsUrl = `https://${cdnHostname}/${short.bunny_video_id}/playlist.m3u8`;

  useEffect(() => {
    if (isActive && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
      setPlaying(true);
    } else if (!isActive && videoRef.current) {
      videoRef.current.pause();
      setPlaying(false);
    }
  }, [isActive]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setPlaying(true);
    } else {
      videoRef.current.pause();
      setPlaying(false);
    }
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setMuted(!muted);
  };

  return (
    <div
      className="relative w-full max-w-[400px] mx-auto aspect-[9/16] bg-black rounded-xl overflow-hidden shadow-2xl cursor-pointer snap-center"
      onClick={() => onActivate ? onActivate() : togglePlay()}
    >
      <video
        ref={videoRef}
        src={hlsUrl}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted={muted}
        loop
        crossOrigin="anonymous"
      />

      {/* Play/Pause overlay */}
      {!playing && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Play size={32} fill="white" className="text-white ml-1" />
          </div>
        </div>
      )}

      {/* Mute button */}
      <button
        onClick={toggleMute}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>

      {/* Info overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/80 via-black/30 to-transparent">
        <h3 className="text-white font-bold text-sm leading-snug line-clamp-2">{short.title}</h3>
        <div className="flex items-center gap-3 mt-2 text-white/70 text-xs">
          <span>{short.views || 0} views</span>
          {short.duration_seconds > 0 && (
            <span>{Math.floor(short.duration_seconds / 60)}:{String(short.duration_seconds % 60).padStart(2, '0')}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShortsPage() {
  const [shorts, setShorts] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/videos/shorts`)
      .then(r => r.ok ? r.json() : { shorts: [] })
      .then(d => setShorts(Array.isArray(d.shorts) ? d.shorts : []))
      .catch(() => setShorts([]))
      .finally(() => setLoading(false));
  }, []);

  const goNext = () => {
    if (activeIndex < shorts.length - 1) {
      setActiveIndex(prev => prev + 1);
      containerRef.current?.children[activeIndex + 1]?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const goPrev = () => {
    if (activeIndex > 0) {
      setActiveIndex(prev => prev - 1);
      containerRef.current?.children[activeIndex - 1]?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowDown') goNext();
      if (e.key === 'ArrowUp') goPrev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeIndex, shorts.length]);

  return (
    <div className="bg-black min-h-screen flex flex-col">
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-5 py-4">
        <Link href="/videos" className="text-white/80 hover:text-white text-sm font-bold flex items-center gap-2">
          ← Back to Videos
        </Link>
        <h1 className="text-white font-black text-lg uppercase tracking-widest">Shorts</h1>
        <span className="text-white/50 text-xs">{shorts.length} shorts</span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-white/60" />
        </div>
      ) : shorts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white/50">
          <Play size={48} className="mb-4" />
          <p className="text-sm font-bold">No shorts yet</p>
          <p className="text-xs mt-1">Short videos under 60 seconds will appear here.</p>
        </div>
      ) : (
        <div className="flex-1 relative overflow-hidden">
          {/* Navigation arrows */}
          {activeIndex > 0 && (
            <button
              onClick={goPrev}
              className="absolute top-1/2 left-4 z-20 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <ChevronUp size={24} />
            </button>
          )}
          {activeIndex < shorts.length - 1 && (
            <button
              onClick={goNext}
              className="absolute top-1/2 right-4 z-20 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <ChevronDown size={24} />
            </button>
          )}

          {/* Shorts container */}
          <div
            ref={containerRef}
            className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-none"
          >
            {shorts.map((s, i) => (
              <div key={s.id} className="h-full snap-center flex items-center justify-center p-4">
                <ShortPlayer
                  short={s}
                  isActive={i === activeIndex}
                  onActivate={() => setActiveIndex(i)}
                />
              </div>
            ))}
          </div>

          {/* Progress dots */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
            {shorts.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`w-1.5 rounded-full transition-all ${
                  i === activeIndex ? 'h-6 bg-white' : 'h-1.5 bg-white/40 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}