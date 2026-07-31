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
      className={`text-[11px] tracking-[0.06em] font-medium transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none rounded-sm pb-0.5 border-b-2 whitespace-nowrap ${
        active ? 'text-amber-400 border-amber-400/80' : 'text-white/70 border-transparent hover:text-amber-300'
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
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (!stories || stories.length === 0) return;
    try {
      const saved = window.localStorage.getItem('op_unread_count');
      if (saved === null) {
        window.localStorage.setItem('op_unread_count', String(Math.min(stories.length, 9)));
        setUnreadCount(Math.min(stories.length, 9));
      }
    } catch (e) {}
  }, [stories]);

  const clearUnread = () => {
    setUnreadCount(0);
    try { window.localStorage.setItem('op_unread_count', '0'); } catch (e) {}
  };

  const closeDrawer = () => {
    setOpen(false);
    setMobileServicesOpen(false);
  };

  const handleSearchClick = (e) => {
    e.preventDefault();
    setSearchOpen(true);
    setServicesOpen(false);
    setTimeout(() => document.getElementById('deep-search-input')?.focus(), 100);
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
                <input id="deep-search-input" type="text" placeholder="Search stories, campus news, documentaries..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-b-2 border-white/20 text-white text-3xl md:text-5xl font-black py-4 md:py-6 focus:outline-none focus:border-amber-400/50 transition-colors placeholder:text-white/10" />
                <button type="submit" disabled={isSearching} className="absolute right-0 top-1/2 -translate-y-1/2 text-amber-400 hover:text-white transition-all duration-200 disabled:opacity-50 active:scale-[0.97]">
                  {isSearching ? <Loader2 size={40} className="animate-spin" /> : <ArrowRight size={40} />}
                </button>
              </form>
              <div className="mt-12">
                {isSearching ? (
                  <div className="text-amber-400 flex items-center gap-3 text-sm md:text-lg font-bold uppercase tracking-widest animate-pulse"><Loader2 className="animate-spin" /> Scanning...</div>
                ) : searchResults.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {searchResults.map(result => (
                      <Link href={`/story/${result.id}`} onClick={closeSearch} key={result.id} className="group block bg-white/[0.02] border border-white/[0.04] rounded-2xl p-6 hover:bg-white/[0.05] hover:border-amber-400/40 transition-all duration-200">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] bg-amber-400/20 text-amber-400 px-2 py-1 rounded-sm font-bold uppercase tracking-widest">{result.type?.replace('_', ' ') || 'Content'}</span>
                          <span className="text-[10px] text-white/40 uppercase tracking-widest">{new Date(result.created_at || result.createdAt).toLocaleDateString()}</span>
                        </div>
                        <h3 className="text-white text-lg font-black leading-snug group-hover:text-amber-300 transition-colors line-clamp-2">{result.title}</h3>
                        <p className="text-white/50 text-xs mt-3 line-clamp-2 font-medium">{result.excerpt || 'Read full publication...'}</p>
                      </Link>
                    ))}
                  </div>
                ) : hasSearched ? (
                  <div className="text-white/50 text-xl md:text-2xl font-black uppercase flex items-center gap-3"><Search size={32} /> No results found for "{searchQuery}".</div>
                ) : (
                  <div className="text-white/20 text-sm md:text-base font-bold uppercase tracking-widest mt-10">Discover articles, press releases, jobs, and multimedia content.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="bg-[#0A0807]/85 backdrop-blur-xl border-b border-white/[0.04] sticky top-0 z-40">
        <div className="max-w-[96rem] mx-auto px-6">
          <div className="flex items-center justify-between h-14">

            {/* Logo */}
            <Link href="/" className="shrink-0 group focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none rounded-sm bg-white p-0.5 hover:ring-1 hover:ring-white/10 transition-all duration-500">
              <img src="/default-og-image.jpg" alt="OpinionPlus Logo" className="h-7 lg:h-8 w-auto object-contain hover:brightness-110 transition-all duration-500" />
            </Link>

            {/* Center Nav Links */}
            <nav className="hidden lg:flex items-center gap-8">
              <NavLink href="/">Feed</NavLink>
              <NavLink href="/videos" className="flex items-center gap-1"><Play size={11} fill="currentColor" /> Videos</NavLink>
              <NavLink href="/?type=story">Stories</NavLink>
              <NavLink href="/?type=documentary">Docs</NavLink>
              <NavLink href="/campuses">Campus</NavLink>
              <button onClick={() => setServicesOpen(!servicesOpen)}
                className={`text-[11px] tracking-[0.06em] font-medium transition-all duration-200 ease-out focus-visible:outline-none pb-0.5 border-b-2 flex items-center gap-1 ${
                  servicesOpen ? 'text-amber-400 border-amber-400/80' : 'text-white/70 border-transparent hover:text-amber-300'}`}>
                Services <ChevronDown size={12} className={`transition-transform duration-300 ${servicesOpen ? 'rotate-180' : 'rotate-0'}`} />
              </button>
            </nav>

            {/* Right Actions */}
            <nav className="hidden lg:flex items-center gap-5">
              <button onClick={handleSearchClick} className="text-white/70 hover:text-amber-300 transition-all duration-200 ease-out focus-visible:outline-none">
                <Search size={15} />
              </button>

              <LanguageSwitcher variant="navbar" />

              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <Link href={`/profile/${user.id}`} className="relative inline-block focus-visible:outline-none">
                    {user.logoUrl ? (
                      <span className="relative inline-block">
                        <img src={user.logoUrl} alt="" className="w-6 h-6 rounded-full object-cover ring-1 ring-white/10 hover:ring-amber-400/50 transition-all duration-200" />
                        <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-[#0A0807]" />
                      </span>
                    ) : (
                      <UserIcon size={15} className="text-white/70 hover:text-amber-300" />
                    )}
                  </Link>
                  <button onClick={() => logout()} title="Sign out" className="text-white/40 hover:text-rose-400 transition-all duration-200 p-1 rounded-full hover:bg-rose-400/10 focus-visible:outline-none">
                    <LogOut size={14} />
                  </button>
                  {isMasterAdmin && (
                    <Link href="/admin" className="text-amber-400 hover:text-white transition-all duration-200 focus-visible:outline-none">
                      <ShieldCheck size={14} />
                    </Link>
                  )}
                </div>
              ) : (
                <Link href="/login" className="text-[11px] tracking-[0.06em] font-medium text-white/70 hover:text-amber-300 transition-all duration-200">Sign In</Link>
              )}

              <Link href="/publish" className="bg-amber-500 hover:bg-white hover:text-ink text-[#0A0807] px-4 py-1.5 rounded-sm text-[10px] tracking-[0.06em] font-bold transition-all duration-300 shadow-sm active:scale-[0.97]">
                Publish
              </Link>
            </nav>

            {/* Mobile Icons */}
            <div className="flex items-center gap-3 lg:hidden ml-auto">
              <button onClick={handleSearchClick} className="text-white p-1"><Search size={18} /></button>
              <button onClick={clearUnread} className="relative text-white p-1">
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-amber-500 text-[#0A0807] text-[9px] font-bold flex items-center justify-center">{unreadCount}</span>
                )}
              </button>
              <button onClick={() => setOpen(true)} className="text-white p-1"><Menu size={20} /></button>
            </div>
          </div>
        </div>

        {/* Services Dropdown */}
        <div className={`hidden lg:block w-full bg-[#0A0807]/95 backdrop-blur-2xl border-t border-white/[0.04] shadow-2xl overflow-hidden transition-all duration-400 ease-out absolute top-14 left-0 ${
          servicesOpen ? 'max-h-[400px] opacity-100 border-b border-white/[0.04]' : 'max-h-0 opacity-0 border-transparent'}`}>
          <div className="max-w-[96rem] mx-auto px-8 py-8 grid grid-cols-4 gap-6">
            <div className="col-span-3 grid grid-cols-3 gap-4">
              <Link href="/services/press-release" onClick={() => setServicesOpen(false)} className="group flex items-start gap-3 p-3 rounded-lg hover:bg-white/[0.04] transition-all duration-200">
                <div className="bg-blue-500/10 p-2.5 rounded-lg text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300"><PenSquare size={16} /></div>
                <div><h4 className="text-white font-bold text-xs tracking-wide mb-0.5">Press Releases</h4><p className="text-white/40 text-[11px] leading-relaxed">Distribute official company announcements.</p></div>
              </Link>
              <Link href="/services/sponsored" onClick={() => setServicesOpen(false)} className="group flex items-start gap-3 p-3 rounded-lg hover:bg-white/[0.04] transition-all duration-200">
                <div className="bg-amber-500/10 p-2.5 rounded-lg text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300"><Gift size={16} /></div>
                <div><h4 className="text-white font-bold text-xs tracking-wide mb-0.5">Sponsored Content</h4><p className="text-white/40 text-[11px] leading-relaxed">Promote articles to targeted audiences.</p></div>
              </Link>
              <Link href="/services/api" onClick={() => setServicesOpen(false)} className="group flex items-start gap-3 p-3 rounded-lg hover:bg-white/[0.04] transition-all duration-200">
                <div className="bg-purple-500/10 p-2.5 rounded-lg text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-all duration-300"><Wrench size={16} /></div>
                <div><h4 className="text-white font-bold text-xs tracking-wide mb-0.5">Developer API</h4><p className="text-white/40 text-[11px] leading-relaxed">Access real-time news streams.</p></div>
              </Link>
              <Link href="/rooms" onClick={() => setServicesOpen(false)} className="group flex items-start gap-3 p-3 rounded-lg hover:bg-white/[0.04] transition-all duration-200">
                <div className="bg-emerald-500/10 p-2.5 rounded-lg text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300"><Radio size={16} /></div>
                <div><h4 className="text-white font-bold text-xs tracking-wide mb-0.5">Live Spaces</h4><p className="text-white/40 text-[11px] leading-relaxed">Host interactive audio discussions.</p></div>
              </Link>
              <Link href="/jobs" onClick={() => setServicesOpen(false)} className="group flex items-start gap-3 p-3 rounded-lg hover:bg-white/[0.04] transition-all duration-200">
                <div className="bg-rose-500/10 p-2.5 rounded-lg text-rose-400 group-hover:bg-rose-500 group-hover:text-white transition-all duration-300"><Briefcase size={16} /></div>
                <div><h4 className="text-white font-bold text-xs tracking-wide mb-0.5">Jobs Board</h4><p className="text-white/40 text-[11px] leading-relaxed">Hire media professionals and creators.</p></div>
              </Link>
              <Link href="/pricing" onClick={() => setServicesOpen(false)} className="group flex items-start gap-3 p-3 rounded-lg hover:bg-white/[0.04] transition-all duration-200">
                <div className="bg-amber-600/10 p-2.5 rounded-lg text-amber-500 group-hover:bg-amber-600 group-hover:text-white transition-all duration-300"><ShieldCheck size={16} /></div>
                <div><h4 className="text-white font-bold text-xs tracking-wide mb-0.5">Partner Program</h4><p className="text-white/40 text-[11px] leading-relaxed">Monetize your content.</p></div>
              </Link>
            </div>
            <div className="col-span-1 border-l border-white/[0.04] pl-6 flex flex-col justify-center">
              <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-3">Support</p>
              <a href="https://wa.me/254112696334" target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between bg-white/[0.02] border border-white/[0.04] rounded-lg p-3 hover:bg-emerald-500 hover:border-emerald-500 transition-all duration-300">
                <div className="flex items-center gap-2">
                  <MessageCircle size={16} className="text-emerald-400 group-hover:text-white transition-colors" />
                  <span className="text-white font-bold text-xs">Chat on WhatsApp</span>
                </div>
                <ArrowRight size={14} className="text-white/30 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <div className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-300 ease-out ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} aria-hidden={!open}>
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={closeDrawer} />
        <div className={`absolute top-0 right-0 h-full w-[85%] max-w-sm bg-[#0A0807]/98 backdrop-blur-2xl border-l border-white/[0.04] shadow-2xl transition-transform duration-300 ease-out flex flex-col ${open ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between px-5 h-14 border-b border-white/[0.04]">
            <img src="/default-og-image.jpg" alt="Logo" className="h-7 object-contain rounded-sm" />
            <button onClick={closeDrawer} className="text-white p-2 rounded-full hover:bg-white/10 transition-all"><X size={20} /></button>
          </div>
          <nav className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-1.5 text-xs font-medium tracking-[0.08em] uppercase">
            <Link href="/" onClick={closeDrawer} className={`min-h-[42px] px-3 rounded-sm flex items-center text-white/90 hover:bg-white/[0.03] ${pathname === '/' ? 'border-l-2 border-amber-400 pl-2' : ''}`}>Feed</Link>
            <Link href="/videos" onClick={closeDrawer} className={`min-h-[42px] px-3 rounded-sm flex items-center gap-2 text-white/90 hover:bg-white/[0.03] ${pathname === '/videos' ? 'border-l-2 border-amber-400 pl-2' : ''}`}><Play size={14} fill="currentColor" /> Videos</Link>
            <Link href="/?type=story" onClick={closeDrawer} className="min-h-[42px] px-3 rounded-sm flex items-center text-white/90 hover:bg-white/[0.03]">Stories</Link>
            <Link href="/?type=documentary" onClick={closeDrawer} className="min-h-[42px] px-3 rounded-sm flex items-center text-white/90 hover:bg-white/[0.03]">Documentaries</Link>
            <Link href="/campuses" onClick={closeDrawer} className={`min-h-[42px] px-3 rounded-sm flex items-center text-white/90 hover:bg-white/[0.03] ${pathname === '/campuses' ? 'border-l-2 border-amber-400 pl-2' : ''}`}>Campus</Link>
            <div className="border-t border-white/[0.04] my-1" />
            <button onClick={() => setMobileServicesOpen(!mobileServicesOpen)} className="min-h-[42px] px-3 rounded-sm flex items-center justify-between text-amber-400 font-bold hover:bg-white/[0.03] w-full">
              Services <ChevronDown size={14} className={`transition-transform duration-300 ${mobileServicesOpen ? 'rotate-180' : 'rotate-0'}`} />
            </button>
            <div className={`flex flex-col gap-1 overflow-hidden transition-all duration-300 ${mobileServicesOpen ? 'max-h-80 opacity-100 pl-3 py-1' : 'max-h-0 opacity-0'}`}>
              <Link href="/services/press-release" onClick={closeDrawer} className="min-h-[36px] flex items-center gap-2 text-white/60 hover:text-white text-[11px]"><PenSquare size={12}/> Press Releases</Link>
              <Link href="/services/sponsored" onClick={closeDrawer} className="min-h-[36px] flex items-center gap-2 text-white/60 hover:text-white text-[11px]"><Gift size={12}/> Sponsored Content</Link>
              <Link href="/services/api" onClick={closeDrawer} className="min-h-[36px] flex items-center gap-2 text-white/60 hover:text-white text-[11px]"><Wrench size={12}/> Developer API</Link>
              <Link href="/rooms" onClick={closeDrawer} className="min-h-[36px] flex items-center gap-2 text-white/60 hover:text-white text-[11px]"><Radio size={12}/> Live Spaces</Link>
              <Link href="/jobs" onClick={closeDrawer} className="min-h-[36px] flex items-center gap-2 text-white/60 hover:text-white text-[11px]"><Briefcase size={12}/> Jobs</Link>
              <Link href="/pricing" onClick={closeDrawer} className="min-h-[36px] flex items-center gap-2 text-white/60 hover:text-white text-[11px]"><ShieldCheck size={12}/> Partner</Link>
            </div>
            <div className="border-t border-white/[0.04] my-1" />
            <Link href="/read-later" onClick={closeDrawer} className="min-h-[42px] px-3 rounded-sm flex items-center gap-2 text-white/90 hover:bg-white/[0.03]"><Bookmark size={14} /> Saved</Link>
            <div className="py-2 px-3"><PushNotificationToggle /></div>
            {isMasterAdmin && <Link href="/admin" onClick={closeDrawer} className="min-h-[42px] px-3 rounded-sm flex items-center gap-2 text-amber-400 hover:bg-white/[0.03]"><ShieldCheck size={14} /> Admin</Link>}
            <div className="mt-4">
              <a href="https://wa.me/254112696334" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.04] p-3 rounded-lg hover:bg-emerald-500 transition-all duration-300 text-white text-[11px]">
                <MessageCircle size={16} className="text-emerald-400" /> Chat on WhatsApp
              </a>
            </div>
          </nav>
          <div className="px-5 py-3 border-t border-white/[0.04] bg-black/20">
            <div className="mb-3 flex justify-center"><LanguageSwitcher variant="footer" /></div>
            {isAuthenticated ? (
              <div className="flex flex-col gap-1.5">
                <Link href={`/profile/${user.id}`} onClick={closeDrawer} className="min-h-[36px] flex items-center gap-2 text-white text-[11px] font-bold hover:text-amber-300"><LayoutGrid size={14} /> Account Settings</Link>
                <button onClick={() => { closeDrawer(); logout(); }} className="min-h-[36px] px-3 rounded-sm flex items-center gap-2 text-rose-400 hover:bg-rose-400/5 text-[11px] font-bold"><LogOut size={14} /> Sign out</button>
              </div>
            ) : (
              <Link href="/login" onClick={closeDrawer} className="bg-amber-500 hover:bg-white hover:text-ink text-[#0A0807] px-4 py-2.5 text-center rounded-sm block text-[11px] font-bold tracking-wide transition-all">Sign In</Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}