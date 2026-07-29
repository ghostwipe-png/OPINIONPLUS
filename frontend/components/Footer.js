// components/Footer.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Instagram, Linkedin, Twitter, Rss, ArrowUp, Check, Loader2, Mail, ArrowRight,
  Activity, Tag, MessageCircle, TrendingUp, Users, BookOpen, Globe, Shield, Code
} from 'lucide-react';

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

const EXPLORE_LINKS = [
  { label: 'Feed', href: '/' },
  { label: 'Stories', href: '/?type=story' },
  { label: 'Documentaries', href: '/?type=documentary' },
  { label: 'Videos', href: '/videos' },
  { label: 'Campus Editions', href: '/campuses' },
  { label: 'Jobs Board', href: '/jobs' },
  { label: 'Live Spaces', href: '/rooms' },
];

const SERVICE_LINKS = [
  { label: 'All Services', href: '/services' },
  { label: 'SMS Broadcasting', href: '/services/sms' },
  { label: 'Press Releases', href: '/services/press-release' },
  { label: 'Sponsored Content', href: '/services/sponsored' },
  { label: 'Developer API', href: '/services/api' },
  { label: 'Partner Program', href: '/pricing' },
];

const SUPPORT_LINKS = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Accessibility', href: '/accessibility' },
  { label: 'Platform Status', href: '/health' },
  { label: 'Press & Media Kit', href: '/press' },
  { label: 'Cookie Settings', href: '#cookie-settings' },
];

const TOP_TAGS = [
  'Politics', 'Technology', 'Business', 'Health', 'Education',
  'Climate', 'Sports', 'Entertainment', 'Finance', 'Agriculture'
];

const FOOTER_IMAGES = [
  '/footer_images/footer-bg.jpg',
  '/footer_images/footer-bg.png',
  '/footer_images/image1.jpg',
  '/footer_images/image1.png',
  '/footer_images/image2.jpg',
  '/footer_images/image2.png',
  '/footer_images/background.jpg',
  '/footer_images/background.png',
  '/footer_images/footer.jpg',
  '/footer_images/footer.png',
  '/default-og-image.jpg'
];

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function CountUp({ end, duration = 2000 }) {
  const [value, setValue] = useState(0);
  const [inView, setInView] = useState(false);
  const ref = useState(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    let frame, start = null;
    const step = (ts) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setValue(Math.floor(progress * end));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [inView, end, duration]);

  return <span ref={ref}>{value.toLocaleString()}</span>;
}

export default function Footer() {
  const pathname = usePathname();
  const [email, setEmail] = useState('');
  const [pref, setPref] = useState('all');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [imgIndex, setImgIndex] = useState(0);
  const [uptime, setUptime] = useState(null);
  const [showSitemap, setShowSitemap] = useState(false);

  const fetchUptime = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/uptime/public`);
      const data = await res.json();
      setUptime(data.uptime);
    } catch (e) { /* silently fail */ }
  }, []);

  useEffect(() => {
    fetchUptime();
  }, [fetchUptime]);

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

  const shareWhatsApp = () => {
    window.open('https://wa.me/254112696334', '_blank');
  };

  return (
    <footer className="relative text-white mt-16 overflow-hidden bg-[#1C1917]">
      
      {/* BACKGROUND IMAGE */}
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
        <div className="absolute inset-0 bg-[#1C1917]/88" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-5 pt-20 pb-12">
        
        {/* ════════════ COMMUNITY STATS BAR ════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20 pb-16 border-b border-white/10">
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-black text-white tabular-nums">
              <CountUp end={12400} />+
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/50 mt-2">Active Publishers</p>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-black text-white tabular-nums">
              <CountUp end={89000} />+
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/50 mt-2">Stories Published</p>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-black text-white tabular-nums">
              <CountUp end={450000} />+
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/50 mt-2">Monthly Readers</p>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-black text-emerald-400 tabular-nums">
              {uptime !== null ? `${uptime}%` : '—'}
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/50 mt-2 flex items-center justify-center gap-1.5">
              <Activity size={12} className="text-emerald-400" /> Uptime This Month
            </p>
          </div>
        </div>

        {/* ════════════ TOP CALLOUT BANNER ════════════ */}
        <div className="max-w-4xl mx-auto text-center space-y-6 mb-20 pb-16 border-b border-white/10">
          <h3 className="editorial-h text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
            Want to publish independent stories and documentaries to the world?
          </h3>
          <p className="text-white/80 text-sm sm:text-base font-medium max-w-xl mx-auto">
            Take control of your narrative. Every voice deserves its own dedicated masthead and audience.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link 
              href="/publish" 
              className="inline-flex items-center gap-2 bg-[#D97706] hover:bg-white hover:text-ink text-white font-extrabold uppercase text-xs tracking-wider px-8 py-4 rounded-sm transition-all shadow-xl"
            >
              Publish your story now <ArrowRight size={16} />
            </Link>
            <Link 
              href="/signup" 
              className="inline-flex items-center gap-2 border-2 border-white/30 hover:border-white text-white font-extrabold uppercase text-xs tracking-wider px-8 py-4 rounded-sm transition-all"
            >
              Create free account
            </Link>
          </div>
        </div>

        {/* ════════════ TOP TAGS ROW ════════════ */}
        <div className="mb-16 pb-16 border-b border-white/10">
          <div className="flex items-center gap-2 mb-5">
            <Tag size={14} className="text-signal" />
            <h4 className="text-xs font-bold uppercase tracking-widest text-white/50">Popular Topics</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {TOP_TAGS.map(tag => (
              <Link
                key={tag}
                href={`/search?q=${encodeURIComponent(tag)}`}
                className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm bg-white/5 border border-white/10 text-white/70 hover:bg-signal hover:text-white hover:border-signal transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>

        {/* ════════════ MAIN GRID ════════════ */}
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
                  <Icon size={18} />
                </a>
              ))}
            </div>

            {/* CUSTOMER SUPPORT WIDGET */}
            <div className="mt-8 p-4 bg-white/5 border border-white/10 rounded-sm">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle size={14} className="text-emerald-400" />
                <p className="text-xs font-bold uppercase tracking-wide text-white/70">Need Help?</p>
              </div>
              <button
                onClick={shareWhatsApp}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase text-[11px] tracking-wider py-2.5 rounded-sm transition-colors"
              >
                <MessageCircle size={13} /> Chat on WhatsApp
              </button>
              <p className="text-[10px] text-white/40 text-center mt-2">+254 112 696 334</p>
            </div>
          </div>

          {/* EXPLORE LINKS (Spans 2 cols) */}
          <div className="lg:col-span-2">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-white/50 mb-5 pb-2">Explore</h4>
            <ul className="space-y-2.5">
              {EXPLORE_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-[13px] font-medium text-white/80 hover:text-signal transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* SERVICES LINKS (Spans 2 cols) */}
          <div className="lg:col-span-2">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-white/50 mb-5 pb-2">Services</h4>
            <ul className="space-y-2.5">
              {SERVICE_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-[13px] font-medium text-white/80 hover:text-signal transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* API DOCS LINK */}
            <div className="mt-5 pt-5 border-t border-white/10">
              <Link
                href="/services/api"
                className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/50 hover:text-signal transition-colors"
              >
                <Code size={13} /> Developer API Docs
              </Link>
            </div>
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

        {/* ════════════ SUPPORT + SITEMAP ════════════ */}
        <div className="mb-12 pt-8 border-t border-white/10">
          <button
            onClick={() => setShowSitemap(!showSitemap)}
            className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/50 hover:text-white transition-colors mb-4"
          >
            <BookOpen size={13} />
            {showSitemap ? 'Hide' : 'Show'} Full Sitemap
          </button>
          
          {showSitemap && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-5 bg-white/5 border border-white/10 rounded-sm mb-6 animate-in fade-in duration-200">
              {[...EXPLORE_LINKS, ...SERVICE_LINKS, ...SUPPORT_LINKS].map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  className="text-[12px] font-medium text-white/60 hover:text-signal transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ════════════ SUPPORT LINKS ROW ════════════ */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-8 pb-8 border-b border-white/10">
          {SUPPORT_LINKS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="text-[11px] font-medium text-white/50 hover:text-signal transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>

        {/* ════════════ BOTTOM BAR ════════════ */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
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