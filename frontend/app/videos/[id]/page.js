

'use client';

export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Eye, Heart, ThumbsDown, Share2, AlertTriangle, Check, UserPlus, UserMinus,
  MessageSquare, Film, Loader2, Bookmark, BookmarkCheck,
  Search, X, ListPlus, MoreVertical, HelpCircle, Maximize2, Settings, Monitor,
  Play, Pause, Plus, Lock, Globe, RotateCcw, SkipForward, Download,
} from 'lucide-react';
import { useAuth } from '../../../lib/auth';
import CommentThread from '../../../components/CommentThread';
import VideoCard from '../../../components/VideoCard';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const RECENT_SEARCHES_KEY = 'opinionplus_video_search_history';
const QUALITY_OPTIONS = ['Auto', '1080p', '720p', '480p', '360p'];
const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

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

function sendPlayerCommand(iframeEl, command, args) {
  if (!iframeEl || !iframeEl.contentWindow) return;
  const payloads = [
    { event: 'command', func: command, args: args || [] },
    { method: command, value: args ? args[0] : undefined },
    { type: command, value: args ? args[0] : undefined },
  ];
  payloads.forEach((p) => {
    try { iframeEl.contentWindow.postMessage(JSON.stringify(p), '*'); } catch { /* ignore */ }
    try { iframeEl.contentWindow.postMessage(p, '*'); } catch { /* ignore */ }
  });
}

export default function WatchVideoPage({ params }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const { user } = useAuth();
  const router = useRouter();

  const [video, setVideo] = useState(null);
  const [relatedVideos, setRelatedVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isExpandedDesc, setIsExpandedDesc] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reported, setReported] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [inWatchLater, setInWatchLater] = useState(false);

  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [mainInView, setMainInView] = useState(true);
  const [miniDismissed, setMiniDismissed] = useState(false);
  const [playerGuessPlaying, setPlayerGuessPlaying] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [videoInPlaylists, setVideoInPlaylists] = useState({});
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [autoplayEnabled, setAutoplayEnabled] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(5);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState('Auto');
  const [selectedSpeed, setSelectedSpeed] = useState(1);

  const watchSecondsRef = useRef(0);
  const watchIntervalRef = useRef(null);
  const iframeRef = useRef(null);
  const sentinelRef = useRef(null);
  const settingsMenuRef = useRef(null);
  const actionsMenuRef = useRef(null);

  const safeRelated = Array.isArray(relatedVideos) ? relatedVideos : [];
  const isMiniPlayer = !mainInView && !miniDismissed;

  const sendCommand = useCallback((command, args) => sendPlayerCommand(iframeRef.current, command, args), []);

  useEffect(() => {
    async function loadVideoData() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/videos/${id}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Video not found');
        const data = await res.json();
        setVideo(data.video);
        setLikesCount(data.video.likes_count || 0);

        try {
          const relRes = await fetch(`${API_BASE}/videos?category=${data.video.category}&limit=5`, { credentials: 'include' });
          const relData = await relRes.json();
          setRelatedVideos(Array.isArray(relData?.videos) ? relData.videos.filter((v) => v.id !== id) : []);
        } catch {
          setRelatedVideos([]);
        }
      } catch (e) {
        console.error(e);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    if (id) loadVideoData();
  }, [id]);

  useEffect(() => {
    if (!video) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/videos/${video.id}/like-status`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setLiked(data.liked === true);
          setDisliked(data.liked === false && data.liked !== null ? true : false);
        }
      } catch { /* ignore */ }
    })();

    if (user && video.user_id) {
      (async () => {
        try {
          const res = await fetch(`${API_BASE}/channels/${video.user_id}/is-subscribed`, { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            setIsFollowing(!!data.subscribed);
          }
        } catch { /* ignore */ }
      })();
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/channels/${video.user_id}/subscriber-count`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setSubscriberCount(data.count || 0);
        }
      } catch { /* ignore */ }
    })();

    if (user) {
      (async () => {
        try {
          const res = await fetch(`${API_BASE}/watch-later/contains/${video.id}`, { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            setInWatchLater(!!data.inWatchLater);
          }
        } catch { /* ignore */ }
      })();
    }
  }, [video, user]);

  useEffect(() => {
    if (!user || !video) return;
    const recordProgress = async (completed = false) => {
      try {
        const token = await getCsrfToken();
        await fetch(`${API_BASE}/history/${video.id}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
          body: JSON.stringify({ watchDuration: watchSecondsRef.current, completed }),
        });
      } catch { /* best-effort only */ }
    };
    watchIntervalRef.current = setInterval(() => {
      watchSecondsRef.current += 10;
      recordProgress(false);
    }, 10000);
    return () => {
      clearInterval(watchIntervalRef.current);
      if (watchSecondsRef.current > 0) recordProgress(false);
    };
  }, [user, video]);

  useEffect(() => {
    const footer = document.querySelector('footer');
    const prevDisplay = footer ? footer.style.display : null;
    if (footer) footer.style.display = 'none';
    return () => {
      if (footer) footer.style.display = prevDisplay || '';
    };
  }, []);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
      if (Array.isArray(stored)) setRecentSearches(stored);
    } catch { /* ignore */ }
  }, []);

  const saveRecentSearch = useCallback((q) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const next = [trimmed, ...prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, 10);
      try { localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Video-only search
  useEffect(() => {
    if (!showSearch) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/videos/search?q=${encodeURIComponent(q)}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(Array.isArray(data.videos) ? data.videos : []);
        } else {
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [searchQuery, showSearch]);

  const navigateToResult = useCallback((item) => {
    setShowSearch(false);
    router.push(`/videos/${item.id}`);
  }, [router]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setMainInView(entry.isIntersecting);
        if (entry.isIntersecting) setMiniDismissed(false);
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [video]);

  const handleExpandMini = useCallback(() => {
    sentinelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setMainInView(true);
  }, []);

  const handleCloseMini = useCallback(() => {
    setMiniDismissed(true);
    sendCommand('pause');
    setPlayerGuessPlaying(false);
  }, [sendCommand]);

  const handleMiniTogglePlay = useCallback(() => {
    const next = !playerGuessPlaying;
    sendCommand(next ? 'play' : 'pause');
    setPlayerGuessPlaying(next);
  }, [playerGuessPlaying, sendCommand]);

  useEffect(() => {
    const handleMessage = (e) => {
      let data = e.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { return; }
      }
      if (!data || typeof data !== 'object') return;
      const evt = String(data.event || data.type || '').toLowerCase();
      if (evt === 'ended' || evt === 'finish' || evt === 'complete') {
        setShowEndScreen(true);
        setPlayerGuessPlaying(false);
      } else if (evt === 'play' || evt === 'playing') {
        setPlayerGuessPlaying(true);
      } else if (evt === 'pause') {
        setPlayerGuessPlaying(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (!showEndScreen) {
      setCountdownSeconds(5);
      return;
    }
    const hideTimer = setTimeout(() => setShowEndScreen(false), 10000);
    let interval;
    if (autoplayEnabled && safeRelated[0]) {
      setCountdownSeconds(5);
      interval = setInterval(() => {
        setCountdownSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            router.push(`/videos/${safeRelated[0].id}`);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      clearTimeout(hideTimer);
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEndScreen, autoplayEnabled]);

  const handleReplay = useCallback(() => {
    setShowEndScreen(false);
    sendCommand('seekTo', [0]);
    sendCommand('play');
    setPlayerGuessPlaying(true);
  }, [sendCommand]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target)) setShowSettingsMenu(false);
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target)) setShowActionsMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleGlobalKey = (e) => {
      const tag = document.activeElement?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA';
      if (e.key === 'Escape') {
        if (showSearch) setShowSearch(false);
        return;
      }
      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        setShowSearch(true);
        return;
      }
      if (isTyping || showSearch || shareModal || reportModal || showPlaylistModal || showShortcutsModal) return;
      switch (e.key) {
        case ' ':
        case 'k':
        case 'K': {
          e.preventDefault();
          const next = !playerGuessPlaying;
          sendCommand(next ? 'play' : 'pause');
          setPlayerGuessPlaying(next);
          break;
        }
        case 'f':
        case 'F':
          iframeRef.current?.requestFullscreen?.().catch(() => {});
          break;
        case 't':
        case 'T':
          setIsTheaterMode((prev) => !prev);
          break;
        case 'm':
        case 'M':
          sendCommand('mute');
          break;
        case 'j':
        case 'J':
          sendCommand('seek', [-10]);
          break;
        case 'l':
        case 'L':
          sendCommand('seek', [10]);
          break;
        case 'ArrowLeft':
          sendCommand('seek', [-5]);
          break;
        case 'ArrowRight':
          sendCommand('seek', [5]);
          break;
        case 'ArrowUp':
          e.preventDefault();
          sendCommand('volume', [0.1]);
          break;
        case 'ArrowDown':
          e.preventDefault();
          sendCommand('volume', [-0.1]);
          break;
        case 'c':
        case 'C':
          sendCommand('toggleCaptions');
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [showSearch, shareModal, reportModal, showPlaylistModal, showShortcutsModal, playerGuessPlaying, sendCommand]);

  const openPlaylistModal = useCallback(() => {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    setShowPlaylistModal(true);
    setPlaylistsLoading(true);
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/playlists`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data.playlists) ? data.playlists : [];
          setPlaylists(list);
          const map = {};
          list.forEach((p) => {
            map[p.id] = Array.isArray(p.video_ids) ? p.video_ids.includes(id) : !!p.contains_video;
          });
          setVideoInPlaylists(map);
        }
      } catch { /* ignore */ } finally {
        setPlaylistsLoading(false);
      }
    })();
  }, [user, id]);

  const togglePlaylistVideo = useCallback(async (playlist) => {
    const already = !!videoInPlaylists[playlist.id];
    setVideoInPlaylists((prev) => ({ ...prev, [playlist.id]: !already }));
    try {
      const token = await getCsrfToken();
      if (!already) {
        await fetch(`${API_BASE}/playlists/${playlist.id}/videos`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
          body: JSON.stringify({ videoId: id }),
        });
      } else {
        await fetch(`${API_BASE}/playlists/${playlist.id}/videos/${id}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'X-CSRF-Token': token },
        });
      }
    } catch {
      setVideoInPlaylists((prev) => ({ ...prev, [playlist.id]: already }));
    }
  }, [videoInPlaylists, id]);

  const handleCreatePlaylist = useCallback(async (e) => {
    e.preventDefault();
    const name = newPlaylistName.trim();
    if (!name) return;
    setNewPlaylistName('');
    try {
      const token = await getCsrfToken();
      const res = await fetch(`${API_BASE}/playlists`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json();
        const created = data.playlist || data;
        if (created && created.id) setPlaylists((prev) => [...prev, created]);
      }
    } catch { /* ignore */ }
  }, [newPlaylistName]);

  const handleSelectQuality = useCallback((q) => {
    setSelectedQuality(q);
    setShowSettingsMenu(false);
  }, []);

  const handleSelectSpeed = useCallback((s) => {
    setSelectedSpeed(s);
    sendCommand('setPlaybackRate', [s]);
    setShowSettingsMenu(false);
  }, [sendCommand]);

  const handleLike = async () => {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikesCount((prev) => (nextLiked ? prev + 1 : Math.max(prev - 1, 0)));
    if (nextLiked && disliked) setDisliked(false);
    try {
      const token = await getCsrfToken();
      const res = await fetch(`${API_BASE}/videos/${video.id}/like`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify({ liked: nextLiked }),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.likesCount === 'number') setLikesCount(data.likesCount);
      }
    } catch {
      setLiked(!nextLiked);
      setLikesCount((prev) => (nextLiked ? Math.max(prev - 1, 0) : prev + 1));
    }
  };

  const handleDislike = async () => {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    const nextDisliked = !disliked;
    setDisliked(nextDisliked);
    if (nextDisliked && liked) {
      setLiked(false);
      setLikesCount((prev) => Math.max(prev - 1, 0));
    }
    try {
      const token = await getCsrfToken();
      await fetch(`${API_BASE}/videos/${video.id}/dislike`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify({ disliked: nextDisliked }),
      });
    } catch {
      setDisliked(!nextDisliked);
    }
  };

  const handleFollow = async () => {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    const nextFollowing = !isFollowing;
    setIsFollowing(nextFollowing);
    setSubscriberCount((prev) => (nextFollowing ? prev + 1 : Math.max(prev - 1, 0)));
    try {
      const token = await getCsrfToken();
      const res = await fetch(`${API_BASE}/channels/${video.user_id}/subscribe`, {
        method: nextFollowing ? 'POST' : 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.subscriberCount === 'number') setSubscriberCount(data.subscriberCount);
      }
    } catch {
      setIsFollowing(!nextFollowing);
      setSubscriberCount((prev) => (nextFollowing ? Math.max(prev - 1, 0) : prev + 1));
    }
  };

  const handleToggleWatchLater = async () => {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    const nextVal = !inWatchLater;
    setInWatchLater(nextVal);
    try {
      const token = await getCsrfToken();
      await fetch(`${API_BASE}/watch-later/${video.id}`, {
        method: nextVal ? 'POST' : 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      });
    } catch {
      setInWatchLater(!nextVal);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReport = (e) => {
    e.preventDefault();
    setReported(true);
    setTimeout(() => {
      setReportModal(false);
      setReported(false);
      setReportReason('');
    }, 2000);
  };

  if (loading) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-signal" />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="bg-paper min-h-screen py-24 text-center px-5">
        <Film size={48} className="mx-auto text-ink-300 mb-4" />
        <h1 className="text-2xl font-black text-ink uppercase mb-2">Video Unavailable</h1>
        <p className="text-xs text-ink-500 mb-6">This video may have been removed or is no longer public.</p>
        <Link href="/videos" className="bg-ink text-white font-bold uppercase text-xs px-6 py-3 rounded-sm">
          Back to Videos
        </Link>
      </div>
    );
  }

  const videoUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="bg-paper min-h-screen pb-24">
      {/* Video Search Overlay */}
      {showSearch && (
        <div className="fixed inset-0 bg-ink/95 backdrop-blur-sm z-50 overflow-y-auto" onClick={() => setShowSearch(false)}>
          <div className="max-w-3xl mx-auto px-5 pt-8 pb-16" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b-2 border-white/20 pb-4 mb-6">
              <Search size={20} className="text-white/60 shrink-0" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const first = searchResults[0];
                    if (first) {
                      saveRecentSearch(searchQuery);
                      navigateToResult(first);
                    }
                  }
                }}
                placeholder="Search videos..."
                className="flex-1 bg-transparent text-white text-lg font-medium outline-none placeholder:text-white/40"
              />
              <button onClick={() => setShowSearch(false)} className="text-white/60 hover:text-white transition-colors duration-300" aria-label="Close search">
                <X size={22} />
              </button>
            </div>

            {searchQuery.trim().length < 2 ? (
              recentSearches.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-white/40 text-xs font-bold uppercase tracking-widest mb-3">Recent searches</h4>
                  {recentSearches.map((s, i) => (
                    <button key={i} onClick={() => setSearchQuery(s)} className="block w-full text-left text-white/80 text-sm py-2 px-3 rounded-sm hover:bg-white/10 transition-colors duration-300">
                      {s}
                    </button>
                  ))}
                </div>
              )
            ) : searchLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={28} className="animate-spin text-white/60" />
              </div>
            ) : searchResults.length === 0 ? (
              <p className="text-white/50 text-sm text-center py-16">No videos found for &ldquo;{searchQuery}&rdquo;</p>
            ) : (
              <div className="space-y-3">
                {searchResults.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => { saveRecentSearch(searchQuery); navigateToResult(v); }}
                    className="flex items-center gap-3 w-full text-left hover:bg-white/10 p-2 rounded-sm transition-colors duration-300"
                  >
                    <img src={v.thumbnail_url || ''} alt="" className="w-28 h-16 object-cover rounded-sm bg-white/10 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-white text-sm font-semibold line-clamp-1">{v.title}</p>
                      <p className="text-white/50 text-xs mt-0.5">{v.user_name} • {v.views || 0} views</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModal && (
        <div className="fixed inset-0 bg-ink/80 backdrop-blur-sm z-50 grid place-items-center px-4">
          <div className="bg-white border-2 border-ink p-6 max-w-md w-full rounded-sm space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-ink uppercase">Share Video</h3>
            <div className="flex gap-2">
              <input type="text" readOnly value={videoUrl} className="flex-1 bg-ink-50 border border-wire px-3 py-2 text-xs font-mono rounded-sm" />
              <button onClick={handleCopyLink} className="bg-ink text-white font-bold uppercase text-xs px-4 py-2 rounded-sm hover:bg-signal transition-colors flex items-center gap-1">
                {copied ? <Check size={14} /> : null} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex gap-2 pt-2">
              <a href={`https://wa.me/?text=${encodeURIComponent(videoUrl)}`} target="_blank" rel="noreferrer" className="flex-1 bg-emerald-600 text-white font-bold uppercase text-xs py-2.5 rounded-sm text-center">WhatsApp</a>
              <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(videoUrl)}&text=${encodeURIComponent(video.title)}`} target="_blank" rel="noreferrer" className="flex-1 bg-sky-500 text-white font-bold uppercase text-xs py-2.5 rounded-sm text-center">Twitter</a>
            </div>
            <button onClick={() => setShareModal(false)} className="w-full border border-wire text-ink font-bold uppercase text-xs py-2 rounded-sm mt-2">Close</button>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportModal && (
        <div className="fixed inset-0 bg-ink/80 backdrop-blur-sm z-50 grid place-items-center px-4">
          <div className="bg-white border-2 border-ink p-6 max-w-md w-full rounded-sm space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-ink uppercase flex items-center gap-2"><AlertTriangle size={18} className="text-signal" /> Report Video</h3>
            {reported ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-sm text-center">Report submitted successfully.</div>
            ) : (
              <form onSubmit={handleReport} className="space-y-4">
                <textarea required value={reportReason} onChange={(e) => setReportReason(e.target.value)} placeholder="Please describe why you are reporting this video..." rows={4} className="w-full border border-wire p-3 text-xs rounded-sm focus:outline-none focus:border-ink" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setReportModal(false)} className="flex-1 border border-wire text-ink font-bold uppercase text-xs py-2.5 rounded-sm">Cancel</button>
                  <button type="submit" className="flex-1 bg-signal text-white font-bold uppercase text-xs py-2.5 rounded-sm">Submit Report</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Save to Playlist Modal */}
      {showPlaylistModal && (
        <div className="fixed inset-0 bg-ink/80 backdrop-blur-sm z-50 grid place-items-center px-4" onClick={() => setShowPlaylistModal(false)}>
          <div className="bg-white border-2 border-ink p-6 max-w-md w-full rounded-sm space-y-4 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-ink uppercase flex items-center gap-2"><ListPlus size={18} className="text-signal" /> Save to Playlist</h3>
              <button onClick={() => setShowPlaylistModal(false)} className="text-ink-400 hover:text-ink transition-colors duration-300" aria-label="Close"><X size={20} /></button>
            </div>
            {playlistsLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 size={24} className="animate-spin text-signal" /></div>
            ) : playlists.length === 0 ? (
              <p className="text-xs text-ink-400 font-medium italic text-center py-4">Create your first playlist to save this video.</p>
            ) : (
              <div className="space-y-2">
                {playlists.map((p) => (
                  <label key={p.id} className="flex items-center justify-between gap-3 border border-wire rounded-sm px-3 py-2.5 cursor-pointer hover:border-ink transition-colors duration-300">
                    <div className="flex items-center gap-2 min-w-0">
                      {p.is_private ? <Lock size={13} className="text-ink-400 shrink-0" /> : <Globe size={13} className="text-ink-400 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-ink truncate">{p.name}</p>
                        <p className="text-[10px] text-ink-400">{p.video_count || 0} video{p.video_count === 1 ? '' : 's'}</p>
                      </div>
                    </div>
                    <input type="checkbox" checked={!!videoInPlaylists[p.id]} onChange={() => togglePlaylistVideo(p)} className="w-4 h-4 accent-signal shrink-0" />
                  </label>
                ))}
              </div>
            )}
            <form onSubmit={handleCreatePlaylist} className="flex gap-2 pt-2 border-t border-wire">
              <input value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)} placeholder="New playlist name..." className="flex-1 border border-wire px-3 py-2 text-xs rounded-sm focus:outline-none focus:border-ink" />
              <button type="submit" disabled={!newPlaylistName.trim()} className="bg-ink text-white font-bold uppercase text-xs px-4 py-2 rounded-sm disabled:opacity-40 flex items-center gap-1 shrink-0"><Plus size={13} /> Create</button>
            </form>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 bg-ink/80 backdrop-blur-sm z-50 grid place-items-center px-4" onClick={() => setShowShortcutsModal(false)}>
          <div className="bg-white border-2 border-ink p-6 max-w-md w-full rounded-sm space-y-4 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-ink uppercase">Keyboard Shortcuts</h3>
              <button onClick={() => setShowShortcutsModal(false)} className="text-ink-400 hover:text-ink transition-colors duration-300" aria-label="Close"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
              {[
                ['Space / K', 'Play / Pause'], ['F', 'Fullscreen'], ['T', 'Theater mode'], ['M', 'Mute / Unmute'],
                ['J', 'Back 10 seconds'], ['L', 'Forward 10 seconds'], ['← / →', 'Seek 5 seconds'], ['↑ / ↓', 'Volume up / down'],
                ['C', 'Toggle captions'], ['/', 'Focus search'], ['Esc', 'Close search'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between border-b border-wire/60 pb-1.5">
                  <span className="text-ink-500 font-medium">{desc}</span>
                  <kbd className="bg-ink-50 border border-wire text-ink font-bold text-[10px] px-2 py-1 rounded-sm">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Video Player */}
      <div className={isMiniPlayer ? 'w-full h-0 overflow-hidden' : 'w-full bg-black'}>
        <div ref={sentinelRef} />
        <div className={isMiniPlayer ? 'fixed bottom-4 right-4 w-[320px] h-[180px] z-40 rounded-lg overflow-hidden shadow-2xl transition-all duration-300 bg-black' : isTheaterMode ? 'max-w-full mx-auto aspect-video relative max-h-[85vh] transition-all duration-300' : 'max-w-7xl mx-auto aspect-video relative max-h-[75vh] transition-all duration-300'}>
          <iframe
            ref={iframeRef}
            src={`https://iframe.mediadelivery.net/embed/${video.bunny_library_id}/${video.bunny_video_id}`}
            loading="lazy"
            style={{ border: 'none', position: 'absolute', top: 0, left: 0, height: '100%', width: '100%' }}
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
            allowFullScreen={true}
            title={video.title}
          />
          {!isMiniPlayer && (
            <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
              <div ref={settingsMenuRef} className="relative">
                <button onClick={() => setShowSettingsMenu((v) => !v)} className="w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors duration-300" aria-label="Player settings"><Settings size={16} /></button>
                {showSettingsMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-ink border border-white/10 rounded-sm shadow-2xl p-3 space-y-3 text-white">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Quality</p>
                      <div className="space-y-0.5">
                        {QUALITY_OPTIONS.map((q) => (
                          <button key={q} onClick={() => handleSelectQuality(q)} className={`flex items-center justify-between w-full text-xs px-2 py-1.5 rounded-sm hover:bg-white/10 transition-colors duration-300 ${selectedQuality === q ? 'text-signal font-bold' : 'text-white/80'}`}>{q} {selectedQuality === q && <Check size={12} />}</button>
                        ))}
                      </div>
                      <p className="text-[10px] text-white/30 mt-1">Bunny Stream auto-selects the best quality for your connection.</p>
                    </div>
                    <div className="border-t border-white/10 pt-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1.5">Playback speed</p>
                      <div className="grid grid-cols-4 gap-1">
                        {SPEED_OPTIONS.map((s) => (
                          <button key={s} onClick={() => handleSelectSpeed(s)} className={`text-[10px] font-bold px-1.5 py-1 rounded-sm transition-colors duration-300 ${selectedSpeed === s ? 'bg-signal text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>{s === 1 ? 'Normal' : `${s}x`}</button>
                        ))}
                      </div>
                      <p className="text-[10px] text-white/30 mt-1.5">Speed changes apply where supported by the current stream.</p>
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => setIsTheaterMode((v) => !v)} className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-300 ${isTheaterMode ? 'bg-signal text-white' : 'bg-black/60 hover:bg-black/80 text-white'}`} aria-label="Toggle theater mode" title="Theater mode (T)"><Monitor size={16} /></button>
            </div>
          )}
          {isMiniPlayer && (
            <div className="absolute inset-0 flex items-end justify-between p-1.5 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none">
              <div className="flex gap-1 pointer-events-auto">
                <button onClick={handleMiniTogglePlay} className="w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black/90 transition-colors duration-300" aria-label={playerGuessPlaying ? 'Pause' : 'Play'}>{playerGuessPlaying ? <Pause size={14} /> : <Play size={14} />}</button>
                <button onClick={handleExpandMini} className="w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black/90 transition-colors duration-300" aria-label="Expand player"><Maximize2 size={13} /></button>
              </div>
              <button onClick={handleCloseMini} className="w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black/90 transition-colors duration-300 pointer-events-auto" aria-label="Close mini player"><X size={14} /></button>
            </div>
          )}
          {showEndScreen && !isMiniPlayer && (
            <div className="absolute inset-0 bg-black/90 z-20 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/10 text-white font-black grid place-content-center uppercase text-lg shrink-0">{video.user_name?.charAt(0) || 'C'}</div>
                <div className="text-left">
                  <p className="text-white font-bold text-sm">{video.user_name}</p>
                  {user?.id !== video.user_id && (
                    <button onClick={handleFollow} className={`mt-1 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm transition-colors duration-300 ${isFollowing ? 'border border-white/30 text-white' : 'bg-signal text-white'}`}>{isFollowing ? 'Following' : 'Subscribe'}</button>
                  )}
                </div>
              </div>
              {safeRelated.length > 0 && (
                <div className="grid grid-cols-2 gap-3 max-w-md w-full">
                  {safeRelated.slice(0, 2).map((rv, i) => (
                    <button key={rv.id} onClick={() => router.push(`/video/${rv.id}`)} className="text-left group">
                      {i === 0 && <span className="text-signal text-[10px] font-bold uppercase tracking-widest block mb-1">Up next {autoplayEnabled ? `· ${countdownSeconds}s` : ''}</span>}
                      <img src={rv.thumbnail_url || ''} alt="" className="w-full aspect-video object-cover rounded-sm group-hover:opacity-80 transition-opacity duration-300" />
                      <p className="text-white text-xs font-semibold line-clamp-2 mt-1">{rv.title}</p>
                    </button>
                  ))}
                </div>
              )}
              <button onClick={handleReplay} className="flex items-center gap-1.5 border border-white/30 text-white text-xs font-bold uppercase px-4 py-2 rounded-sm hover:bg-white/10 transition-colors duration-300"><RotateCcw size={14} /> Replay</button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-5 pt-8 grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-3 border-b border-wire pb-6">
            <div className="flex items-center gap-2">
              <span className="bg-ink text-white font-bold text-[10px] uppercase px-2.5 py-1 rounded-sm tracking-widest">{video.category}</span>
              <span className="text-xs text-ink-400 font-medium">• {new Date(video.created_at).toLocaleDateString()}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-ink tracking-tight">{video.title}</h1>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-3">
                <Link href={`/profile/${video.user_id}`} className="w-10 h-10 rounded-full bg-ink text-white font-black grid place-content-center uppercase text-sm shrink-0 overflow-hidden border border-wire">{video.user_name?.charAt(0) || 'C'}</Link>
                <div>
                  <Link href={`/profile/${video.user_id}`} className="font-bold text-ink text-sm hover:text-signal transition-colors block">{video.user_name}</Link>
                  <span className="text-[11px] text-ink-400 font-medium">{subscriberCount} subscriber{subscriberCount === 1 ? '' : 's'}</span>
                </div>
                {user?.id !== video.user_id && (
                  <button onClick={handleFollow} className={`ml-4 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-sm transition-colors flex items-center gap-1.5 ${isFollowing ? 'border border-wire bg-white text-ink' : 'bg-ink text-white hover:bg-signal'}`}>{isFollowing ? <UserMinus size={13} /> : <UserPlus size={13} />}{isFollowing ? 'Following' : 'Follow'}</button>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center border border-wire bg-white rounded-sm overflow-hidden">
                  <button onClick={handleLike} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 hover:bg-ink-50 transition-colors ${liked ? 'text-signal' : 'text-ink'}`}><Heart size={14} fill={liked ? 'currentColor' : 'none'} /> {likesCount}</button>
                  <div className="w-px h-5 bg-wire" />
                  <button onClick={handleDislike} className={`px-3 py-2 text-xs font-bold flex items-center gap-1.5 hover:bg-ink-50 transition-colors ${disliked ? 'text-signal' : 'text-ink'}`}><ThumbsDown size={14} fill={disliked ? 'currentColor' : 'none'} /></button>
                </div>
                <button onClick={handleToggleWatchLater} className={`border border-wire bg-white px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 hover:border-ink transition-colors ${inWatchLater ? 'text-signal border-signal/40 bg-signal/5' : 'text-ink'}`}>{inWatchLater ? <BookmarkCheck size={14} /> : <Bookmark size={14} />} {inWatchLater ? 'Saved' : 'Watch Later'}</button>
                <button onClick={() => setShareModal(true)} className="border border-wire bg-white px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 hover:border-ink transition-colors text-ink"><Share2 size={14} /> Share</button>
                <button onClick={openPlaylistModal} className="border border-wire bg-white px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 hover:border-ink transition-colors text-ink"><ListPlus size={14} /> Save</button>
                <button onClick={() => setShowSearch(true)} className="border border-wire bg-white p-2 rounded-sm text-ink-500 hover:text-ink transition-colors" title="Search (/)"><Search size={16} /></button>
                <button onClick={() => setShowShortcutsModal(true)} className="border border-wire bg-white p-2 rounded-sm text-ink-500 hover:text-ink transition-colors" title="Keyboard shortcuts"><HelpCircle size={16} /></button>
                <div ref={actionsMenuRef} className="relative">
                  <button onClick={() => setShowActionsMenu((v) => !v)} className="border border-wire bg-white p-2 rounded-sm text-ink-500 hover:text-ink transition-colors" title="More actions"><MoreVertical size={16} /></button>
                  {showActionsMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-wire rounded-sm shadow-2xl z-30 py-1">
                      <button onClick={() => { setShowActionsMenu(false); openPlaylistModal(); }} className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs font-bold text-ink hover:bg-ink-50 transition-colors duration-300"><ListPlus size={14} /> Save to playlist</button>
                      {video.download_url && <a href={video.download_url} download className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs font-bold text-ink hover:bg-ink-50 transition-colors duration-300"><Download size={14} /> Download</a>}
                      <button onClick={() => { setShowActionsMenu(false); setReportModal(true); }} className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs font-bold text-ink hover:bg-ink-50 transition-colors duration-300"><AlertTriangle size={14} /> Report</button>
                      <button disabled title="Coming soon" className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs font-bold text-ink-300 cursor-not-allowed"><Film size={14} /> Clip</button>
                    </div>
                  )}
                </div>
                <button onClick={() => setReportModal(true)} className="border border-wire bg-white p-2 rounded-sm text-ink-500 hover:text-signal transition-colors" title="Report video"><AlertTriangle size={16} /></button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-wire rounded-sm p-5 space-y-3 shadow-sm">
            <div className="flex items-center gap-4 text-xs font-bold text-ink-500">
              <span className="flex items-center gap-1"><Eye size={14} /> {video.views} views</span>
            </div>
            <div className={`text-sm text-ink-700 leading-relaxed font-medium whitespace-pre-wrap ${isExpandedDesc ? '' : 'line-clamp-3'}`}>
              {video.description || 'No description provided for this video broadcast.'}
            </div>
            {video.description && video.description.length > 150 && (
              <button onClick={() => setIsExpandedDesc(!isExpandedDesc)} className="text-xs font-bold text-ink uppercase tracking-wider hover:text-signal transition-colors pt-1 block">{isExpandedDesc ? 'Show less' : 'Show more'}</button>
            )}
          </div>

          <div className="pt-6 space-y-4">
            <h3 className="text-lg font-black text-ink uppercase tracking-tight flex items-center gap-2"><MessageSquare size={18} className="text-signal" /> Discussion & Comments</h3>
            <div className="bg-white border border-wire rounded-sm p-6 shadow-sm">
              <CommentThread storyId={video.id} comments={[]} storyAuthorId={video.user_id} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-wire pb-3">
            <h3 className="text-sm font-bold text-ink uppercase tracking-widest">Related Broadcasts</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">Autoplay</span>
              <button type="button" onClick={() => setAutoplayEnabled((v) => !v)} className={`w-9 h-5 rounded-full transition-colors duration-300 relative ${autoplayEnabled ? 'bg-signal' : 'bg-wire'}`} aria-pressed={autoplayEnabled}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-300 ${autoplayEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </label>
          </div>
          {safeRelated.length === 0 ? (
            <p className="text-xs text-ink-400 font-medium italic">No related videos available.</p>
          ) : (
            <div className="space-y-4">
              {safeRelated.map((rv, idx) => (
                <div key={rv.id}>
                  {idx === 0 && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-black text-signal uppercase tracking-widest flex items-center gap-1"><SkipForward size={11} /> Up next</span>
                      {showEndScreen && autoplayEnabled && <span className="text-[10px] font-bold text-ink-400">Playing in {countdownSeconds}s</span>}
                    </div>
                  )}
                  <VideoCard video={rv} showPublisher={true} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}