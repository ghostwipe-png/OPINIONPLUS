'use client';

import { useState } from 'react';
import { Mail, CheckCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function MastheadNewsletter({ publisherId, publisherName }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    
    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch(`${API_BASE}/users/${publisherId}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to subscribe.');
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message);
    }
  };

  return (
    <div className="bg-ink text-white p-6 rounded-sm border border-wire shadow-sm my-8">
      <div className="flex items-center gap-2 text-signal text-xs font-bold uppercase tracking-wider mb-2">
        <Mail size={14} /> Masthead Dispatch
      </div>
      <h3 className="text-lg font-bold mb-1">Get dispatches from {publisherName}</h3>
      <p className="text-xs text-white/70 mb-4 font-medium">
        Subscribe to receive direct email alerts whenever {publisherName} publishes a new story or documentary.
      </p>

      {status === 'success' ? (
        <div className="bg-emerald-900/50 border border-emerald-500/50 text-emerald-200 p-3 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <CheckCircle size={15} /> Subscribed successfully to {publisherName}&apos;s masthead!
        </div>
      ) : (
        <form onSubmit={handleSubscribe} className="flex gap-2 flex-wrap">
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address..." 
            required
            className="flex-1 bg-paper text-ink text-xs font-medium px-4 py-3 rounded-sm border border-wire focus:outline-none focus:border-signal"
          />
          <button 
            type="submit" 
            disabled={status === 'loading'}
            className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-6 py-3 rounded-sm hover:bg-signal/90 transition-colors shadow-sm disabled:opacity-50"
          >
            {status === 'loading' ? 'Joining...' : 'Subscribe'}
          </button>
        </form>
      )}

      {status === 'error' && (
        <p className="text-signal text-[11px] font-bold uppercase tracking-wider mt-2">{errorMessage}</p>
      )}
    </div>
  );
}