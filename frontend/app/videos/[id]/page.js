'use client';

import { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import {
  Eye, Heart, ThumbsDown, Share2, AlertTriangle, Check, UserPlus, UserMinus,
  MessageSquare, Film, Loader2, Bookmark, BookmarkCheck,
} from 'lucide-react';
import { useAuth } from '../../../lib/auth';
import CommentThread from '../../../components/CommentThread';
import VideoCard from '../../../components/VideoCard';

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

export default function WatchVideoPage({ params }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const { user } = useAuth();

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

  const watchSecondsRef = useRef(0);
  const watchIntervalRef = useRef(null);

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

  // Load like/subscribe/watch-later state (best-effort, non-blocking)
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

  // Record watch history periodically and on unmount
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
      // revert on network failure
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

  const safeRelated = Array.isArray(relatedVideos) ? relatedVideos : [];
  const videoUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="bg-paper min-h-screen pb-24">
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
              <a href={`https://wa.me/?text=${encodeURIComponent(videoUrl)}`} target="_blank" rel="noreferrer" className="flex-1 bg-emerald-600 text-white font-bold uppercase text-xs py-2.5 rounded-sm text-center">
                WhatsApp
              </a>
              <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(videoUrl)}&text=${encodeURIComponent(video.title)}`} target="_blank" rel="noreferrer" className="flex-1 bg-sky-500 text-white font-bold uppercase text-xs py-2.5 rounded-sm text-center">
                Twitter
              </a>
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

      {/* Video Player */}
      <div className="w-full bg-black">
        <div className="max-w-7xl mx-auto aspect-video relative max-h-[75vh]">
          <iframe
            src={`https://iframe.mediadelivery.net/embed/${video.bunny_library_id}/${video.bunny_video_id}?autoplay=false&preload=true`}
            loading="lazy"
            style={{ border: 'none', position: 'absolute', top: 0, left: 0, height: '100%', width: '100%' }}
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
            allowFullScreen={true}
            title={video.title}
          />
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
                <Link href={`/profile/${video.user_id}`} className="w-10 h-10 rounded-full bg-ink text-white font-black grid place-content-center uppercase text-sm shrink-0 overflow-hidden border border-wire">
                  {video.user_name?.charAt(0) || 'C'}
                </Link>
                <div>
                  <Link href={`/profile/${video.user_id}`} className="font-bold text-ink text-sm hover:text-signal transition-colors block">{video.user_name}</Link>
                  <span className="text-[11px] text-ink-400 font-medium">
                    {subscriberCount} subscriber{subscriberCount === 1 ? '' : 's'}
                  </span>
                </div>
                {user?.id !== video.user_id && (
                  <button onClick={handleFollow} className={`ml-4 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-sm transition-colors flex items-center gap-1.5 ${isFollowing ? 'border border-wire bg-white text-ink' : 'bg-ink text-white hover:bg-signal'}`}>
                    {isFollowing ? <UserMinus size={13} /> : <UserPlus size={13} />}
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center border border-wire bg-white rounded-sm overflow-hidden">
                  <button onClick={handleLike} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 hover:bg-ink-50 transition-colors ${liked ? 'text-signal' : 'text-ink'}`}>
                    <Heart size={14} fill={liked ? 'currentColor' : 'none'} /> {likesCount}
                  </button>
                  <div className="w-px h-5 bg-wire" />
                  <button onClick={handleDislike} className={`px-3 py-2 text-xs font-bold flex items-center gap-1.5 hover:bg-ink-50 transition-colors ${disliked ? 'text-signal' : 'text-ink'}`}>
                    <ThumbsDown size={14} fill={disliked ? 'currentColor' : 'none'} />
                  </button>
                </div>
                <button onClick={handleToggleWatchLater} className={`border border-wire bg-white px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 hover:border-ink transition-colors ${inWatchLater ? 'text-signal border-signal/40 bg-signal/5' : 'text-ink'}`}>
                  {inWatchLater ? <BookmarkCheck size={14} /> : <Bookmark size={14} />} {inWatchLater ? 'Saved' : 'Watch Later'}
                </button>
                <button onClick={() => setShareModal(true)} className="border border-wire bg-white px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 hover:border-ink transition-colors text-ink">
                  <Share2 size={14} /> Share
                </button>
                <button onClick={() => setReportModal(true)} className="border border-wire bg-white p-2 rounded-sm text-ink-500 hover:text-signal transition-colors" title="Report video">
                  <AlertTriangle size={16} />
                </button>
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
              <button onClick={() => setIsExpandedDesc(!isExpandedDesc)} className="text-xs font-bold text-ink uppercase tracking-wider hover:text-signal transition-colors pt-1 block">
                {isExpandedDesc ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>

          <div className="pt-6 space-y-4">
            <h3 className="text-lg font-black text-ink uppercase tracking-tight flex items-center gap-2">
              <MessageSquare size={18} className="text-signal" /> Discussion & Comments
            </h3>
            <div className="bg-white border border-wire rounded-sm p-6 shadow-sm">
              <CommentThread storyId={video.id} comments={[]} storyAuthorId={video.user_id} />
            </div>
          </div>
        </div>

        {/* Related Videos */}
        <div className="space-y-6">
          <h3 className="text-sm font-bold text-ink uppercase tracking-widest border-b border-wire pb-3">Related Broadcasts</h3>
          {safeRelated.length === 0 ? (
            <p className="text-xs text-ink-400 font-medium italic">No related videos available.</p>
          ) : (
            <div className="space-y-4">
              {safeRelated.map((rv) => (
                <VideoCard key={rv.id} video={rv} showPublisher={true} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
