'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Users as UsersIcon, FileText, Flag, ShieldPlus, Activity, ScrollText, Lock, CreditCard,
  MessageSquare, Search, Wallet, CheckCircle, Mail, Download, Archive, Eye, Trash2, CheckCheck,
  XCircle, ChevronLeft, ChevronRight, TrendingUp, Settings, Shield, LogOut, Sun, Moon, Menu,
  RefreshCw, Loader2, X, Check, Star, AlertTriangle, Package, Zap, ChevronDown, ChevronUp,
  KeyRound, Server, FileDown, UserCog, Clock,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useStore, setAdminPin } from '../../lib/store';

const DEMO_PIN = '1234';
const IDLE_LIMIT_MS = 5 * 60 * 1000;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function getCsrfToken() {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function adminFetch(path, { method = 'GET', body, pin, pinValue } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (method !== 'GET') headers['X-CSRF-Token'] = getCsrfToken();
  if (pin) headers['X-Admin-Pin'] = pinValue || DEMO_PIN;
  const res = await fetch(`${API_BASE}${path}`, {
    method, credentials: 'include', headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}

function fmtMoney(cents) {
  return `KES ${(Number(cents || 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function tierBadgeClasses(tier) {
  switch (tier) {
    case 'partner': return 'bg-blue-50 text-blue-700';
    case 'pro_partner': return 'bg-amber-50 text-amber-700';
    case 'admin': return 'bg-purple-50 text-purple-700';
    case 'root': return 'bg-red-50 text-signal';
    default: return 'bg-ink-50 text-ink-600';
  }
}

function tierLabel(tier) {
  switch (tier) {
    case 'partner': return 'Partner';
    case 'pro_partner': return 'Pro Partner';
    case 'admin': return 'Admin';
    case 'root': return 'Root';
    default: return 'Basic';
  }
}

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
          <button onClick={() => (pin === DEMO_PIN ? (setAdminPin(pin), onConfirm(pin)) : setError(true))} className="btn-primary flex-1 py-2 rounded-sm text-sm">Confirm</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({ label, detail, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-ink/60 grid place-items-center z-50 px-4">
      <div className="bg-paper rounded-sm p-6 w-full max-w-sm border border-wire">
        <p className="wire-tag mb-2 flex items-center gap-1.5"><AlertTriangle size={12} /> Please confirm</p>
        <p className="text-sm font-semibold mb-1">{label}</p>
        {detail && <p className="text-xs text-ink-400 mb-4">{detail}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} className="btn-outline flex-1 py-2 rounded-sm text-sm">Cancel</button>
          <button onClick={onConfirm} className="btn-primary flex-1 py-2 rounded-sm text-sm">Confirm</button>
        </div>
      </div>
    </div>
  );
}

function ToastStack({ toasts, dismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-xs w-full">
      {toasts.map((t) => (
        <div key={t.id} onClick={() => dismiss(t.id)}
          className={`px-4 py-3 rounded-sm shadow-lg text-sm text-paper cursor-pointer flex items-start gap-2 ${t.type === 'error' ? 'bg-signal' : t.type === 'warn' ? 'bg-amber-600' : 'bg-ink'}`}>
          {t.type === 'error' ? <XCircle size={14} className="mt-0.5 shrink-0" /> : <CheckCircle size={14} className="mt-0.5 shrink-0" />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

function Spinner({ size = 14 }) {
  return <Loader2 size={size} className="animate-spin" />;
}

function EmptyState({ icon: Icon = Package, label }) {
  return (
    <div className="p-8 text-center">
      <Icon size={28} className="mx-auto mb-2 text-ink-300" />
      <p className="text-sm text-ink-400">{label}</p>
    </div>
  );
}

function SparkBars({ values = [], labelFmt = (v) => v }) {
  const max = Math.max(1, ...values.map((v) => v.value));
  return (
    <div className="flex items-end gap-1 h-16">
      {values.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${v.label}: ${labelFmt(v.value)}`}>
          <div className="w-full bg-ink rounded-sm" style={{ height: `${Math.max(4, (v.value / max) * 56)}px`, opacity: 0.25 + 0.75 * (v.value / max) }} />
        </div>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const { user, isAdmin, isRoot, ready } = useAuth();
  const {
    users, stories, reports, admins, adminLogs,
    setUserSuspended, setMediaBlocked, adminDeleteStory, addAdmin, removeAdmin, resolveReport,
  } = useStore();

  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [pinAction, setPinAction] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [locked, setLocked] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [smsHistory, setSmsHistory] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const idleTimer = useRef(null);
  const searchInputRef = useRef(null);
  const lastPinRef = useRef(DEMO_PIN);

  // Archive
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
  const [searchAnalytics, setSearchAnalytics] = useState({ top: [], recent: [], total: 0 });

  // UI / God-mode state
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [loadingTabs, setLoadingTabs] = useState({});
  const [health, setHealth] = useState('unknown');

  // Users enhancements
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userTierFilter, setUserTierFilter] = useState('all');

  // Content enhancements
  const [contentSort, setContentSort] = useState('newest');
  const [contentSourceFilter, setContentSourceFilter] = useState('');
  const [featuredIds, setFeaturedIds] = useState([]);

  // Financial enhancements
  const [txnDateFrom, setTxnDateFrom] = useState('');
  const [txnDateTo, setTxnDateTo] = useState('');
  const [txnStatusFilter, setTxnStatusFilter] = useState('all');
  const [txnMethodFilter, setTxnMethodFilter] = useState('all');
  const [txnSearchQ, setTxnSearchQ] = useState('');
  const [creditAdjustEmail, setCreditAdjustEmail] = useState('');
  const [creditAdjustAmount, setCreditAdjustAmount] = useState('');
  const [creditAdjustReason, setCreditAdjustReason] = useState('');

  // Settings (root only)
  const [platformSettings, setPlatformSettings] = useState({ name: '', description: '', maintenanceMode: false, socialLinks: [] });
  const [systemLogs, setSystemLogs] = useState([]);

  // Security (root only)
  const [activeSessions, setActiveSessions] = useState([]);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);

  // News management
  const [newsEnabled, setNewsEnabled] = useState(true);
  const [newsArticles, setNewsArticles] = useState([]);
  const [selectedNewsIds, setSelectedNewsIds] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);

  const showToast = useCallback((message, type = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);
  const dismissToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const setLoading = (key, val) => setLoadingTabs((prev) => ({ ...prev, [key]: val }));

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
    setLoading('financial', true);
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
      setHealth('ok');
    } catch (e) {
      setHealth('error');
    } finally {
      setLoading('financial', false);
    }
  };

  const exportCSV = () => {
    window.open(`${API_BASE}/subscriptions/admin/export`, '_blank');
  };

  const loadArchive = async () => {
    setLoading('archive', true);
    try {
      const params = new URLSearchParams({ status: archiveStatus, page: archivePage, limit: 50 });
      if (archiveSource) params.append('source', archiveSource);
      if (archiveSearch) params.append('q', archiveSearch);
      const res = await fetch(`${API_BASE}/archive?${params}`, { credentials: 'include' });
      const data = await res.json();
      setArchiveItems(data.items || []); setArchiveTotal(data.total || 0); setArchiveTotalPages(data.totalPages || 1);
    } catch (e) {} finally { setLoading('archive', false); }
  };

  const loadArchiveStats = async () => {
    try { const res = await fetch(`${API_BASE}/archive/stats`, { credentials: 'include' }); const data = await res.json(); setArchiveStats(data); } catch (e) {}
  };

  const approveItem = async (id) => {
    try {
      await fetch(`${API_BASE}/archive/${id}/approve`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() }, body: JSON.stringify({ type: approveType, privacy: approvePrivacy }) });
      showToast('Archive item approved');
      loadArchive(); loadArchiveStats();
    } catch (e) { showToast('Failed to approve item', 'error'); }
  };

  const rejectItem = async (id) => {
    try {
      await fetch(`${API_BASE}/archive/${id}`, { method: 'DELETE', credentials: 'include', headers: { 'X-CSRF-Token': getCsrfToken() } });
      showToast('Archive item rejected');
      loadArchive(); loadArchiveStats();
    } catch (e) { showToast('Failed to reject item', 'error'); }
  };

  const bulkApprove = async () => {
    if (selectedItems.length === 0) return;
    try {
      await fetch(`${API_BASE}/archive/bulk-approve`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() }, body: JSON.stringify({ ids: selectedItems, type: approveType, privacy: approvePrivacy }) });
      showToast(`${selectedItems.length} items approved`);
      setSelectedItems([]); loadArchive(); loadArchiveStats();
    } catch (e) { showToast('Bulk approve failed', 'error'); }
  };

  const bulkReject = async () => {
    if (selectedItems.length === 0) return;
    try {
      await fetch(`${API_BASE}/archive/bulk-delete`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() }, body: JSON.stringify({ ids: selectedItems }) });
      showToast(`${selectedItems.length} items rejected`);
      setSelectedItems([]); loadArchive(); loadArchiveStats();
    } catch (e) { showToast('Bulk reject failed', 'error'); }
  };

  const approveAllPending = async () => {
    try {
      setLoading('archive', true);
      const params = new URLSearchParams({ status: 'pending', page: 1, limit: 500 });
      const res = await fetch(`${API_BASE}/archive?${params}`, { credentials: 'include' });
      const data = await res.json();
      const ids = (data.items || []).map((i) => i.id);
      if (!ids.length) { showToast('No pending items'); return; }
      await fetch(`${API_BASE}/archive/bulk-approve`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() }, body: JSON.stringify({ ids, type: 'news', privacy: 'public' }) });
      showToast(`Approved ${ids.length} pending items`);
      loadArchiveStats();
      if (tab === 'archive') loadArchive();
    } catch (e) { showToast('Approve all failed', 'error'); } finally { setLoading('archive', false); }
  };

  const toggleSelect = (id) => setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  useEffect(() => { if (tab === 'archive') { loadArchive(); loadArchiveStats(); } }, [tab, archivePage, archiveStatus, archiveSource]);

  const markWithdrawalComplete = async (id) => {
    try {
      await fetch(`${API_BASE}/partner/withdrawal/${id}/complete`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() } });
      showToast('Withdrawal marked complete');
      loadAllData();
    } catch (e) { console.error(e); showToast('Failed to update withdrawal', 'error'); }
  };

  const loadSettings = async () => {
    setLoading('settings', true);
    try {
      const data = await adminFetch('/admin/settings');
      setPlatformSettings({ name: data.name || '', description: data.description || '', maintenanceMode: !!data.maintenanceMode, socialLinks: data.socialLinks || [] });
    } catch (e) {}
    try {
      const logs = await adminFetch('/admin/logs');
      setSystemLogs(logs.entries || logs.logs || []);
    } catch (e) { setSystemLogs([]); }
    setLoading('settings', false);
  };

  const saveSettings = async () => {
    try {
      await adminFetch('/admin/settings', { method: 'POST', body: platformSettings });
      showToast('Settings saved');
    } catch (e) { showToast('Failed to save settings', 'error'); }
  };

  const clearCache = async () => {
    try { await adminFetch('/admin/clear-cache', { method: 'POST' }); showToast('Cache cleared'); }
    catch (e) { showToast('Failed to clear cache', 'error'); }
  };

  const loadSecurity = async () => {
    setLoading('security', true);
    try { const s = await adminFetch('/admin/sessions'); setActiveSessions(s.sessions || []); }
    catch (e) { setActiveSessions([]); }
    try { const ev = await adminFetch('/admin/security-events'); setSecurityEvents(ev.events || []); }
    catch (e) { setSecurityEvents([]); }
    try { const keys = await adminFetch('/admin/api-keys'); setApiKeys(keys.keys || []); }
    catch (e) { setApiKeys([]); }
    setLoading('security', false);
  };

  const forceLogoutAllUsers = async () => {
    try { await adminFetch('/admin/force-logout-all', { method: 'POST', pin: true, pinValue: lastPinRef.current }); showToast('All users logged out'); }
    catch (e) { showToast('Failed to force logout all users', 'error'); }
  };

  const forceLogoutUser = async (id) => {
    try { await adminFetch(`/admin/user/${id}/force-logout`, { method: 'POST', pin: true, pinValue: lastPinRef.current }); showToast('User session cleared'); }
    catch (e) { showToast('Failed to force logout user', 'error'); }
  };

  const saveUserEdit = async () => {
    if (!editingUser) return;
    try {
      await adminFetch(`/admin/user/${editingUser.id}`, { method: 'PATCH', body: editingUser });
      showToast('User updated');
      setEditingUser(null);
    } catch (e) { showToast('Failed to update user', 'error'); }
  };

  const adjustCredits = async () => {
    if (!creditAdjustEmail || !creditAdjustAmount) { showToast('Enter an email and amount', 'error'); return; }
    try {
      await adminFetch('/admin/credit-adjust', { method: 'POST', pin: true, pinValue: lastPinRef.current, body: { email: creditAdjustEmail, amount: Number(creditAdjustAmount), reason: creditAdjustReason } });
      showToast(`Credits adjusted for ${creditAdjustEmail}`);
      setCreditAdjustEmail(''); setCreditAdjustAmount(''); setCreditAdjustReason('');
    } catch (e) { showToast('Credit adjustment failed', 'error'); }
  };

  const toggleFeatured = async (storyId) => {
    setFeaturedIds((prev) => prev.includes(storyId) ? prev.filter((i) => i !== storyId) : [...prev, storyId]);
    try { await adminFetch(`/admin/story/${storyId}/feature`, { method: 'POST', body: { featured: !featuredIds.includes(storyId) } }); }
    catch (e) {}
  };

  const exportEntity = (entity) => {
    if (entity === 'subscribers') return exportCSV();
    window.open(`${API_BASE}/admin/export/${entity}${entity === 'transactions' && (txnDateFrom || txnDateTo) ? `?from=${txnDateFrom}&to=${txnDateTo}` : ''}`, '_blank');
  };

  const exportAll = () => {
    ['users', 'transactions', 'stories', 'subscribers'].forEach((e, i) => setTimeout(() => exportEntity(e), i * 400));
    showToast('Exporting all datasets…');
  };

  // News management functions
  const loadNewsToggle = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/news/toggle`, { credentials: 'include' });
      const data = await res.json();
      setNewsEnabled(data.enabled !== false);
    } catch (e) {}
  };

  const loadNewsArticles = async () => {
    setNewsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/news/list`, { credentials: 'include' });
      const data = await res.json();
      setNewsArticles(data.news || []);
    } catch (e) { setNewsArticles([]); }
    setNewsLoading(false);
  };

  const toggleNewsEnabled = async () => {
    const newValue = !newsEnabled;
    setNewsEnabled(newValue);
    try {
      await adminFetch('/admin/news/toggle', { method: 'POST', pin: true, pinValue: lastPinRef.current, body: { enabled: newValue } });
      showToast(`News aggregation ${newValue ? 'enabled' : 'disabled'}`);
    } catch (e) {
      setNewsEnabled(!newValue);
      showToast('Failed to toggle news', 'error');
    }
  };

  const bulkDeleteNews = async () => {
    if (selectedNewsIds.length === 0) return;
    try {
      await adminFetch('/admin/news/bulk-delete', { method: 'POST', pin: true, pinValue: lastPinRef.current, body: { ids: selectedNewsIds } });
      showToast(`${selectedNewsIds.length} news articles deleted`);
      setSelectedNewsIds([]);
      loadNewsArticles();
    } catch (e) { showToast('Failed to delete news articles', 'error'); }
  };

  useEffect(() => { if (tab === 'settings' && isRoot) loadSettings(); }, [tab, isRoot]);
  useEffect(() => { if (tab === 'security' && isRoot) loadSecurity(); }, [tab, isRoot]);
  useEffect(() => { if (tab === 'news') { loadNewsToggle(); loadNewsArticles(); } }, [tab]);

  useEffect(() => {
    const handler = (e) => {
      if (!isAdmin) return;
      if (e.ctrlKey || e.metaKey) {
        const num = parseInt(e.key, 10);
        if (!Number.isNaN(num) && num >= 1 && num <= 9) {
          e.preventDefault();
          const t = TABS_REF.current[num - 1];
          if (t) setTab(t.id);
        } else if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          setTab('users');
          setTimeout(() => searchInputRef.current?.focus(), 50);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isAdmin]);

  const runGated = (label, fn) => setPinAction({ label, run: fn });
  const runConfirm = (label, detail, fn) => setConfirmAction({ label, detail, run: fn });

  if (!ready) return null;

  if (!isAdmin) {
    return (
      <div className="max-w-lg mx-auto px-5 py-32 text-center">
        <p className="editorial-h text-6xl font-black mb-4">404</p>
        <p className="text-ink-400 text-sm">This page could not be found.</p>
        <Link href="/" className="text-signal text-sm font-medium mt-4 inline-block">Back to the feed</Link>
      </div>
    );
  }

  const filteredUsers = users.filter(u =>
    u.publisherName?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  ).filter(u => {
    if (userTierFilter === 'all') return true;
    if (userTierFilter === 'suspended') return !!u.suspended;
    if (userTierFilter === 'basic') return !u.tier || u.tier === 'basic';
    return u.tier === userTierFilter;
  });

  const activeStories = stories.filter(s => !s.deleted);
  let filteredStories = filterStatus === 'all' ? activeStories :
    filterStatus === 'public' ? activeStories.filter(s => s.privacy === 'public') :
    filterStatus === 'private' ? activeStories.filter(s => s.privacy === 'private') :
    filterStatus === 'blocked' ? activeStories.filter(s => s.mediaBlocked) : activeStories;
  if (contentSourceFilter) filteredStories = filteredStories.filter(s => s.source === contentSourceFilter);
  filteredStories = [...filteredStories].sort((a, b) => {
    if (contentSort === 'liked') return (b.likes?.length || 0) - (a.likes?.length || 0);
    if (contentSort === 'commented') return (b.comments?.length || 0) - (a.comments?.length || 0);
    if (contentSort === 'reported') return reports.filter(r => r.storyId === b.id).length - reports.filter(r => r.storyId === a.id).length;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  const openReports = reports.filter(r => !r.resolved);
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');
  const proUsers = users.filter(u => u.tier === 'partner' || u.tier === 'pro_partner');
  const activeSubscribers = subscribers.filter(s => s.status === 'active');

  let filteredTxns = transactions;
  if (txnStatusFilter !== 'all') filteredTxns = filteredTxns.filter(t => t.status === txnStatusFilter);
  if (txnMethodFilter !== 'all') filteredTxns = filteredTxns.filter(t => (t.method || '').toLowerCase() === txnMethodFilter);
  if (txnDateFrom) filteredTxns = filteredTxns.filter(t => new Date(t.created_at) >= new Date(txnDateFrom));
  if (txnDateTo) filteredTxns = filteredTxns.filter(t => new Date(t.created_at) <= new Date(txnDateTo));
  if (txnSearchQ) filteredTxns = filteredTxns.filter(t => (t.reference || '').toLowerCase().includes(txnSearchQ.toLowerCase()) || (t.email || '').toLowerCase().includes(txnSearchQ.toLowerCase()));
  const totalRevenueAll = transactions.filter(t => t.status === 'completed').reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const now = new Date();
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const revenueToday = transactions.filter(t => t.status === 'completed' && isSameDay(new Date(t.created_at), now)).reduce((s, t) => s + Number(t.amount || 0), 0);
  const revenueWeek = transactions.filter(t => t.status === 'completed' && new Date(t.created_at) >= startOfWeek).reduce((s, t) => s + Number(t.amount || 0), 0);
  const revenueMonth = transactions.filter(t => t.status === 'completed' && new Date(t.created_at) >= startOfMonth).reduce((s, t) => s + Number(t.amount || 0), 0);
  const newSignupsToday = users.filter(u => u.createdAt && isSameDay(new Date(u.createdAt), now)).length;
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - (6 - i));
    const value = transactions.filter(t => t.status === 'completed' && isSameDay(new Date(t.created_at), d)).reduce((s, t) => s + Number(t.amount || 0), 0);
    return { label: d.toLocaleDateString(undefined, { weekday: 'short' }), value };
  });
  const storiesPerDay = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - (6 - i));
    const value = activeStories.filter(s => s.createdAt && isSameDay(new Date(s.createdAt), d)).length;
    return { label: d.toLocaleDateString(undefined, { weekday: 'short' }), value };
  });

  const CONTENT_SOURCES = ['BBC', 'Al Jazeera', 'Nation', 'Capital FM', 'Tuko'];

  const TABS = [
    { id: 'archive', label: 'Archive', icon: Archive },
    { id: 'news', label: 'News Management', icon: Zap },
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'users', label: `Users (${users.length})`, icon: UsersIcon },
    { id: 'content', label: `Content (${activeStories.length})`, icon: FileText },
    { id: 'reports', label: `Reports${openReports.length ? ` (${openReports.length})` : ''}`, icon: Flag },
    { id: 'withdrawals', label: `Withdrawals${pendingWithdrawals.length ? ` (${pendingWithdrawals.length})` : ''}`, icon: Wallet },
    { id: 'transactions', label: 'Transactions', icon: CreditCard },
    { id: 'sms', label: 'SMS Logs', icon: MessageSquare },
    { id: 'subscribers', label: `Subscribers (${activeSubscribers.length})`, icon: Mail },
    { id: 'search', label: 'Search Analytics', icon: TrendingUp },
    { id: 'export', label: 'Export Center', icon: FileDown },
    ...(isRoot ? [{ id: 'admins', label: 'Admins', icon: ShieldPlus }] : []),
    ...(isRoot ? [{ id: 'settings', label: 'System Settings', icon: Settings }] : []),
    ...(isRoot ? [{ id: 'security', label: 'Security Center', icon: Shield }] : []),
    { id: 'log', label: 'Audit log', icon: ScrollText },
  ];
  TABS_REF.current = TABS;

  const darkWrap = darkMode ? 'bg-ink text-paper' : '';
  const darkCard = darkMode ? 'border-ink-600 bg-ink-900/40' : 'border-wire';

  return (
    <div className={`min-h-screen ${darkWrap}`}>
      <div className="max-w-7xl mx-auto px-5 py-10">
        {locked && <PinGate label="Session locked after 5 minutes of inactivity." onConfirm={() => { setLocked(false); resetIdle(); }} onCancel={() => setLocked(false)} />}
        {pinAction && <PinGate label={pinAction.label} onConfirm={(pin) => { lastPinRef.current = pin || DEMO_PIN; pinAction.run(); setPinAction(null); }} onCancel={() => setPinAction(null)} />}
        {confirmAction && <ConfirmDialog label={confirmAction.label} detail={confirmAction.detail} onConfirm={() => { confirmAction.run(); setConfirmAction(null); }} onCancel={() => setConfirmAction(null)} />}
        <ToastStack toasts={toasts} dismiss={dismissToast} />

        <div className="flex items-start justify-between mb-2 gap-3 flex-wrap">
          <div>
            <p className="wire-tag mb-2 flex items-center gap-2">
              {isRoot ? 'Root admin' : 'Admin'} console
              <span className={`inline-block w-2 h-2 rounded-full ${health === 'ok' ? 'bg-green-500' : health === 'error' ? 'bg-signal' : 'bg-ink-300'}`} title={`System health: ${health}`} />
            </p>
            <h1 className="editorial-h text-3xl font-bold mb-2">Platform Control</h1>
            <p className="text-xs text-ink-400">{users.length} users · {activeStories.length} stories · {proUsers.length} pro · {activeSubscribers.length} subscribers</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setDarkMode(d => !d)} className={`p-2 rounded-sm border ${darkCard}`} title="Toggle admin dark mode">
              {darkMode ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button onClick={() => setSidebarCollapsed(c => !c)} className={`p-2 rounded-sm border ${darkCard} lg:hidden`} title="Toggle navigation">
              <Menu size={14} />
            </button>
          </div>
        </div>

        <div className="flex gap-6 mt-6 items-start">
          <aside className={`shrink-0 ${sidebarCollapsed ? 'w-12' : 'w-56'} transition-all duration-200 hidden sm:block`}>
            <button onClick={() => setSidebarCollapsed(c => !c)} className={`mb-2 w-full flex items-center gap-2 text-xs px-2 py-2 rounded-sm border ${darkCard}`}>
              <Menu size={13} /> {!sidebarCollapsed && 'Collapse'}
            </button>
            <nav className="flex flex-col gap-1">
              {TABS.map((t, i) => (
                <button key={t.id} onClick={() => { setTab(t.id); if (['transactions', 'sms', 'withdrawals', 'subscribers', 'archive', 'search', 'news'].includes(t.id)) { if (t.id === 'news') { loadNewsToggle(); loadNewsArticles(); } else loadAllData(); } }}
                  title={`Ctrl+${i + 1}`}
                  className={`px-3 py-2 rounded-sm border flex items-center gap-2 text-xs font-semibold text-left transition-colors ${tab === t.id ? 'bg-ink text-paper border-ink' : `${darkCard} text-ink-600`}`}>
                  <t.icon size={13} className="shrink-0" /> {!sidebarCollapsed && <span className="truncate">{t.label}</span>}
                </button>
              ))}
            </nav>
          </aside>

          <div className="flex gap-2 flex-wrap mb-2 text-xs font-semibold sm:hidden">
            {TABS.map(t => (
              <button key={t.id} onClick={() => { setTab(t.id); if (['transactions', 'sms', 'withdrawals', 'subscribers', 'archive', 'search', 'news'].includes(t.id)) { if (t.id === 'news') { loadNewsToggle(); loadNewsArticles(); } else loadAllData(); } }}
                className={`px-3 py-2 rounded-sm border flex items-center gap-1.5 ${tab === t.id ? 'bg-ink text-paper border-ink' : 'border-wire text-ink-600'}`}>
                <t.icon size={13} /> {t.label}
              </button>
            ))}
          </div>

          <main className="flex-1 min-w-0">

            {/* Archive */}
            {tab === 'archive' && (
              <div>
                <div className="flex gap-3 mb-4 flex-wrap text-xs items-center">
                  <span className="px-2 py-1 rounded-full bg-ink-50">📦 {archiveStats.total || 0} total</span>
                  <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700">⏳ {archiveStats.pending || 0} pending</span>
                  <span className="px-2 py-1 rounded-full bg-green-50 text-green-700">✅ {archiveStats.approved || 0} approved</span>
                  <span className="px-2 py-1 rounded-full bg-red-50 text-red-700">🗑️ {archiveStats.rejected || 0} rejected</span>
                  {loadingTabs.archive && <Spinner />}
                  <button onClick={() => runConfirm('Approve all pending archive items?', 'This will publish every pending item as News / Public.', approveAllPending)} className="ml-auto text-xs px-3 py-1.5 rounded-sm bg-ink text-paper flex items-center gap-1"><CheckCheck size={12} /> Approve all pending</button>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  <select value={archiveStatus} onChange={(e) => { setArchiveStatus(e.target.value); setArchivePage(1); }} className="text-xs border border-wire rounded-sm px-2 py-1.5">
                    <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All</option>
                  </select>
                  <select value={archiveSource} onChange={(e) => { setArchiveSource(e.target.value); setArchivePage(1); }} className="text-xs border border-wire rounded-sm px-2 py-1.5">
                    <option value="">All Sources</option>{(archiveStats.bySource || []).map(s => <option key={s.source_name} value={s.source_name}>{s.source_name} ({s.count})</option>)}
                  </select>
                  <input value={archiveSearch} onChange={(e) => setArchiveSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (setArchivePage(1), loadArchive())} placeholder="Search archive..." className="text-xs border border-wire rounded-sm px-2 py-1.5 flex-1 max-w-xs" />
                  <button onClick={() => { setArchivePage(1); loadArchive(); }} className="text-xs px-3 py-1.5 rounded-sm bg-ink text-paper">Search</button>
                </div>
                {archiveStatus === 'pending' && (
                  <div className="flex gap-2 mb-4 items-center text-xs flex-wrap">
                    <span className="text-ink-400">Approve as:</span>
                    <select value={approveType} onChange={(e) => setApproveType(e.target.value)} className="border border-wire rounded-sm px-2 py-1"><option value="news">News</option><option value="story">Story</option><option value="documentary">Documentary</option></select>
                    <select value={approvePrivacy} onChange={(e) => setApprovePrivacy(e.target.value)} className="border border-wire rounded-sm px-2 py-1"><option value="public">Public</option><option value="private">Private</option></select>
                    {selectedItems.length > 0 && (
                      <div className="flex gap-1">
                        <button onClick={bulkApprove} className="px-2 py-1 rounded-sm bg-ink text-paper flex items-center gap-1"><CheckCheck size={12} /> Approve ({selectedItems.length})</button>
                        <button onClick={bulkReject} className="px-2 py-1 rounded-sm bg-red-100 text-signal flex items-center gap-1"><Trash2 size={12} /> Reject ({selectedItems.length})</button>
                      </div>
                    )}
                  </div>
                )}
                <div className="border border-wire rounded-sm divide-y divide-wire">
                  {!loadingTabs.archive && archiveItems.length === 0 && <EmptyState icon={Archive} label="No items found." />}
                  {archiveItems.map(item => (
                    <div key={item.id} className={`p-3 flex items-start gap-3 ${selectedItems.includes(item.id) ? 'bg-ink-50' : ''}`}>
                      <input type="checkbox" checked={selectedItems.includes(item.id)} onChange={() => toggleSelect(item.id)} className="mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1"><span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-ink-50">{item.source_name}</span><span className={`text-xs px-1.5 py-0.5 rounded-full ${item.status === 'pending' ? 'bg-amber-50 text-amber-700' : item.status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{item.status}</span></div>
                        <p className="text-sm font-semibold mb-0.5">{item.title}</p><p className="text-xs text-ink-400 line-clamp-2">{item.excerpt}</p><p className="text-xs text-ink-400 mt-1">{new Date(item.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setPreviewItem(item)} className="text-xs px-2 py-1 rounded-sm border border-wire hover:bg-ink-50"><Eye size={12} /></button>
                        {item.status === 'pending' && (<><button onClick={() => approveItem(item.id)} className="text-xs px-2 py-1 rounded-sm bg-ink text-paper"><CheckCircle size={12} /></button><button onClick={() => rejectItem(item.id)} className="text-xs px-2 py-1 rounded-sm bg-red-100 text-signal"><XCircle size={12} /></button></>)}
                      </div>
                    </div>
                  ))}
                </div>
                {archiveTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 text-xs">
                    <button onClick={() => setArchivePage(p => Math.max(1, p - 1))} disabled={archivePage === 1} className="px-3 py-1.5 rounded-sm border border-wire disabled:opacity-30 flex items-center gap-1"><ChevronLeft size={12} /> Prev</button>
                    <span className="text-ink-400">Page {archivePage} of {archiveTotalPages} ({archiveTotal} items)</span>
                    <button onClick={() => setArchivePage(p => Math.min(archiveTotalPages, p + 1))} disabled={archivePage === archiveTotalPages} className="px-3 py-1.5 rounded-sm border border-wire disabled:opacity-30 flex items-center gap-1">Next <ChevronRight size={12} /></button>
                  </div>
                )}
                {previewItem && (
                  <div className="fixed inset-0 bg-ink/60 z-50 grid place-items-center px-4" onClick={() => setPreviewItem(null)}><div className="bg-paper rounded-sm border border-wire w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}><div className="p-5 border-b border-wire flex items-center justify-between"><h3 className="text-sm font-bold">{previewItem.title}</h3><button onClick={() => setPreviewItem(null)}><XCircle size={18} /></button></div><div className="p-5"><p className="text-xs text-ink-400 mb-3">Source: {previewItem.source_name} · {new Date(previewItem.created_at).toLocaleString()}</p>{previewItem.cover_image && <img src={previewItem.cover_image} alt="" className="w-full rounded-sm mb-4" />}<div className="prose-story text-sm" dangerouslySetInnerHTML={{ __html: previewItem.body }} /></div></div></div>
                )}
              </div>
            )}

            {/* News Management */}
            {tab === 'news' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="wire-tag flex items-center gap-1.5"><Zap size={12} /> News Management</p>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-ink-400">{newsArticles.length} articles</span>
                    <button
                      onClick={toggleNewsEnabled}
                      className={`relative w-12 h-6 rounded-full transition-colors ${newsEnabled ? 'bg-ink' : 'bg-ink-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-paper transition-transform ${newsEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                    <span className="text-xs font-semibold">{newsEnabled ? 'ON' : 'OFF'}</span>
                  </div>
                </div>

                {newsLoading ? (
                  <p className="text-xs text-ink-400 flex items-center gap-2"><Spinner /> Loading…</p>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={selectedNewsIds.length === newsArticles.length && newsArticles.length > 0}
                          onChange={() => {
                            if (selectedNewsIds.length === newsArticles.length) {
                              setSelectedNewsIds([]);
                            } else {
                              setSelectedNewsIds(newsArticles.map(n => n.id));
                            }
                          }}
                        />
                        Select all
                      </label>
                      {selectedNewsIds.length > 0 && (
                        <button
                          onClick={() => runGated(`Permanently delete ${selectedNewsIds.length} selected news articles? This cannot be undone.`, bulkDeleteNews)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-sm border border-signal text-signal flex items-center gap-1"
                        >
                          <Trash2 size={12} /> Delete selected ({selectedNewsIds.length})
                        </button>
                      )}
                    </div>

                    <div className="border border-wire rounded-sm divide-y divide-wire">
                      {newsArticles.length === 0 && <EmptyState icon={Zap} label="No news articles found." />}
                      {newsArticles.map(article => (
                        <div key={article.id} className={`p-3 flex items-start gap-3 ${selectedNewsIds.includes(article.id) ? 'bg-ink-50' : ''}`}>
                          <input
                            type="checkbox"
                            checked={selectedNewsIds.includes(article.id)}
                            onChange={() => setSelectedNewsIds(prev => prev.includes(article.id) ? prev.filter(id => id !== article.id) : [...prev, article.id])}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{article.title}</p>
                            <p className="text-xs text-ink-400 line-clamp-1">{article.excerpt}</p>
                            <p className="text-xs text-ink-400 mt-0.5">{new Date(article.created_at).toLocaleDateString()}</p>
                          </div>
                          <Link href={`/story/${article.id}`} className="text-xs px-2 py-1 rounded-sm border border-wire hover:bg-ink-50 shrink-0">
                            <Eye size={12} />
                          </Link>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Overview */}
            {tab === 'overview' && (
              <div>
                <div className="flex items-center justify-between p-4 border border-wire rounded-sm mb-4">
                  <div>
                    <p className="text-sm font-semibold">News Aggregation</p>
                    <p className="text-xs text-ink-400">Enable or disable automatic news fetching from RSS sources</p>
                  </div>
                  <button
                    onClick={toggleNewsEnabled}
                    className={`relative w-12 h-6 rounded-full transition-colors ${newsEnabled ? 'bg-ink' : 'bg-ink-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-paper transition-transform ${newsEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  <div className="border border-wire rounded-sm p-4">
                    <p className="text-xs text-ink-400 mb-1">Revenue Today</p>
                    <p className="text-2xl font-bold editorial-h">{fmtMoney(revenueToday)}</p>
                  </div>
                  <div className="border border-wire rounded-sm p-4">
                    <p className="text-xs text-ink-400 mb-1">Revenue This Week</p>
                    <p className="text-2xl font-bold editorial-h">{fmtMoney(revenueWeek)}</p>
                  </div>
                  <div className="border border-wire rounded-sm p-4">
                    <p className="text-xs text-ink-400 mb-1">Revenue This Month</p>
                    <p className="text-2xl font-bold editorial-h">{fmtMoney(revenueMonth)}</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  <div className="border border-wire rounded-sm p-4">
                    <p className="text-xs text-ink-400 mb-2">Revenue — last 7 days</p>
                    <SparkBars values={last7Days} labelFmt={fmtMoney} />
                    <div className="flex justify-between text-[10px] text-ink-400 mt-1">{last7Days.map((d, i) => <span key={i}>{d.label}</span>)}</div>
                  </div>
                  <div className="border border-wire rounded-sm p-4">
                    <p className="text-xs text-ink-400 mb-2">New stories — last 7 days</p>
                    <SparkBars values={storiesPerDay} />
                    <div className="flex justify-between text-[10px] text-ink-400 mt-1">{storiesPerDay.map((d, i) => <span key={i}>{d.label}</span>)}</div>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap mb-6">
                  <button onClick={() => runConfirm('Approve all pending archive items?', null, approveAllPending)} className="text-xs font-semibold px-3 py-2 rounded-sm bg-ink text-paper flex items-center gap-1"><CheckCheck size={13} /> Approve All Pending</button>
                  <button onClick={() => setTab('reports')} className="text-xs font-semibold px-3 py-2 rounded-sm border border-wire flex items-center gap-1"><Flag size={13} /> View Reports</button>
                  <button onClick={exportAll} className="text-xs font-semibold px-3 py-2 rounded-sm border border-wire flex items-center gap-1"><Download size={13} /> Export Data</button>
                  <button onClick={loadAllData} className="text-xs font-semibold px-3 py-2 rounded-sm border border-wire flex items-center gap-1"><RefreshCw size={13} /> Refresh</button>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    ['Total Users', users.length, '👥'],
                    ['Pro Users', proUsers.length, '⭐'],
                    ['New Signups Today', newSignupsToday, '🆕'],
                    ['Subscribers', activeSubscribers.length, '📧'],
                    ['Active Stories', activeStories.filter(s => s.privacy === 'public').length, '📝'],
                    ['Suspended', users.filter(u => u.suspended).length, '🚫'],
                    ['Open Reports', openReports.length, '🚩'],
                    ['Pending Withdrawals', pendingWithdrawals.length, '💳'],
                    ['Blocked Media', activeStories.filter(s => s.mediaBlocked).length, '🖼️'],
                    ['Total Revenue', fmtMoney(totalRevenueAll), '💰'],
                  ].map(([label, value, emoji]) => (
                    <div key={label} className="border border-wire rounded-sm p-4 hover:border-ink transition-colors">
                      <p className="text-2xl mb-1">{emoji}</p>
                      <p className="text-2xl font-bold editorial-h">{value}</p>
                      <p className="text-xs text-ink-400 mt-1">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Users */}
            {tab === 'users' && (
              <div>
                <div className="flex gap-2 mb-4 flex-wrap items-center">
                  <div className="relative flex-1 max-w-sm">
                    <Search size={14} className="absolute left-3 top-2.5 text-ink-400" />
                    <input ref={searchInputRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users... (Ctrl+S)" className="w-full border border-wire rounded-sm pl-9 pr-3 py-2 text-sm" />
                  </div>
                  <select value={userTierFilter} onChange={(e) => setUserTierFilter(e.target.value)} className="text-xs border border-wire rounded-sm px-2 py-2">
                    <option value="all">All tiers</option>
                    <option value="basic">Basic</option>
                    <option value="partner">Partner</option>
                    <option value="pro_partner">Pro Partner</option>
                    <option value="admin">Admin</option>
                    <option value="suspended">Suspended</option>
                  </select>
                  {selectedUsers.length > 0 && (
                    <div className="flex gap-1">
                      <button onClick={() => runGated(`Suspend ${selectedUsers.length} selected users?`, () => { selectedUsers.forEach(id => setUserSuspended(id, true, user.email)); showToast(`${selectedUsers.length} users suspended`); setSelectedUsers([]); })} className="text-xs font-semibold px-3 py-2 rounded-sm border border-signal text-signal">Suspend selected</button>
                      <button onClick={() => showToast('Exported selected users')} className="text-xs font-semibold px-3 py-2 rounded-sm border border-wire">Export selected</button>
                    </div>
                  )}
                </div>
                <div className="border border-wire rounded-sm divide-y divide-wire">
                  {filteredUsers.length === 0 && <EmptyState icon={UsersIcon} label="No users found." />}
                  {filteredUsers.map(u => {
                    const expanded = expandedUserId === u.id;
                    const isEditing = editingUser?.id === u.id;
                    const userTxns = transactions.filter(t => t.email === u.email);
                    const userStories = stories.filter(s => s.authorId === u.id && !s.deleted);
                    const userSms = smsHistory.filter(s => (s.recipients || '').includes(u.email));
                    return (
                      <div key={u.id} className="p-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-3">
                            <input type="checkbox" checked={selectedUsers.includes(u.id)} onChange={() => setSelectedUsers(prev => prev.includes(u.id) ? prev.filter(i => i !== u.id) : [...prev, u.id])} />
                            <img src={u.logoUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold">{u.publisherName}</p>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${tierBadgeClasses(u.role === 'root' ? 'root' : u.role === 'admin' ? 'admin' : u.tier)}`}>{tierLabel(u.role === 'root' ? 'root' : u.role === 'admin' ? 'admin' : u.tier)}</span>
                                {u.suspended && <span className="text-xs text-signal font-semibold">Suspended</span>}
                              </div>
                              <p className="text-xs text-ink-400">{u.email}</p>
                              <p className="text-xs text-ink-400">Joined {new Date(u.createdAt).toLocaleDateString()} · {userStories.length} stories</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setExpandedUserId(expanded ? null : u.id)} className="text-xs px-2 py-1 rounded-sm border border-wire flex items-center gap-1">{expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Activity</button>
                            <button onClick={() => setEditingUser(isEditing ? null : { id: u.id, publisherName: u.publisherName, email: u.email, tier: u.tier || 'basic' })} className="text-xs px-2 py-1 rounded-sm border border-wire flex items-center gap-1"><UserCog size={12} /> Edit</button>
                            <Link href={`/profile/${u.id}`} className="text-xs px-2 py-1 rounded-sm border border-wire hover:bg-ink-50">View</Link>
                            {u.email !== user.email && (
                              <>
                                <button onClick={() => runGated(`Force logout ${u.publisherName}?`, () => forceLogoutUser(u.id))} className="text-xs font-semibold px-2 py-1 rounded-sm border border-wire flex items-center gap-1"><LogOut size={12} /></button>
                                <button onClick={() => runGated(u.suspended ? `Unsuspend ${u.publisherName}?` : `Suspend ${u.publisherName}?`, () => setUserSuspended(u.id, !u.suspended, user.email))}
                                  className={`text-xs font-semibold px-3 py-1.5 rounded-sm border ${u.suspended ? 'border-wire' : 'border-signal text-signal'}`}>
                                  {u.suspended ? 'Unsuspend' : 'Suspend'}
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {isEditing && (
                          <div className="mt-3 p-3 border border-wire rounded-sm bg-ink-50 flex flex-wrap gap-2 items-end">
                            <div><label className="text-[10px] text-ink-400 block">Name</label><input value={editingUser.publisherName} onChange={(e) => setEditingUser({ ...editingUser, publisherName: e.target.value })} className="text-xs border border-wire rounded-sm px-2 py-1" /></div>
                            <div><label className="text-[10px] text-ink-400 block">Email</label><input value={editingUser.email} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} className="text-xs border border-wire rounded-sm px-2 py-1" /></div>
                            <div><label className="text-[10px] text-ink-400 block">Tier</label>
                              <select value={editingUser.tier} onChange={(e) => setEditingUser({ ...editingUser, tier: e.target.value })} className="text-xs border border-wire rounded-sm px-2 py-1">
                                <option value="basic">Basic</option><option value="partner">Partner</option><option value="pro_partner">Pro Partner</option>
                              </select>
                            </div>
                            <button onClick={saveUserEdit} className="text-xs px-3 py-1.5 rounded-sm bg-ink text-paper flex items-center gap-1"><Check size={12} /> Save</button>
                            <button onClick={() => setEditingUser(null)} className="text-xs px-3 py-1.5 rounded-sm border border-wire">Cancel</button>
                          </div>
                        )}

                        {expanded && (
                          <div className="mt-3 p-3 border border-wire rounded-sm grid sm:grid-cols-4 gap-3 text-center">
                            <div><p className="text-lg font-bold">{userStories.length}</p><p className="text-[10px] text-ink-400">Stories</p></div>
                            <div><p className="text-lg font-bold">{userStories.reduce((s, st) => s + (st.comments?.length || 0), 0)}</p><p className="text-[10px] text-ink-400">Comments</p></div>
                            <div><p className="text-lg font-bold">{userTxns.length}</p><p className="text-[10px] text-ink-400">Payments</p></div>
                            <div><p className="text-lg font-bold">{userSms.length}</p><p className="text-[10px] text-ink-400">SMS sent</p></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Content */}
            {tab === 'content' && (
              <div>
                <div className="flex gap-2 mb-3 flex-wrap items-center">
                  {['all', 'public', 'private', 'blocked'].map(f => (
                    <button key={f} onClick={() => setFilterStatus(f)} className={`text-xs px-3 py-1.5 rounded-full border ${filterStatus === f ? 'bg-ink text-paper border-ink' : 'border-wire text-ink-600'}`}>
                      {f === 'all' ? 'All' : f === 'blocked' ? 'Blocked Media' : f}
                    </button>
                  ))}
                  <select value={contentSourceFilter} onChange={(e) => setContentSourceFilter(e.target.value)} className="text-xs border border-wire rounded-sm px-2 py-1.5">
                    <option value="">All sources</option>
                    {CONTENT_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select value={contentSort} onChange={(e) => setContentSort(e.target.value)} className="text-xs border border-wire rounded-sm px-2 py-1.5">
                    <option value="newest">Newest</option>
                    <option value="liked">Most liked</option>
                    <option value="commented">Most commented</option>
                    <option value="reported">Most reported</option>
                  </select>
                </div>
                <div className="border border-wire rounded-sm divide-y divide-wire">
                  {filteredStories.length === 0 && <EmptyState icon={FileText} label="No content found." />}
                  {filteredStories.map(s => {
                    const author = users.find(u => u.id === s.authorId);
                    const wordCount = s.body ? s.body.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length : 0;
                    const readingTime = Math.max(1, Math.round(wordCount / 200));
                    const reportCount = reports.filter(r => r.storyId === s.id).length;
                    const featured = featuredIds.includes(s.id);
                    return (
                      <div key={s.id} className="flex items-center justify-between p-3 flex-wrap gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Link href={`/story/${s.id}`} className="text-sm font-semibold hover:text-signal">{s.title}</Link>
                            {featured && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 flex items-center gap-1"><Star size={9} /> Featured</span>}
                          </div>
                          <p className="text-xs text-ink-400">
                            {author?.publisherName} · {s.type} · {s.privacy} · {s.likes?.length || 0} likes · {s.comments?.length || 0} comments
                            {reportCount > 0 && <span className="text-signal"> · {reportCount} reports</span>}
                            {s.mediaBlocked && <span className="text-signal"> · media blocked</span>}
                            {wordCount > 0 && <span> · {wordCount} words · {readingTime} min read</span>}
                            {s.coverImage && <span> · has image</span>}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => toggleFeatured(s.id)} className={`text-xs font-semibold px-3 py-1.5 rounded-sm border flex items-center gap-1 ${featured ? 'border-amber-400 text-amber-700' : 'border-wire'}`}><Star size={12} /> {featured ? 'Unfeature' : 'Feature'}</button>
                          <button onClick={() => runGated(s.mediaBlocked ? 'Unblock media?' : 'Block media?', () => setMediaBlocked(s.id, !s.mediaBlocked, user.email))}
                            className="text-xs font-semibold px-3 py-1.5 rounded-sm border border-wire">{s.mediaBlocked ? 'Unblock' : 'Block media'}</button>
                          <button onClick={() => runGated('Delete permanently?', () => adminDeleteStory(s.id, user.email))}
                            className="text-xs font-semibold px-3 py-1.5 rounded-sm border border-signal text-signal">Delete</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Reports */}
            {tab === 'reports' && (
              <div className="border border-wire rounded-sm divide-y divide-wire">
                {reports.length === 0 && <EmptyState icon={Flag} label="No reports filed." />}
                {reports.map(r => {
                  const story = stories.find(s => s.id === r.storyId);
                  return (
                    <div key={r.id} className="flex items-center justify-between p-3 flex-wrap gap-2">
                      <div>
                        <p className="text-sm font-semibold">{story?.title || 'Deleted post'}</p>
                        <p className="text-xs text-ink-400">{r.reason} · {new Date(r.createdAt).toLocaleString()}{r.resolved && <span className="text-ink-400"> · resolved</span>}</p>
                      </div>
                      {!r.resolved && <button onClick={() => { resolveReport(r.id); showToast('Report resolved'); }} className="text-xs font-semibold px-3 py-1.5 rounded-sm border border-wire">Resolve</button>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Withdrawals */}
            {tab === 'withdrawals' && (
              <div>
                <div className="flex gap-2 mb-4 items-center">
                  {['all', 'pending', 'completed'].map(f => (
                    <button key={f} onClick={() => setFilterStatus(f)} className={`text-xs px-3 py-1.5 rounded-full border ${filterStatus === f ? 'bg-ink text-paper border-ink' : 'border-wire text-ink-600'}`}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                  {loadingTabs.financial && <Spinner />}
                </div>
                <div className="border border-wire rounded-sm divide-y divide-wire">
                  {withdrawals.length === 0 && <EmptyState icon={Wallet} label="No withdrawal requests yet." />}
                  {withdrawals.filter(w => filterStatus === 'all' ? true : w.status === filterStatus).map(w => (
                    <div key={w.id} className="flex items-center justify-between p-3 flex-wrap gap-2">
                      <div><p className="text-sm font-semibold">{fmtMoney(w.amount)}</p><p className="text-xs text-ink-400">Phone: {w.phone} · {new Date(w.created_at).toLocaleString()}</p></div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${w.status === 'completed' ? 'bg-ink-50 text-ink-600' : w.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-signal'}`}>{w.status}</span>
                        {w.status === 'pending' && (
                          <button onClick={() => runGated(`Mark withdrawal of ${fmtMoney(w.amount)} as completed?`, () => markWithdrawalComplete(w.id))}
                            className="text-xs font-semibold px-3 py-1.5 rounded-sm border border-ink text-ink hover:bg-ink hover:text-paper flex items-center gap-1"><CheckCircle size={12} /> Complete</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transactions */}
            {tab === 'transactions' && (
              <div>
                <div className="border border-wire rounded-sm p-4 mb-4 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-xs text-ink-400">Total revenue (completed)</p>
                    <p className="text-2xl font-bold editorial-h">{fmtMoney(totalRevenueAll)}</p>
                  </div>
                  <button onClick={() => exportEntity('transactions')} className="text-xs font-semibold px-3 py-2 rounded-sm border border-wire flex items-center gap-1"><Download size={13} /> Export CSV</button>
                </div>

                <div className="flex flex-wrap gap-2 mb-4 items-end">
                  <div><label className="text-[10px] text-ink-400 block">From</label><input type="date" value={txnDateFrom} onChange={(e) => setTxnDateFrom(e.target.value)} className="text-xs border border-wire rounded-sm px-2 py-1.5" /></div>
                  <div><label className="text-[10px] text-ink-400 block">To</label><input type="date" value={txnDateTo} onChange={(e) => setTxnDateTo(e.target.value)} className="text-xs border border-wire rounded-sm px-2 py-1.5" /></div>
                  <select value={txnStatusFilter} onChange={(e) => setTxnStatusFilter(e.target.value)} className="text-xs border border-wire rounded-sm px-2 py-1.5">
                    <option value="all">All statuses</option><option value="completed">Completed</option><option value="pending">Pending</option><option value="failed">Failed</option>
                  </select>
                  <select value={txnMethodFilter} onChange={(e) => setTxnMethodFilter(e.target.value)} className="text-xs border border-wire rounded-sm px-2 py-1.5">
                    <option value="all">All methods</option><option value="mpesa">M-Pesa</option><option value="card">Card</option>
                  </select>
                  <input value={txnSearchQ} onChange={(e) => setTxnSearchQ(e.target.value)} placeholder="Search email or reference..." className="text-xs border border-wire rounded-sm px-2 py-1.5 flex-1 min-w-[180px]" />
                </div>

                <div className="border border-wire rounded-sm divide-y divide-wire mb-6">
                  {filteredTxns.length === 0 && <EmptyState icon={CreditCard} label="No transactions found." />}
                  {filteredTxns.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 flex-wrap gap-2">
                      <div><p className="text-sm font-semibold">{t.credits} credits · {fmtMoney(t.amount)}</p><p className="text-xs text-ink-400">{t.reference} · {t.email || '—'} · {new Date(t.created_at).toLocaleString()}</p></div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${t.status === 'completed' ? 'bg-ink-50 text-ink-600' : t.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-signal'}`}>{t.status}</span>
                    </div>
                  ))}
                </div>

                <div className="border border-wire rounded-sm p-4">
                  <p className="wire-tag mb-3 flex items-center gap-1.5"><Lock size={12} /> Manual credit adjustment</p>
                  <div className="flex flex-wrap gap-2 items-end">
                    <div><label className="text-[10px] text-ink-400 block">User email</label><input value={creditAdjustEmail} onChange={(e) => setCreditAdjustEmail(e.target.value)} placeholder="user@example.com" className="text-xs border border-wire rounded-sm px-2 py-1.5" /></div>
                    <div><label className="text-[10px] text-ink-400 block">Amount (+/-)</label><input type="number" value={creditAdjustAmount} onChange={(e) => setCreditAdjustAmount(e.target.value)} placeholder="e.g. 50 or -10" className="text-xs border border-wire rounded-sm px-2 py-1.5 w-28" /></div>
                    <div><label className="text-[10px] text-ink-400 block">Reason</label><input value={creditAdjustReason} onChange={(e) => setCreditAdjustReason(e.target.value)} placeholder="Reason for audit log" className="text-xs border border-wire rounded-sm px-2 py-1.5" /></div>
                    <button onClick={() => runGated(`Adjust credits for ${creditAdjustEmail || '—'} by ${creditAdjustAmount || 0}?`, adjustCredits)} className="text-xs font-semibold px-3 py-2 rounded-sm bg-ink text-paper">Apply adjustment</button>
                  </div>
                </div>
              </div>
            )}

            {/* SMS Logs */}
            {tab === 'sms' && (
              <div className="border border-wire rounded-sm divide-y divide-wire">
                {smsHistory.length === 0 && <EmptyState icon={MessageSquare} label="No SMS sent yet." />}
                {smsHistory.map(s => (
                  <div key={s.id} className="p-3">
                    <p className="text-sm mb-1">{s.message}</p>
                    <p className="text-xs text-ink-400">To: {s.recipients} · {s.recipient_count} recipients · {s.cost} credits · {new Date(s.created_at).toLocaleString()}</p>
                    <span className={`text-xs font-semibold ${s.status === 'delivered' ? 'text-ink-600' : 'text-signal'}`}>{s.status}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Subscribers */}
            {tab === 'subscribers' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-ink-600"><strong>{subscribers.length}</strong> total · <strong>{activeSubscribers.length}</strong> active</p>
                  <button onClick={exportCSV} className="text-xs font-semibold px-3 py-1.5 rounded-sm border border-wire hover:bg-ink-50 flex items-center gap-1">
                    <Download size={12} /> Export CSV
                  </button>
                </div>
                <div className="border border-wire rounded-sm divide-y divide-wire">
                  {subscribers.length === 0 && <EmptyState icon={Mail} label="No subscribers yet." />}
                  {subscribers.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 flex-wrap gap-2">
                      <div>
                        <p className="text-sm font-semibold">{s.email}</p>
                        <p className="text-xs text-ink-400">Prefers: {s.preferences} · Joined {new Date(s.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${s.status === 'active' ? 'bg-ink-50 text-ink-600' : 'bg-red-50 text-signal'}`}>{s.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search Analytics */}
            {tab === 'search' && (
              <div>
                <p className="text-sm text-ink-600 mb-4"><strong>{searchAnalytics.total || 0}</strong> total searches</p>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div><p className="wire-tag mb-3">Top Searches</p><div className="border border-wire rounded-sm divide-y divide-wire">{(searchAnalytics.top || []).length === 0 && <EmptyState icon={Search} label="No data yet." />}{(searchAnalytics.top || []).map((s, i) => (<div key={i} className="flex items-center justify-between p-3"><span className="text-sm">{s.query}</span><span className="text-xs font-semibold text-ink-600">{s.count} searches</span></div>))}</div></div>
                  <div><p className="wire-tag mb-3">Recent Searches</p><div className="border border-wire rounded-sm divide-y divide-wire max-h-96 overflow-y-auto">{(searchAnalytics.recent || []).length === 0 && <EmptyState icon={Search} label="No data yet." />}{(searchAnalytics.recent || []).map((s, i) => (<div key={i} className="p-3 flex items-center justify-between"><span className="text-sm">{s.query}</span><span className="text-xs text-ink-400">{new Date(s.created_at).toLocaleString()}</span></div>))}</div></div>
                </div>
              </div>
            )}

            {/* Export Center */}
            {tab === 'export' && (
              <div>
                <p className="text-sm text-ink-600 mb-4">Download platform data as CSV.</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  {[
                    ['Users', 'users', UsersIcon],
                    ['Transactions', 'transactions', CreditCard],
                    ['Stories', 'stories', FileText],
                    ['Subscribers', 'subscribers', Mail],
                  ].map(([label, key, Icon]) => (
                    <button key={key} onClick={() => exportEntity(key)} className="border border-wire rounded-sm p-4 text-left hover:border-ink transition-colors">
                      <Icon size={18} className="mb-2" />
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="text-xs text-ink-400 flex items-center gap-1 mt-1"><FileDown size={11} /> Export CSV</p>
                    </button>
                  ))}
                </div>
                <button onClick={exportAll} className="text-xs font-semibold px-4 py-2.5 rounded-sm bg-ink text-paper flex items-center gap-2"><Package size={14} /> Export All (zip of CSVs)</button>
              </div>
            )}

            {/* Admins */}
            {tab === 'admins' && isRoot && (
              <div>
                <div className="flex gap-2 mb-4 max-w-md">
                  <input value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} placeholder="admin@example.com" className="flex-1 border border-wire rounded-sm px-3 py-2 text-sm" />
                  <button onClick={() => runGated(`Grant admin access to ${newAdminEmail}?`, () => { addAdmin(newAdminEmail, user.email); showToast(`${newAdminEmail} added as admin`); setNewAdminEmail(''); })} className="btn-primary px-4 py-2 rounded-sm text-sm">Add admin</button>
                </div>
                <div className="border border-wire rounded-sm divide-y divide-wire">
                  <div className="p-3 flex items-center justify-between"><span className="text-sm font-semibold">{user.email}</span><span className="text-xs text-ink-400 font-semibold">Root — cannot be removed</span></div>
                  {admins.map(email => (
                    <div key={email} className="p-3 flex items-center justify-between">
                      <span className="text-sm">{email}</span>
                      <button onClick={() => runGated(`Remove admin access for ${email}?`, () => { removeAdmin(email, user.email); showToast(`${email} removed`); })} className="text-xs font-semibold text-signal">Remove</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* System Settings (root) */}
            {tab === 'settings' && isRoot && (
              <div className="space-y-6">
                {loadingTabs.settings && <p className="text-xs text-ink-400 flex items-center gap-2"><Spinner /> Loading settings…</p>}
                <div className="border border-wire rounded-sm p-4 space-y-3 max-w-xl">
                  <p className="wire-tag flex items-center gap-1.5"><Settings size={12} /> Platform</p>
                  <div><label className="text-[10px] text-ink-400 block">Platform name</label><input value={platformSettings.name} onChange={(e) => setPlatformSettings({ ...platformSettings, name: e.target.value })} className="w-full border border-wire rounded-sm px-3 py-2 text-sm" /></div>
                  <div><label className="text-[10px] text-ink-400 block">Description</label><textarea value={platformSettings.description} onChange={(e) => setPlatformSettings({ ...platformSettings, description: e.target.value })} rows={3} className="w-full border border-wire rounded-sm px-3 py-2 text-sm" /></div>
                  <div>
                    <label className="text-[10px] text-ink-400 block mb-1">Social links</label>
                    {platformSettings.socialLinks.map((l, i) => (
                      <div key={i} className="flex gap-2 mb-2">
                        <input value={l.platform} onChange={(e) => { const links = [...platformSettings.socialLinks]; links[i] = { ...l, platform: e.target.value }; setPlatformSettings({ ...platformSettings, socialLinks: links }); }} placeholder="Platform" className="w-28 border border-wire rounded-sm px-2 py-1.5 text-xs" />
                        <input value={l.url} onChange={(e) => { const links = [...platformSettings.socialLinks]; links[i] = { ...l, url: e.target.value }; setPlatformSettings({ ...platformSettings, socialLinks: links }); }} placeholder="https://..." className="flex-1 border border-wire rounded-sm px-2 py-1.5 text-xs" />
                        <button onClick={() => setPlatformSettings({ ...platformSettings, socialLinks: platformSettings.socialLinks.filter((_, idx) => idx !== i) })} className="text-signal"><X size={14} /></button>
                      </div>
                    ))}
                    <button onClick={() => setPlatformSettings({ ...platformSettings, socialLinks: [...platformSettings.socialLinks, { platform: '', url: '' }] })} className="text-xs px-2 py-1 rounded-sm border border-wire">+ Add link</button>
                  </div>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={platformSettings.maintenanceMode} onChange={(e) => setPlatformSettings({ ...platformSettings, maintenanceMode: e.target.checked })} /> Maintenance mode</label>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => runConfirm('Save platform settings?', null, saveSettings)} className="text-xs font-semibold px-4 py-2 rounded-sm bg-ink text-paper">Save settings</button>
                    <button onClick={() => runGated('Clear Cloudflare cache?', clearCache)} className="text-xs font-semibold px-4 py-2 rounded-sm border border-wire flex items-center gap-1"><RefreshCw size={12} /> Clear cache</button>
                  </div>
                </div>

                <div className="border border-wire rounded-sm">
                  <p className="wire-tag p-4 pb-0 flex items-center gap-1.5"><Server size={12} /> System log (last 100)</p>
                  <div className="divide-y divide-wire max-h-80 overflow-y-auto">
                    {systemLogs.length === 0 && <EmptyState icon={Server} label="No log entries available." />}
                    {systemLogs.map((l, i) => (
                      <div key={i} className="p-3 text-xs">
                        <span className="font-semibold">{l.level || 'error'}</span> · {l.message} <span className="text-ink-400 block">{l.created_at ? new Date(l.created_at).toLocaleString() : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Security Center (root) */}
            {tab === 'security' && isRoot && (
              <div className="space-y-6">
                {loadingTabs.security && <p className="text-xs text-ink-400 flex items-center gap-2"><Spinner /> Loading security data…</p>}
                <div className="flex justify-between items-center">
                  <p className="wire-tag flex items-center gap-1.5"><Shield size={12} /> Active admin sessions</p>
                  <button onClick={() => runGated('Force logout ALL users platform-wide? This cannot be undone.', forceLogoutAllUsers)} className="text-xs font-semibold px-3 py-2 rounded-sm border border-signal text-signal flex items-center gap-1"><LogOut size={12} /> Force logout all users</button>
                </div>
                <div className="border border-wire rounded-sm divide-y divide-wire">
                  {activeSessions.length === 0 && <EmptyState icon={Clock} label="No active session data available." />}
                  {activeSessions.map((s, i) => (
                    <div key={i} className="p-3 flex items-center justify-between text-xs">
                      <span>{s.email || s.user}</span><span className="text-ink-400">{s.ip} · {s.device}</span><span className="text-ink-400">{s.lastActive ? new Date(s.lastActive).toLocaleString() : ''}</span>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="wire-tag mb-2 flex items-center gap-1.5"><AlertTriangle size={12} /> Security events</p>
                  <div className="border border-wire rounded-sm divide-y divide-wire">
                    {securityEvents.length === 0 && <EmptyState icon={AlertTriangle} label="No security events logged." />}
                    {securityEvents.map((e, i) => (
                      <div key={i} className="p-3 text-xs"><span className="font-semibold">{e.type}</span> · {e.detail} <span className="text-ink-400 block">{e.created_at ? new Date(e.created_at).toLocaleString() : ''}</span></div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="wire-tag mb-2 flex items-center gap-1.5"><KeyRound size={12} /> API keys</p>
                  <div className="border border-wire rounded-sm divide-y divide-wire">
                    {apiKeys.length === 0 && <EmptyState icon={KeyRound} label="No API key data available." />}
                    {apiKeys.map((k, i) => (
                      <div key={i} className="p-3 flex items-center justify-between text-xs"><span>{k.name}</span><span className="text-ink-400 font-mono">{(k.key || '').replace(/.(?=.{4})/g, '•')}</span></div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Audit log */}
            {tab === 'log' && (
              <div className="border border-wire rounded-sm divide-y divide-wire">
                {adminLogs.length === 0 && <EmptyState icon={ScrollText} label="No admin actions yet." />}
                {adminLogs.map(l => (
                  <div key={l.id} className="p-3 text-sm">
                    <span className="font-semibold">{l.actorEmail}</span> · {l.action.replaceAll('_', ' ')} · <span className="text-ink-400">{l.target}</span>
                    <span className="text-xs text-ink-400 block">{new Date(l.timestamp).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

const TABS_REF = { current: [] };