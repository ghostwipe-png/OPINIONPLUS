'use client';

import { useState } from 'react';
import { Mail, Check, Loader2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

const PREFERENCES = [
  { id: 'all', label: 'All Content' },
  { id: 'news', label: 'News Only' },
  { id: 'stories', label: 'Stories Only' },
  { id: 'documentaries', label: 'Documentaries' },
];

export default function EmailSubscribe() {
  const [email, setEmail] = useState('');
  const [pref, setPref] = useState('all');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const subscribe = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/subscriptions/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, preferences: pref }),
      });
      const data = await res.json();
      if (res.ok) { setDone(true); }
      else { setError(data.error || 'Failed to subscribe.'); }
    } catch (e) { setError('Network error.'); }
    setLoading(false);
  };

  if (done) {
    return (
      <div className="bg-ink-50 border border-wire rounded-sm p-4 text-center">
        <Check size={20} className="mx-auto mb-2 text-ink-600" />
        <p className="text-sm font-semibold">You're subscribed!</p>
        <p className="text-xs text-ink-400">We'll send {pref === 'all' ? 'all content' : pref} to your inbox.</p>
      </div>
    );
  }

  return (
    <div className="border border-wire rounded-sm p-4">
      <p className="wire-tag flex items-center gap-2 mb-3"><Mail size={13} /> Daily Digest</p>
      <p className="text-xs text-ink-400 mb-3">Get the best content delivered to your inbox.</p>
      
      <div className="flex flex-wrap gap-1.5 mb-3">
        {PREFERENCES.map(p => (
          <button key={p.id} onClick={() => setPref(p.id)}
            className={`text-xs px-2 py-1 rounded-full border ${pref === p.id ? 'bg-ink text-paper border-ink' : 'border-wire text-ink-600'}`}>
            {p.label}
          </button>
        ))}
      </div>

      <form onSubmit={subscribe} className="flex gap-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@email.com"
          className="flex-1 border border-wire rounded-sm px-3 py-2 text-sm" required />
        <button type="submit" disabled={loading}
          className="btn-primary px-4 py-2 rounded-sm text-sm flex items-center gap-1.5 disabled:opacity-50">
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'Subscribe'}
        </button>
      </form>
      {error && <p className="text-xs text-signal mt-2">{error}</p>}
    </div>
  );
}