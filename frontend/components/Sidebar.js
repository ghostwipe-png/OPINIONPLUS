'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Flame, Tv, Clock, Bookmark, ThumbsUp, ListVideo,
  Film, Upload, ChevronLeft, ChevronRight, Menu, Play,
  Library, History, User
} from 'lucide-react';
import { useAuth } from '../lib/auth';

const MAIN_LINKS = [
  { href: '/videos', icon: Home, label: 'Home' },
  { href: '/videos?sort=trending', icon: Flame, label: 'Trending' },
  { href: '/subscriptions', icon: Tv, label: 'Subscriptions' },
];

const LIBRARY_LINKS = [
  { href: '/library', icon: Library, label: 'Library' },
  { href: '/library?tab=history', icon: History, label: 'History' },
  { href: '/library?tab=watch-later', icon: Clock, label: 'Watch Later' },
  { href: '/library?tab=liked', icon: ThumbsUp, label: 'Liked Videos' },
  { href: '/library?tab=playlists', icon: ListVideo, label: 'Playlists' },
];

const CREATOR_LINKS = [
  { href: '/library?tab=my-videos', icon: Film, label: 'Your Videos' },
  { href: '/upload/video', icon: Upload, label: 'Upload' },
];

export default function Sidebar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [showMoreLibrary, setShowMoreLibrary] = useState(false);

  const isActive = (href) => {
    if (href === '/videos' && pathname === '/videos') return true;
    if (href.includes('?') && pathname + (typeof window !== 'undefined' ? window.location.search : '') === href) return true;
    if (href !== '/videos' && pathname.startsWith(href.split('?')[0])) return true;
    return false;
  };

  const visibleLibraryLinks = showMoreLibrary ? LIBRARY_LINKS : LIBRARY_LINKS.slice(0, 3);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-ink text-white p-2 rounded-full shadow-lg"
        aria-label="Toggle sidebar"
      >
        <Menu size={18} />
      </button>

      {/* Overlay for mobile */}
      {!collapsed && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setCollapsed(true)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-16 left-0 h-[calc(100vh-64px)] bg-paper border-r border-wire z-40 transition-all duration-200 overflow-y-auto overflow-x-hidden ${
          collapsed ? '-translate-x-full lg:translate-x-0 lg:w-16' : 'translate-x-0 w-56'
        }`}
      >
        {/* Collapse toggle (desktop) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center w-full py-2 text-ink-400 hover:text-ink transition-colors border-b border-wire"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <nav className="py-2">
          {/* Main Links */}
          <div className="px-2 space-y-0.5">
            {MAIN_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setCollapsed(true)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? 'bg-ink-50 text-ink font-semibold'
                    : 'text-ink-600 hover:bg-ink-50 hover:text-ink'
                }`}
              >
                <link.icon size={20} className="shrink-0" />
                {!collapsed && <span className="truncate">{link.label}</span>}
              </Link>
            ))}
          </div>

          {/* Divider */}
          <div className="mx-4 my-2 border-t border-wire" />

          {/* Library Section */}
          {user && (
            <>
              {!collapsed && (
                <p className="px-5 py-1 text-[10px] font-bold uppercase tracking-widest text-ink-400">
                  Library
                </p>
              )}
              <div className="px-2 space-y-0.5">
                {visibleLibraryLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setCollapsed(true)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                      isActive(link.href)
                        ? 'bg-ink-50 text-ink font-semibold'
                        : 'text-ink-600 hover:bg-ink-50 hover:text-ink'
                    }`}
                  >
                    <link.icon size={20} className="shrink-0" />
                    {!collapsed && <span className="truncate">{link.label}</span>}
                  </Link>
                ))}
                {!collapsed && LIBRARY_LINKS.length > 3 && (
                  <button
                    onClick={() => setShowMoreLibrary(!showMoreLibrary)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-ink-500 hover:text-ink hover:bg-ink-50 transition-colors w-full"
                  >
                    <ChevronRight
                      size={20}
                      className={`shrink-0 transition-transform ${showMoreLibrary ? 'rotate-90' : ''}`}
                    />
                    <span>{showMoreLibrary ? 'Show less' : `Show ${LIBRARY_LINKS.length - 3} more`}</span>
                  </button>
                )}
              </div>

              {/* Divider */}
              <div className="mx-4 my-2 border-t border-wire" />

              {/* Creator Links */}
              {!collapsed && (
                <p className="px-5 py-1 text-[10px] font-bold uppercase tracking-widest text-ink-400">
                  Creator
                </p>
              )}
              <div className="px-2 space-y-0.5">
                {CREATOR_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setCollapsed(true)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                      isActive(link.href)
                        ? 'bg-ink-50 text-ink font-semibold'
                        : 'text-ink-600 hover:bg-ink-50 hover:text-ink'
                    }`}
                  >
                    <link.icon size={20} className="shrink-0" />
                    {!collapsed && <span className="truncate">{link.label}</span>}
                  </Link>
                ))}
              </div>
            </>
          )}

          {/* Sign-in prompt */}
          {!user && (
            <div className="px-4 py-4">
              <p className="text-xs text-ink-500 mb-3 leading-relaxed">
                Sign in to access your library, history, and playlists.
              </p>
              <Link
                href="/login"
                className="flex items-center gap-2 text-sm font-semibold text-signal hover:underline"
              >
                <User size={18} />
                <span>Sign in</span>
              </Link>
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}