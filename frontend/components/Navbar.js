// components/navbar.js
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  PenSquare,
  ShieldCheck,
  LogOut,
  LayoutGrid,
  User as UserIcon,
  Menu,
  X,
  Bookmark,
  Gift,
  Bell,
  Search,
  Briefcase,
  GraduationCap,
  Radio,
  Wrench,
  ArrowRight,
  Loader2,
  Sparkles,
  ChevronDown,
  MessageCircle,
  Play
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useStore } from '../lib/store';
import PushNotificationToggle from './PushNotificationToggle';
import LanguageSwitcher from './LanguageSwitcher';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function NavLink({ href, children, className = '', onClick }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`tracking-[0.08em] xl:tracking-[0.12em] uppercase text-[10px] xl:text-[11px] font-semibold transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none rounded-sm pb-0.5 border-b-2 whitespace-nowrap hover:-translate-y-[0.5px] active:scale-[0.98] ${
        active ? 'text-amber-400 border-amber-400/80' : 'text-white/75 border-transparent hover:text-amber-300 hover:scale-[1.02]'
      } ${className}`}
    >
      {children}
    </Link>
  );
}

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { stories } = useStore();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const isMasterAdmin = user?.email === 'adipotech@gmail.com';

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('op_unread_count');
      const parsed = saved ? parseInt(saved, 10) : 0;
      setUnreadCount(Number.isFinite(parsed) ? parsed : 0);
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!stories || stories.length === 0) return;
    try {
      const saved = window.localStorage.getItem('op_unread_count');
      if (saved === null) {
        window.localStorage.setItem('op_unread_count', String(Math.min(stories.length, 9)));
        setUnreadCount(Math.min(stories.length, 9));
      }
    } catch (e) { /* ignore */ }
  }, [stories]);

  const clearUnread = () => {
    setUnreadCount(0);
    try {
      window.localStorage.setItem('op_unread_count', '0');
    } catch (e) { /* ignore */ }
  };

  const closeDrawer = () => {
    setOpen(false);
    setMobileServicesOpen(false);
  };

  const handleSearchClick = (e) => {
    e.preventDefault();
    setSearchOpen(true);
    setServicesOpen(false);
    setTimeout(() => {
      document.getElementById('deep-search-input')?.focus();
    }, 100);
  };

  const performDeepSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      const url = `${API_BASE}/stories?search=${encodeURIComponent(searchQuery.trim())}&limit=20`;
      const res = await fetch(url);
      const data = await res.json();
      setSearchResults(data.stories || []);
    } catch (error) {
      console.error('Deep search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
  };

  return (
    <>
      {searchOpen && (
        <div className="fixed inset-0 z-[60] bg-[#0A0807]/98 backdrop-blur-3xl animate-in fade-in flex flex-col">
          <div className="p-5 md:p-8 flex justify-between items-center border-b border-white/[0.04]">
             <h2 className="text-white text-lg md:text-2xl font-black uppercase tracking-widest flex items-center gap-3">
               <Sparkles className="text-amber-400" /> Deep Search Engine
             </h2>
             <button onClick={closeSearch} className="text-white/50 hover:text-amber-300 transition-all duration-200 p-2 bg-white/5 rounded-full hover:bg-white/10 active:scale-[0.97]">
               <X size={28} />
             </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 md:p-10">
             <div className="max-w-5xl mx-auto">
               <form onSubmit={performDeepSearch} className="relative">
                 <input
                   id="deep-search-input"
                   type="text"
                   placeholder="Search stories, campus news, documentaries..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="w-full bg-transparent border-b-2 border-white/20 text-white text-3xl md:text-5xl font-black py-4 md:py-6 focus:outline-none focus:border-amber-400/50 transition-colors placeholder:text-white/10"
                 />
                 <button type="submit" disabled={isSearching} className="absolute right-0 top-1/2 -translate-y-1/2 text-amber-400 hover:text-white transition-all duration-200 disabled:opacity-50 active:scale-[0.97]">
                   {isSearching ? <Loader2 size={40} className="animate-spin" /> : <ArrowRight size={40} />}
                 </button>
               </form>

               <div className="mt-12">
                 {isSearching ? (
                   <div className="text-amber-400 flex items-center gap-3 text-sm md:text-lg font-bold uppercase tracking-widest animate-pulse">
                     <Loader2 className="animate-spin" /> Scanning Platform Database...
                   </div>
                 ) : searchResults.length > 0 ? (
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                     {searchResults.map(result => (
                        <Link
                          href={`/story/${result.id}`}
                          onClick={closeSearch}
                          key={result.id}
                          className="group block bg-white/[0.02] border border-white/[0.04] rounded-2xl p-6 hover:bg-white/[0.05] hover:border-amber-400/40 hover:shadow-2xl transition-all duration-200"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] bg-amber-400/20 text-amber-400 px-2 py-1 rounded-sm font-bold uppercase tracking-widest">
                              {result.type?.replace('_', ' ') || 'Content'}
                            </span>
                            <span className="text-[10px] text-white/40 uppercase tracking-widest">{new Date(result.created_at || result.createdAt).toLocaleDateString()}</span>
                          </div>
                          <h3 className="text-white text-lg font-black leading-snug group-hover:text-amber-300 transition-colors line-clamp-2">{result.title}</h3>
                          <p className="text-white/50 text-xs mt-3 line-clamp-2 font-medium leading-relaxed">{result.excerpt || 'Read full publication...'}</p>
                        </Link>
                     ))}
                   </div>
                 ) : hasSearched && searchResults.length === 0 ? (
                   <div className="text-white/50 text-xl md:text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                      <Search size={32} /> No results found for "{searchQuery}".
                   </div>
                 ) : (
                   <div className="text-white/20 text-sm md:text-base font-bold uppercase tracking-widest mt-10">
                     Discover articles, press releases, jobs, and multimedia content.
                   </div>
                 )}
               </div>
             </div>
          </div>
        </div>
      )}

      <header className="bg-[#0A0807]/85 backdrop-blur-xl border-b border-white/[0.04] sticky top-0 z-40">
        <div className="max-w-[96rem] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">

            <Link href="/" className="shrink-0 group focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none rounded-sm bg-white p-1 hover:ring-1 hover:ring-white/10 transition-all duration-500">
              <img
                src="/default-og-image.jpg"
                alt="OpinionPlus Logo"
                className="h-8 lg:h-9 w-auto object-contain hover:brightness-110 transition-all duration-500"
              />
            </Link>

            <nav className="hidden lg:flex items-center gap-6 xl:gap-8 absolute left-1/2 -translate-x-1/2">
              <NavLink href="/">Feed</NavLink>
              <NavLink href="/videos" className="flex items-center gap-1">
                <Play size={13} fill="currentColor" /> Videos
              </NavLink>
              <NavLink href="/?type=story">Stories</NavLink>
              <NavLink href="/?type=documentary">Docs</NavLink>
              <NavLink href="/campuses">Campus</NavLink>

              <button
                onClick={() => setServicesOpen(!servicesOpen)}
                className={`flex items-center gap-1.5 tracking-[0.08em] xl:tracking-[0.12em] uppercase text-[10px] xl:text-[11px] font-semibold transition-all duration-200 ease-out focus-visible:outline-none pb-0.5 border-b-2 active:scale-[0.98] ${
                  servicesOpen ? 'text-amber-400 border-amber-400/80' : 'text-white/75 border-transparent hover:text-amber-300 hover:scale-[1.02]'
                }`}
              >
                Services & Offers <ChevronDown size={14} className={`transition-transform duration-300 ${servicesOpen ? 'rotate-180' : 'rotate-0'}`} />
              </button>
            </nav>

            <nav className="hidden lg:flex items-center gap-4 xl:gap-6">
              <button
                onClick={handleSearchClick}
                className="tracking-[0.08em] uppercase text-[10px] xl:text-[11px] font-semibold text-white/75 hover:text-amber-300 transition-all duration-200 ease-out focus-visible:outline-none flex items-center gap-1.5 hover:-translate-y-[0.5px] active:scale-[0.98]"
              >
                <Search size={14} /> Search
              </button>

              <LanguageSwitcher variant="navbar" />

              {isAuthenticated ? (
                <Link
                  href={`/profile/${user.id}`}
                  className="tracking-[0.08em] uppercase text-[10px] xl:text-[11px] font-semibold text-white/75 hover:text-amber-300 transition-all duration-200 ease-out focus-visible:outline-none flex items-center gap-1.5 hover:-translate-y-[0.5px] active:scale-[0.98]"
                >
                  {user.logoUrl ? (
                    <span className="relative inline-block">
                      <img src={user.logoUrl} alt={user.publisherName} className="w-5 h-5 rounded-full object-cover ring-1 ring-white/10 hover:ring-amber-400/50 transition-all duration-200" />
                      <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-[#0A0807]" />
                    </span>
                  ) : (
                    <UserIcon size={14} />
                  )}
                  <span>Account</span>
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="tracking-[0.08em] uppercase text-[10px] xl:text-[11px] font-semibold text-white/75 hover:text-amber-300 transition-all duration-200 ease-out focus-visible:outline-none"
                >
                  Sign In
                </Link>
              )}

              {isAuthenticated && (
                <button
                  onClick={() => logout()}
                  title="Sign out"
                  className="text-white/40 hover:text-rose-400 transition-all duration-200 p-1.5 rounded-full hover:bg-rose-400/10 focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:outline-none active:scale-[0.97]"
                  aria-label="Sign out"
                >
                  <LogOut size={15} />
                </button>
              )}

              {isMasterAdmin && (
                <Link
                  href="/admin"
                  className="tracking-[0.08em] uppercase text-[10px] xl:text-[11px] font-semibold text-amber-400 hover:text-white transition-all duration-200 ease-out focus-visible:outline-none flex items-center gap-1.5 hover:-translate-y-[0.5px] active:scale-[0.98]"
                >
                  <ShieldCheck size={14} /> Admin
                </Link>
              )}

              <Link
                href="/publish"
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#0A0807] px-4 py-2 rounded-sm tracking-[0.12em] uppercase text-[10px] font-bold shadow-lg shadow-amber-900/20 hover:shadow-amber-900/40 transition-all duration-300 active:scale-[0.97]"
              >
                Publish
              </Link>
            </nav>

            <div className="flex items-center gap-3 lg:hidden ml-auto z-10">
              <button onClick={handleSearchClick} className="text-white p-1 rounded-sm transition-all duration-200 active:scale-[0.97]"><Search size={20} /></button>
              <button onClick={clearUnread} className="relative text-white p-1 rounded-sm transition-all duration-200 active:scale-[0.97]">
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-amber-500 text-[#0A0807] text-[9px] font-bold flex items-center justify-center leading-none">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button onClick={() => setOpen(true)} className="text-white p-1 rounded-sm transition-all duration-200 active:scale-[0.97]"><Menu size={22} /></button>
            </div>
          </div>
        </div>

        <div
          className={`hidden lg:block w-full bg-[#0A0807]/95 backdrop-blur-2xl border-t border-white/[0.04] shadow-2xl overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] absolute top-16 left-0 ${
            servicesOpen ? 'max-h-[500px] opacity-100 border-b border-white/[0.04]' : 'max-h-0 opacity-0 border-transparent'
          }`}
        >
          <div className="max-w-[96rem] mx-auto px-6 py-10 grid grid-cols-4 gap-8">
            <div className="col-span-3 grid grid-cols-3 gap-6">
              <Link href="/services/press-release" onClick={() => setServicesOpen(false)} style={{ animationDelay: '0ms' }} className="group flex items-start gap-4 p-4 rounded-xl hover:bg-white/[0.04] hover:scale-[1.01] transition-all duration-300">
                <div className="bg-blue-500/10 p-3 rounded-xl text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300"><PenSquare size={20} /></div>
                <div>
                  <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-1">Press Releases</h4>
                  <p className="text-white/50 text-xs leading-relaxed">Distribute your official company announcements.</p>
                </div>
              </Link>

              <Link href="/services/sponsored" onClick={() => setServicesOpen(false)} style={{ animationDelay: '50ms' }} className="group flex items-start gap-4 p-4 rounded-xl hover:bg-white/[0.04] hover:scale-[1.01] transition-all duration-300">
                <div className="bg-amber-500/10 p-3 rounded-xl text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300"><Gift size={20} /></div>
                <div>
                  <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-1">Sponsored Content</h4>
                  <p className="text-white/50 text-xs leading-relaxed">Promote articles to a highly targeted audience.</p>
                </div>
              </Link>

              <Link href="/services/api" onClick={() => setServicesOpen(false)} style={{ animationDelay: '100ms' }} className="group flex items-start gap-4 p-4 rounded-xl hover:bg-white/[0.04] hover:scale-[1.01] transition-all duration-300">
                <div className="bg-purple-500/10 p-3 rounded-xl text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-all duration-300"><Wrench size={20} /></div>
                <div>
                  <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-1">Developer API</h4>
                  <p className="text-white/50 text-xs leading-relaxed">Access real-time news streams for your apps.</p>
                </div>
              </Link>

              <Link href="/rooms" onClick={() => setServicesOpen(false)} style={{ animationDelay: '150ms' }} className="group flex items-start gap-4 p-4 rounded-xl hover:bg-white/[0.04] hover:scale-[1.01] transition-all duration-300">
                <div className="bg-emerald-500/10 p-3 rounded-xl text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300"><Radio size={20} /></div>
                <div>
                  <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-1">Live Spaces</h4>
                  <p className="text-white/50 text-xs leading-relaxed">Host interactive audio discussions with readers.</p>
                </div>
              </Link>

              <Link href="/jobs" onClick={() => setServicesOpen(false)} style={{ animationDelay: '200ms' }} className="group flex items-start gap-4 p-4 rounded-xl hover:bg-white/[0.04] hover:scale-[1.01] transition-all duration-300">
                <div className="bg-rose-500/10 p-3 rounded-xl text-rose-400 group-hover:bg-rose-500 group-hover:text-white transition-all duration-300"><Briefcase size={20} /></div>
                <div>
                  <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-1">Jobs Board</h4>
                  <p className="text-white/50 text-xs leading-relaxed">Hire top media professionals and creators.</p>
                </div>
              </Link>

              <Link href="/pricing" onClick={() => setServicesOpen(false)} style={{ animationDelay: '250ms' }} className="group flex items-start gap-4 p-4 rounded-xl hover:bg-white/[0.04] hover:scale-[1.01] transition-all duration-300">
                <div className="bg-amber-600/10 p-3 rounded-xl text-amber-500 group-hover:bg-amber-600 group-hover:text-white transition-all duration-300"><ShieldCheck size={20} /></div>
                <div>
                  <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-1">Partner Program</h4>
                  <p className="text-white/50 text-xs leading-relaxed">Monetize your content as an OpinionPlus partner.</p>
                </div>
              </Link>
            </div>

            <div className="col-span-1 border-l border-white/[0.04] pl-8 flex flex-col justify-center">
              <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-4">Dedicated Support</p>

              <a
                href="https://wa.me/254112696334"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex items-center justify-between bg-white/[0.02] border border-white/[0.04] rounded-lg p-4 hover:bg-emerald-500 hover:border-emerald-500 transition-all duration-300 overflow-hidden"
              >
                <div className="flex items-center gap-3 relative z-10">
                  <MessageCircle size={20} className="text-emerald-400 group-hover:text-white transition-colors" />
                  <div className="flex flex-col">
                     <span className="text-white font-bold text-sm">How can we help you?</span>
                     <span className="text-white/80 text-xs font-mono max-h-0 opacity-0 group-hover:max-h-10 group-hover:opacity-100 group-hover:mt-1 transition-all duration-300">
                        +254 112 696 334
                     </span>
                  </div>
                </div>
                <ArrowRight size={18} className="text-white/30 group-hover:text-white group-hover:translate-x-1 transition-all relative z-10" />
              </a>
            </div>
          </div>
        </div>
      </header>

      <div
        className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-300 ease-out ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!open}
      >
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md transition-opacity" onClick={closeDrawer} />
        <div
          className={`absolute top-0 right-0 h-full w-[85%] max-w-sm bg-[#0A0807]/98 backdrop-blur-2xl border-l border-white/[0.04] shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between px-5 h-20 border-b border-white/[0.04] bg-white/[0.02]">
            <img src="/default-og-image.jpg" alt="OpinionPlus Logo" className="h-8 object-contain rounded-sm" />
            <button onClick={closeDrawer} className="text-white p-2 rounded-full hover:bg-white/10 hover:scale-110 transition-all duration-200">
              <X size={24} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-2 text-xs font-semibold tracking-[0.12em] uppercase">
            <Link href="/" onClick={closeDrawer} className={`flex items-center min-h-[44px] px-3 rounded-sm text-white/90 hover:bg-white/[0.03] hover:pl-4 transition-all duration-200 ${pathname === '/' ? 'border-l-2 border-amber-400 pl-3' : ''}`}>Feed</Link>
            <Link href="/videos" onClick={closeDrawer} className={`flex items-center gap-2 min-h-[44px] px-3 rounded-sm text-white/90 hover:bg-white/[0.03] hover:pl-4 transition-all duration-200 ${pathname === '/videos' ? 'border-l-2 border-amber-400 pl-3' : ''}`}>
              <Play size={16} fill="currentColor" /> Videos
            </Link>
            <Link href="/?type=story" onClick={closeDrawer} className="flex items-center min-h-[44px] px-3 rounded-sm text-white/90 hover:bg-white/[0.03] hover:pl-4 transition-all duration-200">Stories</Link>
            <Link href="/?type=documentary" onClick={closeDrawer} className="flex items-center min-h-[44px] px-3 rounded-sm text-white/90 hover:bg-white/[0.03] hover:pl-4 transition-all duration-200">Documentaries</Link>
            <Link href="/campuses" onClick={closeDrawer} className={`flex items-center min-h-[44px] px-3 rounded-sm text-white/90 hover:bg-white/[0.03] hover:pl-4 transition-all duration-200 ${pathname === '/campuses' ? 'border-l-2 border-amber-400 pl-3' : ''}`}>Campus Editions</Link>

            <div className="border-t border-white/[0.04] my-2" />

            <button
              onClick={() => setMobileServicesOpen(!mobileServicesOpen)}
              className="flex items-center justify-between min-h-[44px] px-3 rounded-sm text-amber-400 font-bold hover:bg-white/[0.03] transition-all duration-200 w-full"
            >
              Services & Offers <ChevronDown size={16} className={`transition-transform duration-300 ${mobileServicesOpen ? 'rotate-180' : 'rotate-0'}`} />
            </button>

            <div className={`flex flex-col gap-1 overflow-hidden transition-all duration-300 ${mobileServicesOpen ? 'max-h-96 opacity-100 pl-4 py-2' : 'max-h-0 opacity-0'}`}>
               <Link href="/services/press-release" onClick={closeDrawer} style={{ animationDelay: '0ms' }} className="flex items-center gap-2 min-h-[40px] text-white/70 hover:text-white hover:pl-1 transition-all duration-200"><PenSquare size={14}/> Press Releases</Link>
               <Link href="/services/sponsored" onClick={closeDrawer} style={{ animationDelay: '50ms' }} className="flex items-center gap-2 min-h-[40px] text-white/70 hover:text-white hover:pl-1 transition-all duration-200"><Gift size={14}/> Sponsored Content</Link>
               <Link href="/services/api" onClick={closeDrawer} style={{ animationDelay: '100ms' }} className="flex items-center gap-2 min-h-[40px] text-white/70 hover:text-white hover:pl-1 transition-all duration-200"><Wrench size={14}/> Developer API</Link>
               <Link href="/rooms" onClick={closeDrawer} style={{ animationDelay: '150ms' }} className="flex items-center gap-2 min-h-[40px] text-white/70 hover:text-white hover:pl-1 transition-all duration-200"><Radio size={14}/> Live Spaces</Link>
               <Link href="/jobs" onClick={closeDrawer} style={{ animationDelay: '200ms' }} className="flex items-center gap-2 min-h-[40px] text-white/70 hover:text-white hover:pl-1 transition-all duration-200"><Briefcase size={14}/> Jobs Board</Link>
               <Link href="/pricing" onClick={closeDrawer} style={{ animationDelay: '250ms' }} className="flex items-center gap-2 min-h-[40px] text-white/70 hover:text-white hover:pl-1 transition-all duration-200"><ShieldCheck size={14}/> Partner Program</Link>
            </div>

            <div className="border-t border-white/[0.04] my-2" />

            <Link href="/read-later" onClick={closeDrawer} className="flex items-center gap-2.5 min-h-[44px] px-3 rounded-sm text-white/90 hover:bg-white/[0.03] hover:pl-4 transition-all duration-200"><Bookmark size={16} /> Saved Articles</Link>
            <div className="py-3 px-3"><PushNotificationToggle /></div>

            {isMasterAdmin && (
              <Link href="/admin" onClick={closeDrawer} className="flex items-center gap-2.5 min-h-[44px] px-3 rounded-sm text-amber-400 hover:bg-white/[0.03] hover:pl-4 transition-all duration-200 mt-2"><ShieldCheck size={16} /> Admin Dashboard</Link>
            )}

            <div className="mt-6">
              <a
                href="https://wa.me/254112696334"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.04] p-4 rounded-lg hover:bg-emerald-500 hover:border-emerald-500 transition-all duration-300 text-white"
              >
                <MessageCircle size={20} className="text-emerald-400" />
                <div className="flex flex-col">
                  <span className="font-bold">How can we help you?</span>
                  <span className="text-white/60 normal-case tracking-normal">Tap to chat on WhatsApp</span>
                </div>
              </a>
            </div>
          </nav>

          <div className="px-5 py-4 border-t border-white/[0.04] bg-black/20">
            <div className="mb-4 flex justify-center">
              <LanguageSwitcher variant="footer" />
            </div>
            {isAuthenticated ? (
              <div className="flex flex-col gap-2">
                <Link href={`/profile/${user.id}`} onClick={closeDrawer} className="flex items-center gap-2.5 min-h-[40px] text-white uppercase text-[11px] font-bold tracking-[0.12em] hover:text-amber-300 transition-colors duration-200"><LayoutGrid size={15} /> Account Settings</Link>
                <button
                  onClick={() => { closeDrawer(); logout(); }}
                  className="flex items-center gap-2.5 min-h-[44px] px-3 rounded-sm text-rose-400 hover:bg-rose-400/5 uppercase text-[11px] font-bold tracking-[0.12em] transition-all duration-200"
                >
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            ) : (
              <Link href="/login" onClick={closeDrawer} className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#0A0807] px-4 py-3 text-center rounded-sm block uppercase text-[11px] font-bold tracking-[0.12em] transition-all duration-300 shadow-sm active:scale-[0.97]">Sign In</Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}