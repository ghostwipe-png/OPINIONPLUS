'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Users as UsersIcon,
  FileText,
  Flag,
  ShieldPlus,
  Activity,
  ScrollText,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useStore, setAdminPin } from '../../lib/store';

const DEMO_PIN = '1234';
const IDLE_LIMIT_MS = 5 * 60 * 1000;

function PinGate({ onConfirm, onCancel, label }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  return (
    <div className="fixed inset-0 bg-ink/60 grid place-items-center z-50 px-4">
      <div className="bg-paper rounded-sm p-6 w-full max-w-sm border border-wire">
        <p className="wire-tag mb-2 flex items-center gap-1.5">
          <Lock size={12} /> Confirm with PIN
        </p>
        <p className="text-sm text-ink-600 mb-4">{label}</p>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => { setPin(e.target.value); setError(false); }}
          placeholder="4-digit PIN"
          className="w-full border-b border-wire focus:border-ink outline-none py-2 text-lg tracking-widest text-center"
          autoFocus
        />
        {error && <p className="text-signal text-xs mt-2">Incorrect PIN. Try again.</p>}
        <p className="text-xs text-ink-400 mt-2">Demo PIN is {DEMO_PIN}.</p>
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} className="btn-outline flex-1 py-2 rounded-sm text-sm">
            Cancel
          </button>
          <button
            onClick={() => (pin === DEMO_PIN ? (setAdminPin(pin), onConfirm()) : setError(true))}
            className="btn-primary flex-1 py-2 rounded-sm text-sm"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user, isAdmin, isRoot, ready } = useAuth();
  const {
    users,
    stories,
    reports,
    admins,
    adminLogs,
    setUserSuspended,
    setMediaBlocked,
    adminDeleteStory,
    addAdmin,
    removeAdmin,
    resolveReport,
  } = useStore();

  const [tab, setTab] = useState('users');
  const [search, setSearch] = useState('');
  const [pinAction, setPinAction] = useState(null);
  const [locked, setLocked] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const idleTimer = useRef(null);

  const resetIdle = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setLocked(true), IDLE_LIMIT_MS);
  };

  useEffect(() => {
    if (!isAdmin) return;
    resetIdle();
    const events = ['mousemove', 'keydown', 'click'];
    events.forEach((ev) => window.addEventListener(ev, resetIdle));
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetIdle));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [isAdmin]);

  if (!ready) return null;

  if (!isAdmin) {
    return (
      <div className="max-w-lg mx-auto px-5 py-32 text-center">
        <p className="editorial-h text-6xl font-black mb-4">404</p>
        <p className="text-ink-400 text-sm">This page could not be found.</p>
        <Link href="/" className="text-signal text-sm font-medium mt-4 inline-block">
          Back to the feed
        </Link>
      </div>
    );
  }

  const runGated = (label, fn) => setPinAction({ label, run: fn });

  const filteredUsers = users.filter(
    (u) =>
      u.publisherName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const activeStories = stories.filter((s) => !s.deleted);
  const openReports = reports.filter((r) => !r.resolved);

  const TABS = [
    { id: 'users', label: 'Users', icon: UsersIcon },
    { id: 'content', label: 'Content', icon: FileText },
    { id: 'reports', label: `Reports${openReports.length ? ` (${openReports.length})` : ''}`, icon: Flag },
    ...(isRoot ? [{ id: 'admins', label: 'Admins', icon: ShieldPlus }] : []),
    { id: 'health', label: 'Health', icon: Activity },
    { id: 'log', label: 'Audit log', icon: ScrollText },
  ];

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">
      {locked && (
        <PinGate
          label="Session locked after 5 minutes of inactivity. Re-enter your PIN to continue."
          onConfirm={() => { setLocked(false); resetIdle(); }}
          onCancel={() => setLocked(false)}
        />
      )}
      {pinAction && (
        <PinGate
          label={pinAction.label}
          onConfirm={() => { pinAction.run(); setPinAction(null); }}
          onCancel={() => setPinAction(null)}
        />
      )}

      <p className="wire-tag mb-2">{isRoot ? 'Root admin' : 'Admin'} console</p>
      <h1 className="editorial-h text-3xl font-bold mb-8">Moderation &amp; platform control</h1>

      <div className="flex gap-2 flex-wrap mb-8 text-xs font-semibold">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 rounded-sm border flex items-center gap-1.5 ${
              tab === t.id ? 'bg-ink text-paper border-ink' : 'border-wire text-ink-600'
            }`}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="border border-wire rounded-sm px-3 py-2 text-sm mb-4 w-full max-w-sm"
          />
          <div className="border border-wire rounded-sm divide-y divide-wire">
            {filteredUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <img src={u.logoUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                  <div>
                    <p className="text-sm font-semibold">{u.publisherName}</p>
                    <p className="text-xs text-ink-400">{u.email}</p>
                  </div>
                  {u.suspended && <span className="text-xs text-signal font-semibold">Suspended</span>}
                </div>
                {u.email !== user.email && (
                  <button
                    onClick={() =>
                      runGated(
                        u.suspended ? `Unsuspend ${u.publisherName}?` : `Suspend ${u.publisherName}?`,
                        () => setUserSuspended(u.id, !u.suspended, user.email)
                      )
                    }
                    className={`text-xs font-semibold px-3 py-1.5 rounded-sm border ${
                      u.suspended ? 'border-wire' : 'border-signal text-signal'
                    }`}
                  >
                    {u.suspended ? 'Unsuspend' : 'Suspend'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'content' && (
        <div className="border border-wire rounded-sm divide-y divide-wire">
          {activeStories.map((s) => {
            const author = users.find((u) => u.id === s.authorId);
            return (
              <div key={s.id} className="flex items-center justify-between p-3 flex-wrap gap-2">
                <div>
                  <Link href={`/story/${s.id}`} className="text-sm font-semibold hover:text-signal">
                    {s.title}
                  </Link>
                  <p className="text-xs text-ink-400">
                    {author?.publisherName} · {s.type} · {s.privacy}
                    {s.mediaBlocked && <span className="text-signal"> · media blocked</span>}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      runGated(
                        s.mediaBlocked ? 'Unblock this media?' : 'Block media for this post?',
                        () => setMediaBlocked(s.id, !s.mediaBlocked, user.email)
                      )
                    }
                    className="text-xs font-semibold px-3 py-1.5 rounded-sm border border-wire"
                  >
                    {s.mediaBlocked ? 'Unblock media' : 'Block media'}
                  </button>
                  <button
                    onClick={() =>
                      runGated('Delete this post permanently?', () =>
                        adminDeleteStory(s.id, user.email)
                      )
                    }
                    className="text-xs font-semibold px-3 py-1.5 rounded-sm border border-signal text-signal"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'reports' && (
        <div className="border border-wire rounded-sm divide-y divide-wire">
          {reports.length === 0 && <p className="p-4 text-sm text-ink-400">No reports filed.</p>}
          {reports.map((r) => {
            const story = stories.find((s) => s.id === r.storyId);
            return (
              <div key={r.id} className="flex items-center justify-between p-3 flex-wrap gap-2">
                <div>
                  <p className="text-sm font-semibold">{story?.title || 'Deleted post'}</p>
                  <p className="text-xs text-ink-400">
                    {r.reason} · {new Date(r.createdAt).toLocaleString()}
                    {r.resolved && <span className="text-ink-400"> · resolved</span>}
                  </p>
                </div>
                {!r.resolved && (
                  <button
                    onClick={() => resolveReport(r.id)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-sm border border-wire"
                  >
                    Mark resolved
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'admins' && isRoot && (
        <div>
          <div className="flex gap-2 mb-4 max-w-md">
            <input
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="admin@example.com"
              className="flex-1 border border-wire rounded-sm px-3 py-2 text-sm"
            />
            <button
              onClick={() =>
                runGated(`Grant admin access to ${newAdminEmail}?`, () => {
                  addAdmin(newAdminEmail, user.email);
                  setNewAdminEmail('');
                })
              }
              className="btn-primary px-4 py-2 rounded-sm text-sm"
            >
              Add admin
            </button>
          </div>
          <div className="border border-wire rounded-sm divide-y divide-wire">
            <div className="p-3 flex items-center justify-between">
              <span className="text-sm font-semibold">{user.email}</span>
              <span className="text-xs text-ink-400 font-semibold">Root — cannot be removed</span>
            </div>
            {admins.map((email) => (
              <div key={email} className="p-3 flex items-center justify-between">
                <span className="text-sm">{email}</span>
                <button
                  onClick={() => runGated(`Remove admin access for ${email}?`, () => removeAdmin(email, user.email))}
                  className="text-xs font-semibold text-signal"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'health' && (
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            ['Total users', users.length],
            ['Published stories', activeStories.filter((s) => s.privacy === 'public').length],
            ['Suspended accounts', users.filter((u) => u.suspended).length],
            ['Open reports', openReports.length],
            ['Blocked media', activeStories.filter((s) => s.mediaBlocked).length],
            ['Admin actions logged', adminLogs.length],
          ].map(([label, value]) => (
            <div key={label} className="border border-wire rounded-sm p-4">
              <p className="text-3xl font-bold editorial-h">{value}</p>
              <p className="text-xs text-ink-400 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'log' && (
        <div className="border border-wire rounded-sm divide-y divide-wire">
          {adminLogs.length === 0 && <p className="p-4 text-sm text-ink-400">No admin actions yet.</p>}
          {adminLogs.map((l) => (
            <div key={l.id} className="p-3 text-sm">
              <span className="font-semibold">{l.actorEmail}</span> · {l.action.replaceAll('_', ' ')} ·{' '}
              <span className="text-ink-400">{l.target}</span>
              <span className="text-xs text-ink-400 block">
                {new Date(l.timestamp).toLocaleString()} · IP logged server-side in production
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}