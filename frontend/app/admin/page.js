'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Users as UsersIcon, FileText, Flag, ShieldPlus, Activity, ScrollText, Lock,
  CreditCard, MessageSquare, Search, Wallet, CheckCircle, Mail, Download, TrendingUp,
  Archive, Eye, Trash2, CheckCheck, XCircle, Filter, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useStore, setAdminPin } from '../../lib/store';

const DEMO_PIN = '1234';
const IDLE_LIMIT_MS = 5 * 60 * 1000;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function PinGate({ onConfirm, onCancel, label }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  return (
    <div className="fixed inset-0 bg-ink/60 grid place-items-center z-50 px-4">
      <div className="bg-paper rounded-sm p-6 w-full max-w-sm border border-wire">
        <p className="wire-tag mb-2 flex items-center gap-1.5"><Lock size={12} /> Confirm with PIN</p>
        <p className="text-sm text-ink-600 mb-4">{label}</p>
        <input type="password" inputMode="numeric" value={pin} onChange={(e) => { setPin(e.target.value); setError(false); }} placeholder="4-digit PIN" className="w-full border-b border-wire focus:border-ink outline-none py-2 text-lg tracking-widest text-center" autoFocus />
        {error && <p className="text-signal text-xs mt-2">Incorrect PIN. Try again.</p>}
        <p className="text-xs text-ink-400 mt-2">Demo PIN is {DEMO_PIN}.</p>
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} className="btn-outline flex-1 py-2 rounded-sm text-sm">Cancel</button>
          <button onClick={() => (pin === DEMO_PIN ? (setAdminPin(pin), onConfirm()) : setError(true))} className="btn-primary flex-1 py-2 rounded-sm text-sm">Confirm</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user, isAdmin, isRoot, ready } = useAuth();
  const { users, stories, reports, admins, adminLogs, setUserSuspended, setMediaBlocked, adminDeleteStory, addAdmin, removeAdmin, resolveReport } = useStore();

  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [pinAction, setPinAction] = useState(null);
  const [locked, setLocked] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [smsHistory, setSmsHistory] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [searchAnalytics, setSearchAnalytics] = useState({ top: [], recent: [], total: 0 });
  const [filterStatus, setFilterStatus] = useState('all');
  const idleTimer = useRef(null);

  // Archive state
  const [archiveItems, setArchiveItems] = useState([]);
  const [archivePage, setArchivePage] = useState(1);
  const [archiveTotal, setArchiveTotal] = useState(0);
  const [archiveTotalPages, setArchiveTotalPages] = useState(1);
  const [archiveStatus, setArchiveStatus] = useState('pending');
  const [archiveSource, setArchiveSource] = useState('');
  const [archiveSearch, setArchiveSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [archiveStats, setArchiveStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, bySource: [] });
  const [approveType, setApproveType] = useState('news');
  const [approvePrivacy, setApprovePrivacy] = useState('public');
  const [previewItem, setPreviewItem] = useState(null);

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

  const loadAllData = async () => {
    try {
      const [txnRes, smsRes, wdRes, subRes, searchRes] = await Promise.all([
        fetch(`${API_BASE}/payments/history`, { credentials: 'include' }).then(r => r.json()).catch(() => ({ transactions: [] })),
        fetch(`${API_BASE}/sms/history`, { credentials: 'include' }).then(r => r.json()).catch(() => ({ history: [] })),
        fetch(`${API_BASE}/partner/earnings`, { credentials: 'include' }).then(r => r.json()).catch(() => ({ withdrawals: [] })),
        fetch(`${API_BASE}/subscriptions/admin/list`, { credentials: 'include' }).then(r => r.json()).catch(() => ({ subscribers: [], total: 0, active: 0 })),
        fetch(`${API_BASE}/stories/search/analytics`, { credentials: 'include' }).then(r => r.json()).catch(() => ({ top: [], recent: [], total: 0 })),
      ]);
      setTransactions(txnRes.transactions || []);
      setSmsHistory(smsRes.history || []);
      setWithdrawals(wdRes.withdrawals || []);
      setSubscribers(subRes.subscribers || []);
      setSearchAnalytics(searchRes);
    } catch (e) { /* ignore */ }
  };

  const loadArchive = async () => {
    try {
      const params = new URLSearchParams({ status: archiveStatus, page: archivePage, limit: 50 });
      if (archiveSource) params.append('source', archiveSource);
      if (archiveSearch) params.append('q', archiveSearch);
      const res = await fetch(`${API_BASE}/archive?${params}`, { credentials: 'include' });
      const data = await res.json();
      setArchiveItems(data.items || []);
      setArchiveTotal(data.total || 0);
      setArchiveTotalPages(data.totalPages || 1);
    } catch (e) { /* ignore */ }
  };

  const loadArchiveStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/archive/stats`, { credentials: 'include' });
      const data = await res.json();
      setArchiveStats(data);
    } catch (e) { /* ignore */ }
  };

  const approveItem = async (id) => {
    try {
      await fetch(`${API_BASE}/archive/${id}/approve`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: approveType, privacy: approvePrivacy }),
      });
      loadArchive(); loadArchiveStats();
    } catch (e) { console.error(e); }
  };

  const rejectItem = async (id) => {
    try {
      await fetch(`${API_BASE}/archive/${id}`, { method: 'DELETE', credentials: 'include' });
      loadArchive(); loadArchiveStats();
    } catch (e) { console.error(e); }
  };

  const bulkApprove = async () => {
    if (selectedItems.length === 0) return;
    try {
      await fetch(`${API_BASE}/archive/bulk-approve`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedItems, type: approveType, privacy: approvePrivacy }),
      });
      setSelectedItems([]); loadArchive(); loadArchiveStats();
    } catch (e) { console.error(e); }
  };

  const bulkReject = async () => {
    if (selectedItems.length === 0) return;
    try {
      await fetch(`${API_BASE}/archive/bulk-delete`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedItems }),
      });
      setSelectedItems([]); loadArchive(); loadArchiveStats();
    } catch (e) { console.error(e); }
  };

  const toggleSelect = (id) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selectedItems.length === archiveItems.length) setSelectedItems([]);
    else setSelectedItems(archiveItems.map(i => i.id));
  };

  const exportCSV = () => window.open(`${API_BASE}/subscriptions/admin/export`, '_blank');
  const markWithdrawalComplete = async (id) => {
    try {
      await fetch(`${API_BASE}/partner/withdrawal/${id}/complete`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
      loadAllData();
    } catch (e) { console.error(e); }
  };

  useEffect(() => { if (tab === 'archive') { loadArchive(); loadArchiveStats(); } }, [tab, archivePage, archiveStatus, archiveSource]);

  if (!ready) return null;
  if (!isAdmin) return (
    <div className="max-w-lg mx-auto px-5 py-32 text-center">
      <p className="editorial-h text-6xl font-black mb-4">404</p>
      <p className="text-ink-400 text-sm">This page could not be found.</p>
      <Link href="/" className="text-signal text-sm font-medium mt-4 inline-block">Back to the feed</Link>
    </div>
  );

  const runGated = (label, fn) => setPinAction({ label, run: fn });
  const filteredUsers = users.filter(u => u.publisherName?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()));
  const activeStories = stories.filter(s => !s.deleted);
  const openReports = reports.filter(r => !r.resolved);
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');
  const proUsers = users.filter(u => u.tier === 'partner' || u.tier === 'pro_partner');
  const activeSubscribers = subscribers.filter(s => s.status === 'active');

  const TABS = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'archive', label: `Archive (${archiveStats.pending || 0})`, icon: Archive },
    { id: 'users', label: `Users (${users.length})`, icon: UsersIcon },
    { id: 'content', label: `Content (${activeStories.length})`, icon: FileText },
    { id: 'reports', label: `Reports${openReports.length ? ` (${openReports.length})` : ''}`, icon: Flag },
    { id: 'withdrawals', label: `Withdrawals${pendingWithdrawals.length ? ` (${pendingWithdrawals.length})` : ''}`, icon: Wallet },
    { id: 'transactions', label: 'Transactions', icon: CreditCard },
    { id: 'sms', label: 'SMS Logs', icon: MessageSquare },
    { id: 'subscribers', label: `Subscribers (${activeSubscribers.length})`, icon: Mail },
    { id: 'search', label: 'Search Analytics', icon: TrendingUp },
    ...(isRoot ? [{ id: 'admins', label: 'Admins', icon: ShieldPlus }] : []),
    { id: 'log', label: 'Audit log', icon: ScrollText },
  ];

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">
      {locked && <PinGate label="Session locked after 5 minutes of inactivity." onConfirm={() => { setLocked(false); resetIdle(); }} onCancel={() => setLocked(false)} />}
      {pinAction && <PinGate label={pinAction.label} onConfirm={() => { pinAction.run(); setPinAction(null); }} onCancel={() => setPinAction(null)} />}
      <p className="wire-tag mb-2">{isRoot ? 'Root admin' : 'Admin'} console</p>
      <h1 className="editorial-h text-3xl font-bold mb-2">Platform Control</h1>
      <p className="text-xs text-ink-400 mb-8">{users.length} users · {activeStories.length} stories · {archiveStats.total || 0} archived</p>

      <div className="flex gap-2 flex-wrap mb-8 text-xs font-semibold">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); if (['transactions', 'sms', 'withdrawals', 'subscribers', 'search'].includes(t.id)) loadAllData(); }}
            className={`px-3 py-2 rounded-sm border flex items-center gap-1.5 ${tab === t.id ? 'bg-ink text-paper border-ink' : 'border-wire text-ink-600'}`}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* ====== ARCHIVE TAB ====== */}
      {tab === 'archive' && (
        <div>
          {/* Stats bar */}
          <div className="flex gap-3 mb-4 flex-wrap text-xs">
            <span className="px-2 py-1 rounded-full bg-ink-50">📦 {archiveStats.total || 0} total</span>
            <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700">⏳ {archiveStats.pending || 0} pending</span>
            <span className="px-2 py-1 rounded-full bg-green-50 text-green-700">✅ {archiveStats.approved || 0} approved</span>
            <span className="px-2 py-1 rounded-full bg-red-50 text-red-700">🗑️ {archiveStats.rejected || 0} rejected</span>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <select value={archiveStatus} onChange={(e) => { setArchiveStatus(e.target.value); setArchivePage(1); }} className="text-xs border border-wire rounded-sm px-2 py-1.5">
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </select>
            <select value={archiveSource} onChange={(e) => { setArchiveSource(e.target.value); setArchivePage(1); }} className="text-xs border border-wire rounded-sm px-2 py-1.5">
              <option value="">All Sources</option>
              {(archiveStats.bySource || []).map(s => <option key={s.source_name} value={s.source_name}>{s.source_name} ({s.count})</option>)}
            </select>
            <input value={archiveSearch} onChange={(e) => setArchiveSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (setArchivePage(1), loadArchive())} placeholder="Search archive..." className="text-xs border border-wire rounded-sm px-2 py-1.5 flex-1 max-w-xs" />
            <button onClick={() => { setArchivePage(1); loadArchive(); }} className="text-xs px-3 py-1.5 rounded-sm bg-ink text-paper">Search</button>
          </div>

          {/* Approve settings */}
          {archiveStatus === 'pending' && (
            <div className="flex gap-2 mb-4 items-center text-xs flex-wrap">
              <span className="text-ink-400">Approve as:</span>
              <select value={approveType} onChange={(e) => setApproveType(e.target.value)} className="border border-wire rounded-sm px-2 py-1">
                <option value="news">News</option>
                <option value="story">Story</option>
                <option value="documentary">Documentary</option>
              </select>
              <select value={approvePrivacy} onChange={(e) => setApprovePrivacy(e.target.value)} className="border border-wire rounded-sm px-2 py-1">
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
              {selectedItems.length > 0 && (
                <div className="flex gap-1">
                  <button onClick={bulkApprove} className="px-2 py-1 rounded-sm bg-ink text-paper flex items-center gap-1"><CheckCheck size={12} /> Approve ({selectedItems.length})</button>
                  <button onClick={bulkReject} className="px-2 py-1 rounded-sm bg-red-100 text-signal flex items-center gap-1"><Trash2 size={12} /> Reject ({selectedItems.length})</button>
                </div>
              )}
            </div>
          )}

          {/* Items */}
          <div className="border border-wire rounded-sm divide-y divide-wire">
            {archiveItems.length === 0 && <p className="p-4 text-sm text-ink-400">No items found.</p>}
            {archiveItems.map(item => (
              <div key={item.id} className={`p-3 flex items-start gap-3 ${selectedItems.includes(item.id) ? 'bg-ink-50' : ''}`}>
                <input type="checkbox" checked={selectedItems.includes(item.id)} onChange={() => toggleSelect(item.id)} className="mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-ink-50">{item.source_name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${item.status === 'pending' ? 'bg-amber-50 text-amber-700' : item.status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{item.status}</span>
                  </div>
                  <p className="text-sm font-semibold mb-0.5">{item.title}</p>
                  <p className="text-xs text-ink-400 line-clamp-2">{item.excerpt}</p>
                  <p className="text-xs text-ink-400 mt-1">{new Date(item.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setPreviewItem(item)} className="text-xs px-2 py-1 rounded-sm border border-wire hover:bg-ink-50" title="Preview"><Eye size={12} /></button>
                  {item.status === 'pending' && (
                    <>
                      <button onClick={() => approveItem(item.id)} className="text-xs px-2 py-1 rounded-sm bg-ink text-paper" title="Approve"><CheckCircle size={12} /></button>
                      <button onClick={() => rejectItem(item.id)} className="text-xs px-2 py-1 rounded-sm bg-red-100 text-signal" title="Reject"><XCircle size={12} /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {archiveTotalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-xs">
              <button onClick={() => setArchivePage(p => Math.max(1, p - 1))} disabled={archivePage === 1} className="px-3 py-1.5 rounded-sm border border-wire disabled:opacity-30 flex items-center gap-1"><ChevronLeft size={12} /> Prev</button>
              <span className="text-ink-400">Page {archivePage} of {archiveTotalPages} ({archiveTotal} items)</span>
              <button onClick={() => setArchivePage(p => Math.min(archiveTotalPages, p + 1))} disabled={archivePage === archiveTotalPages} className="px-3 py-1.5 rounded-sm border border-wire disabled:opacity-30 flex items-center gap-1">Next <ChevronRight size={12} /></button>
            </div>
          )}

          {/* Preview modal */}
          {previewItem && (
            <div className="fixed inset-0 bg-ink/60 z-50 grid place-items-center px-4" onClick={() => setPreviewItem(null)}>
              <div className="bg-paper rounded-sm border border-wire w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-wire flex items-center justify-between">
                  <h3 className="text-sm font-bold">{previewItem.title}</h3>
                  <button onClick={() => setPreviewItem(null)}><XCircle size={18} /></button>
                </div>
                <div className="p-5">
                  <p className="text-xs text-ink-400 mb-3">Source: {previewItem.source_name} · {new Date(previewItem.created_at).toLocaleString()}</p>
                  {previewItem.cover_image && <img src={previewItem.cover_image} alt="" className="w-full rounded-sm mb-4" />}
                  <div className="prose-story text-sm" dangerouslySetInnerHTML={{ __html: previewItem.body }} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}