// components/Footer.js
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Instagram, Linkedin, Twitter, Rss, ArrowUp, Check, Loader2, Mail, ArrowRight } from 'lucide-react';

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

// Supports JPG and PNG images in public/footer_images/ with automatic fallback
const FOOTER_IMAGES = [
  '/footer_images/footer-bg.png',
  '/footer_images/footer-bg.jpg',
  '/footer_images/image1.jpg',
  '/footer_images/image1.png',
  '/footer_images/image2.jpg',
  '/footer_images/image2.png',
  '/footer_images/background.jpg',
  '/footer_images/background.png',
  '/footer_images/footer.jpg',
  '/footer_images/footer.png',
  '/footer_images/1.jpg',
  '/footer_images/1.png',
  '/footer_images/2.jpg',
  '/footer_images/2.png',
  '/default-og-image.jpg'
];

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function Footer() {
  const pathname = usePathname();
  const [email, setEmail] = useState('');
  const [pref, setPref] = useState('all');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [imgIndex, setImgIndex] = useState(0);

  // Automatically hide the footer on any live room page (/rooms/[id])
  if (pathname && pathname.startsWith('/rooms/')) {
    return null;
  }

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
    <footer className="relative text-white mt-16 overflow-hidden bg-[#1C1917]">
      
      {/* ---------------- FULL BACKGROUND IMAGE DISPLAYED FROM AFAR ---------------- */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
        <img 
          src={FOOTER_IMAGES[imgIndex]} 
          alt="" 
          className="w-full h-full object-contain object-center opacity-30 scale-95"
          onError={() => {
            if (imgIndex < FOOTER_IMAGES.length - 1) {
              setImgIndex(prev => prev + 1);
            }
          }} 
        />
        {/* Dark overlay to ensure text readability */}
        <div className="absolute inset-0 bg-[#1C1917]/88" />
      </div>

      {/* ---------------- ENTIRE FOOTER CONTENT ---------------- */}
      <div className="relative z-10 max-w-6xl mx-auto px-5 pt-20 pb-12">
        
        {/* TOP CALLOUT BANNER */}
        <div className="max-w-4xl mx-auto text-center space-y-6 mb-20 pb-16 border-b border-white/10">
          <h3 className="editorial-h text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
            Want to publish independent stories and documentaries to the world?
          </h3>
          <p className="text-white/80 text-sm sm:text-base font-medium max-w-xl mx-auto">
            Take control of your narrative. Every voice deserves its own dedicated masthead and audience.
          </p>
          <div>
            <Link 
              href="/publish" 
              className="inline-flex items-center gap-2 bg-[#D97706] hover:bg-white hover:text-ink text-white font-extrabold uppercase text-xs tracking-wider px-8 py-4 rounded-sm transition-all shadow-xl"
            >
              Publish your story now <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* MAIN 4-COLUMN GRID */}
        <div className="grid gap-12 lg:grid-cols-12 mb-16">
          
          {/* BRANDING (Spans 4 cols) */}
          <div className="lg:col-span-4">
            <Link href="/" className="editorial-h text-2xl font-black tracking-tight inline-block mb-4 hover:opacity-90 transition-opacity">
              OPINION<span className="text-signal">PLUS</span>
            </Link>
            <p className="text-sm text-white/80 leading-relaxed max-w-sm mb-6 font-medium">
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
                  className="w-10 h-10 bg-white/10 grid place-items-center rounded-sm text-white/80 hover:text-white hover:bg-signal transition-colors focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none"
                >
                  <Icon size={18} fill={Icon === Twitter || Icon === Linkedin ? "currentColor" : "none"} />
                </a>
              ))}
            </div>
          </div>

          {/* QUICK LINKS (Spans 2 cols) */}
          <div className="lg:col-span-2">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-white/50 mb-5 pb-2">Explore</h4>
            <ul className="space-y-3 text-[13px] font-medium text-white/90">
              <li><Link href="/" className="hover:text-signal transition-colors focus-visible:outline-none focus-visible:text-signal">Feed</Link></li>
              <li><Link href="/campuses" className="hover:text-signal transition-colors focus-visible:outline-none focus-visible:text-signal">Campus</Link></li>
              <li><Link href="/jobs" className="hover:text-signal transition-colors focus-visible:outline-none focus-visible:text-signal">Jobs</Link></li>
              <li><Link href="/publish" className="hover:text-signal transition-colors focus-visible:outline-none focus-visible:text-signal">Publish story</Link></li>
            </ul>
          </div>

          {/* LEGAL & SUPPORT (Spans 2 cols) */}
          <div className="lg:col-span-2">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-white/50 mb-5 pb-2">Support</h4>
            <ul className="space-y-3 text-[13px] font-medium text-white/90">
              <li><Link href="/services" className="hover:text-signal transition-colors focus-visible:outline-none focus-visible:text-signal">Services</Link></li>
              <li><Link href="/pricing" className="hover:text-signal transition-colors focus-visible:outline-none focus-visible:text-signal">Partner</Link></li>
              <li><Link href="/privacy" className="hover:text-signal transition-colors focus-visible:outline-none focus-visible:text-signal">Privacy policy</Link></li>
            </ul>
          </div>

          {/* NEWSLETTER WIDGET (Spans 4 cols) */}
          <div className="lg:col-span-4 bg-white/10 p-6 rounded-xl backdrop-blur-sm border border-white/10 shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <Mail size={16} className="text-signal" />
              <h4 className="text-sm font-bold uppercase tracking-wide text-white">Daily Digest</h4>
            </div>
            <p className="text-xs text-white/80 mb-5 leading-relaxed">
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
                        : 'bg-white/15 text-white/80 hover:bg-white/25 hover:text-white'
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
                  className="w-full bg-black/40 border border-white/30 text-white placeholder-white/40 text-sm px-4 py-3 rounded-sm focus:outline-none focus:border-signal disabled:opacity-60 transition-colors" 
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
                  <p className="text-[11px] font-medium text-emerald-300 flex items-center gap-1">
                    <Check size={12} /> Subscribed to {pref === 'all' ? 'all content' : pref}.
                  </p>
                )}
              </div>
            </form>
          </div>

        </div>

        {/* BOTTOM BAR: Copyright & Scroll to top */}
        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-white/10 gap-4">
          <p className="text-[11px] font-medium text-white/60 tracking-wide text-center md:text-left">
            © {new Date().getFullYear()} OPINIONPLUS. Every byline belongs to the person who wrote it.
          </p>
          
          <button 
            onClick={scrollToTop} 
            title="Back to top"
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/60 hover:text-signal transition-colors group focus-visible:outline-none focus-visible:text-signal"
          >
            Back to top
            <span className="w-8 h-8 grid place-items-center rounded-sm border border-white/20 bg-white/10 group-hover:border-signal transition-colors">
              <ArrowUp size={14} />
            </span>
          </button>
        </div>

      </div>
    </footer>
  );
}