'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Instagram, Linkedin, Twitter, Rss, ArrowUp, Check, Loader2, Mail } from 'lucide-react';

const SOCIAL_LINKS = [
  { label: 'X (Twitter)', href: 'https://twitter.com/opinionplus', Icon: Twitter },
  { label: 'Instagram', href: 'https://instagram.com/opinionplus', Icon: Instagram },
  { label: 'LinkedIn', href: 'https://linkedin.com/company/opinionplus', Icon: Linkedin },
  { label: 'RSS feed', href: '/feed.xml', Icon: Rss },
];

const PREFERENCES = [
  { id: 'all', label: 'All' },
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
    <footer className="bg-[#1C1917] text-white pt-16 pb-8 border-t-[6px] border-signal mt-16">
      <div className="max-w-6xl mx-auto px-5">
        
        {/* TOP ROW: 4-Column Grid */}
        <div className="grid gap-12 lg:grid-cols-12 mb-16">
          
          {/* BRANDING (Spans 4 cols) */}
          <div className="lg:col-span-4">
            <Link href="/" className="editorial-h text-2xl font-black tracking-tight inline-block mb-4 hover:opacity-90 transition-opacity">
              OPINION<span className="text-signal">PLUS</span>
            </Link>
            <p className="text-sm text-white/70 leading-relaxed max-w-sm mb-6 font-medium">
              Every story and documentary deserves its own stage. Your name, your logo, your truth at the top.
            </p>
            <div className="flex items-center gap-3">
              {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                <a 
                  key={label} 
                  href={href} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  aria-label={label}
                  className="w-10 h-10 bg-white/5 grid place-items-center rounded-sm text-white/70 hover:text-white hover:bg-signal transition-colors focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none"
                >
                  <Icon size={18} fill={Icon === Twitter || Icon === Linkedin ? "currentColor" : "none"} />
                </a>
              ))}
            </div>
          </div>

          {/* QUICK LINKS (Spans 2 cols) */}
          <div className="lg:col-span-2">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-5 pb-2 border-b border-white/10">Explore</h4>
            <ul className="space-y-3 text-[13px] font-medium text-white/80">
              <li><Link href="/" className="hover:text-signal transition-colors focus-visible:outline-none focus-visible:text-signal">Feed</Link></li>
              <li><Link href="/leaderboard" className="hover:text-signal transition-colors focus-visible:outline-none focus-visible:text-signal">Leaderboard</Link></li>
              <li><Link href="/publish" className="hover:text-signal transition-colors focus-visible:outline-none focus-visible:text-signal">Publish story</Link></li>
            </ul>
          </div>

          {/* LEGAL & SUPPORT (Spans 2 cols) */}
          <div className="lg:col-span-2">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-5 pb-2 border-b border-white/10">Support</h4>
            <ul className="space-y-3 text-[13px] font-medium text-white/80">
              <li><Link href="/about" className="hover:text-signal transition-colors focus-visible:outline-none focus-visible:text-signal">Guidelines</Link></li>
              <li><Link href="/privacy" className="hover:text-signal transition-colors focus-visible:outline-none focus-visible:text-signal">Privacy policy</Link></li>
            </ul>
          </div>

          {/* NEWSLETTER WIDGET (Spans 4 cols) */}
          <div className="lg:col-span-4 bg-white/5 p-6 rounded-sm border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <Mail size={16} className="text-signal" />
              <h4 className="text-sm font-bold uppercase tracking-wide text-white">Daily Digest</h4>
            </div>
            <p className="text-xs text-white/60 mb-5 leading-relaxed">
              Get top independent stories and documentaries delivered directly to your inbox.
            </p>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Preferences Row */}
              <div className="flex flex-wrap gap-2">
                {PREFERENCES.map(p => (
                  <button 
                    key={p.id} 
                    type="button" 
                    onClick={() => setPref(p.id)}
                    className={`text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-sm transition-colors focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none ${
                      pref === p.id 
                        ? 'bg-signal text-white' 
                        : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Input Row */}
              <div className="relative">
                <input 
                  type="email" 
                  inputMode="email" 
                  autoComplete="email" 
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (status === 'error') setStatus('idle'); }}
                  placeholder="Your email address" 
                  aria-label="Email address" 
                  disabled={status === 'loading' || status === 'success'}
                  className="w-full bg-[#1C1917] border border-white/20 text-white placeholder-white/30 text-sm px-4 py-3 rounded-sm focus:outline-none focus:border-signal disabled:opacity-60 transition-colors" 
                />
                <button 
                  type="submit" 
                  disabled={status === 'loading' || status === 'success'}
                  className="absolute right-1 top-1 bottom-1 bg-white text-ink hover:bg-signal hover:text-white px-4 font-bold text-[11px] uppercase tracking-wider rounded-sm transition-colors disabled:opacity-60 flex items-center justify-center min-w-[100px]"
                >
                  {status === 'loading' ? <Loader2 size={14} className="animate-spin" /> : 
                   status === 'success' ? <Check size={14} /> : 
                   'Subscribe'}
                </button>
              </div>

              {/* Status Messages */}
              <div className="min-h-[20px]">
                {status === 'error' && <p className="text-[11px] font-medium text-signal">{error}</p>}
                {status === 'success' && (
                  <p className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
                    <Check size={12} /> Subscribed to {pref === 'all' ? 'all content' : pref}.
                  </p>
                )}
              </div>
            </form>
          </div>

        </div>

        {/* BOTTOM BAR: Copyright & Scroll to top */}
        <div className="flex flex-col md:flex-row items-center justify-between pt-6 border-t border-white/10 gap-4">
          <p className="text-[11px] font-medium text-white/40 tracking-wide text-center md:text-left">
            © {new Date().getFullYear()} OPINIONPLUS. Every byline belongs to the person who wrote it.
          </p>
          
          <button 
            onClick={scrollToTop} 
            title="Back to top"
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-signal transition-colors group focus-visible:outline-none focus-visible:text-signal"
          >
            Back to top
            <span className="w-8 h-8 grid place-items-center rounded-sm border border-white/10 bg-white/5 group-hover:border-signal transition-colors">
              <ArrowUp size={14} />
            </span>
          </button>
        </div>

      </div>
    </footer>
  );
}