'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Instagram, Linkedin, Twitter, Rss, ArrowRight, ArrowUp, Check, Loader2 } from 'lucide-react';

const SOCIAL_LINKS = [
  { label: 'X (Twitter)', href: 'https://twitter.com/opinionplus', Icon: Twitter },
  { label: 'Instagram', href: 'https://instagram.com/opinionplus', Icon: Instagram },
  { label: 'LinkedIn', href: 'https://linkedin.com/company/opinionplus', Icon: Linkedin },
  { label: 'RSS feed', href: '/feed.xml', Icon: Rss },
];

const PREFERENCES = [
  { id: 'all', label: 'All' },
  { id: 'news', label: 'News' },
  { id: 'stories', label: 'Stories' },
  { id: 'documentaries', label: 'Docs' },
];

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function Footer() {
  const [email, setEmail] = useState('');
  const [pref, setPref] = useState('all');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setStatus('error');
      setError('Enter a valid email address.');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const res = await fetch(`${API_BASE}/subscriptions/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, preferences: pref }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setEmail('');
      } else {
        setStatus('error');
        setError(data.error || 'Failed to subscribe.');
      }
    } catch (err) {
      setStatus('error');
      setError('Something went wrong. Please try again.');
    }
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <footer className="border-t border-wire mt-24">
      <div className="max-w-6xl mx-auto px-5 py-12 grid gap-10 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Link href="/" className="editorial-h text-xl font-extrabold hover:opacity-80 transition-opacity">
            OPINION<span className="text-signal">PLUS</span>
          </Link>
          <p className="text-sm text-ink-400 mt-2 max-w-xs">
            A platform where every person gets a masthead — their name, their logo, their truth, at the top of the page.
          </p>
          <div className="flex items-center gap-3 mt-5">
            {SOCIAL_LINKS.map(({ label, href, Icon }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
                className="w-9 h-9 grid place-items-center rounded-full border border-wire text-ink-600 hover:text-signal hover:border-signal transition-colors">
                <Icon size={16} />
              </a>
            ))}
          </div>
        </div>

        <div>
          <p className="wire-tag mb-3">Read</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/" className="hover:text-signal transition-colors">Feed</Link></li>
            <li><Link href="/about" className="hover:text-signal transition-colors">About OpinionPlus</Link></li>
            <li><Link href="/publish" className="hover:text-signal transition-colors">Publish your story</Link></li>
          </ul>
        </div>

        <div>
          <p className="wire-tag mb-3">Legal &amp; support</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/privacy" className="hover:text-signal transition-colors">Privacy policy</Link></li>
            <li><Link href="/contact" className="hover:text-signal transition-colors">Contact us</Link></li>
          </ul>
        </div>
      </div>

      {/* Email Subscription */}
      <div className="rule">
        <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col sm:flex-row sm:items-start gap-5 justify-between">
          <div>
            <p className="wire-tag mb-1">Daily Digest</p>
            <p className="text-sm text-ink-400 max-w-sm">
              Get the best content delivered to your inbox. Pick your preference, unsubscribe anytime.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="w-full sm:w-auto space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {PREFERENCES.map(p => (
                <button key={p.id} type="button" onClick={() => setPref(p.id)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${pref === p.id ? 'bg-ink text-paper border-ink' : 'border-wire text-ink-600 hover:border-ink'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 sm:w-72">
                <input type="email" inputMode="email" autoComplete="email" value={email}
                  onChange={(e) => { setEmail(e.target.value); if (status === 'error') setStatus('idle'); }}
                  placeholder="you@example.com" aria-label="Email address" disabled={status === 'loading'}
                  className="w-full px-3 py-2 text-sm rounded-sm border border-wire bg-paper focus:outline-none focus:border-signal disabled:opacity-60" />
                {status === 'error' && <p className="text-xs text-signal mt-1">{error}</p>}
                {status === 'success' && (
                  <p className="text-xs text-ink-600 mt-1 flex items-center gap-1"><Check size={12} /> Subscribed to {pref === 'all' ? 'all' : pref}.</p>
                )}
              </div>
              <button type="submit" disabled={status === 'loading' || status === 'success'}
                className="btn-outline px-4 py-2 rounded-sm text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60 whitespace-nowrap">
                {status === 'loading' ? <><Loader2 size={13} className="animate-spin" /> Subscribing…</> : status === 'success' ? <><Check size={13} /> Subscribed</> : <><ArrowRight size={13} /> Subscribe</>}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="rule">
        <div className="max-w-6xl mx-auto px-5 py-5 flex items-center justify-between">
          <p className="text-xs text-ink-400">© {new Date().getFullYear()} OpinionPlus. Every byline belongs to the person who wrote it.</p>
          <button onClick={scrollToTop} title="Back to top"
            className="w-8 h-8 grid place-items-center rounded-full border border-wire text-ink-400 hover:text-signal hover:border-signal transition-colors">
            <ArrowUp size={14} />
          </button>
        </div>
      </div>
    </footer>
  );
}