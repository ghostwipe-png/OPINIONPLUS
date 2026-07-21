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
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useStore } from '../lib/store';
import PushNotificationToggle from './PushNotificationToggle';
import SearchBar from './SearchBar';

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
  const [open, setOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const isMasterAdmin = user?.email === 'adipotech@gmail.com';

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('op_unread_count');
      const parsed = saved ? parseInt(saved, 10) : 0;
      setUnreadCount(Number.isFinite(parsed) ? parsed : 0);
    } catch (e) {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!stories || stories.length === 0) return;
    try {
      const saved = window.localStorage.getItem('op_unread_count');
      if (saved === null) {
        window.localStorage.setItem('op_unread_count', String(Math.min(stories.length, 9)));
        setUnreadCount(Math.min(stories.length, 9));
      }
    } catch (e) {
      /* ignore */
    }
  }, [stories]);

  const clearUnread = () => {
    setUnreadCount(0);
    try {
      window.localStorage.setItem('op_unread_count', '0');
    } catch (e) {
      /* ignore */
    }
  };

  const closeDrawer = () => setOpen(false);

  return (
    <header className="border-b border-ink-700 bg-ink sticky top-0 z-40">
      <div className="max-w-[96rem] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-20">
          
          {/* LEFT: Primary Navigation Links */}
          <nav className="hidden lg:flex items-center gap-2.5 xl:gap-5" aria-label="Primary">
            <NavLink href="/">Feed</NavLink>
            <NavLink href="/?type=story">Stories</NavLink>
            <NavLink href="/?type=documentary">Docs</NavLink>
            <NavLink href="/rooms">Spaces</NavLink>
            <NavLink href="/services">Services</NavLink>
            <NavLink href="/campuses">Campus</NavLink>
            <NavLink href="/jobs">Jobs</NavLink>
            <NavLink href="/pricing">Partner</NavLink>
          </nav>

          {/* CENTER: Centered Brand Logo / Title */}
          <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none">
            <Link
              href="/"
              className="inline-block group pointer-events-auto focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none rounded-sm"
            >
              <span className="editorial-h text-lg xl:text-xl font-black tracking-[0.22em] text-white block">
                OPINION<span className="text-signal">PLUS</span>
              </span>
              <span className="text-[8px] xl:text-[9px] tracking-[0.28em] uppercase text-white/50 block mt-0.5 whitespace-nowrap">
                every voice, a masthead
              </span>
            </Link>
          </div>

          {/* RIGHT: Action & Utility Links */}
          <nav className="hidden lg:flex items-center gap-3 xl:gap-5" aria-label="Utility">
            <button
              onClick={() => setMobileSearchOpen((o) => !o)}
              className="tracking-[0.08em] uppercase text-[10px] xl:text-[11px] font-semibold text-white/75 hover:text-signal transition-colors focus-visible:outline-none whitespace-nowrap"
            >
              Search
            </button>
            <Link
              href="/read-later"
              className="tracking-[0.08em] uppercase text-[10px] xl:text-[11px] font-semibold text-white/75 hover:text-signal transition-colors focus-visible:outline-none whitespace-nowrap"
            >
              Saved
            </Link>
            {isMasterAdmin && (
              <Link
                href="/admin"
                className={`tracking-[0.08em] uppercase text-[10px] xl:text-[11px] font-semibold transition-colors focus-visible:outline-none flex items-center gap-1 whitespace-nowrap ${
                  pathname === '/admin' ? 'text-signal' : 'text-white/75 hover:text-signal'
                }`}
              >
                <ShieldCheck size={13} /> Admin
              </Link>
            )}
            {isAuthenticated ? (
              <Link
                href={`/profile/${user.id}`}
                className="tracking-[0.08em] uppercase text-[10px] xl:text-[11px] font-semibold text-white/75 hover:text-signal transition-colors focus-visible:outline-none flex items-center gap-1.5 whitespace-nowrap"
              >
                {user.logoUrl ? (
                  <img src={user.logoUrl} alt={user.publisherName} className="w-4 h-4 xl:w-5 xl:h-5 rounded-full object-cover border border-white/20" />
                ) : (
                  <UserIcon size={13} />
                )}
                <span>Account</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="tracking-[0.08em] uppercase text-[10px] xl:text-[11px] font-semibold text-white/75 hover:text-signal transition-colors focus-visible:outline-none whitespace-nowrap"
              >
                Sign In
              </Link>
            )}
            <Link
              href="/publish"
              className="bg-signal text-white px-3 py-1.5 xl:px-3.5 xl:py-2 rounded-sm tracking-[0.12em] uppercase text-[9px] xl:text-[10px] font-bold hover:bg-white hover:text-ink transition-colors shadow-sm whitespace-nowrap"
            >
              Publish
            </Link>
          </nav>

          {/* MOBILE TOGGLES */}
          <div className="flex items-center gap-3 lg:hidden ml-auto z-10">
            <button
              className="text-white p-1 focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none rounded-sm"
              onClick={() => setMobileSearchOpen((o) => !o)}
              aria-label="Toggle search"
              aria-expanded={mobileSearchOpen}
            >
              <Search size={20} />
            </button>
            <button
              className="relative text-white p-1 focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none rounded-sm"
              onClick={clearUnread}
              aria-label="Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-signal text-white text-[9px] font-bold flex items-center justify-center leading-none">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              className="text-white p-1 focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none rounded-sm"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
            >
              <Menu size={22} />
            </button>
          </div>
        </div>

        {mobileSearchOpen && (
          <div className="lg:hidden pb-4 pt-2 animate-in fade-in duration-200">
            <SearchBar />
          </div>
        )}
      </div>

      {/* Mobile Drawer with Smooth Slide & Backdrop Fade */}
      <div
        className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-300 ease-out ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!open}
      >
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
          onClick={closeDrawer}
        />
        <div
          className={`absolute top-0 right-0 h-full w-[85%] max-w-sm bg-ink shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          <div className="flex items-center justify-between px-5 h-20 border-b border-ink-700">
            <span className="editorial-h text-lg font-extrabold text-white tracking-[0.2em]">
              OPINION<span className="text-signal">PLUS</span>
            </span>
            <button
              className="text-white min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none rounded-sm"
              onClick={closeDrawer}
              aria-label="Close menu"
            >
              <X size={22} />
            </button>
          </div>

          {isAuthenticated && (
            <Link
              href={`/profile/${user.id}`}
              onClick={closeDrawer}
              className="flex items-center gap-3 px-5 py-4 border-b border-ink-700 focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none"
            >
              {user.logoUrl ? (
                <img src={user.logoUrl} alt={user.publisherName} className="nameplate-seal w-10 h-10 object-cover rounded-full" />
              ) : (
                <span className="nameplate-seal w-10 h-10 grid place-items-center text-white bg-ink-800 rounded-full">
                  <UserIcon size={18} />
                </span>
              )}
              <div>
                <p className="text-white font-semibold text-sm">{user.publisherName}</p>
                <p className="text-white/50 text-xs">View profile</p>
              </div>
            </Link>
          )}

          <nav className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-1 text-xs font-semibold tracking-[0.12em] uppercase">
            <Link
              href="/"
              onClick={closeDrawer}
              className={`flex items-center min-h-[40px] px-2 rounded-sm ${pathname === '/' ? 'text-signal bg-white/5' : 'text-white/90 hover:bg-white/5'}`}
            >
              Feed
            </Link>
            <Link
              href="/?type=story"
              onClick={closeDrawer}
              className={`flex items-center min-h-[40px] px-2 rounded-sm text-white/90 hover:bg-white/5`}
            >
              Stories
            </Link>
            <Link
              href="/?type=documentary"
              onClick={closeDrawer}
              className={`flex items-center min-h-[40px] px-2 rounded-sm text-white/90 hover:bg-white/5`}
            >
              Documentaries
            </Link>
            <Link
              href="/rooms"
              onClick={closeDrawer}
              className={`flex items-center gap-2.5 min-h-[40px] px-2 rounded-sm ${pathname === '/rooms' ? 'text-signal bg-white/5' : 'text-white/90 hover:bg-white/5'}`}
            >
              <Radio size={15} /> Live Audio Spaces
            </Link>
            <Link
              href="/services"
              onClick={closeDrawer}
              className={`flex items-center gap-2.5 min-h-[40px] px-2 rounded-sm ${pathname === '/services' ? 'text-signal bg-white/5' : 'text-white/90 hover:bg-white/5'}`}
            >
              <Wrench size={15} /> Services
            </Link>
            <Link
              href="/campuses"
              onClick={closeDrawer}
              className={`flex items-center gap-2.5 min-h-[40px] px-2 rounded-sm ${pathname === '/campuses' ? 'text-signal bg-white/5' : 'text-white/90 hover:bg-white/5'}`}
            >
              <GraduationCap size={15} /> Campus Editions
            </Link>
            <Link
              href="/jobs"
              onClick={closeDrawer}
              className={`flex items-center gap-2.5 min-h-[40px] px-2 rounded-sm ${pathname === '/jobs' ? 'text-signal bg-white/5' : 'text-white/90 hover:bg-white/5'}`}
            >
              <Briefcase size={15} /> Jobs Board
            </Link>
            <Link
              href="/pricing"
              onClick={closeDrawer}
              className={`flex items-center gap-2.5 min-h-[40px] px-2 rounded-sm ${pathname === '/pricing' ? 'text-signal bg-white/5' : 'text-white/90 hover:bg-white/5'}`}
            >
              <Gift size={15} /> Partner Program
            </Link>

            <div className="border-t border-ink-700 my-3" />

            {isAuthenticated && (
              <Link
                href="/publish"
                onClick={closeDrawer}
                className={`flex items-center gap-2.5 min-h-[40px] px-2 rounded-sm ${pathname === '/publish' ? 'text-signal bg-white/5' : 'text-white/90 hover:bg-white/5'}`}
              >
                <PenSquare size={15} /> Publish Story
              </Link>
            )}
            <Link
              href="/read-later"
              onClick={closeDrawer}
              className={`flex items-center gap-2.5 min-h-[40px] px-2 rounded-sm ${pathname === '/read-later' ? 'text-signal bg-white/5' : 'text-white/90 hover:bg-white/5'}`}
            >
              <Bookmark size={15} /> Saved Articles
            </Link>
            <div className="py-2 px-2">
              <PushNotificationToggle />
            </div>

            {isMasterAdmin && (
              <>
                <div className="border-t border-ink-700 my-3" />
                <Link
                  href="/admin"
                  onClick={closeDrawer}
                  className={`flex items-center gap-2.5 min-h-[40px] px-2 rounded-sm ${pathname === '/admin' ? 'text-signal bg-white/5' : 'text-white/90 hover:bg-white/5'}`}
                >
                  <ShieldCheck size={15} /> Admin Dashboard
                </Link>
              </>
            )}
          </nav>

          <div className="px-5 py-4 border-t border-ink-700 bg-ink-900/50">
            {isAuthenticated ? (
              <div className="flex flex-col gap-2">
                <Link
                  href={`/profile/${user.id}`}
                  onClick={closeDrawer}
                  className="flex items-center gap-2.5 min-h-[38px] text-white uppercase text-[11px] font-bold tracking-[0.12em] hover:text-signal transition-colors"
                >
                  <LayoutGrid size={15} /> Account Settings
                </Link>
                <button
                  onClick={() => {
                    closeDrawer();
                    logout();
                  }}
                  className="flex items-center gap-2.5 min-h-[38px] text-left text-signal uppercase text-[11px] font-bold tracking-[0.12em] hover:opacity-80 transition-opacity"
                >
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={closeDrawer}
                className="bg-signal text-white px-4 py-3 text-center rounded-sm block uppercase text-[11px] font-bold tracking-[0.12em] hover:bg-white hover:text-ink transition-colors shadow-sm"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}