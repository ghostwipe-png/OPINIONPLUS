'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Camera, Check, UserPlus, UserMinus, Key, Copy, Trash2, Plus, Terminal, Zap, BarChart3, Newspaper, QrCode, X, Download, LayoutDashboard, ChevronDown, ChevronUp, CreditCard, MessageSquare, Activity, Film, Radio, Play, Lock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useStore } from '../../../lib/store';
import { useAuth } from '../../../lib/auth';
import StoryCard from '../../../components/StoryCard';
import ApiGuideModal from '../../../components/ApiGuideModal';
import SmsDashboard from '../../../components/SmsDashboard';
import { openCloudinaryWidget } from '../../../lib/mediaUpload';
import StoryTimeline from '../../../components/StoryTimeline';
import WalletDashboard from '../../../components/WalletDashboard';
import MastheadNewsletter from '../../../components/MastheadNewsletter';

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
  if (!res.ok) throw new Error('API request failed');
  return res.json();
}

export default function ProfilePage() {
  const { id } = useParams();
  const { users, stories, upsertUser, toggleFollow, follows } = useStore();
  const { user, updateProfile } = useAuth();

  const profile = users.find((u) => u.id === id);
  const isOwner = user?.id === id;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(profile || {});

  const [profileTab, setProfileTab] = useState('stories'); // 'stories' | 'documentaries' | 'rooms'
  const [publisherRooms, setPublisherRooms] = useState([]);

  const [apiKeys, setApiKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState(null);
  const [showKeys, setShowKeys] = useState(false);
  const [showApiGuide, setShowApiGuide] = useState(false);

  const [qrStory, setQrStory] = useState(null);
  const qrRef = useRef();

  const [apiUsage, setApiUsage] = useState(null);
  const [upgrading, setUpgrading] = useState(false);

  const isAdminUser = user?.role === 'admin' || user?.role === 'root';
  const isPro = isAdminUser || (apiUsage?.tier === 'pro' && apiUsage?.subscription_active);

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
      const csrfRes = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
      const csrfData = await csrfRes.json();

      const res = await fetch(`${API_BASE}/payments/subscribe/pro`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfData.token || '',
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

  useEffect(() => {
    if (isOwner) {
      fetchKeys();
      fetchApiUsage();
    }
    if (id) {
      fetch(`${API_BASE}/rooms`)
        .then((r) => r.json())
        .then((data) => {
          const rooms = data.rooms || [];
          setPublisherRooms(rooms.filter((r) => r.host_id === id));
        })
        .catch(() => {});
    }
  }, [isOwner, id]);

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

  // Normalized filtering and sorting
  const userStories = stories
    .filter((s) => (s.authorId === id || s.author_id === id) && !s.deleted)
    .filter((s) => (s.type === 'story' || !s.type) && (s.privacy === 'public' || isOwner))
    .sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));

  const userDocumentaries = stories
    .filter((s) => (s.authorId === id || s.author_id === id) && !s.deleted)
    .filter((s) => s.type === 'documentary' && (s.privacy === 'public' || isOwner))
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

  const SectionHeader = ({ title, icon: Icon, rightAction, description }) => (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-wire pb-4 mb-6">
      <div>
        <h2 className="text-lg font-black text-ink uppercase tracking-tight flex items-center gap-2">
          {Icon && <Icon size={18} className="text-signal" />} {title}
        </h2>
        {description && <p className="text-xs font-medium text-ink-500 mt-1">{description}</p>}
      </div>
      {rightAction && <div className="mt-3 sm:mt-0">{rightAction}</div>}
    </div>
  );

  const publisherName = profile.publisherName || profile.publisher_name;
  const logoUrl = profile.logoUrl || profile.logo_url;

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

      {/* 🌟 1. MASTHEAD HERO SECTION */}
      <div className="bg-ink text-white relative overflow-hidden border-b-4 border-signal">
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent"></div>
        
        <div className="max-w-6xl mx-auto px-5 pt-20 pb-20 relative z-10">
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
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none uppercase text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
                      {publisherName}
                    </h1>
                  )}
                  {profile.suspended && (
                    <span className="inline-block bg-red-500 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-sm mt-3 shadow-md">
                      Account Suspended
                    </span>
                  )}
                </div>

                <div className="shrink-0 flex items-center justify-center">
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
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-[11px] font-black uppercase tracking-widest text-white/60 mb-5 bg-white/5 inline-flex px-4 py-2 rounded-sm border border-white/10 backdrop-blur-sm w-fit mx-auto md:mx-0">
                <span className="flex items-center gap-1.5"><Newspaper size={14} className="text-signal" /> {userStories.length + userDocumentaries.length} Published</span>
                <span className="opacity-30">•</span>
                <span className="flex items-center gap-1.5"><UserPlus size={14} className="text-signal" /> {followerCount} Followers</span>
                <span className="opacity-30">•</span>
                <span className="flex items-center gap-1.5"><Radio size={14} className="text-signal" /> {publisherRooms.length} Live Rooms</span>
              </div>

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

      <div className="max-w-6xl mx-auto px-5 pt-10 pb-12 space-y-12">
        
        {/* 🌟 2. DASHBOARD / COMMAND CENTER (Horizontal Architecture for Owners) */}
        {isOwner && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2 text-ink mb-2">
              <LayoutDashboard size={20} className="text-signal" />
              <h2 className="text-xl font-black uppercase tracking-tight">Command Center</h2>
            </div>

            {/* ROW 1: Essentials (Wallet & SMS) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
          </div>
        )}

        {/* 🌟 3. COMMUNITY & NEWSLETTER */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <MastheadNewsletter publisherId={id} publisherName={publisherName} />
        </section>

        {/* 🌟 4. PORTFOLIO TABS (Stories, Documentaries, Live Audio Rooms) */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center gap-3 border-b-2 border-wire pb-4 mb-8 flex-wrap">
            <button
              onClick={() => setProfileTab('stories')}
              className={`text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-sm transition-colors flex items-center gap-2 ${
                profileTab === 'stories' ? 'bg-ink text-white' : 'bg-ink-50 text-ink hover:bg-ink-100'
              }`}
            >
              <Newspaper size={14} /> Stories ({userStories.length})
            </button>
            <button
              onClick={() => setProfileTab('documentaries')}
              className={`text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-sm transition-colors flex items-center gap-2 ${
                profileTab === 'documentaries' ? 'bg-ink text-white' : 'bg-ink-50 text-ink hover:bg-ink-100'
              }`}
            >
              <Film size={14} /> Documentaries ({userDocumentaries.length})
            </button>
            <button
              onClick={() => setProfileTab('rooms')}
              className={`text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-sm transition-colors flex items-center gap-2 ${
                profileTab === 'rooms' ? 'bg-signal text-white' : 'bg-ink-50 text-ink hover:bg-ink-100'
              }`}
            >
              <Radio size={14} className={publisherRooms.length > 0 ? 'animate-pulse text-signal' : ''} /> Live Audio Rooms ({publisherRooms.length})
            </button>
          </div>

          {/* Tab 1: Stories */}
          {profileTab === 'stories' && (
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
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {userStories.map((s) => (
                    <div key={s.id} className="bg-white border border-wire rounded-md flex flex-col justify-between shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden">
                      <StoryCard story={s} />
                      
                      {isOwner && (
                        <div className="px-4 py-3 border-t border-wire bg-ink-50/50 flex justify-end">
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
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {userDocumentaries.map((s) => (
                    <div key={s.id} className="bg-white border border-wire rounded-md flex flex-col justify-between shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden">
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
                  <Link
                    href="/rooms"
                    className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-4 py-2 rounded-sm hover:bg-signal/90 transition-colors shadow-sm inline-flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Host New Room
                  </Link>
                )}
              </div>

              {publisherRooms.length === 0 ? (
                <div className="border border-dashed border-wire rounded-sm p-16 text-center bg-white">
                  <Radio size={32} className="mx-auto text-ink-300 mb-3" />
                  <p className="text-lg font-bold text-ink mb-1">No active audio rooms.</p>
                  <p className="text-xs text-ink-500">This publisher is not currently hosting any live discussions.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {publisherRooms.map((room) => (
                    <div key={room.id} className="border-2 border-ink bg-white p-6 rounded-sm shadow-sm flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-signal text-white">
                            {room.category}
                          </span>
                          {room.is_premium ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-amber-100 text-amber-800 flex items-center gap-1">
                              <Lock size={10} /> KES {(room.price_cents / 100).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-emerald-100 text-emerald-800">
                              Free
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-black text-ink leading-snug">{room.title}</h3>
                        <p className="text-xs text-ink-600 line-clamp-2 font-medium">{room.description || 'Live audio briefing.'}</p>
                      </div>

                      <div className="pt-4 border-t border-wire flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Live Now
                        </span>
                        <Link
                          href={`/rooms/${room.id}`}
                          className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-4 py-2.5 rounded-sm hover:bg-signal/90 transition-colors shadow-sm flex items-center gap-1.5"
                        >
                          <Play size={13} fill="currentColor" /> Join
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}