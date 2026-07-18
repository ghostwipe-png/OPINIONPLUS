'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Camera, Check, UserPlus, UserMinus, Key, Copy, Trash2, Plus, Terminal, Zap, BarChart3 } from 'lucide-react';
import { useStore } from '../../../lib/store';
import { useAuth } from '../../../lib/auth';
import StoryCard from '../../../components/StoryCard';
import ApiGuideModal from '../../../components/ApiGuideModal';
import SmsDashboard from '../../../components/SmsDashboard';
import { openCloudinaryWidget } from '../../../lib/mediaUpload';
import StoryTimeline from '../../../components/StoryTimeline';
import WalletDashboard from '../../../components/WalletDashboard';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
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

  // API Keys
  const [apiKeys, setApiKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState(null);
  const [showKeys, setShowKeys] = useState(false);
  const [showApiGuide, setShowApiGuide] = useState(false);

  // API Usage / Tier
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

  const revokeKey = async (id) => {
    try {
      await api(`/keys/${id}`, { method: 'DELETE' });
      fetchKeys();
    } catch (e) { console.error(e); }
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const res = await fetch(`${API_BASE}/payments/subscribe/pro`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
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

  useEffect(() => {
    if (isOwner) {
      fetchKeys();
      fetchApiUsage();
    }
  }, [isOwner]);

  if (!profile) {
    return <p className="max-w-2xl mx-auto px-5 py-24 text-center text-ink-400">Publisher not found.</p>;
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

  return (
    <div className="max-w-4xl mx-auto px-5 py-12">
      {showApiGuide && <ApiGuideModal onClose={() => setShowApiGuide(false)} />}

      <div className="flex items-start gap-6 flex-wrap">
        <div className="relative">
          <img
            src={editing ? form.logoUrl : profile.logoUrl}
            alt={profile.publisherName}
            className="w-24 h-24 rounded-full border-2 border-ink object-cover"
          />
          {editing && (
            <button onClick={changeLogo} className="absolute -bottom-1 -right-1 bg-ink text-paper w-8 h-8 rounded-full grid place-items-center" aria-label="Change logo">
              <Camera size={14} />
            </button>
          )}
        </div>

        <div className="flex-1 min-w-[240px]">
          {editing ? (
            <input value={form.publisherName} onChange={(e) => setForm((f) => ({ ...f, publisherName: e.target.value }))} className="editorial-h text-3xl font-bold border-b border-wire focus:border-ink outline-none w-full" />
          ) : (
            <h1 className="editorial-h text-3xl font-bold">{profile.publisherName}</h1>
          )}

          {profile.suspended && <p className="text-signal text-sm font-semibold mt-1">Account suspended</p>}

          <p className="text-xs text-ink-400 mt-1">
            {theirStories.length} post{theirStories.length === 1 ? '' : 's'} · {followerCount} follower{followerCount === 1 ? '' : 's'}
          </p>

          {editing ? (
            <textarea value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} rows={3} className="w-full text-sm border-b border-wire focus:border-ink outline-none mt-3 resize-none" placeholder="Bio" />
          ) : (
            <p className="text-sm text-ink-600 mt-3 max-w-lg">{profile.bio}</p>
          )}

          {editing && (
            <input value={form.socialLink || ''} onChange={(e) => setForm((f) => ({ ...f, socialLink: e.target.value }))} placeholder="Social link (optional)" className="w-full text-sm border-b border-wire focus:border-ink outline-none mt-3 py-1" />
          )}
          {!editing && profile.socialLink && (
            <a href={profile.socialLink} className="text-signal text-sm underline mt-2 inline-block">{profile.socialLink}</a>
          )}

          <div className="mt-5">
            {isOwner ? (
              editing ? (
                <button onClick={saveEdits} className="btn-primary px-4 py-2 rounded-sm text-sm flex items-center gap-2"><Check size={14} /> Save profile</button>
              ) : (
                <button onClick={() => { setForm(profile); setEditing(true); }} className="btn-outline px-4 py-2 rounded-sm text-sm">Edit profile</button>
              )
            ) : user ? (
              <button onClick={() => toggleFollow(user.id, id)} className={`px-4 py-2 rounded-sm text-sm flex items-center gap-2 ${iFollow ? 'btn-outline' : 'btn-primary'}`}>
                {iFollow ? <UserMinus size={14} /> : <UserPlus size={14} />}{iFollow ? 'Following' : 'Follow'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* API Tier Section */}
      {isOwner && (
        <div className="rule mt-10 pt-8">
          <div className="flex items-center justify-between mb-5">
            <span className="wire-tag flex items-center gap-2"><BarChart3 size={14} /> API Access</span>
            <span className={`text-xs font-semibold flex items-center gap-1 ${isPro ? 'text-ink-600' : 'text-ink-400'}`}>
              <Zap size={12} className={isPro ? 'text-signal' : ''} />
              {isPro ? 'Pro — Unlimited' : `Free — ${apiUsage?.calls_today || 0}/50 calls today`}
            </span>
          </div>
          {!isPro && !isAdminUser && (
            <div className="bg-ink-50 border border-wire rounded-sm p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Upgrade to Pro</p>
                <p className="text-xs text-ink-400">Unlimited API calls · KES 300/month</p>
              </div>
              <button onClick={handleUpgrade} disabled={upgrading} className="btn-primary px-4 py-2 rounded-sm text-sm">
                {upgrading ? 'Redirecting...' : 'Upgrade'}
              </button>
            </div>
          )}
          {isAdminUser && (
            <p className="text-xs text-ink-400">Admin access — all features unlocked.</p>
          )}
        </div>
      )}

      {/* API Keys Section */}
      {isOwner && (
        <div className="rule mt-10 pt-8">
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => { setShowKeys(!showKeys); if (!showKeys) fetchKeys(); }} className="wire-tag flex items-center gap-2 hover:text-signal transition-colors">
              <Key size={14} /> API Keys {showKeys ? '▲' : '▼'}
            </button>
            <button onClick={() => setShowApiGuide(true)} className="text-xs font-semibold text-ink-400 hover:text-signal transition-colors flex items-center gap-1">
              <Terminal size={12} /> API GUIDE
            </button>
          </div>

          {showKeys && (
            <div className="space-y-4">
              <p className="text-sm text-ink-400">Generate API keys to syndicate your stories to external sites.</p>
              <div className="flex gap-2 max-w-md">
                <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Key name (e.g. My Website)" className="flex-1 border border-wire rounded-sm px-3 py-2 text-sm" />
                <button onClick={generateKey} className="btn-primary px-4 py-2 rounded-sm text-sm flex items-center gap-1.5"><Plus size={14} /> Generate</button>
              </div>
              {newKey && (
                <div className="bg-ink-50 border border-signal rounded-sm p-4">
                  <p className="text-xs font-semibold text-signal mb-2">Copy this key now — you won&apos;t see it again!</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-paper border border-wire rounded-sm px-3 py-2 text-xs break-all font-mono">{newKey.key}</code>
                    <button onClick={() => navigator.clipboard.writeText(newKey.key)} className="btn-outline px-3 py-2 rounded-sm"><Copy size={14} /></button>
                  </div>
                </div>
              )}
              {apiKeys.length > 0 && (
                <div className="border border-wire rounded-sm divide-y divide-wire">
                  {apiKeys.map((k) => (
                    <div key={k.id} className="flex items-center justify-between p-3">
                      <div>
                        <p className="text-sm font-semibold">{k.name}</p>
                        <p className="text-xs text-ink-400 font-mono">{k.prefix}...</p>
                        <p className="text-xs text-ink-400">Created {new Date(k.created_at).toLocaleDateString()}{k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}</p>
                      </div>
                      <button onClick={() => revokeKey(k.id)} className="text-xs font-semibold text-signal flex items-center gap-1"><Trash2 size={13} /> Revoke</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Publishing Timeline */}
      <div className="rule mt-10 pt-8">
        <StoryTimeline userId={id} />
      </div>

      {/* Partner Wallet */}
      {isOwner && <WalletDashboard />}

      {/* SMS Dashboard */}
      {isOwner && <SmsDashboard />}

      {/* Published Stories */}
      <div className="rule mt-10 pt-8">
        <h2 className="wire-tag mb-5">Published</h2>
        {theirStories.length === 0 ? (
          <p className="text-sm text-ink-400">Nothing published yet.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {theirStories.map((s) => (<StoryCard key={s.id} story={s} />))}
          </div>
        )}
      </div>
    </div>
  );
}