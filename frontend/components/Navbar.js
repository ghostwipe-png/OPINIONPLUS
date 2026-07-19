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
      className={`transition-colors focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none rounded-sm pb-0.5 border-b-2 ${
        active ? 'text-signal border-signal' : 'text-white/80 border-transparent hover:text-signal'
      } ${className}`}
    >
      {children}
    </Link>
  );
}

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { stories } = useStore();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('op_unread_count');
      const parsed = saved ? parseInt(saved, 10) : 0;
      setUnreadCount(Number.isFinite(parsed) ? parsed : 0);
    } catch (e) {
      /* ignore */
    }
  }, []);

  // Keep the badge loosely in sync with how many stories the store knows about,
  // as a stand-in until a real notifications feed exists.
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
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex items-center justify-between h-16">
          <Link
            href="/"
            className="flex items-baseline gap-2 group focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none rounded-sm"
          >
            <span className="editorial-h text-2xl font-extrabold tracking-tight text-white">
              OPINION<span className="text-signal">PLUS</span>
            </span>
            <span className="hidden min-[400px]:inline wire-tag text-white/50">
              every voice, a masthead
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-5 text-sm font-medium" aria-label="Primary">
            <SearchBar />
            <NavLink href="/">Feed</NavLink>
            <NavLink href="/pricing" className="flex items-center gap-1">
              <Gift size={14} /> Partner
            </NavLink>

            <button
              onClick={clearUnread}
              className="relative text-white/80 hover:text-signal transition-colors focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none rounded-sm"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-signal text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  {unreadCount}
                </span>
              )}
            </button>

            <PushNotificationToggle />
            {isAuthenticated && (
              <NavLink href="/publish" className="flex items-center gap-1.5">
                <PenSquare size={15} /> Publish
              </NavLink>
            )}
            <Link
              href="/read-later"
              className="text-white/50 hover:text-white transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none rounded-sm"
              title="Read Later"
            >
              <Bookmark size={14} />
            </Link>
            {isAdmin && (
              <NavLink href="/admin" className="flex items-center gap-1.5">
                <ShieldCheck size={15} /> Admin
              </NavLink>
            )}
            {isAuthenticated ? (
              <div className="flex items-center gap-3 pl-3 border-l border-ink-700">
                <Link
                  href={`/profile/${user.id}`}
                  className="nameplate focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none rounded-sm"
                >
                  {user.logoUrl ? (
                    <img src={user.logoUrl} alt={user.publisherName} className="nameplate-seal" />
                  ) : (
                    <span className="nameplate-seal grid place-items-center text-white">
                      <UserIcon size={14} />
                    </span>
                  )}
                  <span className="text-sm font-semibold text-white">{user.publisherName}</span>
                </Link>
                <button
                  onClick={logout}
                  className="text-white/50 hover:text-signal transition-colors focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none rounded-sm"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <Link href="/login" className="btn-primary px-4 py-2 text-sm rounded-sm">
                Sign in
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3 md:hidden">
            <button
              className="text-white focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none rounded-sm"
              onClick={() => setMobileSearchOpen((o) => !o)}
              aria-label="Toggle search"
              aria-expanded={mobileSearchOpen}
            >
              <Search size={20} />
            </button>
            <button
              className="relative text-white focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none rounded-sm"
              onClick={clearUnread}
              aria-label="Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-1 rounded-full bg-signal text-white text-[9px] font-bold flex items-center justify-center leading-none">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              className="text-white focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none rounded-sm"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
            >
              <Menu size={22} />
            </button>
          </div>
        </div>

        {mobileSearchOpen && (
          <div className="md:hidden pb-4">
            <SearchBar />
          </div>
        )}
      </div>

      {/* Mobile drawer */}
      <div
        className={`md:hidden fixed inset-0 z-50 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!open}
      >
        <div
          className="absolute inset-0 bg-black/60"
          onClick={closeDrawer}
        />
        <div
          className={`absolute top-0 right-0 h-full w-[85%] max-w-sm bg-ink shadow-xl transition-transform duration-300 ease-out flex flex-col ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          <div className="flex items-center justify-between px-5 h-16 border-b border-ink-700">
            <span className="editorial-h text-lg font-extrabold text-white">
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
                <img src={user.logoUrl} alt={user.publisherName} className="nameplate-seal w-10 h-10" />
              ) : (
                <span className="nameplate-seal w-10 h-10 grid place-items-center text-white">
                  <UserIcon size={18} />
                </span>
              )}
              <div>
                <p className="text-white font-semibold text-sm">{user.publisherName}</p>
                <p className="text-white/50 text-xs">View profile</p>
              </div>
            </Link>
          )}

          <nav className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-1 text-sm font-medium">
            <Link
              href="/"
              onClick={closeDrawer}
              className={`flex items-center min-h-[44px] ${pathname === '/' ? 'text-signal' : 'text-white'}`}
            >
              Feed
            </Link>
            <Link
              href="/pricing"
              onClick={closeDrawer}
              className={`flex items-center gap-2 min-h-[44px] ${pathname === '/pricing' ? 'text-signal' : 'text-white'}`}
            >
              <Gift size={16} /> Partner Program
            </Link>

            <button
              onClick={() => {
                clearUnread();
              }}
              className="flex items-center justify-between min-h-[44px] text-white text-left"
            >
              <span className="flex items-center gap-2">
                <Bell size={16} /> Notifications
              </span>
              {unreadCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-signal text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  {unreadCount}
                </span>
              )}
            </button>

            <div className="border-t border-ink-700 my-2" />

            {isAuthenticated && (
              <Link
                href="/publish"
                onClick={closeDrawer}
                className={`flex items-center gap-2 min-h-[44px] ${pathname === '/publish' ? 'text-signal' : 'text-white'}`}
              >
                <PenSquare size={16} /> Publish
              </Link>
            )}
            <Link
              href="/read-later"
              onClick={closeDrawer}
              className={`flex items-center gap-2 min-h-[44px] ${pathname === '/read-later' ? 'text-signal' : 'text-white'}`}
            >
              <Bookmark size={16} /> Read Later
            </Link>
            <div className="py-1">
              <PushNotificationToggle />
            </div>

            {isAdmin && (
              <>
                <div className="border-t border-ink-700 my-2" />
                <Link
                  href="/admin"
                  onClick={closeDrawer}
                  className={`flex items-center gap-2 min-h-[44px] ${pathname === '/admin' ? 'text-signal' : 'text-white'}`}
                >
                  <ShieldCheck size={16} /> Admin
                </Link>
              </>
            )}
          </nav>

          <div className="px-5 py-4 border-t border-ink-700">
            {isAuthenticated ? (
              <>
                <Link
                  href={`/profile/${user.id}`}
                  onClick={closeDrawer}
                  className="flex items-center gap-2 min-h-[44px] text-white"
                >
                  <LayoutGrid size={16} /> My profile
                </Link>
                <button
                  onClick={() => {
                    closeDrawer();
                    logout();
                  }}
                  className="flex items-center gap-2 min-h-[44px] text-left text-signal"
                >
                  <LogOut size={16} /> Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={closeDrawer}
                className="btn-primary px-4 py-2 text-center rounded-sm block"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
