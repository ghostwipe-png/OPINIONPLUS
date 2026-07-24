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
  MessageCircle
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useStore } from '../lib/store';
import PushNotificationToggle from './PushNotificationToggle';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function NavLink({ href, children, className = '', onClick }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`tracking-[0.08em] xl:tracking-[0.12em] uppercase text-[10px] xl:text-[11px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none rounded-sm pb-0.5 border-b-2 whitespace-nowrap ${
        active ? 'text-signal border-signal' : 'text-white/75 border-transparent hover:text-signal'
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
  
  // UI States
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [servicesOpen, setServicesOpen] = useState(false); // Controls Roll Down Menu
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);

  // Deep Search States
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
      {/* 🔍 DEEP SEARCH OVERLAY MODAL */}
      {searchOpen && (
        <div className="fixed inset-0 z-[60] bg-[#1C1917]/95 backdrop-blur-xl animate-in fade-in flex flex-col">
          <div className="p-5 md:p-8 flex justify-between items-center border-b border-white/10">
             <h2 className="text-white text-lg md:text-2xl font-black uppercase tracking-widest flex items-center gap-3">
               <Sparkles className="text-signal" /> Deep Search Engine
             </h2>
             <button onClick={closeSearch} className="text-white/50 hover:text-signal transition-colors p-2 bg-white/5 rounded-full hover:bg-white/10">
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
                   className="w-full bg-transparent border-b-2 border-white/20 text-white text-2xl md:text-5xl font-black py-4 md:py-6 focus:outline-none focus:border-signal transition-colors placeholder:text-white/20"
                 />
                 <button type="submit" disabled={isSearching} className="absolute right-0 top-1/2 -translate-y-1/2 text-signal hover:text-white transition-colors disabled:opacity-50">
                   {isSearching ? <Loader2 size={40} className="animate-spin" /> : <ArrowRight size={40} />}
                 </button>
               </form>

               {/* Deep Search Results Area */}
               <div className="mt-12">
                 {isSearching ? (
                   <div className="text-signal flex items-center gap-3 text-sm md:text-lg font-bold uppercase tracking-widest animate-pulse">
                     <Loader2 className="animate-spin" /> Scanning Platform Database...
                   </div>
                 ) : searchResults.length > 0 ? (
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                     {searchResults.map(result => (
                        <Link 
                          href={`/story/${result.id}`} 
                          onClick={closeSearch} 
                          key={result.id} 
                          className="group block bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-signal hover:shadow-2xl transition-all"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] bg-signal/20 text-signal px-2 py-1 rounded-sm font-bold uppercase tracking-widest">
                              {result.type?.replace('_', ' ') || 'Content'}
                            </span>
                            <span className="text-[10px] text-white/40 uppercase tracking-widest">{new Date(result.created_at || result.createdAt).toLocaleDateString()}</span>
                          </div>
                          <h3 className="text-white text-lg font-black leading-snug group-hover:text-signal transition-colors line-clamp-2">{result.title}</h3>
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

      {/* ---------------- MAIN NAVBAR STRUCTURE ---------------- */}
      <header className="bg-ink border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-[96rem] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-20">
            
            {/* LEFT: Logo */}
            <Link href="/" className="shrink-0 group focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none rounded-sm bg-white p-1">
              <img 
                src="/default-og-image.jpg" 
                alt="OpinionPlus Logo" 
                className="h-9 lg:h-11 w-auto object-contain" 
              />
            </Link>

            {/* CENTER: Navigation Links */}
            <nav className="hidden lg:flex items-center gap-6 xl:gap-8 absolute left-1/2 -translate-x-1/2">
              <NavLink href="/">Feed</NavLink>
              <NavLink href="/?type=story">Stories</NavLink>
              <NavLink href="/?type=documentary">Docs</NavLink>
              <NavLink href="/campuses">Campus</NavLink>
              
              {/* Roll Down Trigger Button */}
              <button 
                onClick={() => setServicesOpen(!servicesOpen)}
                className={`flex items-center gap-1.5 tracking-[0.08em] xl:tracking-[0.12em] uppercase text-[10px] xl:text-[11px] font-semibold transition-colors focus-visible:outline-none pb-0.5 border-b-2 ${
                  servicesOpen ? 'text-signal border-signal' : 'text-white/75 border-transparent hover:text-signal'
                }`}
              >
                Services & Offers <ChevronDown size={14} className={`transition-transform duration-300 ${servicesOpen ? 'rotate-180' : 'rotate-0'}`} />
              </button>
            </nav>

            {/* RIGHT: Action & Utility Links */}
            <nav className="hidden lg:flex items-center gap-4 xl:gap-6">
              <button
                onClick={handleSearchClick}
                className="tracking-[0.08em] uppercase text-[10px] xl:text-[11px] font-semibold text-white/75 hover:text-signal transition-colors focus-visible:outline-none flex items-center gap-1.5"
              >
                <Search size={14} /> Search
              </button>
              
              {isAuthenticated ? (
                <Link
                  href={`/profile/${user.id}`}
                  className="tracking-[0.08em] uppercase text-[10px] xl:text-[11px] font-semibold text-white/75 hover:text-signal transition-colors focus-visible:outline-none flex items-center gap-1.5"
                >
                  {user.logoUrl ? (
                    <img src={user.logoUrl} alt={user.publisherName} className="w-5 h-5 rounded-full object-cover border border-white/20" />
                  ) : (
                    <UserIcon size={14} />
                  )}
                  <span>Account</span>
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="tracking-[0.08em] uppercase text-[10px] xl:text-[11px] font-semibold text-white/75 hover:text-signal transition-colors focus-visible:outline-none"
                >
                  Sign In
                </Link>
              )}
              
              <Link
                href="/publish"
                className="bg-signal text-white px-4 py-2 rounded-sm tracking-[0.12em] uppercase text-[10px] font-bold hover:bg-white hover:text-ink transition-colors shadow-sm"
              >
                Publish
              </Link>
            </nav>

            {/* MOBILE TOGGLES */}
            <div className="flex items-center gap-3 lg:hidden ml-auto z-10">
              <button onClick={handleSearchClick} className="text-white p-1 rounded-sm"><Search size={20} /></button>
              <button onClick={clearUnread} className="relative text-white p-1 rounded-sm">
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-signal text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button onClick={() => setOpen(true)} className="text-white p-1 rounded-sm"><Menu size={22} /></button>
            </div>
          </div>
        </div>

        {/* ---------------- FLEXIBLE ROLL DOWN MENU (DESKTOP) ---------------- */}
        <div 
          className={`hidden lg:block w-full bg-ink border-t border-white/5 shadow-2xl overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] absolute top-20 left-0 ${
            servicesOpen ? 'max-h-[500px] opacity-100 border-b border-white/10' : 'max-h-0 opacity-0 border-transparent'
          }`}
        >
          <div className="max-w-[96rem] mx-auto px-6 py-10 grid grid-cols-4 gap-8">
            <div className="col-span-3 grid grid-cols-3 gap-6">
              <Link href="/services/press-release" onClick={() => setServicesOpen(false)} className="group flex items-start gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors">
                <div className="bg-signal/10 p-3 rounded-lg text-signal group-hover:bg-signal group-hover:text-white transition-colors"><PenSquare size={20} /></div>
                <div>
                  <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-1">Press Releases</h4>
                  <p className="text-white/50 text-xs leading-relaxed">Distribute your official company announcements.</p>
                </div>
              </Link>
              
              <Link href="/services/sponsored" onClick={() => setServicesOpen(false)} className="group flex items-start gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors">
                <div className="bg-signal/10 p-3 rounded-lg text-signal group-hover:bg-signal group-hover:text-white transition-colors"><Gift size={20} /></div>
                <div>
                  <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-1">Sponsored Content</h4>
                  <p className="text-white/50 text-xs leading-relaxed">Promote articles to a highly targeted audience.</p>
                </div>
              </Link>

              <Link href="/services/api" onClick={() => setServicesOpen(false)} className="group flex items-start gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors">
                <div className="bg-signal/10 p-3 rounded-lg text-signal group-hover:bg-signal group-hover:text-white transition-colors"><Wrench size={20} /></div>
                <div>
                  <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-1">Developer API</h4>
                  <p className="text-white/50 text-xs leading-relaxed">Access real-time news streams for your apps.</p>
                </div>
              </Link>

              <Link href="/rooms" onClick={() => setServicesOpen(false)} className="group flex items-start gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors">
                <div className="bg-signal/10 p-3 rounded-lg text-signal group-hover:bg-signal group-hover:text-white transition-colors"><Radio size={20} /></div>
                <div>
                  <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-1">Live Spaces</h4>
                  <p className="text-white/50 text-xs leading-relaxed">Host interactive audio discussions with readers.</p>
                </div>
              </Link>

              <Link href="/jobs" onClick={() => setServicesOpen(false)} className="group flex items-start gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors">
                <div className="bg-signal/10 p-3 rounded-lg text-signal group-hover:bg-signal group-hover:text-white transition-colors"><Briefcase size={20} /></div>
                <div>
                  <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-1">Jobs Board</h4>
                  <p className="text-white/50 text-xs leading-relaxed">Hire top media professionals and creators.</p>
                </div>
              </Link>

              <Link href="/pricing" onClick={() => setServicesOpen(false)} className="group flex items-start gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors">
                <div className="bg-signal/10 p-3 rounded-lg text-signal group-hover:bg-signal group-hover:text-white transition-colors"><ShieldCheck size={20} /></div>
                <div>
                  <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-1">Partner Program</h4>
                  <p className="text-white/50 text-xs leading-relaxed">Monetize your content as an OpinionPlus partner.</p>
                </div>
              </Link>
            </div>

            {/* Support Action / Intelligently Hidden Hotline */}
            <div className="col-span-1 border-l border-white/10 pl-8 flex flex-col justify-center">
              <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-4">Dedicated Support</p>
              
              <a 
                href="https://wa.me/254112696334"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-signal hover:border-signal transition-all overflow-hidden"
              >
                <div className="flex items-center gap-3 relative z-10">
                  <MessageCircle size={20} className="text-signal group-hover:text-white transition-colors" />
                  <div className="flex flex-col">
                     <span className="text-white font-bold text-sm">How can we help you?</span>
                     {/* Intelligently hidden hotline: Reveals on hover by expanding width/opacity */}
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

      {/* ---------------- MOBILE DRAWER NAVIGATION ---------------- */}
      <div
        className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-300 ease-out ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!open}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-xs transition-opacity" onClick={closeDrawer} />
        <div
          className={`absolute top-0 right-0 h-full w-[85%] max-w-sm bg-ink shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between px-5 h-20 border-b border-white/10 bg-white/5">
            <img src="/default-og-image.jpg" alt="OpinionPlus Logo" className="h-8 object-contain rounded-sm" />
            <button onClick={closeDrawer} className="text-white p-2 rounded-full hover:bg-white/10">
              <X size={24} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-2 text-xs font-semibold tracking-[0.12em] uppercase">
            {/* Core Links */}
            <Link href="/" onClick={closeDrawer} className="flex items-center min-h-[44px] px-3 rounded-sm text-white/90 hover:bg-white/10">Feed</Link>
            <Link href="/?type=story" onClick={closeDrawer} className="flex items-center min-h-[44px] px-3 rounded-sm text-white/90 hover:bg-white/10">Stories</Link>
            <Link href="/?type=documentary" onClick={closeDrawer} className="flex items-center min-h-[44px] px-3 rounded-sm text-white/90 hover:bg-white/10">Documentaries</Link>
            <Link href="/campuses" onClick={closeDrawer} className="flex items-center min-h-[44px] px-3 rounded-sm text-white/90 hover:bg-white/10">Campus Editions</Link>
            
            <div className="border-t border-white/10 my-2" />
            
            {/* Mobile Roll Down Services Accordion */}
            <button 
              onClick={() => setMobileServicesOpen(!mobileServicesOpen)}
              className="flex items-center justify-between min-h-[44px] px-3 rounded-sm text-signal font-bold hover:bg-white/10 w-full"
            >
              Services & Offers <ChevronDown size={16} className={`transition-transform duration-300 ${mobileServicesOpen ? 'rotate-180' : 'rotate-0'}`} />
            </button>
            
            <div className={`flex flex-col gap-1 overflow-hidden transition-all duration-300 ${mobileServicesOpen ? 'max-h-96 opacity-100 pl-4 py-2' : 'max-h-0 opacity-0'}`}>
               <Link href="/services/press-release" onClick={closeDrawer} className="flex items-center gap-2 min-h-[40px] text-white/70 hover:text-white"><PenSquare size={14}/> Press Releases</Link>
               <Link href="/services/sponsored" onClick={closeDrawer} className="flex items-center gap-2 min-h-[40px] text-white/70 hover:text-white"><Gift size={14}/> Sponsored Content</Link>
               <Link href="/services/api" onClick={closeDrawer} className="flex items-center gap-2 min-h-[40px] text-white/70 hover:text-white"><Wrench size={14}/> Developer API</Link>
               <Link href="/rooms" onClick={closeDrawer} className="flex items-center gap-2 min-h-[40px] text-white/70 hover:text-white"><Radio size={14}/> Live Spaces</Link>
               <Link href="/jobs" onClick={closeDrawer} className="flex items-center gap-2 min-h-[40px] text-white/70 hover:text-white"><Briefcase size={14}/> Jobs Board</Link>
               <Link href="/pricing" onClick={closeDrawer} className="flex items-center gap-2 min-h-[40px] text-white/70 hover:text-white"><ShieldCheck size={14}/> Partner Program</Link>
            </div>

            <div className="border-t border-white/10 my-2" />

            <Link href="/read-later" onClick={closeDrawer} className="flex items-center gap-2.5 min-h-[44px] px-3 rounded-sm text-white/90 hover:bg-white/10"><Bookmark size={16} /> Saved Articles</Link>
            <div className="py-3 px-3"><PushNotificationToggle /></div>

            {isMasterAdmin && (
              <Link href="/admin" onClick={closeDrawer} className="flex items-center gap-2.5 min-h-[44px] px-3 rounded-sm text-signal hover:bg-white/10 mt-2"><ShieldCheck size={16} /> Admin Dashboard</Link>
            )}

            {/* Support Action Mobile */}
            <div className="mt-6">
              <a 
                href="https://wa.me/254112696334"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-white/5 border border-white/10 p-4 rounded-lg hover:bg-signal transition-colors text-white"
              >
                <MessageCircle size={20} className="text-signal" />
                <div className="flex flex-col">
                  <span className="font-bold">How can we help you?</span>
                  <span className="text-white/60 normal-case tracking-normal">Tap to chat on WhatsApp</span>
                </div>
              </a>
            </div>
          </nav>

          <div className="px-5 py-4 border-t border-white/10 bg-black/20">
            {isAuthenticated ? (
              <div className="flex flex-col gap-2">
                <Link href={`/profile/${user.id}`} onClick={closeDrawer} className="flex items-center gap-2.5 min-h-[40px] text-white uppercase text-[11px] font-bold tracking-[0.12em] hover:text-signal transition-colors"><LayoutGrid size={15} /> Account Settings</Link>
                <button onClick={() => { closeDrawer(); logout(); }} className="flex items-center gap-2.5 min-h-[40px] text-left text-signal uppercase text-[11px] font-bold tracking-[0.12em] hover:opacity-80 transition-opacity"><LogOut size={15} /> Sign out</button>
              </div>
            ) : (
              <Link href="/login" onClick={closeDrawer} className="bg-signal text-white px-4 py-3 text-center rounded-sm block uppercase text-[11px] font-bold tracking-[0.12em] hover:bg-white hover:text-ink transition-colors shadow-sm">Sign In</Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}