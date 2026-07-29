'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  Camera, Check, UserPlus, UserMinus, Key, Copy, Trash2, Plus, Terminal, Zap, BarChart3,
  Newspaper, QrCode, X, Download, LayoutDashboard, ChevronDown, ChevronUp, CreditCard,
  MessageSquare, Activity, Film, Radio, Play, Lock, ShieldCheck, Loader2, GraduationCap,
  Briefcase, Globe, Mail, User, Share2, Star, Pin, PinOff, Crown, DollarSign, LayoutGrid,
  CalendarDays, Twitter, Linkedin, Users as UsersIcon, Award, ThumbsUp, Megaphone,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useStore } from '../../../lib/store';
import { useAuth } from '../../../lib/auth';
import StoryCard from '../../../components/StoryCard';
import VideoCard from '../../../components/VideoCard';
import ApiGuideModal from '../../../components/ApiGuideModal';
import SmsDashboard from '../../../components/SmsDashboard';
import { openCloudinaryWidget } from '../../../lib/mediaUpload';
import StoryTimeline from '../../../components/StoryTimeline';
import WalletDashboard from '../../../components/WalletDashboard';
import MastheadNewsletter from '../../../components/MastheadNewsletter';
import PublisherMediaKit from '../../../components/PublisherMediaKit';
import ReaderInsights from '../../../components/ReaderInsights';
import PublisherBadges from '../../../components/PublisherBadges';
import ContentCalendar from '../../../components/ContentCalendar';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
let csrfToken = null;

async function fetchCsrfToken() {
  if (csrfToken) return csrfToken;
  try {
    const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
    const data = await res.json();
    csrfToken = data.token;
    return csrfToken;
  } catch (e) { return ''; }
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (options.method && options.method !== 'GET') {
    const token = await fetchCsrfToken();
    if (token) headers['X-CSRF-Token'] = token;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers,
    ...options,
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'API request failed');
  }
  return res.json();
}

const SectionHeader = ({ title, icon: Icon, rightAction, description }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-wire pb-4 mb-6">
    <div>
      <h2 className="text-lg font-black text-ink uppercase tracking-tight flex items-center gap-2">
        {Icon && <Icon size={18} className="text-signal" />}
        {title}
      </h2>
      {description && <p className="text-xs font-medium text-ink-500 mt-1">{description}</p>}
    </div>
    {rightAction && <div className="mt-3 sm:mt-0">{rightAction}</div>}
  </div>
);

// ── helpers for new features ──────────────────────────────────────────────

function estimateWordsAndReadTime(storiesList) {
  let totalWords = 0;
  for (const s of storiesList) {
    const body = s.body || s.content || '';
    if (body) {
      totalWords += String(body).trim().split(/\s+/).filter(Boolean).length;
    } else if (typeof s.wordCount === 'number') {
      totalWords += s.wordCount;
    }
  }
  const avgReadMin = storiesList.length > 0 ? Math.max(1, Math.round((totalWords / storiesList.length) / 200)) : 0;
  return { totalWords, avgReadMin };
}

function formatCompactNumber(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

const TIER_BADGE_STYLES = {
  pro_partner: 'bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 text-amber-900 border-amber-400',
  partner: 'bg-gradient-to-r from-slate-200 via-slate-100 to-slate-300 text-slate-700 border-slate-300',
};

export default function ProfilePage() {
  const { id } = useParams();
  const { users, stories, upsertUser, toggleFollow, follows } = useStore();
  const { user, updateProfile } = useAuth();
  const profile = users.find((u) => u.id === id);
  const isOwner = user?.id === id;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(profile || {});
  const [profileTab, setProfileTab] = useState('stories');
  const [publisherRooms, setPublisherRooms] = useState([]);
  const [publisherCampuses, setPublisherCampuses] = useState([]);
  const [publisherJobs, setPublisherJobs] = useState([]);
  const [publisherVideos, setPublisherVideos] = useState([]);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomTitle, setRoomTitle] = useState('');
  const [roomDesc, setRoomDesc] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [roomModalError, setRoomModalError] = useState('');
  const [apiKeys, setApiKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState(null);
  const [showKeys, setShowKeys] = useState(false);
  const [showApiGuide, setShowApiGuide] = useState(false);
  const [qrStory, setQrStory] = useState(null);
  const qrRef = useRef();
  const [apiUsage, setApiUsage] = useState(null);
  const [upgrading, setUpgrading] = useState(false);

  // ── NEW FEATURE STATE ────────────────────────────────────────────────
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [pinnedStory, setPinnedStory] = useState(null);
  const [pinningId, setPinningId] = useState(null);
  const [badges, setBadges] = useState([]);
  const [endorsements, setEndorsements] = useState([]);
  const [endorseTopic, setEndorseTopic] = useState('');
  const [isEndorsing, setIsEndorsing] = useState(false);
  const [endorseError, setEndorseError] = useState('');
  const [partnerData, setPartnerData] = useState(null);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [calendarView, setCalendarView] = useState(false); // false = grid, true = calendar
  const [exporting, setExporting] = useState(false);

  const isAdminUser = user?.role === 'admin' || user?.role === 'root';
  const isPro = isAdminUser || (apiUsage?.tier === 'pro' && apiUsage?.subscription_active);

  const publisherTier = profile?.tier;
  const isPartner = publisherTier === 'partner' || publisherTier === 'pro_partner';

  const fetchKeys = async () => {
    try {
      const data = await api('/keys');
      setApiKeys(data.keys || []);
    } catch (e) { console.error(e); }
  };

  const fetchApiUsage = async () => {
    try {
      const data = await api('/payments/api-usage');
      setApiUsage(data);
    } catch (e) { /* ignore */ }
  };

  const fetchPublisherRooms = async () => {
    try {
      const data = await api('/rooms');
      const rooms = data.rooms || [];
      setPublisherRooms(rooms.filter((r) => r.host_id === id));
    } catch (e) {}
  };

  const fetchPublisherCampuses = async () => {
    try {
      const data = await api('/campuses');
      const allCampuses = data.campuses || [];
      setPublisherCampuses(allCampuses.filter((c) => c.user_id === id || c.author_id === id));
    } catch (e) {}
  };

  const fetchPublisherJobs = async () => {
    try {
      const data = await api('/jobs');
      const allJobs = data.jobs || data || [];
      setPublisherJobs(allJobs.filter((j) => j.user_id === id || j.author_id === id));
    } catch (e) {}
  };

  const fetchPublisherVideos = async () => {
    try {
      const data = await api(`/videos?userId=${id}&limit=50`);
      setPublisherVideos(data.videos || []);
    } catch (e) {}
  };

  // ── NEW: fetchers for added features ──────────────────────────────────
  const fetchPinnedStory = async () => {
    try {
      const data = await api(`/users/${id}/pinned-story`);
      setPinnedStory(data.story || null);
    } catch (e) { /* self-healing: silently leave no pinned story */ }
  };

  const fetchBadges = async () => {
    try {
      const data = await api(`/users/${id}/badges`);
      setBadges(data.badges || []);
    } catch (e) { setBadges([]); }
  };

  const fetchEndorsements = async () => {
    try {
      const data = await api(`/users/${id}/endorsements`);
      setEndorsements(data.endorsements || []);
    } catch (e) { setEndorsements([]); }
  };

  const fetchPartnerDashboard = async () => {
    if (!isOwner || !isPartner) return;
    setPartnerLoading(true);
    try {
      const data = await api('/partner/dashboard');
      setPartnerData(data);
    } catch (e) {
      setPartnerData(null);
    } finally {
      setPartnerLoading(false);
    }
  };

  const generateKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      const data = await api('/keys', {
        method: 'POST',
        body: JSON.stringify({ name: newKeyName }),
      });
      setNewKey(data);
      setNewKeyName('');
      fetchKeys();
    } catch (e) { console.error(e); }
  };

  const revokeKey = async (keyId) => {
    if (!confirm('Are you sure? Any external app using this key will immediately stop working.')) return;
    try {
      await api(`/keys/${keyId}`, { method: 'DELETE' });
      fetchKeys();
    } catch (e) { console.error(e); }
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const token = await fetchCsrfToken();
      const res = await fetch(`${API_BASE}/payments/subscribe/pro`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token || '',
        },
      });
      const data = await res.json();
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } catch (e) {
      console.error(e);
      setUpgrading(false);
    }
  };

  const handleCreateFreeRoom = async (e) => {
    e.preventDefault();
    if (!roomTitle.trim()) {
      setRoomModalError('Please enter a room title.');
      return;
    }
    setIsCreatingRoom(true);
    setRoomModalError('');
    try {
      const data = await api('/rooms', {
        method: 'POST',
        body: JSON.stringify({
          title: roomTitle.trim(),
          description: roomDesc.trim(),
        })
      });
      if (data.ok && data.room) {
        window.location.href = `/rooms/${data.room.id}`;
      } else {
        setRoomModalError(data.error || 'Failed to create room.');
        setIsCreatingRoom(false);
      }
    } catch (err) {
      setRoomModalError(err.message || 'Error creating room.');
      setIsCreatingRoom(false);
    }
  };

  const handleDeleteRoom = async (roomId) => {
    if (!confirm('Are you sure you want to permanently delete this room?')) return;
    try {
      await api(`/rooms/${roomId}`, { method: 'DELETE' });
      setPublisherRooms((prev) => prev.filter((r) => r.id !== roomId));
    } catch (e) {
      alert(e.message || 'Failed to delete room.');
    }
  };

  const handleDeleteCampus = async (campusId) => {
    if (!confirm('Are you sure you want to delete this registered campus?')) return;
    try {
      await api(`/campuses/${campusId}`, { method: 'DELETE' });
      setPublisherCampuses((prev) => prev.filter((c) => c.id !== campusId));
    } catch (e) {
      alert(e.message || 'Failed to delete campus.');
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!confirm('Are you sure you want to delete this job posting?')) return;
    try {
      await api(`/jobs/${jobId}`, { method: 'DELETE' });
      setPublisherJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (e) {
      alert(e.message || 'Failed to delete job.');
    }
  };

  const downloadQRCode = () => {
    if (!qrRef.current || !qrStory) return;
    const svgElement = qrRef.current.querySelector('svg');
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = 300;
      canvas.height = 300;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, 300, 300);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `${qrStory.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-qr.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  // ── NEW: action handlers ──────────────────────────────────────────────
  const handlePinStory = async (storyId) => {
    setPinningId(storyId);
    try {
      await api('/users/me/pin-story', {
        method: 'POST',
        body: JSON.stringify({ story_id: storyId }),
      });
      await fetchPinnedStory();
    } catch (e) {
      alert(e.message || 'Failed to pin story.');
    } finally {
      setPinningId(null);
    }
  };

  const handleUnpinStory = async () => {
    setPinningId('unpin');
    try {
      await api('/users/me/pin-story', { method: 'DELETE' });
      setPinnedStory(null);
    } catch (e) {
      alert(e.message || 'Failed to unpin story.');
    } finally {
      setPinningId(null);
    }
  };

  const profileUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/profile/${id}`
    : `https://opinionplus.online/profile/${id}`;

  const handleCopyProfileLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (e) { /* clipboard may be unavailable; fail silently */ }
  };

  const changeCoverImage = () => {
    openCloudinaryWidget({
      onSuccess: async (r) => {
        setForm((f) => ({ ...f, coverImage: r.url }));
        try {
          await api('/users/me/cover-image', {
            method: 'PATCH',
            body: JSON.stringify({ coverImage: r.url }),
          });
          upsertUser({ ...profile, coverImage: r.url, cover_image: r.url });
        } catch (e) {
          console.error('Failed to save cover image', e);
        }
      },
    });
  };

  const handleExportContent = async () => {
    setExporting(true);
    try {
      const token = await fetchCsrfToken();
      const res = await fetch(`${API_BASE}/users/me/export-content`, {
        credentials: 'include',
        headers: { 'X-CSRF-Token': token || '' },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'my-content-export.csv';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.message || 'Failed to export content.');
    } finally {
      setExporting(false);
    }
  };

  const handleEndorse = async () => {
    const topic = endorseTopic.trim();
    if (!topic) {
      setEndorseError('Enter a topic to endorse this publisher for.');
      return;
    }
    setIsEndorsing(true);
    setEndorseError('');
    try {
      await api(`/users/${id}/endorse`, {
        method: 'POST',
        body: JSON.stringify({ topic }),
      });
      setEndorseTopic('');
      await fetchEndorsements();
    } catch (e) {
      setEndorseError(e.message || 'Failed to save endorsement.');
    } finally {
      setIsEndorsing(false);
    }
  };

  useEffect(() => {
    if (isOwner) {
      fetchKeys();
      fetchApiUsage();
    }
    if (id) {
      fetchPublisherRooms();
      fetchPublisherCampuses();
      fetchPublisherJobs();
      fetchPublisherVideos();
      fetchPinnedStory();
      fetchBadges();
      fetchEndorsements();
    }
  }, [isOwner, id]);

  useEffect(() => {
    if (isOwner && isPartner) fetchPartnerDashboard();
  }, [isOwner, isPartner]);



  const userStories = stories
    .filter((s) => (s.authorId === id || s.author_id === id) && !s.deleted)
    .filter((s) => (s.type === 'story' || !s.type) && (s.privacy === 'public' || isOwner))
    .sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));

  const userDocumentaries = stories
    .filter((s) => (s.authorId === id || s.author_id === id) && !s.deleted)
    .filter((s) => s.type === 'documentary' && (s.privacy === 'public' || isOwner))
    .sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));

  // ── NEW: Press releases & sponsored content tabs (feature 1 & 2) ──────
  const userPressReleases = stories
    .filter((s) => (s.authorId === id || s.author_id === id) && !s.deleted)
    .filter((s) => s.type === 'press_release' && (s.privacy === 'public' || isOwner))
    .sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));

  const userSponsored = stories
    .filter((s) => (s.authorId === id || s.author_id === id) && !s.deleted)
    .filter((s) => s.type === 'sponsored' && (s.privacy === 'public' || isOwner))
    .sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));

  const followerCount = Object.values(follows).filter((list) => list.includes(id)).length;
  const iFollow = user ? (follows[user.id] || []).includes(id) : false;

    const saveEdits = () => {
    upsertUser({ ...profile, ...form });
    if (isOwner) updateProfile(form);
    setEditing(false);
  };

  const changeLogo = () => {
    openCloudinaryWidget({ onSuccess: (r) => setForm((f) => ({ ...f, logoUrl: r.url })) });
  };

  const publisherName = profile?.publisherName || profile?.publisher_name;
  const logoUrl = profile?.logoUrl || profile?.logo_url;
  const coverImageUrl = profile ? (editing ? form.coverImage : (profile.coverImage || profile.cover_image)) : null;

  // ── NEW: reading time stats (feature 6) ────────────────────────────────
  const { totalWords, avgReadMin } = useMemo(
    () => estimateWordsAndReadTime([...userStories, ...userDocumentaries]),
    [userStories, userDocumentaries]
  );

  // ── NEW: social links (feature 3) ──────────────────────────────────────
  const socialLinks = profile ? [
    profile.social_link || profile.socialLink
      ? { key: 'website', href: /^https?:\/\//i.test(profile.social_link || profile.socialLink) ? (profile.social_link || profile.socialLink) : `https://${profile.social_link || profile.socialLink}`, Icon: Globe, label: 'Website' }
      : null,
    profile.twitter ? { key: 'twitter', href: `https://twitter.com/${String(profile.twitter).replace('@', '')}`, Icon: Twitter, label: 'Twitter' } : null,
    profile.linkedin ? { key: 'linkedin', href: profile.linkedin, Icon: Linkedin, label: 'LinkedIn' } : null,
    profile.email ? { key: 'email', href: `mailto:${profile.email}`, Icon: Mail, label: 'Email' } : null,
  ].filter(Boolean) : [];

  if (!profile) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center animate-in fade-in">
        <div className="w-16 h-16 bg-wire/20 rounded-full flex items-center justify-center mb-4">
          <Newspaper className="text-ink-300" size={32} />
        </div>
        <p className="text-xl font-black uppercase tracking-widest text-ink-400">Publisher Not Found</p>
      </div>
    );
  }

  return (
    <div className="bg-paper min-h-screen pb-24 relative selection:bg-signal selection:text-white">
      {showApiGuide && <ApiGuideModal onClose={() => setShowApiGuide(false)} />}
      
      {/* QR Code Modal */}
      {qrStory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white border-2 border-ink rounded-md max-w-sm w-full p-8 relative shadow-2xl animate-in zoom-in-95 duration-300">
            <button onClick={() => setQrStory(null)} className="absolute top-4 right-4 text-ink-400 hover:text-signal transition-colors bg-ink-50 hover:bg-red-50 p-1.5 rounded-full">
              <X size={18} />
            </button>
            <div className="text-center mb-6">
              <h3 className="text-xl font-black text-ink uppercase tracking-tight">Story QR Code</h3>
              <p className="text-xs text-ink-500 mt-1 line-clamp-2 font-medium">{qrStory.title}</p>
            </div>
            <div ref={qrRef} className="bg-white p-4 rounded-md border-2 border-wire flex justify-center mb-6 shadow-inner">
              <QRCodeSVG 
                value={`${typeof window !== 'undefined' ? window.location.origin : 'https://opinionplus.online'}/story/${qrStory.id}`} 
                size={200} 
                level="H" 
                includeMargin={true} 
              />
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={downloadQRCode} className="w-full bg-ink text-white font-bold uppercase text-xs tracking-widest py-3.5 rounded-sm hover:bg-signal transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg">
                <Download size={16} /> Download High-Res PNG
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Free Live Room Creation Modal */}
      {showRoomModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white border-2 border-ink rounded-md max-w-md w-full p-8 relative shadow-2xl animate-in zoom-in-95 duration-300">
            <button onClick={() => setShowRoomModal(false)} disabled={isCreatingRoom} className="absolute top-4 right-4 text-ink-400 hover:text-signal transition-colors bg-ink-50 hover:bg-red-50 p-1.5 rounded-full">
              <X size={18} />
            </button>
            <div className="mb-6">
              <h3 className="text-xl font-black text-ink uppercase tracking-tight flex items-center gap-2">
                <Radio className="text-signal" size={22} /> Host Live Space
              </h3>
              <p className="text-xs text-ink-500 mt-1">Broadcast real-time audio and video sessions to your audience for free.</p>
            </div>
            <form onSubmit={handleCreateFreeRoom} className="space-y-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-ink-600 mb-1.5">Space Title *</label>
                <input 
                  type="text"
                  required
                  value={roomTitle}
                  onChange={(e) => setRoomTitle(e.target.value)}
                  placeholder="e.g., Evening Political Debate"
                  disabled={isCreatingRoom}
                  className="w-full bg-white border-2 border-wire rounded-sm px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-ink transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-ink-600 mb-1.5">Description (Optional)</label>
                <textarea 
                  value={roomDesc}
                  onChange={(e) => setRoomDesc(e.target.value)}
                  placeholder="Brief summary of the discussion..."
                  disabled={isCreatingRoom}
                  className="w-full bg-white border-2 border-wire rounded-sm px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-ink transition-colors resize-none h-20"
                />
              </div>
              {roomModalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-sm text-red-600 text-xs font-bold">
                  {roomModalError}
                </div>
              )}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRoomModal(false)}
                  disabled={isCreatingRoom}
                  className="flex-1 bg-ink-50 border border-wire text-ink font-bold uppercase text-xs tracking-widest py-3 rounded-sm hover:bg-ink-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingRoom || !roomTitle.trim()}
                  className="flex-1 bg-signal text-white font-bold uppercase text-xs tracking-widest py-3 rounded-sm hover:bg-signal/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-md"
                >
                  {isCreatingRoom ? <><Loader2 size={16} className="animate-spin" /> Launching...</> : 'Launch Space'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ⭐ NEW FEATURE 10: COVER IMAGE / BANNER ⭐ */}
      <div className="relative h-48 md:h-64 w-full bg-ink overflow-hidden group">
        {coverImageUrl ? (
          <img src={coverImageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-ink via-ink-800 to-ink" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" />
        {isOwner && (
          <button
            onClick={changeCoverImage}
            className="absolute top-4 right-4 bg-black/50 text-white text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-sm backdrop-blur-sm hover:bg-signal transition-colors flex items-center gap-2 opacity-0 group-hover:opacity-100 focus:opacity-100"
          >
            <Camera size={14} /> Edit Cover
          </button>
        )}
      </div>

      {/* 🌟 1. MASTHEAD HERO SECTION */}
      <div className="bg-ink text-white relative overflow-hidden border-b-4 border-signal -mt-1">
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent"></div>
        <div className="max-w-6xl mx-auto px-5 sm:px-6 pt-12 pb-10 relative z-10">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <div className="relative shrink-0 group">
              <div className="w-36 h-36 md:w-44 md:h-44 rounded-md overflow-hidden border-4 border-white/10 bg-ink shadow-2xl transition-transform duration-500 group-hover:scale-105">
                <img src={editing ? form.logoUrl : logoUrl} alt={publisherName} className="w-full h-full object-cover" />
              </div>
              {editing && (
                <button onClick={changeLogo} className="absolute -bottom-2 -right-2 bg-signal text-white p-3 rounded-full shadow-xl hover:bg-white hover:text-signal transition-all hover:scale-110" title="Change logo">
                  <Camera size={18} />
                </button>
              )}
            </div>
            <div className="flex-1 min-w-0 text-center md:text-left w-full flex flex-col justify-center mt-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-5">
                <div className="flex-1">
                  {editing ? (
                    <input 
                      value={form.publisherName || form.publisher_name} 
                      onChange={(e) => setForm((f) => ({ ...f, publisherName: e.target.value }))} 
                      className="w-full bg-white/5 border border-white/20 text-white text-3xl md:text-4xl font-black tracking-tight px-4 py-2 rounded-sm focus:outline-none focus:border-signal focus:bg-white/10 transition-colors" 
                    />
                  ) : (
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                      <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none uppercase text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
                        {publisherName}
                      </h1>
                      {/* ⭐ NEW FEATURE 14: SUBSCRIPTION TIER BADGE ⭐ */}
                      {isPartner && (
                        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border shadow-sm flex items-center gap-1.5 ${TIER_BADGE_STYLES[publisherTier] || ''}`}>
                          <Crown size={12} /> {publisherTier === 'pro_partner' ? 'Pro Partner' : 'Partner'}
                        </span>
                      )}
                    </div>
                  )}
                  {profile.suspended && (
                    <span className="inline-block bg-red-500 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-sm mt-3 shadow-md">
                      Account Suspended
                    </span>
                  )}
                  {/* ⭐ NEW FEATURE 3: SOCIAL LINKS DISPLAY ⭐ */}
                  {!editing && socialLinks.length > 0 && (
                    <div className="flex items-center justify-center md:justify-start gap-3 mt-3">
                      {socialLinks.map(({ key, href, Icon, label }) => (
                        <a
                          key={key}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={label}
                          className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors"
                        >
                          <Icon size={15} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div className="shrink-0 flex flex-col sm:flex-row items-center justify-center gap-3">
                  {isOwner ? (
                    editing ? (
                      <button onClick={saveEdits} className="bg-signal text-white font-bold uppercase text-xs tracking-widest px-8 py-3 rounded-sm hover:bg-white hover:text-signal transition-all shadow-lg flex items-center justify-center gap-2 w-full md:w-auto">
                        <Check size={16} /> Save Changes
                      </button>
                    ) : (
                      <button onClick={() => { setForm(profile); setEditing(true); }} className="border-2 border-white/20 text-white font-bold uppercase text-xs tracking-widest px-8 py-3 rounded-sm hover:bg-white hover:text-ink transition-all shadow-lg w-full md:w-auto backdrop-blur-sm">
                        Edit Profile
                      </button>
                    )
                  ) : user ? (
                    <button onClick={() => toggleFollow(user.id, id)} className={`font-bold uppercase text-xs tracking-widest px-8 py-3 rounded-sm flex items-center justify-center gap-2 transition-all shadow-lg w-full md:w-auto ${iFollow ? 'border-2 border-white/20 text-white hover:bg-white/10 backdrop-blur-sm' : 'bg-signal text-white hover:bg-signal/90 hover:scale-105'}`}>
                      {iFollow ? <UserMinus size={16} /> : <UserPlus size={16} />}{iFollow ? 'Following' : 'Follow'}
                    </button>
                  ) : null}

                  {/* ⭐ NEW FEATURE 4: SHARE PROFILE BUTTON ⭐ */}
                  <div className="relative w-full md:w-auto">
                    <button
                      onClick={() => setShareOpen((v) => !v)}
                      className="border-2 border-white/20 text-white font-bold uppercase text-xs tracking-widest px-6 py-3 rounded-sm hover:bg-white hover:text-ink transition-all shadow-lg w-full md:w-auto backdrop-blur-sm flex items-center justify-center gap-2"
                    >
                      <Share2 size={14} /> Share
                    </button>
                    {shareOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-white text-ink rounded-md shadow-2xl border border-wire z-20 p-2 animate-in fade-in zoom-in-95 duration-150">
                        <button
                          onClick={handleCopyProfileLink}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wide rounded-sm hover:bg-ink-50 transition-colors"
                        >
                          {shareCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          {shareCopied ? 'Copied!' : 'Copy Link'}
                        </button>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(`Check out ${publisherName} on OpinionPlus: ${profileUrl}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wide rounded-sm hover:bg-ink-50 transition-colors"
                        >
                          <MessageSquare size={14} /> Share on WhatsApp
                        </a>
                        <a
                          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${publisherName} on OpinionPlus`)}&url=${encodeURIComponent(profileUrl)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wide rounded-sm hover:bg-ink-50 transition-colors"
                        >
                          <Twitter size={14} /> Share on Twitter
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-[11px] font-black uppercase tracking-widest text-white/60 mb-5 bg-white/5 inline-flex px-4 py-2 rounded-sm border border-white/10 backdrop-blur-sm w-fit mx-auto md:mx-0">
                <span className="flex items-center gap-1.5"><Newspaper size={14} className="text-signal" /> {userStories.length + userDocumentaries.length} Published</span>
                <span className="opacity-30">•</span>
                <span className="flex items-center gap-1.5"><UserPlus size={14} className="text-signal" /> {followerCount} Followers</span>
                <span className="opacity-30">•</span>
                <span className="flex items-center gap-1.5"><Radio size={14} className="text-signal" /> {publisherRooms.length} Live Rooms</span>
                <span className="opacity-30">•</span>
                <span className="flex items-center gap-1.5"><GraduationCap size={14} className="text-signal" /> {publisherCampuses.length} Campuses</span>
                <span className="opacity-30">•</span>
                <span className="flex items-center gap-1.5"><Briefcase size={14} className="text-signal" /> {publisherJobs.length} Jobs</span>
                <span className="opacity-30">•</span>
                <span className="flex items-center gap-1.5"><Play size={14} className="text-signal" /> {publisherVideos.length} Videos</span>
                {/* ⭐ NEW FEATURE 6: READING TIME STATS ⭐ */}
                <span className="opacity-30">•</span>
                <span className="flex items-center gap-1.5"><BarChart3 size={14} className="text-signal" /> {formatCompactNumber(totalWords)} Words Published</span>
                <span className="opacity-30">•</span>
                <span className="flex items-center gap-1.5"><Activity size={14} className="text-signal" /> {avgReadMin > 0 ? `${avgReadMin} min` : '—'} Avg Read</span>
              </div>

              {/* ⭐ NEW FEATURE 9: BADGES & ACHIEVEMENTS ⭐ */}
              {badges.length > 0 && (
                <div className="mb-5">
                  <PublisherBadges badges={badges} />
                </div>
              )}

              {editing ? (
                <textarea 
                  value={form.bio || ''} 
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} 
                  placeholder="Write a short bio..."
                  className="w-full bg-white/5 border border-white/20 text-white text-sm font-medium px-4 py-3 rounded-sm focus:outline-none focus:border-signal focus:bg-white/10 transition-colors min-h-[80px] resize-none" 
                />
              ) : (
                <p className="text-sm md:text-base text-white/80 max-w-3xl font-medium leading-relaxed border-l-2 border-signal/50 pl-4">
                  {profile.bio || "This publisher hasn't written a bio yet."}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 sm:px-6 pt-10 pb-12 space-y-12">

        {/* ⭐ NEW FEATURE 5: PINNED / FEATURED STORY ⭐ */}
        {pinnedStory && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 py-8 md:py-10">
            <div className="border-2 border-amber-400/60 bg-amber-50/30 rounded-md overflow-hidden shadow-sm">
              <div className="relative h-64 w-full bg-ink-100">
                <img
                  src={pinnedStory.image_url || pinnedStory.imageUrl || pinnedStory.cover_image}
                  alt={pinnedStory.title}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-4 left-4 bg-amber-400 text-ink text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5">
                  <Star size={12} fill="currentColor" /> Featured
                </span>
              </div>
              <div className="p-6 md:p-8">
                <Link href={`/story/${pinnedStory.id}`} className="text-xl md:text-2xl font-black text-ink uppercase tracking-tight hover:text-signal transition-colors">
                  {pinnedStory.title}
                </Link>
                <p className="text-sm text-ink-600 font-medium mt-3 leading-relaxed line-clamp-3">
                  {pinnedStory.excerpt || pinnedStory.summary || ''}
                </p>
                {isOwner && (
                  <button
                    onClick={handleUnpinStory}
                    disabled={pinningId === 'unpin'}
                    className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ink-500 hover:text-red-500 transition-colors"
                  >
                    <PinOff size={14} /> {pinningId === 'unpin' ? 'Removing...' : 'Unpin from profile'}
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* 🌟 2. DASHBOARD / COMMAND CENTER */}
        {isOwner && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 py-8 md:py-10">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
              <div className="flex items-center gap-2 text-ink">
                <LayoutDashboard size={20} className="text-signal" />
                <h2 className="text-xl font-black uppercase tracking-tight">Command Center</h2>
              </div>
              {/* ⭐ NEW FEATURE 13: CONTENT EXPORT ⭐ */}
              <button
                onClick={handleExportContent}
                disabled={exporting}
                className="bg-ink-50 border border-wire text-ink font-bold uppercase text-xs tracking-widest px-5 py-2.5 rounded-sm hover:bg-ink hover:text-white transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {exporting ? 'Exporting...' : 'Export My Content'}
              </button>
            </div>
            {/* ROW 1: Essentials (Wallet & SMS) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
              <div className="bg-white p-6 rounded-md shadow-sm border border-wire/60 hover:shadow-md transition-shadow flex flex-col h-full">
                <SectionHeader title="Earnings & Wallet" icon={CreditCard} description="Manage your revenue and payouts" />
                <div className="flex-1"><WalletDashboard /></div>
              </div>
              <div className="bg-white p-6 rounded-md shadow-sm border border-wire/60 hover:shadow-md transition-shadow flex flex-col h-full">
                <SectionHeader title="SMS Campaigns" icon={MessageSquare} description="Broadcast breaking news instantly" />
                <div className="flex-1"><SmsDashboard /></div>
              </div>
            </div>
            {/* ROW 2: Developer Hub (API Usage & Keys) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
              {/* API Access Details */}
              <div className="bg-white p-6 rounded-md shadow-sm border border-wire/60 hover:shadow-md transition-shadow flex flex-col h-full">
                <SectionHeader 
                  title="API Access" 
                  icon={BarChart3} 
                  description="Monitor your developer limits"
                  rightAction={
                    <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 px-2.5 py-1 rounded-sm border ${isPro ? 'text-signal border-signal/30 bg-signal/5' : 'text-ink-500 border-wire bg-ink-50'}`}>
                      <Zap size={12} fill={isPro ? "currentColor" : "none"} />
                      {isPro ? 'Pro Active' : `Free: ${apiUsage?.calls_today || 0}/50`}
                    </span>
                  } 
                />
                <div className="flex-1 flex flex-col justify-center">
                  {!isPro && !isAdminUser ? (
                    <div className="bg-ink-50 border border-wire rounded-sm p-6 flex flex-col items-center text-center gap-4">
                      <div>
                        <p className="text-base font-black text-ink uppercase tracking-tight">Unlock Unlimited API</p>
                        <p className="text-xs font-medium text-ink-500 mt-1 leading-relaxed max-w-xs">Upgrade to Pro to remove rate limits and build robust external integrations.</p>
                      </div>
                      <button onClick={handleUpgrade} disabled={upgrading} className="bg-ink text-white font-bold uppercase text-[11px] tracking-widest px-8 py-3 rounded-sm hover:bg-signal transition-colors w-full sm:w-auto shadow-md">
                        {upgrading ? 'Connecting Gateway...' : 'Upgrade Now — KES 400'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-6 bg-emerald-50 border border-emerald-100 rounded-sm">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3 shadow-sm">
                        <Check size={24} />
                      </div>
                      <p className="font-black uppercase tracking-widest text-emerald-800 text-sm">Pro Tier Active</p>
                      <p className="text-xs font-medium text-emerald-600 mt-1">You have unlimited API access.</p>
                    </div>
                  )}
                </div>
              </div>
              {/* API Keys Manager */}
              <div className="bg-white p-6 rounded-md shadow-sm border border-wire/60 hover:shadow-md transition-shadow flex flex-col h-full">
                <SectionHeader 
                  title="API Keys" 
                  icon={Key} 
                  description="Manage access credentials"
                  rightAction={
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowApiGuide(true)} className="text-[10px] font-bold text-ink hover:text-signal uppercase tracking-widest transition-colors flex items-center gap-1.5 border border-wire px-2.5 py-1.5 rounded-sm hover:border-signal">
                        <Terminal size={12} /> Docs
                      </button>
                      <button onClick={() => { setShowKeys(!showKeys); if (!showKeys) fetchKeys(); }} className="text-ink hover:text-signal transition-colors bg-ink-50 p-1.5 rounded-sm border border-wire">
                        {showKeys ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  } 
                />
                <div className="flex-1">
                  {!showKeys ? (
                     <div className="h-full flex items-center justify-center border-2 border-dashed border-wire rounded-sm p-6 cursor-pointer hover:border-ink-300 hover:bg-ink-50 transition-colors" onClick={() => { setShowKeys(true); fetchKeys(); }}>
                       <p className="text-xs font-bold text-ink-400 uppercase tracking-widest flex items-center gap-2">
                         <Key size={14} /> Manage API Keys
                       </p>
                     </div>
                  ) : (
                    <div className="space-y-5 animate-in fade-in duration-300">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input 
                          value={newKeyName} 
                          onChange={(e) => setNewKeyName(e.target.value)} 
                          placeholder="Key label (e.g., Blog App)" 
                          className="flex-1 bg-white border-2 border-wire rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-ink transition-colors font-medium" 
                        />
                        <button onClick={generateKey} disabled={!newKeyName.trim()} className="bg-ink text-white font-bold uppercase text-[11px] tracking-widest px-5 py-2 rounded-sm hover:bg-signal disabled:opacity-50 disabled:hover:bg-ink transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-sm">
                          <Plus size={14} /> Create
                        </button>
                      </div>
                      {newKey && (
                        <div className="bg-signal/5 border border-signal text-ink rounded-sm p-4 shadow-inner">
                          <p className="text-[11px] font-black text-signal uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            <Zap size={14} /> Save this key immediately
                          </p>
                          <div className="flex items-center gap-2 bg-white p-1 rounded-sm border border-wire shadow-sm">
                            <code className="flex-1 px-3 py-1 text-xs break-all font-mono text-ink-800 selection:bg-signal selection:text-white">{newKey.key}</code>
                            <button onClick={() => navigator.clipboard.writeText(newKey.key)} className="bg-ink text-white hover:bg-signal transition-colors px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-sm flex items-center gap-1">
                              <Copy size={12} /> Copy
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="space-y-3 pt-1">
                        {apiKeys.length === 0 ? (
                           <p className="text-xs text-ink-400 font-medium italic text-center py-4 bg-ink-50 rounded-sm border border-wire/50">No API keys generated yet.</p>
                        ) : (
                          <div className="border border-wire rounded-sm divide-y divide-wire bg-white overflow-hidden max-h-48 overflow-y-auto">
                            {apiKeys.map((k) => (
                              <div key={k.id} className="flex items-center justify-between p-3 gap-4 hover:bg-ink-50/50 transition-colors group">
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-ink truncate">{k.name}</p>
                                  <p className="text-[10px] font-mono text-ink-400 mt-0.5 tracking-wider">{k.prefix}••••••••••••</p>
                                </div>
                                <button onClick={() => revokeKey(k.id)} className="text-[10px] font-bold text-ink-400 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1.5 uppercase tracking-wider px-2.5 py-1.5 border border-transparent rounded-sm hover:border-red-200 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100">
                                  <Trash2 size={12} /> Revoke
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* ROW 3: Analytics (Timeline) */}
            <section className="bg-white p-6 rounded-md shadow-sm border border-wire/60 hover:shadow-md transition-shadow">
              <SectionHeader title="Publishing Analytics" icon={Activity} description="Your story momentum over the last year" />
              <StoryTimeline userId={id} />
            </section>

            {/* ⭐ NEW FEATURE 12: READER INSIGHTS (owner only) ⭐ */}
            <section className="bg-white p-6 rounded-md shadow-sm border border-wire/60 hover:shadow-md transition-shadow">
              <SectionHeader title="Reader Insights" icon={UsersIcon} description="Understand who's engaging with your work" />
              <ReaderInsights userId={id} />
            </section>

            {/* Media Kit (supporting tool for the Command Center) */}
            <section className="bg-white p-6 rounded-md shadow-sm border border-wire/60 hover:shadow-md transition-shadow">
              <PublisherMediaKit
                userId={id}
                publisherName={publisherName}
                bio={profile.bio}
                stats={{
                  totalStories: userStories.length + userDocumentaries.length,
                  followers: followerCount,
                  totalViews: userStories.reduce((sum, s) => sum + (s.view_count || s.viewCount || 0), 0),
                }}
                topStories={[...userStories]
                  .sort((a, b) => (b.view_count || b.viewCount || 0) - (a.view_count || a.viewCount || 0))
                  .slice(0, 5)}
              />
            </section>

            {/* ⭐ NEW FEATURE 8: PARTNER EARNINGS (owner + partner only) ⭐ */}
            {isPartner && (
              <section className="bg-white p-6 rounded-md shadow-sm border border-wire/60 hover:shadow-md transition-shadow">
                <SectionHeader title="Partner Earnings" icon={DollarSign} description="Your partner program earnings summary" />
                {partnerLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="animate-spin text-signal" size={24} />
                  </div>
                ) : partnerData ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center border border-wire rounded-sm py-4">
                        <p className="text-xl font-black text-ink">{partnerData?.wallet?.total_earned || 0}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Total Earned</p>
                      </div>
                      <div className="text-center border border-wire rounded-sm py-4">
                        <p className="text-xl font-black text-ink">{partnerData?.wallet?.balance || 0}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Available</p>
                      </div>
                      <div className="text-center border border-wire rounded-sm py-4">
                        <p className="text-xl font-black text-ink">{partnerData?.referral_count || 0}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Referrals</p>
                      </div>
                    </div>
                    {Array.isArray(partnerData.recent_earnings) && partnerData.recent_earnings.length > 0 && (
                      <div className="space-y-2">
                        {partnerData.recent_earnings.slice(0, 10).map((e, idx) => (
                          <div key={e.id || idx} className="flex items-center justify-between bg-ink-50 border border-wire/60 rounded-sm px-4 py-2.5 text-xs font-bold text-ink">
                            <span>{e.description || e.source || 'Earning'}</span>
                            <span>{e.amount}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <Link href="/partner" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-signal hover:underline">
                      View Full Partner Dashboard →
                    </Link>
                  </div>
                ) : (
                  <p className="text-xs text-ink-400 italic text-center py-6">No partner data available yet.</p>
                )}
              </section>
            )}
          </div>
        )}

        {/* 🌟 3. COMMUNITY & NEWSLETTER */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 py-8 md:py-10">
          <MastheadNewsletter publisherId={id} publisherName={publisherName} />
        </section>

        {/* 🌟 4. PORTFOLIO TABS */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 py-8 md:py-10">
          <div className="flex items-center justify-between gap-3 border-b-2 border-wire pb-4 mb-8 flex-wrap">
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => setProfileTab('stories')}
                className={`text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-sm transition-colors flex items-center gap-2 ${
                  profileTab === 'stories' ? 'bg-ink text-white' : 'bg-ink-50 text-ink hover:bg-ink-100'
                }`}
              >
                <Newspaper size={14} /> Stories ({userStories.length})
              </button>
              <button
                onClick={() => setProfileTab('documentaries')}
                className={`text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-sm transition-colors flex items-center gap-2 ${
                  profileTab === 'documentaries' ? 'bg-ink text-white' : 'bg-ink-50 text-ink hover:bg-ink-100'
                }`}
              >
                <Film size={14} /> Documentaries ({userDocumentaries.length})
              </button>
              {/* ⭐ NEW FEATURE 1: PRESS RELEASES TAB ⭐ */}
              <button
                onClick={() => setProfileTab('press')}
                className={`text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-sm transition-colors flex items-center gap-2 ${
                  profileTab === 'press' ? 'bg-ink text-white' : 'bg-ink-50 text-ink hover:bg-ink-100'
                }`}
              >
                <Megaphone size={14} /> Press Releases ({userPressReleases.length})
              </button>
              {/* ⭐ NEW FEATURE 2: SPONSORED CONTENT TAB ⭐ */}
              <button
                onClick={() => setProfileTab('sponsored')}
                className={`text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-sm transition-colors flex items-center gap-2 ${
                  profileTab === 'sponsored' ? 'bg-ink text-white' : 'bg-ink-50 text-ink hover:bg-ink-100'
                }`}
              >
                <DollarSign size={14} /> Sponsored ({userSponsored.length})
              </button>
              <button
                onClick={() => setProfileTab('rooms')}
                className={`text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-sm transition-colors flex items-center gap-2 ${
                  profileTab === 'rooms' ? 'bg-signal text-white' : 'bg-ink-50 text-ink hover:bg-ink-100'
                }`}
              >
                <Radio size={14} className={publisherRooms.length > 0 ? 'animate-pulse text-signal' : ''} /> Live Audio Rooms ({publisherRooms.length})
              </button>
              <button
                onClick={() => setProfileTab('campuses')}
                className={`text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-sm transition-colors flex items-center gap-2 ${
                  profileTab === 'campuses' ? 'bg-ink text-white' : 'bg-ink-50 text-ink hover:bg-ink-100'
                }`}
              >
                <GraduationCap size={14} /> Campuses ({publisherCampuses.length})
              </button>
              <button
                onClick={() => setProfileTab('jobs')}
                className={`text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-sm transition-colors flex items-center gap-2 ${
                  profileTab === 'jobs' ? 'bg-ink text-white' : 'bg-ink-50 text-ink hover:bg-ink-100'
                }`}
              >
                <Briefcase size={14} /> Jobs ({publisherJobs.length})
              </button>
              <button
                onClick={() => setProfileTab('videos')}
                className={`text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-sm transition-colors flex items-center gap-2 ${
                  profileTab === 'videos' ? 'bg-ink text-white' : 'bg-ink-50 text-ink hover:bg-ink-100'
                }`}
              >
                <Play size={14} /> Videos ({publisherVideos.length})
              </button>
              {/* ⭐ NEW FEATURE 8: PARTNER EARNINGS TAB (public view, if partner) ⭐ */}
              {isPartner && (
                <button
                  onClick={() => setProfileTab('earnings')}
                  className={`text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-sm transition-colors flex items-center gap-2 ${
                    profileTab === 'earnings' ? 'bg-ink text-white' : 'bg-ink-50 text-ink hover:bg-ink-100'
                  }`}
                >
                  <Crown size={14} /> Earnings
                </button>
              )}
            </div>

            {/* ⭐ NEW FEATURE 7: CONTENT CALENDAR VIEW TOGGLE ⭐ */}
            {profileTab === 'stories' && (
              <div className="flex items-center gap-1 bg-ink-50 border border-wire rounded-sm p-1">
                <button
                  onClick={() => setCalendarView(false)}
                  className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm transition-colors flex items-center gap-1.5 ${!calendarView ? 'bg-ink text-white' : 'text-ink-500 hover:bg-ink-100'}`}
                >
                  <LayoutGrid size={12} /> Grid
                </button>
                <button
                  onClick={() => setCalendarView(true)}
                  className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm transition-colors flex items-center gap-1.5 ${calendarView ? 'bg-ink text-white' : 'text-ink-500 hover:bg-ink-100'}`}
                >
                  <CalendarDays size={12} /> Calendar
                </button>
              </div>
            )}
          </div>

          {/* Tab 1: Stories */}
          {profileTab === 'stories' && (
            calendarView ? (
              <ContentCalendar stories={userStories} />
            ) : (
            <div>
              {userStories.length === 0 ? (
                <div className="border-2 border-dashed border-wire bg-white rounded-md p-16 text-center shadow-sm">
                  <div className="w-16 h-16 bg-ink-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Newspaper size={24} className="text-ink-300" />
                  </div>
                  <p className="text-xl font-black uppercase tracking-tight text-ink mb-2">Blank Canvas</p>
                  <p className="text-sm font-medium text-ink-500">This publisher hasn&apos;t released any stories yet.</p>
                </div>
              ) : (
                <div className="grid gap-6 md:gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {userStories.map((s) => (
                    <div key={s.id} className="bg-white border border-wire rounded-md flex flex-col justify-between shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden">
                      <StoryCard story={s} />
                      {/* ⭐ NEW FEATURE 11: COLLABORATIONS SHOWCASE ⭐ */}
                      {s.collaborators && s.collaborators.length > 0 && (
                        <div className="px-4 pt-2">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-signal bg-signal/5 border border-signal/20 px-2 py-1 rounded-full">
                            <UsersIcon size={11} /> Co-authored with {s.collaborators.map((c) => c.name).join(', ')}
                          </span>
                        </div>
                      )}
                      {isOwner && (
                        <div className="px-4 py-3 border-t border-wire bg-ink-50/50 flex justify-between items-center gap-2">
                          {/* ⭐ NEW FEATURE 5: PIN TO PROFILE BUTTON ⭐ */}
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePinStory(s.id); }}
                            disabled={pinningId === s.id}
                            className="bg-white border border-wire text-ink text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-sm hover:bg-amber-400 hover:text-ink hover:border-amber-400 transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <Pin size={13} /> {pinnedStory?.id === s.id ? 'Pinned' : (pinningId === s.id ? 'Pinning...' : 'Pin to profile')}
                          </button>
                          <button 
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQrStory(s); }}
                            className="bg-white border border-wire text-ink text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-sm hover:bg-ink hover:text-white hover:border-ink transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <QrCode size={13} /> Get QR
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            )
          )}

          {/* Tab 2: Documentaries */}
          {profileTab === 'documentaries' && (
            <div>
              {userDocumentaries.length === 0 ? (
                <div className="border-2 border-dashed border-wire bg-white rounded-md p-16 text-center shadow-sm">
                  <div className="w-16 h-16 bg-ink-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Film size={24} className="text-ink-300" />
                  </div>
                  <p className="text-xl font-black uppercase tracking-tight text-ink mb-2">No Documentaries</p>
                  <p className="text-sm font-medium text-ink-500">This publisher hasn&apos;t released any documentaries yet.</p>
                </div>
              ) : (
                <div className="grid gap-6 md:gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {userDocumentaries.map((s) => (
                    <div key={s.id} className="bg-white border border-wire rounded-md flex flex-col justify-between shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden">
                      <StoryCard story={s} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ⭐ NEW FEATURE 1: Tab — Press Releases ⭐ */}
          {profileTab === 'press' && (
            <div>
              {userPressReleases.length === 0 ? (
                <div className="border-2 border-dashed border-wire bg-white rounded-md p-16 text-center shadow-sm">
                  <div className="w-16 h-16 bg-ink-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Megaphone size={24} className="text-ink-300" />
                  </div>
                  <p className="text-xl font-black uppercase tracking-tight text-ink mb-2">No Press Releases</p>
                  <p className="text-sm font-medium text-ink-500">No press releases published yet.</p>
                </div>
              ) : (
                <div className="grid gap-6 md:gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {userPressReleases.map((s) => (
                    <div key={s.id} className="bg-white border border-wire rounded-md flex flex-col justify-between shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden">
                      <StoryCard story={s} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ⭐ NEW FEATURE 2: Tab — Sponsored Content ⭐ */}
          {profileTab === 'sponsored' && (
            <div>
              {userSponsored.length === 0 ? (
                <div className="border-2 border-dashed border-wire bg-white rounded-md p-16 text-center shadow-sm">
                  <div className="w-16 h-16 bg-ink-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <DollarSign size={24} className="text-ink-300" />
                  </div>
                  <p className="text-xl font-black uppercase tracking-tight text-ink mb-2">No Sponsored Campaigns</p>
                  <p className="text-sm font-medium text-ink-500">No sponsored campaigns running.</p>
                </div>
              ) : (
                <div className="grid gap-6 md:gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {userSponsored.map((s) => (
                    <div key={s.id} className="bg-white border border-wire rounded-md flex flex-col justify-between shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden relative">
                      <span className={`absolute top-3 right-3 z-10 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-md ${
                        s.campaign_status === 'active' ? 'bg-emerald-500 text-white'
                        : s.campaign_status === 'paused' ? 'bg-amber-400 text-ink'
                        : 'bg-ink-300 text-white'
                      }`}>
                        {s.campaign_status || 'active'}
                      </span>
                      <StoryCard story={s} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Live Audio Rooms */}
          {profileTab === 'rooms' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4 bg-ink-50 p-4 border border-wire rounded-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-ink">
                  Live & Scheduled Audio Discussions hosted by {publisherName}
                </p>
                {isOwner && (
                  <button
                    onClick={() => { setRoomTitle(''); setRoomDesc(''); setRoomModalError(''); setShowRoomModal(true); }}
                    className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-5 py-2.5 rounded-sm hover:bg-signal/90 transition-colors shadow-sm inline-flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Host New Space (Free)
                  </button>
                )}
              </div>
              {publisherRooms.length === 0 ? (
                <div className="border border-dashed border-wire rounded-sm p-16 text-center bg-white">
                  <Radio size={32} className="mx-auto text-ink-300 mb-3" />
                  <p className="text-lg font-bold text-ink mb-1">No active audio rooms.</p>
                  <p className="text-xs text-ink-500 mb-4">This publisher is not currently hosting any live discussions.</p>
                  {isOwner && (
                    <button
                      onClick={() => { setRoomTitle(''); setRoomDesc(''); setRoomModalError(''); setShowRoomModal(true); }}
                      className="bg-ink text-white font-bold uppercase text-xs tracking-wider px-5 py-2.5 rounded-sm hover:bg-signal transition-colors inline-flex items-center gap-1.5"
                    >
                      <Plus size={14} /> Host Your First Space
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                  {publisherRooms.map((room) => (
                    <div key={room.id} className="border-2 border-ink bg-white p-6 rounded-sm shadow-sm flex flex-col justify-between space-y-4 relative group">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-signal text-white">
                            Live Space
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Active
                          </span>
                        </div>
                        <h3 className="text-lg font-black text-ink leading-snug">{room.title}</h3>
                        <p className="text-xs text-ink-600 line-clamp-2 font-medium">{room.description || 'Live audio briefing session.'}</p>
                      </div>
                      <div className="pt-4 border-t border-wire flex items-center justify-between gap-2">
                        <Link
                          href={`/rooms/${room.id}`}
                          className="flex-1 bg-signal text-white font-bold uppercase text-xs tracking-wider py-2.5 rounded-sm hover:bg-signal/90 transition-colors shadow-sm flex items-center justify-center gap-1.5 text-center"
                        >
                          <Play size={13} fill="currentColor" /> Join Space
                        </Link>
                        {isOwner && (
                          <button
                            onClick={() => handleDeleteRoom(room.id)}
                            className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white p-2.5 rounded-sm transition-colors border border-red-200"
                            title="Permanently Delete Room"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Campuses */}
          {profileTab === 'campuses' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4 bg-ink-50 p-4 border border-wire rounded-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-ink">
                  Registered University & Campus Editions
                </p>
                <Link
                  href="/campuses"
                  className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-5 py-2.5 rounded-sm hover:bg-signal/90 transition-colors shadow-sm inline-flex items-center gap-1.5"
                >
                  <Plus size={14} /> Register New Campus
                </Link>
              </div>
              {publisherCampuses.length === 0 ? (
                <div className="border border-dashed border-wire rounded-sm p-16 text-center bg-white">
                  <GraduationCap size={32} className="mx-auto text-ink-300 mb-3" />
                  <p className="text-lg font-bold text-ink mb-1">No registered campuses.</p>
                  <p className="text-xs text-ink-500 mb-4">You haven&apos;t registered any university campus editions yet.</p>
                  <Link
                    href="/campuses"
                    className="bg-ink text-white font-bold uppercase text-xs tracking-wider px-5 py-2.5 rounded-sm hover:bg-signal transition-colors inline-flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Register Campus Edition
                  </Link>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                  {publisherCampuses.map((campus) => (
                    <div key={campus.id} className="border-2 border-ink bg-white p-6 rounded-sm shadow-sm flex flex-col justify-between space-y-4 relative group">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-signal text-white">
                            Active Edition
                          </span>
                          <Globe size={16} className="text-ink-400" />
                        </div>
                        <h3 className="text-xl font-black text-ink uppercase tracking-tight">{campus.university_name}</h3>
                        <p className="text-xs text-ink-600 font-medium flex items-center gap-1.5">
                          <User size={14} className="text-signal" /> Rep: {campus.representative_name}
                        </p>
                        <p className="text-xs text-ink-600 font-medium flex items-center gap-1.5">
                          <Mail size={14} className="text-signal" /> {campus.contact_email}
                        </p>
                      </div>
                      <div className="pt-4 border-t border-wire flex items-center justify-between gap-2">
                        <Link
                          href="/campuses"
                          className="flex-1 bg-ink text-white font-bold uppercase text-[10px] tracking-wider py-2.5 rounded-sm hover:bg-signal transition-colors text-center"
                        >
                          View Campuses
                        </Link>
                        {isOwner && (
                          <button
                            onClick={() => handleDeleteCampus(campus.id)}
                            className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white p-2.5 rounded-sm transition-colors border border-red-200"
                            title="Delete Campus Edition"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 5: Jobs */}
          {profileTab === 'jobs' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4 bg-ink-50 p-4 border border-wire rounded-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-ink">
                  Job Listings Posted by {publisherName}
                </p>
                <Link
                  href="/jobs"
                  className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-5 py-2.5 rounded-sm hover:bg-signal/90 transition-colors shadow-sm inline-flex items-center gap-1.5"
                >
                  <Plus size={14} /> Post New Job
                </Link>
              </div>
              {publisherJobs.length === 0 ? (
                <div className="border border-dashed border-wire rounded-sm p-16 text-center bg-white">
                  <Briefcase size={32} className="mx-auto text-ink-300 mb-3" />
                  <p className="text-lg font-bold text-ink mb-1">No job listings.</p>
                  <p className="text-xs text-ink-500 mb-4">You haven&apos;t posted any job openings yet.</p>
                  <Link
                    href="/jobs"
                    className="bg-ink text-white font-bold uppercase text-xs tracking-wider px-5 py-2.5 rounded-sm hover:bg-signal transition-colors inline-flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Post Job
                  </Link>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                  {publisherJobs.map((job) => (
                    <div key={job.id} className="border-2 border-ink bg-white p-6 rounded-sm shadow-sm flex flex-col justify-between space-y-4 relative group">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-signal text-white">
                            Job Listing
                          </span>
                          <Briefcase size={16} className="text-ink-400" />
                        </div>
                        <h3 className="text-lg font-black text-ink uppercase tracking-tight">{job.title}</h3>
                        <p className="text-xs font-bold text-ink-600">{job.company}</p>
                        <p className="text-xs text-ink-500 line-clamp-2 font-medium">{job.description || job.snippet}</p>
                      </div>
                      <div className="pt-4 border-t border-wire flex items-center justify-between gap-2">
                        <Link
                          href="/jobs"
                          className="flex-1 bg-ink text-white font-bold uppercase text-[10px] tracking-wider py-2.5 rounded-sm hover:bg-signal transition-colors text-center"
                        >
                          View Job Board
                        </Link>
                        {isOwner && (
                          <button
                            onClick={() => handleDeleteJob(job.id)}
                            className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white p-2.5 rounded-sm transition-colors border border-red-200"
                            title="Delete Job Posting"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 6: Videos */}
          {profileTab === 'videos' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4 bg-ink-50 p-4 border border-wire rounded-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-ink">
                  Video Broadcasts by {publisherName}
                </p>
                {isOwner && (
                  <Link
                    href="/upload/video"
                    className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-5 py-2.5 rounded-sm hover:bg-signal/90 transition-colors shadow-sm inline-flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Upload Video
                  </Link>
                )}
              </div>
              {publisherVideos.length === 0 ? (
                <div className="border border-dashed border-wire rounded-sm p-16 text-center bg-white">
                  <Film size={32} className="mx-auto text-ink-300 mb-3" />
                  <p className="text-lg font-bold text-ink mb-1">No videos uploaded.</p>
                  <p className="text-xs text-ink-500 mb-4">
                    {isOwner ? "You haven't uploaded any video broadcasts yet." : "This publisher hasn't uploaded any videos yet."}
                  </p>
                  {isOwner && (
                    <Link
                      href="/upload/video"
                      className="bg-ink text-white font-bold uppercase text-xs tracking-wider px-5 py-2.5 rounded-sm hover:bg-signal transition-colors inline-flex items-center gap-1.5"
                    >
                      <Plus size={14} /> Upload Video Broadcast
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                  {publisherVideos.map((video) => (
                    <VideoCard key={video.id} video={video} showPublisher={false} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ⭐ NEW FEATURE 8: Tab — Partner Earnings (public view) ⭐ */}
          {profileTab === 'earnings' && isPartner && (
            <div className="border border-wire bg-white rounded-md p-10 text-center shadow-sm">
              <Crown size={28} className="mx-auto text-amber-500 mb-3" />
              <p className="text-sm font-medium text-ink-500">
                {publisherName} is part of the OpinionPlus Partner Program.
              </p>
              {isOwner && (
                <Link href="/partner" className="inline-flex items-center gap-2 mt-4 text-xs font-bold uppercase tracking-widest text-signal hover:underline">
                  View Full Partner Dashboard →
                </Link>
              )}
            </div>
          )}
        </section>

        {/* ⭐ NEW FEATURE 15: ENDORSEMENTS SECTION ⭐ */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 py-8 md:py-10">
          <SectionHeader
            title="Endorsements"
            icon={ThumbsUp}
            description={`Publishers who vouch for ${publisherName}'s expertise`}
          />
          <div className="space-y-3 mb-6">
            {endorsements.length === 0 ? (
              <p className="text-xs text-ink-400 font-medium italic">No endorsements yet.</p>
            ) : (
              endorsements.map((e, idx) => (
                <div key={`${e.endorser_id}-${e.topic}-${idx}`} className="flex items-center gap-2 bg-ink-50 border border-wire/60 rounded-sm px-4 py-3">
                  <Award size={14} className="text-signal shrink-0" />
                  <p className="text-sm font-medium text-ink">
                    Endorsed by <Link href={`/profile/${e.endorser_id}`} className="font-bold hover:text-signal">{e.endorser_name}</Link> for <span className="font-bold">{e.topic}</span>
                  </p>
                </div>
              ))
            )}
          </div>
          {user && !isOwner && (
            <div className="flex flex-col sm:flex-row gap-2 max-w-md">
              <input
                value={endorseTopic}
                onChange={(e) => setEndorseTopic(e.target.value)}
                placeholder="e.g., Technology, Politics..."
                className="flex-1 bg-white border-2 border-wire rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-ink transition-colors font-medium"
              />
              <button
                onClick={handleEndorse}
                disabled={isEndorsing}
                className="bg-ink text-white font-bold uppercase text-xs tracking-widest px-5 py-2.5 rounded-sm hover:bg-signal disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shrink-0 shadow-sm"
              >
                {isEndorsing ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
                Endorse
              </button>
            </div>
          )}
          {endorseError && <p className="text-xs font-bold text-red-500 mt-2">{endorseError}</p>}
        </section>
      </div>
    </div>
  );
}
