'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PenSquare, ShieldCheck, LogOut, LayoutGrid, User as UserIcon, Menu, X } from 'lucide-react';
import { useAuth } from '../lib/auth';

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-wire bg-paper/95 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-baseline gap-2 group">
            <span className="editorial-h text-2xl font-extrabold tracking-tight">
              OPINION<span className="text-signal">PLUS</span>
            </span>
            <span className="hidden sm:inline wire-tag">every voice, a masthead</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link href="/" className="hover:text-signal transition-colors">
              Feed
            </Link>
            {isAuthenticated && (
              <Link href="/publish" className="hover:text-signal transition-colors flex items-center gap-1.5">
                <PenSquare size={15} /> Publish
              </Link>
            )}
            {isAdmin && (
              <Link href="/admin" className="hover:text-signal transition-colors flex items-center gap-1.5">
                <ShieldCheck size={15} /> Admin
              </Link>
            )}
            {isAuthenticated ? (
              <div className="flex items-center gap-3 pl-3 border-l border-wire">
                <Link href={`/profile/${user.id}`} className="nameplate">
                  {user.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.logoUrl} alt={user.publisherName} className="nameplate-seal" />
                  ) : (
                    <span className="nameplate-seal grid place-items-center">
                      <UserIcon size={14} />
                    </span>
                  )}
                  <span className="text-sm font-semibold">{user.publisherName}</span>
                </Link>
                <button
                  onClick={logout}
                  className="text-ink-400 hover:text-signal transition-colors"
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

          <button className="md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-wire px-5 py-4 flex flex-col gap-4 text-sm font-medium">
          <Link href="/" onClick={() => setOpen(false)}>
            Feed
          </Link>
          {isAuthenticated && (
            <Link href="/publish" onClick={() => setOpen(false)} className="flex items-center gap-2">
              <PenSquare size={15} /> Publish
            </Link>
          )}
          {isAdmin && (
            <Link href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2">
              <ShieldCheck size={15} /> Admin
            </Link>
          )}
          {isAuthenticated ? (
            <>
              <Link href={`/profile/${user.id}`} onClick={() => setOpen(false)} className="flex items-center gap-2">
                <LayoutGrid size={15} /> My profile
              </Link>
              <button onClick={logout} className="flex items-center gap-2 text-left text-signal">
                <LogOut size={15} /> Sign out
              </button>
            </>
          ) : (
            <Link href="/login" onClick={() => setOpen(false)} className="btn-primary px-4 py-2 text-center rounded-sm">
              Sign in
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
