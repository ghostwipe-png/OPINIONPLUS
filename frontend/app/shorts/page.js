'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Heart,
  MessageCircle,
  Share2,
  UserPlus,
  UserMinus,
  Loader2,
  Send,
  X,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const MAX_COMMENT_LENGTH = 500;

function sanitizeComment(text) {
  return text
    .replace(/[\u0000-\u001F\u007F]/g, '') // strip control chars
    .trim()
    .slice(0, MAX_COMMENT_LENGTH);
}

function ShortPlayer({ short, isActive, shouldMount, csrfToken, isLast }) {
  const videoRef = useRef(null);
  const router = useRouter();
  const { user } = useAuth();

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(short.likes_count || 0);
  const [showHeart, setShowHeart] = useState(false);
  const [heartPos, setHeartPos] = useState({ x: 0, y: 0 });
  const [following, setFollowing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState([]);
  const [commentCount, setCommentCount] = useState(short.comments_count || 0);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const [progress, setProgress] = useState(0);

  const lastTapRef = useRef(0);
  const tapTimeoutRef = useRef(null);

  const cdnHostname = process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME || 'iframe.mediadelivery.net';
  const hlsUrl = `https://${cdnHostname}/${short.bunny_video_id}/playlist.m3u8`;
  const isOwn = !!(user && short.user_id === user.id);

  const requireLogin = useCallback(() => {
    router.push('/login');
  }, [router]);

  const authHeaders = useCallback(
    (json) => ({
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    }),
    [csrfToken]
  );

  // Auto-play when active, pause when inactive
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      v.currentTime = 0;
      setVideoError(false);
      const playPromise = v.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(() => setPlaying(true)).catch(() => setPlaying(false));
      } else {
        setPlaying(true);
      }
    } else {
      v.pause();
      setPlaying(false);
    }
  }, [isActive, shouldMount]);

  // Track playback progress for the progress bar
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTimeUpdate = () => {
      if (v.duration > 0) setProgress((v.currentTime / v.duration) * 100);
    };
    v.addEventListener('timeupdate', onTimeUpdate);
    return () => v.removeEventListener('timeupdate', onTimeUpdate);
  }, [shouldMount]);

  // Load like/follow/subscriber status for the active short
  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;

    if (user) {
      fetch(`${API_BASE}/videos/${short.id}/like-status`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : { liked: null }))
        .then((d) => { if (!cancelled) setLiked(d.liked === true); })
        .catch(() => {});

      if (!isOwn) {
        fetch(`${API_BASE}/channels/${short.user_id}/is-subscribed`, { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : { subscribed: false }))
          .then((d) => { if (!cancelled) setFollowing(!!d.subscribed); })
          .catch(() => {});
      }
    }

    fetch(`${API_BASE}/channels/${short.user_id}/subscriber-count`)
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => { if (!cancelled) setSubscriberCount(d.count || 0); })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [user, short.id, short.user_id, isActive, isOwn]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const handleLike = useCallback(
    (e) => {
      if (e) e.stopPropagation();
      if (!user) { requireLogin(); return; }
      const next = !liked;
      setLiked(next);
      setLikesCount((prev) => (next ? prev + 1 : Math.max(prev - 1, 0)));
      fetch(`${API_BASE}/videos/${short.id}/like`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(true),
        body: JSON.stringify({ liked: next }),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => {
          if (typeof d.likesCount === 'number') setLikesCount(d.likesCount);
          if (typeof d.userLiked === 'boolean') setLiked(d.userLiked);
        })
        .catch(() => {
          // revert optimistic update on failure
          setLiked(!next);
          setLikesCount((prev) => (next ? Math.max(prev - 1, 0) : prev + 1));
        });
    },
    [user, liked, short.id, authHeaders, requireLogin]
  );

  const handleClick = (e) => {
    // Don't pause/like if clicking action buttons or the comments panel
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('form')) return;

    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (now - lastTapRef.current < 300) {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      if (user) {
        if (!liked) handleLike();
        setHeartPos({ x, y });
        setShowHeart(true);
        setTimeout(() => setShowHeart(false), 800);
      } else {
        requireLogin();
      }
    } else {
      tapTimeoutRef.current = setTimeout(() => {
        togglePlay();
        tapTimeoutRef.current = null;
      }, 300);
    }
    lastTapRef.current = now;
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    const next = !v.muted;
    v.muted = next;
    setMuted(next);
  };

  const handleFollow = (e) => {
    e.stopPropagation();
    if (!user) { requireLogin(); return; }
    const next = !following;
    setFollowing(next);
    setSubscriberCount((prev) => (next ? prev + 1 : Math.max(prev - 1, 0)));
    fetch(`${API_BASE}/channels/${short.user_id}/subscribe`, {
      method: next ? 'POST' : 'DELETE',
      credentials: 'include',
      headers: authHeaders(false),
    })
      .then((r) => { if (!r.ok) throw new Error('follow failed'); })
      .catch(() => {
        setFollowing(!next);
        setSubscriberCount((prev) => (next ? Math.max(prev - 1, 0) : prev + 1));
      });
  };

  const handleShare = (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}/videos/${short.id}`;
    if (navigator.share) {
      navigator.share({ title: short.title, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  const toggleComments = (e) => {
    e.stopPropagation();
    if (!user) { requireLogin(); return; }
    setShowComments((prev) => {
      const next = !prev;
      if (next && comments.length === 0) {
        fetch(`${API_BASE}/videos/${short.id}/comments`, { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : { comments: [] }))
          .then((d) => setComments(Array.isArray(d.comments) ? d.comments : []))
          .catch(() => {});
      }
      return next;
    });
  };

  const handleSendComment = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { requireLogin(); return; }
    const text = sanitizeComment(commentText);
    if (!text) return;
    setCommentText('');
    const tempId = `temp_${Date.now()}`;
    const tempComment = {
      id: tempId,
      user_name: user.publisherName || user.name || 'You',
      body: text,
      created_at: new Date().toISOString(),
    };
    setComments((prev) => [tempComment, ...prev]);
    setCommentCount((prev) => prev + 1);

    fetch(`${API_BASE}/videos/${short.id}/comments`, {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(true),
      body: JSON.stringify({ body: text }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((saved) => {
        setComments((prev) => prev.map((c) => (c.id === tempId ? { ...saved, id: saved.id ?? tempId } : c)));
      })
      .catch(() => {
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        setCommentCount((prev) => Math.max(prev - 1, 0));
      });
  };

  // Keyboard shortcuts, scoped to the active short only
  useEffect(() => {
    if (!isActive) return;
    const handleKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'm' || e.key === 'M') {
        const v = videoRef.current;
        if (!v) return;
        const next = !v.muted;
        v.muted = next;
        setMuted(next);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isActive]);

  return (
    <div
      onClick={handleClick}
      className="relative w-full max-w-[400px] mx-auto aspect-[9/16] bg-black rounded-xl overflow-hidden shadow-2xl cursor-pointer snap-center group"
    >
      {shouldMount && !videoError ? (
        <video
          ref={videoRef}
          src={hlsUrl}
          poster={short.thumbnail_url || undefined}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted={muted}
          loop
          crossOrigin="anonymous"
          onError={() => setVideoError(true)}
        />
      ) : (
        <img
          src={short.thumbnail_url || ''}
          alt={short.title || ''}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Video failed to load — show a subtle indicator over the thumbnail */}
      {videoError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10 pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-white/70">
            <AlertTriangle size={28} />
            <span className="text-xs">Video unavailable</span>
          </div>
        </div>
      )}

      {/* Double tap heart */}
      {showHeart && (
        <div
          className="absolute z-30 pointer-events-none"
          style={{ left: `${heartPos.x}%`, top: `${heartPos.y}%`, transform: 'translate(-50%, -50%)' }}
        >
          <Heart size={80} fill="#E0492B" className="text-signal animate-ping-once" />
        </div>
      )}

      {/* Paused indicator */}
      {isActive && !playing && !videoError && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-10 pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex flex-col items-center justify-center gap-1">
            <Pause size={28} className="text-white" />
            <span className="text-white text-[10px] font-semibold uppercase tracking-wide">Paused</span>
          </div>
        </div>
      )}

      {/* Mute */}
      <button
        onClick={toggleMute}
        className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors duration-300"
        aria-label={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>

      {/* Right actions */}
      <div className="absolute bottom-28 right-3 z-20 flex flex-col items-center gap-5">
        <button onClick={handleLike} className="flex flex-col items-center gap-1 text-white" aria-label="Like">
          <div className="w-11 h-11 rounded-full bg-black/40 flex items-center justify-center">
            <Heart size={22} className={liked ? 'fill-signal text-signal' : 'text-white'} />
          </div>
          <span className="text-[11px] font-semibold drop-shadow">{likesCount}</span>
        </button>

        <button onClick={toggleComments} className="flex flex-col items-center gap-1 text-white" aria-label="Comments">
          <div className="w-11 h-11 rounded-full bg-black/40 flex items-center justify-center">
            <MessageCircle size={22} />
          </div>
          <span className="text-[11px] font-semibold drop-shadow">{commentCount}</span>
        </button>

        <button onClick={handleShare} className="flex flex-col items-center gap-1 text-white" aria-label="Share">
          <div className="w-11 h-11 rounded-full bg-black/40 flex items-center justify-center">
            <Share2 size={20} />
          </div>
          <span className="text-[11px] font-semibold drop-shadow">Share</span>
        </button>
      </div>

      {/* Follow button — only on other creators' shorts */}
      {!isOwn && (
        <div className="absolute bottom-28 left-3 z-20">
          <button
            onClick={handleFollow}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase transition-all duration-300 ${
              following ? 'bg-white/10 text-white border border-white/30' : 'bg-signal text-white hover:bg-signal/90'
            }`}
          >
            {following ? <UserMinus size={14} /> : <UserPlus size={14} />}
            {following ? 'Following' : 'Follow'}
          </button>
        </div>
      )}

      {/* Comments panel */}
      {showComments && (
        <div
          className="absolute inset-x-0 bottom-0 h-[60%] z-40 bg-black/90 backdrop-blur-sm flex flex-col rounded-t-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
            <h3 className="text-white font-bold text-sm">Comments ({commentCount})</h3>
            <button onClick={toggleComments} className="text-white/60 hover:text-white transition-colors duration-300" aria-label="Close comments">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {comments.length === 0 ? (
              <p className="text-white/40 text-xs text-center py-8">No comments yet. Be the first!</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                    {c.user_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <span className="text-white/80 text-xs font-semibold">{c.user_name}</span>
                    <p className="text-white text-xs mt-0.5 break-words">{c.body}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <form onSubmit={handleSendComment} className="flex items-center gap-2 px-4 py-3 border-t border-white/10 shrink-0">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              maxLength={MAX_COMMENT_LENGTH}
              placeholder="Add a comment..."
              className="flex-1 bg-white/10 text-white text-sm rounded-full px-4 py-2 outline-none placeholder:text-white/40"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="submit"
              disabled={!commentText.trim()}
              className="text-signal disabled:text-white/30 p-1.5"
              aria-label="Send comment"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      )}

      {/* Info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pt-10 bg-gradient-to-t from-black/80 via-black/50 to-transparent z-10 pointer-events-none">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {short.user_name?.charAt(0)?.toUpperCase() || 'C'}
          </div>
          <div>
            <span className="text-white font-semibold text-sm block">{short.user_name}</span>
            <span className="text-white/50 text-xs">{subscriberCount} subscribers</span>
          </div>
        </div>
        <h3 className="text-white text-sm leading-snug line-clamp-2">{short.title}</h3>
        <div className="flex items-center gap-3 mt-2 text-white/60 text-xs">
          <span>{short.views || 0} views</span>
          {short.duration_seconds > 0 && (
            <span>
              {Math.floor(short.duration_seconds / 60)}:{String(short.duration_seconds % 60).padStart(2, '0')}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20 z-20">
        <div className="h-full bg-signal" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export default function ShortsPage() {
  const [shorts, setShorts] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [csrfToken, setCsrfToken] = useState(null);
  const containerRef = useRef(null);

  const fetchShorts = useCallback(() => {
    setLoading(true);
    setError(false);
    fetch(`${API_BASE}/videos/shorts`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('bad response'))))
      .then((d) => setShorts(Array.isArray(d.shorts) ? d.shorts : []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchShorts();
  }, [fetchShorts]);

  // Fetch a CSRF token up front for like/comment/follow mutations
  useEffect(() => {
    fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCsrfToken(d?.csrfToken || d?.token || null))
      .catch(() => setCsrfToken(null));
  }, []);

  // Hide footer while on the shorts page, restore on unmount
  useEffect(() => {
    const footer = document.querySelector('footer');
    const prevDisplay = footer ? footer.style.display : null;
    if (footer) footer.style.display = 'none';
    return () => {
      if (footer) footer.style.display = prevDisplay || '';
    };
  }, []);

  // Auto-detect which short is in view
  useEffect(() => {
    if (!containerRef.current || shorts.length === 0) return;
    const slides = Array.from(containerRef.current.querySelectorAll('[data-short-slide]'));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = slides.indexOf(entry.target);
            if (index >= 0) setActiveIndex(index);
          }
        });
      },
      { threshold: 0.7 }
    );
    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [shorts]);

  const scrollToIndex = useCallback((index) => {
    const slides = containerRef.current?.querySelectorAll('[data-short-slide]');
    slides?.[index]?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const goNext = useCallback(() => {
    setActiveIndex((prev) => {
      if (prev < shorts.length - 1) {
        scrollToIndex(prev + 1);
      }
      return prev;
    });
  }, [shorts.length, scrollToIndex]);

  const goPrev = useCallback(() => {
    setActiveIndex((prev) => {
      if (prev > 0) {
        scrollToIndex(prev - 1);
      }
      return prev;
    });
  }, [scrollToIndex]);

  // Touch swipe (up = next, down = previous)
  const touchStartY = useRef(0);
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e) => {
    const diff = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  // Keyboard navigation (page-level: next/prev only; play/pause/mute are per-slide)
  useEffect(() => {
    const handleKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'J') goNext();
      if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'K') goPrev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev]);

  // Mouse wheel navigation
  useEffect(() => {
    let wheelLock = false;
    const handleWheel = (e) => {
      if (wheelLock) return;
      wheelLock = true;
      if (e.deltaY > 0) goNext();
      else if (e.deltaY < 0) goPrev();
      setTimeout(() => { wheelLock = false; }, 500);
    };
    const node = containerRef.current;
    node?.addEventListener('wheel', handleWheel, { passive: true });
    return () => node?.removeEventListener('wheel', handleWheel);
  }, [goNext, goPrev, shorts.length]);

  return (
    <div
      className="bg-black min-h-screen flex flex-col fixed inset-0 z-50"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative z-10 flex items-center justify-between px-5 py-4 bg-gradient-to-b from-black/60 to-transparent shrink-0">
        <Link href="/videos" className="text-white/80 hover:text-white text-sm font-bold transition-colors duration-300">
          ← Back
        </Link>
        <h1 className="text-white font-black text-lg uppercase tracking-widest">Shorts</h1>
        <span className="text-white/50 text-xs">{shorts.length} shorts</span>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-white/60" />
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white/50 px-6 text-center">
          <AlertTriangle size={40} className="mb-4" />
          <p className="text-sm font-bold">Couldn't load shorts</p>
          <p className="text-xs mt-1 mb-4">Check your connection and try again.</p>
          <button
            onClick={fetchShorts}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-signal text-white text-xs font-bold uppercase hover:bg-signal/90 transition-colors duration-300"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      ) : shorts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white/50">
          <Play size={48} className="mb-4" />
          <p className="text-sm font-bold">No shorts yet</p>
          <p className="text-xs mt-1">Short videos under 60 seconds will appear here.</p>
        </div>
      ) : (
        <div className="relative flex-1 overflow-hidden">
          {shorts.length > 1 && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1.5">
              {shorts.map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollToIndex(i)}
                  aria-label={`Go to short ${i + 1}`}
                  className={`w-1.5 rounded-full transition-all duration-300 ${
                    i === activeIndex ? 'h-6 bg-white' : 'h-1.5 bg-white/40 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>
          )}

          <div
            ref={containerRef}
            className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-none"
          >
            {shorts.map((s, i) => (
              <div key={s.id} data-short-slide className="h-full snap-center flex items-center justify-center p-4">
                <ShortPlayer
                  short={s}
                  isActive={i === activeIndex}
                  shouldMount={Math.abs(i - activeIndex) <= 1}
                  csrfToken={csrfToken}
                  isLast={i === shorts.length - 1}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}