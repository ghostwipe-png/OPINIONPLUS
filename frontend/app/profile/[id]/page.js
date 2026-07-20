'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Camera, Check, UserPlus, UserMinus, Key, Copy, Trash2, Plus, Terminal, Zap, BarChart3, Newspaper, QrCode, X, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react'; // ⚡ NEW: QR Code library
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

  // API Keys State
  const [apiKeys, setApiKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState(null);
  const [showKeys, setShowKeys] = useState(false);
  const [showApiGuide, setShowApiGuide] = useState(false);

  // QR Code State
  const [qrStory, setQrStory] = useState(null);
  const qrRef = useRef();

  // API Usage / Tier State
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

  // ⚡ NEW: Download QR Code as PNG
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
  }, [isOwner]);

  if (!profile) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-xl font-bold text-ink-400">Publisher not found.</p>
      </div>
    );
  }

  const theirStories = stories
    .filter((s) => s.authorId === id && !s.deleted)
    .filter((s) => s.privacy === 'public' || isOwner)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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

  const SectionHeader = ({ title, icon: Icon, rightAction }) => (
    <div className="flex items-end justify-between border-b-2 border-wire/60 mb-6">
      <div className="bg-ink text-white font-bold uppercase text-xs px-4 py-2 shrink-0 flex items-center gap-2">
        {Icon && <Icon size={14} />} {title}
      </div>
      {rightAction && <div className="mb-1">{rightAction}</div>}
    </div>
  );

  return (
    <div className="bg-paper min-h-screen pb-20 relative">
      {showApiGuide && <ApiGuideModal onClose={() => setShowApiGuide(false)} />}

      {/* ⚡ NEW: QR Code Modal */}
      {qrStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-paper border border-wire rounded-sm max-w-sm w-full p-6 relative shadow-2xl">
            <button onClick={() => setQrStory(null)} className="absolute top-4 right-4 text-ink-400 hover:text-ink transition-colors">
              <X size={20} />
            </button>
            <h3 className="text-lg font-black text-ink mb-1 uppercase tracking-tight">Story QR Code</h3>
            <p className="text-xs text-ink-500 mb-6 truncate">{qrStory.title}</p>
            <div ref={qrRef} className="bg-white p-6 rounded-sm border border-wire flex justify-center mb-6">
              <QRCodeSVG 
                value={`${typeof window !== 'undefined' ? window.location.origin : 'https://opinionplus.online'}/story/${qrStory.id}`} 
                size={220} 
                level="H" 
                includeMargin={true} 
              />
            </div>
            <div className="flex gap-3">
              <button onClick={downloadQRCode} className="flex-1 bg-ink text-white font-bold uppercase text-xs tracking-wider py-3 rounded-sm hover:bg-signal transition-colors flex items-center justify-center gap-2">
                <Download size={14} /> Download PNG
              </button>
              <button onClick={() => setQrStory(null)} className="px-6 border-2 border-wire text-ink font-bold uppercase text-xs tracking-wider py-3 rounded-sm hover:border-ink transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PREMIUM MASTHEAD HEADER */}
      <div className="bg-ink text-white pt-16 pb-16 border-b-4 border-signal">
        <div className="max-w-5xl mx-auto px-5">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <div className="relative shrink-0 group">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-sm overflow-hidden border-2 border-white/20 bg-ink-800 shadow-xl">
                <img src={editing ? form.logoUrl : profile.logoUrl} alt={profile.publisherName} className="w-full h-full object-cover" />
              </div>
              {editing && (
                <button onClick={changeLogo} className="absolute bottom-2 right-2 bg-signal text-white p-2 rounded-sm shadow-lg hover:bg-white hover:text-signal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Change logo">
                  <Camera size={16} />
                </button>
              )}
            </div>

            <div className="flex-1 min-w-0 text-center md:text-left w-full">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div className="flex-1">
                  {editing ? (
                    <input value={form.publisherName} onChange={(e) => setForm((f) => ({ ...f, publisherName: e.target.value }))} className="w-full bg-white/10 border border-white/20 text-white text-3xl md:text-4xl font-black tracking-tight px-3 py-1 rounded-sm focus:outline-none focus:border-signal" />
                  ) : (
                    <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-none uppercase">{profile.publisherName}</h1>
                  )}
                  {profile.suspended && <span className="inline-block bg-signal text-white text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm mt-2">Account suspended</span>}
                </div>
                <div className="shrink-0">
                  {isOwner ? (
                    editing ? (
                      <button onClick={saveEdits} className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-6 py-2.5 rounded-sm hover:bg-white hover:text-signal transition-colors flex items-center justify-center gap-2 w-full md:w-auto">
                        <Check size={14} /> Save Profile
                      </button>
                    ) : (
                      <button onClick={() => { setForm(profile); setEditing(true); }} className="border border-white/40 text-white font-bold uppercase text-xs tracking-wider px-6 py-2.5 rounded-sm hover:bg-white hover:text-ink transition-colors w-full md:w-auto">
                        Edit Profile
                      </button>
                    )
                  ) : user ? (
                    <button onClick={() => toggleFollow(user.id, id)} className={`font-bold uppercase text-xs tracking-wider px-6 py-2.5 rounded-sm flex items-center justify-center gap-2 transition-colors w-full md:w-auto ${iFollow ? 'border border-white/40 text-white hover:bg-white/10' : 'bg-signal text-white hover:bg-signal/90'}`}>
                      {iFollow ? <UserMinus size={14} /> : <UserPlus size={14} />}{iFollow ? 'Following' : 'Follow'}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center justify-center md:justify-start gap-4 text-xs font-bold uppercase tracking-widest text-white/50 mb-4">
                <span>{theirStories.length} Published</span>
                <span>•</span>
                <span>{followerCount} Followers</span>
              </div>
              {editing ? (
                <div className="space-y-3 mt-2">
                  <textarea value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} rows={3} className="w-full bg-white/10 border border-white/20 text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-signal resize-none placeholder-white/40" placeholder="Tell your story..." />
                  <input value={form.socialLink || ''} onChange={(e) => setForm((f) => ({ ...f, socialLink: e.target.value }))} placeholder="Website or Social link (optional)" className="w-full bg-white/10 border border-white/20 text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-signal placeholder-white/40" />
                </div>
              ) : (
                <>
                  <p className="text-sm md:text-base text-white/80 max-w-2xl font-medium leading-relaxed">{profile.bio || "This publisher hasn't written a bio yet."}</p>
                  {profile.socialLink && (
                    <a href={profile.socialLink} target="_blank" rel="noopener noreferrer" className="inline-block text-signal text-sm font-bold mt-3 hover:text-white transition-colors underline decoration-signal/30 underline-offset-4">
                      {profile.socialLink.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 py-12 space-y-16">
        
        {/* DASHBOARDS (Only visible to owner) */}
        {isOwner && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-7 space-y-10">
              <section>
                <SectionHeader title="API Access" icon={BarChart3} rightAction={
                  <span className={`text-[11px] font-bold uppercase tracking-widest flex items-center gap-1 ${isPro ? 'text-signal' : 'text-ink-400'}`}>
                    <Zap size={12} fill={isPro ? "currentColor" : "none"} />
                    {isPro ? 'Pro — Unlimited' : `Free — ${apiUsage?.calls_today || 0}/50 today`}
                  </span>
                } />
                {!isPro && !isAdminUser && (
                  <div className="bg-white border border-wire rounded-sm p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <p className="text-base font-bold text-ink">Upgrade to Pro</p>
                      <p className="text-xs font-medium text-ink-500 mt-1">Unlimited API calls · KES 400 one-time</p>
                    </div>
                    <button onClick={handleUpgrade} disabled={upgrading} className="bg-ink text-white font-bold uppercase text-[11px] tracking-wider px-6 py-3 rounded-sm hover:bg-signal transition-colors w-full sm:w-auto">
                      {upgrading ? 'Redirecting...' : 'Upgrade — KES 400'}
                    </button>
                  </div>
                )}
                {isAdminUser && (
                  <p className="text-xs font-bold text-signal uppercase tracking-widest bg-signal/10 inline-block px-3 py-1.5 rounded-sm">
                    Admin access — all limits lifted.
                  </p>
                )}
              </section>

              {/* API Keys Card */}
              <section>
                <SectionHeader 
                  title={`API Keys ${showKeys ? '▲' : '▼'}`} 
                  icon={Key} 
                  rightAction={
                    <button onClick={() => setShowApiGuide(true)} className="text-[10px] font-bold text-ink hover:text-signal uppercase tracking-widest transition-colors flex items-center gap-1 bg-wire/30 px-2 py-1 rounded-sm">
                      <Terminal size={12} /> View Guide
                    </button>
                  } 
                />
                <button onClick={() => { setShowKeys(!showKeys); if (!showKeys) fetchKeys(); }} className="absolute -mt-12 h-10 w-40 opacity-0 cursor-pointer" aria-label="Toggle API Keys" />

                {showKeys && (
                  <div className="bg-white border border-wire rounded-sm p-6 shadow-sm space-y-6">
                    <p className="text-sm font-medium text-ink-600">Generate API keys to syndicate your stories to external sites.</p>
                    
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input 
                        value={newKeyName} 
                        onChange={(e) => setNewKeyName(e.target.value)} 
                        placeholder="Key name (e.g. My Website)" 
                        className="flex-1 bg-paper border border-wire rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-ink" 
                      />
                      <button onClick={generateKey} disabled={!newKeyName.trim()} className="bg-ink text-white font-bold uppercase text-xs tracking-wider px-6 py-2.5 rounded-sm hover:bg-signal disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shrink-0">
                        <Plus size={14} /> Generate
                      </button>
                    </div>
                    
                    {newKey && (
                      <div className="bg-signal/10 border border-signal text-ink rounded-sm p-4 shadow-sm">
                        <p className="text-xs font-bold text-signal uppercase tracking-widest mb-3">Copy this key now — you won&apos;t see it again!</p>
                        <div className="flex items-center gap-2 bg-white p-1.5 rounded-sm border border-wire">
                          <code className="flex-1 px-3 py-1 text-xs break-all font-mono text-ink">{newKey.key}</code>
                          <button onClick={() => navigator.clipboard.writeText(newKey.key)} className="bg-ink text-white hover:bg-signal transition-colors px-3 py-2 text-[10px] font-bold uppercase tracking-wider rounded-sm flex items-center gap-1">
                            <Copy size={12} /> Copy
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-3 pt-2">
                      {apiKeys.length === 0 ? (
                         <p className="text-xs text-ink-400 italic">No API keys active.</p>
                      ) : (
                        <div className="border border-wire rounded-sm divide-y divide-wire">
                          {apiKeys.map((k) => (
                            <div key={k.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 bg-paper/50">
                              <div>
                                <p className="text-sm font-bold text-ink">{k.name}</p>
                                <p className="text-[11px] font-mono text-ink-500 mt-1">{k.prefix}••••••••••••</p>
                                <p className="text-[10px] uppercase tracking-wider text-ink-400 mt-1">
                                  Created {new Date(k.created_at).toLocaleDateString()} {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                                </p>
                              </div>
                              <button onClick={() => revokeKey(k.id)} className="text-[10px] font-bold text-ink-400 hover:text-signal transition-colors flex items-center gap-1.5 uppercase tracking-wider px-3 py-2 border border-wire rounded-sm hover:border-signal">
                                <Trash2 size={13} /> Revoke
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            </div>

            <div className="lg:col-span-5 space-y-10">
              <section><SmsDashboard /></section>
              <section><WalletDashboard /></section>
              <section><StoryTimeline userId={id} /></section>
            </div>
          </div>
        )}

        <section>
          <MastheadNewsletter publisherId={id} publisherName={profile.publisherName} />
        </section>

        <section>
          <SectionHeader title="Published Stories" icon={Newspaper} />
          
          {theirStories.length === 0 ? (
            <div className="border border-dashed border-wire bg-white rounded-sm p-12 text-center">
              <p className="text-lg font-bold text-ink mb-1">No stories yet.</p>
              <p className="text-sm text-ink-500">When this publisher releases content, it will appear here.</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {theirStories.map((s) => (
                <div key={s.id} className="relative group">
                  <StoryCard story={s} />
                  
                  {/* ⚡ NEW: Creator Action Overlay for QR Generation */}
                  {isOwner && (
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <button 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQrStory(s); }}
                        className="bg-white/90 backdrop-blur-sm text-ink border border-wire p-2 rounded-full shadow-lg hover:bg-signal hover:text-white hover:border-signal transition-all"
                        title="Generate QR Code"
                      >
                        <QrCode size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}