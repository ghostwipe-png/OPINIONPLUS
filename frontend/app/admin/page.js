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

function safeDate(iso, options) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, options);
  } catch {
    return '—';
  }
}

function safeDateShort(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
  } catch {
    return '—';
  }
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function tierBadgeClasses(tier) {
  switch (tier) {
    case 'partner': return 'bg-ink-50 text-ink-700 border border-wire';
    case 'pro_partner': return 'bg-signal/10 text-signal border border-signal/30';
    case 'admin': return 'bg-purple-50 text-purple-700 border border-purple-200';
    case 'root': return 'bg-red-50 text-signal border border-signal/30';
    default: return 'bg-ink-50 text-ink-600 border border-wire';
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
    <div className="fixed inset-0 bg-ink/70 backdrop-blur-sm grid place-items-center z-50 px-4">
      <div className="bg-paper rounded-sm p-8 w-full max-w-sm border-2 border-ink shadow-2xl space-y-4">
        <div className="bg-ink text-white font-bold uppercase text-xs px-3 py-1.5 inline-flex items-center gap-1.5 rounded-sm">
          <Lock size={13} className="text-signal" /> Security Gate
        </div>
        <p className="text-sm font-bold text-ink">{label}</p>
        <input 
          type="password" 
          inputMode="numeric" 
          value={pin} 
          onChange={(e) => { setPin(e.target.value); setError(false); }} 
          placeholder="4-digit PIN" 
          className="w-full border border-wire bg-paper focus:border-ink outline-none px-4 py-3 text-lg font-mono tracking-widest text-center rounded-sm" 
          autoFocus 
        />
        {error && <p className="text-signal text-xs font-bold uppercase tracking-wider">Incorrect PIN. Try again.</p>}
        <p className="text-[11px] font-mono text-ink-400">Demo PIN is {DEMO_PIN}</p>
        <div className="flex gap-3 pt-2">
          <button onClick={onCancel} className="border border-wire bg-paper hover:bg-ink-50 text-ink font-bold uppercase text-xs tracking-wider flex-1 py-3 rounded-sm transition-colors">Cancel</button>
          <button onClick={() => (pin === DEMO_PIN ? (setAdminPin(pin), onConfirm(pin)) : setError(true))} className="bg-signal text-white font-bold uppercase text-xs tracking-wider flex-1 py-3 rounded-sm hover:bg-signal/90 transition-colors shadow-sm">Confirm</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({ label, detail, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-ink/70 backdrop-blur-sm grid place-items-center z-50 px-4">
      <div className="bg-paper rounded-sm p-8 w-full max-w-sm border-2 border-ink shadow-2xl space-y-4">
        <div className="bg-signal text-white font-bold uppercase text-xs px-3 py-1.5 inline-flex items-center gap-1.5 rounded-sm">
          <AlertTriangle size={13} /> Action Confirmation
        </div>
        <p className="text-sm font-bold text-ink">{label}</p>
        {detail && <p className="text-xs font-medium text-ink-500">{detail}</p>}
        <div className="flex gap-3 pt-2">
          <button onClick={onCancel} className="border border-wire bg-paper hover:bg-ink-50 text-ink font-bold uppercase text-xs tracking-wider flex-1 py-3 rounded-sm transition-colors">Cancel</button>
          <button onClick={onConfirm} className="bg-signal text-white font-bold uppercase text-xs tracking-wider flex-1 py-3 rounded-sm hover:bg-signal/90 transition-colors shadow-sm">Confirm</button>
        </div>
      </div>
    </div>
  );
}

function ToastStack({ toasts, dismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2.5 max-w-sm w-full">
      {toasts.map((t) => (
        <div 
          key={t.id} 
          onClick={() => dismiss(t.id)}
          className={`p-4 rounded-sm shadow-xl text-xs font-bold uppercase tracking-wider cursor-pointer flex items-start gap-3 border ${
            t.type === 'error' ? 'bg-red-50 border-signal text-signal' : t.type === 'warn' ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-ink border-ink text-white'
          }`}
        >
          {t.type === 'error' ? <XCircle size={15} className="mt-0.5 shrink-0" /> : <CheckCircle size={15} className="mt-0.5 shrink-0 text-signal" />}
          <span className="flex-1">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

function Spinner({ size = 14 }) {
  return <Loader2 size={size} className="animate-spin text-signal" />;
}

function EmptyState({ icon: Icon = Package, label }) {
  return (
    <div className="p-12 text-center bg-paper">
      <div className="w-12 h-12 bg-ink-50 rounded-full grid place-items-center mx-auto mb-3 border border-wire">
        <Icon size={20} className="text-ink-400" />
      </div>
      <p className="text-sm font-bold text-ink">{label}</p>
    </div>
  );
}

function SparkBars({ values = [], labelFmt = (v) => v }) {
  const max = Math.max(1, ...values.map((v) => v.value));
  return (
    <div className="flex items-end gap-1.5 h-24 pt-2">
      {values.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5" title={`${v.label}: ${labelFmt(v.value)}`}>
          <div className="w-full bg-ink rounded-sm transition-all shadow-sm" style={{ height: `${Math.max(6, (v.value / max) * 76)}px`, opacity: 0.3 + 0.7 * (v.value / max) }} />
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{v.label}</span>
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

  const TABS = useMemo(() => [
    { id: 'archive', label: 'Archive', icon: Archive },
    { id: 'news', label: 'News Management', icon: Zap },
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'users', label: `Users (${users.length})`, icon: UsersIcon },
    { id: 'content', label: `Content (${stories.filter(s => !s.deleted).length})`, icon: FileText },
    { id: 'reports', label: `Reports${reports.filter(r => !r.resolved).length ? ` (${reports.filter(r => !r.resolved).length})` : ''}`, icon: Flag },
    { id: 'withdrawals', label: `Withdrawals${withdrawals.filter(w => w.status === 'pending').length ? ` (${withdrawals.filter(w => w.status === 'pending').length})` : ''}`, icon: Wallet },
    { id: 'transactions', label: 'Transactions', icon: CreditCard },
    { id: 'sms', label: 'SMS Logs', icon: MessageSquare },
    { id: 'subscribers', label: `Subscribers (${subscribers.filter(s => s.status === 'active').length})`, icon: Mail },
    { id: 'search', label: 'Search Analytics', icon: TrendingUp },
    { id: 'export', label: 'Export Center', icon: FileDown },
    ...(isRoot ? [{ id: 'admins', label: 'Admins', icon: ShieldPlus }] : []),
    ...(isRoot ? [{ id: 'settings', label: 'System Settings', icon: Settings }] : []),
    ...(isRoot ? [{ id: 'security', label: 'Security Center', icon: Shield }] : []),
    { id: 'log', label: 'Audit Log', icon: ScrollText },
  ], [users.length, stories, reports, withdrawals, subscribers, isRoot]);

  const tabsRef = useRef(TABS);
  useEffect(() => { tabsRef.current = TABS; }, [TABS]);

  useEffect(() => {
    const handler = (e) => {
      if (!isAdmin) return;
      if (e.ctrlKey || e.metaKey) {
        const num = parseInt(e.key, 10);
        if (!Number.isNaN(num) && num >= 1 && num <= 9) {
          e.preventDefault();
          const t = tabsRef.current[num - 1];
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
      <div className="max-w-lg mx-auto px-5 py-32 text-center bg-paper min-h-screen">
        <p className="text-6xl font-black mb-4 text-ink">404</p>
        <p className="text-ink-500 text-sm font-medium mb-6">This administration console could not be found or access is restricted.</p>
        <Link href="/" className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-6 py-3 rounded-sm inline-block shadow-sm">Back to the feed</Link>
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

  const darkWrap = darkMode ? 'bg-ink text-paper' : 'bg-paper text-ink';
  const darkCard = darkMode ? 'border-ink-600 bg-ink-900/60 text-white' : 'border-wire bg-white text-ink';

  return (
    <div className={`min-h-screen ${darkWrap} py-12 pb-24`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {locked && <PinGate label="Session locked after 5 minutes of inactivity." onConfirm={() => { setLocked(false); resetIdle(); }} onCancel={() => setLocked(false)} />}
        {pinAction && <PinGate label={pinAction.label} onConfirm={(pin) => { lastPinRef.current = pin || DEMO_PIN; pinAction.run(); setPinAction(null); }} onCancel={() => setPinAction(null)} />}
        {confirmAction && <ConfirmDialog label={confirmAction.label} detail={confirmAction.detail} onConfirm={() => { confirmAction.run(); setConfirmAction(null); }} onCancel={() => setConfirmAction(null)} />}
        <ToastStack toasts={toasts} dismiss={dismissToast} />

        {/* Header Banner */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-wire gap-4 flex-wrap">
          <div>
            <div className="bg-ink text-white font-bold uppercase text-xs px-3 py-1.5 inline-flex items-center gap-2 rounded-sm mb-3 shadow-sm">
              <Shield size={13} className="text-signal" /> {isRoot ? 'Root Administrator' : 'Administrator'} Console
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${health === 'ok' ? 'bg-emerald-500' : health === 'error' ? 'bg-signal' : 'bg-ink-300'}`} title={`System health: ${health}`} />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Platform Control Suite</h1>
            <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mt-1">
              {users.length} registered users · {activeStories.length} published stories · {proUsers.length} pro partners · {activeSubscribers.length} active subscribers
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setDarkMode(d => !d)} className={`p-2.5 rounded-sm border ${darkCard} font-bold`} title="Toggle admin dark mode">
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button onClick={() => setSidebarCollapsed(c => !c)} className={`p-2.5 rounded-sm border ${darkCard} lg:hidden font-bold`} title="Toggle navigation">
              <Menu size={16} />
            </button>
          </div>
        </div>

        <div className="flex gap-8 items-start">
          {/* Sidebar Navigation */}
          <aside className={`shrink-0 ${sidebarCollapsed ? 'w-16' : 'w-64'} transition-all duration-200 hidden lg:block sticky top-8`}>
            <button onClick={() => setSidebarCollapsed(c => !c)} className={`mb-3 w-full flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-3 py-2.5 rounded-sm border ${darkCard} hover:border-ink transition-colors`}>
              <Menu size={14} /> {!sidebarCollapsed && 'Collapse Menu'}
            </button>
            <nav className="flex flex-col gap-1">
              {TABS.map((t, i) => (
                <button 
                  key={t.id} 
                  onClick={() => { setTab(t.id); if (['transactions', 'sms', 'withdrawals', 'subscribers', 'archive', 'search', 'news'].includes(t.id)) { if (t.id === 'news') { loadNewsToggle(); loadNewsArticles(); } else loadAllData(); } }}
                  title={`Ctrl+${i + 1}`}
                  className={`px-4 py-2.5 rounded-sm border flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-left transition-colors ${
                    tab === t.id ? 'bg-ink text-white border-ink shadow-sm' : `${darkCard} hover:border-ink`
                  }`}
                >
                  <t.icon size={15} className={`shrink-0 ${tab === t.id ? 'text-signal' : 'text-ink-400'}`} /> 
                  {!sidebarCollapsed && <span className="truncate">{t.label}</span>}
                </button>
              ))}
            </nav>
          </aside>

          {/* Mobile Navigation Tabs */}
          <div className="flex gap-2 flex-wrap mb-6 w-full lg:hidden">
            {TABS.map(t => (
              <button 
                key={t.id} 
                onClick={() => { setTab(t.id); if (['transactions', 'sms', 'withdrawals', 'subscribers', 'archive', 'search', 'news'].includes(t.id)) { if (t.id === 'news') { loadNewsToggle(); loadNewsArticles(); } else loadAllData(); } }}
                className={`px-3 py-2 rounded-sm border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                  tab === t.id ? 'bg-ink text-white border-ink' : 'border-wire bg-white text-ink-600'
                }`}
              >
                <t.icon size={13} /> {t.label}
              </button>
            ))}
          </div>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0 bg-white border border-wire rounded-sm p-6 sm:p-8 shadow-sm">

            {/* Archive */}
            {tab === 'archive' && (
              <div className="space-y-6">
                <div className="flex gap-3 mb-4 flex-wrap text-xs font-bold uppercase tracking-wider items-center bg-ink-50 p-4 rounded-sm border border-wire">
                  <span className="px-3 py-1 rounded-sm bg-white border border-wire">📦 {archiveStats.total || 0} Total</span>
                  <span className="px-3 py-1 rounded-sm bg-amber-100 text-amber-800">⏳ {archiveStats.pending || 0} Pending</span>
                  <span className="px-3 py-1 rounded-sm bg-emerald-100 text-emerald-800">✅ {archiveStats.approved || 0} Approved</span>
                  <span className="px-3 py-1 rounded-sm bg-red-100 text-signal">🗑️ {archiveStats.rejected || 0} Rejected</span>
                  {loadingTabs.archive && <Spinner />}
                  <button onClick={() => runConfirm('Approve all pending archive items?', 'This will publish every pending item as News / Public.', approveAllPending)} className="ml-auto bg-ink text-white font-bold uppercase text-xs tracking-wider px-4 py-2 rounded-sm hover:bg-signal transition-colors flex items-center gap-1.5 shadow-sm">
                    <CheckCheck size={14} /> Approve All Pending
                  </button>
                </div>

                <div className="flex flex-wrap gap-3">
                  <select value={archiveStatus} onChange={(e) => { setArchiveStatus(e.target.value); setArchivePage(1); }} className="text-xs font-bold uppercase tracking-wider border border-wire rounded-sm px-3 py-2.5 bg-paper">
                    <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All Statuses</option>
                  </select>
                  <select value={archiveSource} onChange={(e) => { setArchiveSource(e.target.value); setArchivePage(1); }} className="text-xs font-bold uppercase tracking-wider border border-wire rounded-sm px-3 py-2.5 bg-paper">
                    <option value="">All Sources</option>{(archiveStats.bySource || []).map(s => <option key={s.source_name} value={s.source_name}>{s.source_name} ({s.count})</option>)}
                  </select>
                  <input value={archiveSearch} onChange={(e) => setArchiveSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (setArchivePage(1), loadArchive())} placeholder="Search archive..." className="text-xs font-medium border border-wire rounded-sm px-3 py-2.5 flex-1 max-w-sm bg-paper focus:outline-none focus:border-ink" />
                  <button onClick={() => { setArchivePage(1); loadArchive(); }} className="bg-ink text-white font-bold uppercase text-xs tracking-wider px-5 py-2.5 rounded-sm hover:bg-signal transition-colors">Search</button>
                </div>

                {archiveStatus === 'pending' && (
                  <div className="flex gap-3 items-center text-xs font-bold uppercase tracking-wider flex-wrap bg-ink-50/50 p-4 rounded-sm border border-wire">
                    <span className="text-ink-500">Approve as format:</span>
                    <select value={approveType} onChange={(e) => setApproveType(e.target.value)} className="border border-wire rounded-sm px-3 py-2 bg-paper"><option value="news">News</option><option value="story">Story</option><option value="documentary">Documentary</option></select>
                    <select value={approvePrivacy} onChange={(e) => setApprovePrivacy(e.target.value)} className="border border-wire rounded-sm px-3 py-2 bg-paper"><option value="public">Public</option><option value="private">Private</option></select>
                    {selectedItems.length > 0 && (
                      <div className="flex gap-2 ml-auto">
                        <button onClick={bulkApprove} className="bg-ink text-white font-bold uppercase text-xs px-4 py-2 rounded-sm hover:bg-signal transition-colors flex items-center gap-1.5"><CheckCheck size={13} /> Approve ({selectedItems.length})</button>
                        <button onClick={bulkReject} className="bg-signal text-white font-bold uppercase text-xs px-4 py-2 rounded-sm hover:bg-signal/90 transition-colors flex items-center gap-1.5"><Trash2 size={13} /> Reject ({selectedItems.length})</button>
                      </div>
                    )}
                  </div>
                )}

                <div className="border border-wire rounded-sm divide-y divide-wire bg-paper">
                  {!loadingTabs.archive && archiveItems.length === 0 && <EmptyState icon={Archive} label="No archive items found matching criteria." />}
                  {archiveItems.map(item => (
                    <div key={item.id} className={`p-4 flex items-start gap-4 transition-colors ${selectedItems.includes(item.id) ? 'bg-ink-50' : 'hover:bg-ink-50/30'}`}>
                      <input type="checkbox" checked={selectedItems.includes(item.id)} onChange={() => toggleSelect(item.id)} className="mt-1.5 h-4 w-4 rounded border-wire text-ink focus:ring-0 cursor-pointer" />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-ink text-white">{item.source_name}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${item.status === 'pending' ? 'bg-amber-100 text-amber-800' : item.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-signal'}`}>{item.status}</span>
                        </div>
                        <p className="text-sm font-bold text-ink">{item.title}</p>
                        <p className="text-xs text-ink-600 line-clamp-2 font-medium">{item.excerpt}</p>
                        <p className="text-[11px] text-ink-400">{safeDate(item.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => setPreviewItem(item)} className="border border-wire bg-white hover:border-ink p-2 rounded-sm text-ink transition-colors" title="Preview"><Eye size={14} /></button>
                        {item.status === 'pending' && (
                          <>
                            <button onClick={() => approveItem(item.id)} className="bg-emerald-600 text-white p-2 rounded-sm hover:bg-emerald-700 transition-colors shadow-sm" title="Approve"><CheckCircle size={14} /></button>
                            <button onClick={() => rejectItem(item.id)} className="bg-signal text-white p-2 rounded-sm hover:bg-signal/90 transition-colors shadow-sm" title="Reject"><XCircle size={14} /></button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {archiveTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t border-wire text-xs font-bold uppercase tracking-wider">
                    <button onClick={() => setArchivePage(p => Math.max(1, p - 1))} disabled={archivePage === 1} className="border border-wire px-4 py-2 rounded-sm hover:border-ink disabled:opacity-30 flex items-center gap-1.5"><ChevronLeft size={14} /> Previous</button>
                    <span className="text-ink-500">Page {archivePage} of {archiveTotalPages} ({archiveTotal} total items)</span>
                    <button onClick={() => setArchivePage(p => Math.min(archiveTotalPages, p + 1))} disabled={archivePage === archiveTotalPages} className="border border-wire px-4 py-2 rounded-sm hover:border-ink disabled:opacity-30 flex items-center gap-1.5">Next <ChevronRight size={14} /></button>
                  </div>
                )}

                {previewItem && (
                  <div className="fixed inset-0 bg-ink/70 backdrop-blur-sm z-50 grid place-items-center p-4" onClick={() => setPreviewItem(null)}>
                    <div className="bg-paper rounded-sm border-2 border-ink w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                      <div className="p-6 bg-ink text-white flex items-center justify-between border-b border-white/10">
                        <h3 className="text-base font-bold uppercase tracking-wide">{previewItem.title}</h3>
                        <button onClick={() => setPreviewItem(null)} className="text-white/70 hover:text-white"><XCircle size={20} /></button>
                      </div>
                      <div className="p-6 space-y-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Source: {previewItem.source_name} · {safeDate(previewItem.created_at)}</p>
                        {previewItem.cover_image && <img src={previewItem.cover_image} alt="" className="w-full max-h-80 object-cover rounded-sm border border-wire" />}
                        <div className="prose-story text-sm text-ink-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: previewItem.body }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* News Management */}
            {tab === 'news' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-6 bg-ink-50 border border-wire rounded-sm">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-ink flex items-center gap-2"><Zap size={16} className="text-signal" /> RSS News Aggregation Engine</h2>
                    <p className="text-xs text-ink-500 mt-1">Control automated news fetching and indexing across connected public wire sources.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-ink-600">{newsArticles.length} active feeds</span>
                    <button
                      onClick={toggleNewsEnabled}
                      className={`relative w-14 h-7 rounded-full transition-colors ${newsEnabled ? 'bg-ink' : 'bg-ink-300'}`}
                    >
                      <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${newsEnabled ? 'translate-x-7' : 'translate-x-0'}`} />
                    </button>
                    <span className="text-xs font-bold uppercase">{newsEnabled ? 'Active' : 'Paused'}</span>
                  </div>
                </div>

                {newsLoading ? (
                  <p className="text-xs font-bold uppercase text-ink-400 flex items-center gap-2"><Spinner /> Loading news feeds...</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-600 cursor-pointer">
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
                          className="h-4 w-4 rounded border-wire text-ink focus:ring-0"
                        />
                        Select All Articles
                      </label>
                      {selectedNewsIds.length > 0 && (
                        <button
                          onClick={() => runGated(`Permanently delete ${selectedNewsIds.length} selected news articles? This cannot be undone.`, bulkDeleteNews)}
                          className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-4 py-2 rounded-sm hover:bg-signal/90 transition-colors flex items-center gap-1.5 shadow-sm"
                        >
                          <Trash2 size={13} /> Delete Selected ({selectedNewsIds.length})
                        </button>
                      )}
                    </div>

                    <div className="border border-wire rounded-sm divide-y divide-wire bg-paper">
                      {newsArticles.length === 0 && <EmptyState icon={Zap} label="No news articles indexed in the system." />}
                      {newsArticles.map(article => (
                        <div key={article.id} className={`p-4 flex items-start gap-4 transition-colors ${selectedNewsIds.includes(article.id) ? 'bg-ink-50' : 'hover:bg-ink-50/30'}`}>
                          <input
                            type="checkbox"
                            checked={selectedNewsIds.includes(article.id)}
                            onChange={() => setSelectedNewsIds(prev => prev.includes(article.id) ? prev.filter(id => id !== article.id) : [...prev, article.id])}
                            className="mt-1.5 h-4 w-4 rounded border-wire text-ink focus:ring-0 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0 space-y-1">
                            <p className="text-sm font-bold text-ink">{article.title}</p>
                            <p className="text-xs text-ink-600 line-clamp-1 font-medium">{article.excerpt}</p>
                            <p className="text-[11px] text-ink-400">{safeDateShort(article.created_at)}</p>
                          </div>
                          <Link href={`/story/${article.id}`} className="border border-wire bg-white hover:border-ink p-2 rounded-sm text-ink transition-colors shrink-0" title="View story">
                            <Eye size={14} />
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Overview */}
            {tab === 'overview' && (
              <div className="space-y-8">
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="border border-wire rounded-sm p-6 bg-ink-50/50">
                    <p className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-1">Revenue Today</p>
                    <p className="text-3xl font-black text-ink">{fmtMoney(revenueToday)}</p>
                  </div>
                  <div className="border border-wire rounded-sm p-6 bg-ink-50/50">
                    <p className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-1">Revenue This Week</p>
                    <p className="text-3xl font-black text-ink">{fmtMoney(revenueWeek)}</p>
                  </div>
                  <div className="border border-wire rounded-sm p-6 bg-ink-50/50">
                    <p className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-1">Revenue This Month</p>
                    <p className="text-3xl font-black text-ink">{fmtMoney(revenueMonth)}</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="border border-wire rounded-sm p-6 bg-paper">
                    <p className="text-xs font-bold uppercase tracking-wider text-ink mb-4">Revenue Trajectory — Last 7 Days</p>
                    <SparkBars values={last7Days} labelFmt={fmtMoney} />
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-ink-400 mt-2 border-t border-wire pt-2">{last7Days.map((d, i) => <span key={i}>{d.label}</span>)}</div>
                  </div>
                  <div className="border border-wire rounded-sm p-6 bg-paper">
                    <p className="text-xs font-bold uppercase tracking-wider text-ink mb-4">Publishing Volume — Last 7 Days</p>
                    <SparkBars values={storiesPerDay} />
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-ink-400 mt-2 border-t border-wire pt-2">{storiesPerDay.map((d, i) => <span key={i}>{d.label}</span>)}</div>
                  </div>
                </div>

                <div className="flex gap-3 flex-wrap pt-2">
                  <button onClick={() => runConfirm('Approve all pending archive items?', null, approveAllPending)} className="bg-ink text-white font-bold uppercase text-xs tracking-wider px-5 py-3 rounded-sm hover:bg-signal transition-colors flex items-center gap-2 shadow-sm"><CheckCheck size={14} /> Approve All Pending</button>
                  <button onClick={() => setTab('reports')} className="border border-ink bg-white text-ink font-bold uppercase text-xs tracking-wider px-5 py-3 rounded-sm hover:bg-ink hover:text-white transition-colors flex items-center gap-2"><Flag size={14} /> View Reports ({openReports.length})</button>
                  <button onClick={exportAll} className="border border-wire bg-white text-ink font-bold uppercase text-xs tracking-wider px-5 py-3 rounded-sm hover:border-ink transition-colors flex items-center gap-2"><Download size={14} /> Export All Data</button>
                  <button onClick={loadAllData} className="border border-wire bg-white text-ink font-bold uppercase text-xs tracking-wider px-5 py-3 rounded-sm hover:border-ink transition-colors flex items-center gap-2"><RefreshCw size={14} /> Refresh Telemetry</button>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-wire">
                  {[
                    ['Total Users', users.length, '👥'],
                    ['Pro Partners', proUsers.length, '⭐'],
                    ['New Signups Today', newSignupsToday, '🆕'],
                    ['Active Subscribers', activeSubscribers.length, '📧'],
                    ['Public Stories', activeStories.filter(s => s.privacy === 'public').length, '📝'],
                    ['Suspended Accounts', users.filter(u => u.suspended).length, '🚫'],
                    ['Open Reports', openReports.length, '🚩'],
                    ['Pending Withdrawals', pendingWithdrawals.length, '💳'],
                    ['Blocked Media', activeStories.filter(s => s.mediaBlocked).length, '🖼️'],
                    ['Total Revenue', fmtMoney(totalRevenueAll), '💰'],
                  ].map(([label, value, emoji]) => (
                    <div key={label} className="border border-wire rounded-sm p-5 bg-paper hover:border-ink transition-all shadow-sm">
                      <p className="text-2xl mb-2">{emoji}</p>
                      <p className="text-2xl font-black text-ink">{value}</p>
                      <p className="text-xs font-bold uppercase tracking-wider text-ink-400 mt-1">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Users */}
            {tab === 'users' && (
              <div className="space-y-6">
                <div className="flex gap-3 mb-6 flex-wrap items-center">
                  <div className="relative flex-1 max-w-sm">
                    <Search size={16} className="absolute left-3.5 top-3 text-ink-400" />
                    <input ref={searchInputRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users by name or email... (Ctrl+S)" className="w-full border border-wire rounded-sm pl-10 pr-4 py-2.5 text-xs font-medium bg-paper focus:outline-none focus:border-ink" />
                  </div>
                  <select value={userTierFilter} onChange={(e) => setUserTierFilter(e.target.value)} className="text-xs font-bold uppercase tracking-wider border border-wire rounded-sm px-3 py-2.5 bg-paper">
                    <option value="all">All Tiers</option>
                    <option value="basic">Basic</option>
                    <option value="partner">Partner</option>
                    <option value="pro_partner">Pro Partner</option>
                    <option value="admin">Admin</option>
                    <option value="suspended">Suspended</option>
                  </select>
                  {selectedUsers.length > 0 && (
                    <div className="flex gap-2 ml-auto">
                      <button onClick={() => runGated(`Suspend ${selectedUsers.length} selected users?`, () => { selectedUsers.forEach(id => setUserSuspended(id, true, user?.email)); showToast(`${selectedUsers.length} users suspended`); setSelectedUsers([]); })} className="bg-signal text-white font-bold uppercase text-xs px-4 py-2.5 rounded-sm hover:bg-signal/90 transition-colors shadow-sm">Suspend Selected ({selectedUsers.length})</button>
                    </div>
                  )}
                </div>

                <div className="border border-wire rounded-sm divide-y divide-wire bg-paper">
                  {filteredUsers.length === 0 && <EmptyState icon={UsersIcon} label="No users match your search criteria." />}
                  {filteredUsers.map(u => {
                    const expanded = expandedUserId === u.id;
                    const isEditing = editingUser?.id === u.id;
                    const userTxns = transactions.filter(t => t.email === u.email);
                    const userStories = stories.filter(s => s.authorId === u.id && !s.deleted);
                    const userSms = smsHistory.filter(s => (s.recipients || '').includes(u.email));
                    return (
                      <div key={u.id} className="p-4 hover:bg-ink-50/30 transition-colors">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div className="flex items-center gap-4">
                            <input type="checkbox" checked={selectedUsers.includes(u.id)} onChange={() => setSelectedUsers(prev => prev.includes(u.id) ? prev.filter(i => i !== u.id) : [...prev, u.id])} className="h-4 w-4 rounded border-wire text-ink focus:ring-0 cursor-pointer" />
                            <img src={u.logoUrl} alt="" className="w-11 h-11 rounded-full border border-wire object-cover shadow-sm" />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <p className="text-sm font-bold text-ink">{u.publisherName}</p>
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${tierBadgeClasses(u.role === 'root' ? 'root' : u.role === 'admin' ? 'admin' : u.tier)}`}>{tierLabel(u.role === 'root' ? 'root' : u.role === 'admin' ? 'admin' : u.tier)}</span>
                                {u.suspended && <span className="text-[10px] font-bold text-signal uppercase tracking-wider">Suspended</span>}
                              </div>
                              <p className="text-xs font-mono text-ink-500">{u.email}</p>
                              <p className="text-[11px] text-ink-400 mt-0.5">Joined {safeDateShort(u.createdAt)} · {userStories.length} published stories</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button onClick={() => setExpandedUserId(expanded ? null : u.id)} className="border border-wire bg-white hover:border-ink px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-1 transition-colors">{expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Activity</button>
                            <button onClick={() => setEditingUser(isEditing ? null : { id: u.id, publisherName: u.publisherName, email: u.email, tier: u.tier || 'basic' })} className="border border-wire bg-white hover:border-ink px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-1 transition-colors"><UserCog size={13} /> Edit</button>
                            <Link href={`/profile/${u.id}`} className="border border-wire bg-white hover:border-ink px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider text-ink transition-colors">View Profile</Link>
                            {u.email !== user?.email && (
                              <>
                                <button onClick={() => runGated(`Force logout ${u.publisherName}?`, () => forceLogoutUser(u.id))} className="border border-wire bg-white hover:border-ink p-1.5 rounded-sm text-ink transition-colors" title="Force Logout"><LogOut size={14} /></button>
                                <button onClick={() => runGated(u.suspended ? `Unsuspend ${u.publisherName}?` : `Suspend ${u.publisherName}?`, () => setUserSuspended(u.id, !u.suspended, user?.email))}
                                  className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm border transition-colors ${u.suspended ? 'border-wire text-ink hover:border-ink' : 'border-signal text-signal hover:bg-signal hover:text-white'}`}>
                                  {u.suspended ? 'Unsuspend' : 'Suspend'}
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {isEditing && (
                          <div className="mt-4 p-4 border border-wire rounded-sm bg-ink-50 flex flex-wrap gap-4 items-end">
                            <div className="flex-1 min-w-[200px]"><label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Name</label><input value={editingUser.publisherName} onChange={(e) => setEditingUser({ ...editingUser, publisherName: e.target.value })} className="w-full text-xs border border-wire rounded-sm px-3 py-2 bg-paper font-semibold" /></div>
                            <div className="flex-1 min-w-[200px]"><label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Email</label><input value={editingUser.email} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} className="w-full text-xs border border-wire rounded-sm px-3 py-2 bg-paper font-semibold" /></div>
                            <div><label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Tier</label>
                              <select value={editingUser.tier} onChange={(e) => setEditingUser({ ...editingUser, tier: e.target.value })} className="text-xs font-bold uppercase tracking-wider border border-wire rounded-sm px-3 py-2 bg-paper">
                                <option value="basic">Basic</option><option value="partner">Partner</option><option value="pro_partner">Pro Partner</option>
                              </select>
                            </div>
                            <button onClick={saveUserEdit} className="bg-ink text-white font-bold uppercase text-xs px-5 py-2 rounded-sm hover:bg-signal transition-colors flex items-center gap-1.5"><Check size={14} /> Save</button>
                            <button onClick={() => setEditingUser(null)} className="border border-wire bg-white font-bold uppercase text-xs px-4 py-2 rounded-sm">Cancel</button>
                          </div>
                        )}

                        {expanded && (
                          <div className="mt-4 p-4 border border-wire rounded-sm bg-ink-50 grid sm:grid-cols-4 gap-4 text-center">
                            <div className="bg-paper p-3 rounded-sm border border-wire"><p className="text-2xl font-black text-ink">{userStories.length}</p><p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mt-0.5">Stories</p></div>
                            <div className="bg-paper p-3 rounded-sm border border-wire"><p className="text-2xl font-black text-ink">{userStories.reduce((s, st) => s + (st.comments?.length || 0), 0)}</p><p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mt-0.5">Comments</p></div>
                            <div className="bg-paper p-3 rounded-sm border border-wire"><p className="text-2xl font-black text-ink">{userTxns.length}</p><p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mt-0.5">Payments</p></div>
                            <div className="bg-paper p-3 rounded-sm border border-wire"><p className="text-2xl font-black text-ink">{userSms.length}</p><p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mt-0.5">SMS Sent</p></div>
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
              <div className="space-y-6">
                <div className="flex gap-3 mb-4 flex-wrap items-center">
                  {['all', 'public', 'private', 'blocked'].map(f => (
                    <button key={f} onClick={() => setFilterStatus(f)} className={`text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-sm border transition-colors ${filterStatus === f ? 'bg-ink text-white border-ink' : 'border-wire text-ink-600 hover:border-ink'}`}>
                      {f === 'all' ? 'All Stories' : f === 'blocked' ? 'Blocked Media' : f}
                    </button>
                  ))}
                  <select value={contentSourceFilter} onChange={(e) => setContentSourceFilter(e.target.value)} className="text-xs font-bold uppercase tracking-wider border border-wire rounded-sm px-3 py-2 bg-paper ml-auto">
                    <option value="">All Sources</option>
                    {CONTENT_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select value={contentSort} onChange={(e) => setContentSort(e.target.value)} className="text-xs font-bold uppercase tracking-wider border border-wire rounded-sm px-3 py-2 bg-paper">
                    <option value="newest">Newest First</option>
                    <option value="liked">Most Liked</option>
                    <option value="commented">Most Commented</option>
                    <option value="reported">Most Reported</option>
                  </select>
                </div>

                <div className="border border-wire rounded-sm divide-y divide-wire bg-paper">
                  {filteredStories.length === 0 && <EmptyState icon={FileText} label="No stories match your filter criteria." />}
                  {filteredStories.map(s => {
                    const author = users.find(u => u.id === s.authorId);
                    const wordCount = s.body ? s.body.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length : 0;
                    const readingTime = Math.max(1, Math.round(wordCount / 200));
                    const reportCount = reports.filter(r => r.storyId === s.id).length;
                    const featured = featuredIds.includes(s.id);
                    return (
                      <div key={s.id} className="flex items-center justify-between p-4 flex-wrap gap-4 hover:bg-ink-50/30 transition-colors">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link href={`/story/${s.id}`} className="text-sm font-bold text-ink hover:text-signal transition-colors">{s.title}</Link>
                            {featured && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-amber-100 text-amber-800 flex items-center gap-1"><Star size={10} fill="currentColor" /> Featured</span>}
                          </div>
                          <p className="text-xs font-medium text-ink-500">
                            {author?.publisherName || 'Unknown'} · {s.type} · {s.privacy} · {s.likes?.length || 0} likes · {s.comments?.length || 0} comments
                            {reportCount > 0 && <span className="text-signal font-bold"> · {reportCount} reports</span>}
                            {s.mediaBlocked && <span className="text-signal font-bold"> · media blocked</span>}
                            {wordCount > 0 && <span> · {wordCount} words ({readingTime} min)</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => toggleFeatured(s.id)} className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm border flex items-center gap-1.5 transition-colors ${featured ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-wire bg-white hover:border-ink text-ink'}`}><Star size={13} /> {featured ? 'Unfeature' : 'Feature'}</button>
                          <button onClick={() => runGated(s.mediaBlocked ? 'Unblock media?' : 'Block media?', () => setMediaBlocked(s.id, !s.mediaBlocked, user?.email))}
                            className="border border-wire bg-white hover:border-ink text-ink font-bold uppercase text-xs tracking-wider px-3 py-1.5 rounded-sm transition-colors">{s.mediaBlocked ? 'Unblock' : 'Block Media'}</button>
                          <button onClick={() => runGated('Delete permanently?', () => adminDeleteStory(s.id, user?.email))}
                            className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-3 py-1.5 rounded-sm hover:bg-signal/90 transition-colors shadow-sm">Delete</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Reports */}
            {tab === 'reports' && (
              <div className="border border-wire rounded-sm divide-y divide-wire bg-paper">
                {reports.length === 0 && <EmptyState icon={Flag} label="No active publication reports filed." />}
                {reports.map(r => {
                  const story = stories.find(s => s.id === r.storyId);
                  return (
                    <div key={r.id} className="flex items-center justify-between p-4 flex-wrap gap-4 hover:bg-ink-50/30 transition-colors">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-ink">{story?.title || 'Deleted Publication'}</p>
                        <p className="text-xs font-medium text-ink-500">Reason: <span className="text-signal font-bold">{r.reason}</span> · Filed {safeDate(r.createdAt)} {r.resolved && <span className="text-ink-400">(Resolved)</span>}</p>
                      </div>
                      {!r.resolved && <button onClick={() => { resolveReport(r.id); showToast('Report resolved'); }} className="bg-ink text-white font-bold uppercase text-xs tracking-wider px-4 py-2 rounded-sm hover:bg-signal transition-colors">Mark Resolved</button>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Withdrawals */}
            {tab === 'withdrawals' && (
              <div className="space-y-6">
                <div className="flex gap-3 mb-4 items-center">
                  {['all', 'pending', 'completed'].map(f => (
                    <button key={f} onClick={() => setFilterStatus(f)} className={`text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-sm border transition-colors ${filterStatus === f ? 'bg-ink text-white border-ink' : 'border-wire text-ink-600 hover:border-ink'}`}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                  {loadingTabs.financial && <Spinner />}
                </div>
                <div className="border border-wire rounded-sm divide-y divide-wire bg-paper">
                  {withdrawals.length === 0 && <EmptyState icon={Wallet} label="No partner withdrawal requests found." />}
                  {withdrawals.filter(w => filterStatus === 'all' ? true : w.status === filterStatus).map(w => (
                    <div key={w.id} className="flex items-center justify-between p-4 flex-wrap gap-4 hover:bg-ink-50/30 transition-colors">
                      <div><p className="text-base font-black text-ink">{fmtMoney(w.amount)}</p><p className="text-xs font-mono text-ink-500 mt-0.5">M-Pesa: {w.phone} · Requested {safeDate(w.created_at)}</p></div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-sm ${w.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : w.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-signal'}`}>{w.status}</span>
                        {w.status === 'pending' && (
                          <button onClick={() => runGated(`Mark withdrawal of ${fmtMoney(w.amount)} as completed?`, () => markWithdrawalComplete(w.id))}
                            className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-4 py-2 rounded-sm hover:bg-signal/90 transition-colors flex items-center gap-1.5 shadow-sm"><CheckCircle size={14} /> Complete Payout</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transactions */}
            {tab === 'transactions' && (
              <div className="space-y-6">
                <div className="border border-wire rounded-sm p-6 bg-ink-50/50 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-1">Total Verified Revenue</p>
                    <p className="text-3xl font-black text-ink">{fmtMoney(totalRevenueAll)}</p>
                  </div>
                  <button onClick={() => exportEntity('transactions')} className="bg-ink text-white font-bold uppercase text-xs tracking-wider px-5 py-3 rounded-sm hover:bg-signal transition-colors flex items-center gap-2 shadow-sm"><Download size={15} /> Export Transactions CSV</button>
                </div>

                <div className="flex flex-wrap gap-3 items-end bg-paper p-4 border border-wire rounded-sm">
                  <div><label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">From Date</label><input type="date" value={txnDateFrom} onChange={(e) => setTxnDateFrom(e.target.value)} className="text-xs border border-wire rounded-sm px-3 py-2 bg-paper font-semibold" /></div>
                  <div><label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">To Date</label><input type="date" value={txnDateTo} onChange={(e) => setTxnDateTo(e.target.value)} className="text-xs border border-wire rounded-sm px-3 py-2 bg-paper font-semibold" /></div>
                  <select value={txnStatusFilter} onChange={(e) => setTxnStatusFilter(e.target.value)} className="text-xs font-bold uppercase tracking-wider border border-wire rounded-sm px-3 py-2 bg-paper">
                    <option value="all">All Statuses</option><option value="completed">Completed</option><option value="pending">Pending</option><option value="failed">Failed</option>
                  </select>
                  <select value={txnMethodFilter} onChange={(e) => setTxnMethodFilter(e.target.value)} className="text-xs font-bold uppercase tracking-wider border border-wire rounded-sm px-3 py-2 bg-paper">
                    <option value="all">All Methods</option><option value="mpesa">M-Pesa</option><option value="card">Card</option>
                  </select>
                  <input value={txnSearchQ} onChange={(e) => setTxnSearchQ(e.target.value)} placeholder="Search email or ref..." className="text-xs font-medium border border-wire rounded-sm px-3 py-2 flex-1 min-w-[200px] bg-paper focus:outline-none focus:border-ink" />
                </div>

                <div className="border border-wire rounded-sm divide-y divide-wire bg-paper">
                  {filteredTxns.length === 0 && <EmptyState icon={CreditCard} label="No transactions found matching filters." />}
                  {filteredTxns.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-4 flex-wrap gap-4 hover:bg-ink-50/30 transition-colors">
                      <div><p className="text-sm font-bold text-ink">{t.credits} SMS Credits · <span className="font-black">{fmtMoney(t.amount)}</span></p><p className="text-xs font-mono text-ink-500 mt-0.5">{t.reference} · {t.email || '—'} · {safeDate(t.created_at)}</p></div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-sm ${t.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : t.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-signal'}`}>{t.status}</span>
                    </div>
                  ))}
                </div>

                <div className="border border-wire rounded-sm p-6 bg-paper space-y-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-ink flex items-center gap-2"><Lock size={14} className="text-signal" /> Manual Credit Ledger Adjustment</p>
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[200px]"><label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">User Email</label><input value={creditAdjustEmail} onChange={(e) => setCreditAdjustEmail(e.target.value)} placeholder="user@example.com" className="w-full text-xs border border-wire rounded-sm px-3 py-2.5 bg-paper font-semibold" /></div>
                    <div className="w-36"><label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Amount (+/-)</label><input type="number" value={creditAdjustAmount} onChange={(e) => setCreditAdjustAmount(e.target.value)} placeholder="e.g. 50 or -10" className="w-full text-xs border border-wire rounded-sm px-3 py-2.5 bg-paper font-semibold" /></div>
                    <div className="flex-1 min-w-[200px]"><label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Audit Reason</label><input value={creditAdjustReason} onChange={(e) => setCreditAdjustReason(e.target.value)} placeholder="Reason logged in audit trail" className="w-full text-xs border border-wire rounded-sm px-3 py-2.5 bg-paper font-semibold" /></div>
                    <button onClick={() => runGated(`Adjust credits for ${creditAdjustEmail || '—'} by ${creditAdjustAmount || 0}?`, adjustCredits)} className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-6 py-2.5 rounded-sm hover:bg-signal/90 transition-colors shadow-sm">Apply Adjustment</button>
                  </div>
                </div>
              </div>
            )}

            {/* SMS Logs */}
            {tab === 'sms' && (
              <div className="border border-wire rounded-sm divide-y divide-wire bg-paper">
                {smsHistory.length === 0 && <EmptyState icon={MessageSquare} label="No broadcast SMS logs recorded." />}
                {smsHistory.map(s => (
                  <div key={s.id} className="p-4 space-y-1 hover:bg-ink-50/30 transition-colors">
                    <p className="text-sm font-bold text-ink">{s.message}</p>
                    <p className="text-xs font-mono text-ink-500">Recipients: {s.recipients} ({s.recipient_count} total) · Cost: {s.cost} credits · {safeDate(s.created_at)}</p>
                    <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${s.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-signal'}`}>{s.status}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Subscribers */}
            {tab === 'subscribers' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-ink-50 border border-wire rounded-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink">Total Subscribers: <span className="font-black text-sm">{subscribers.length}</span> (Active: <span className="text-signal font-black">{activeSubscribers.length}</span>)</p>
                  <button onClick={exportCSV} className="bg-ink text-white font-bold uppercase text-xs tracking-wider px-5 py-2.5 rounded-sm hover:bg-signal transition-colors flex items-center gap-2 shadow-sm">
                    <Download size={14} /> Export Subscribers CSV
                  </button>
                </div>
                <div className="border border-wire rounded-sm divide-y divide-wire bg-paper">
                  {subscribers.length === 0 && <EmptyState icon={Mail} label="No newsletter subscribers recorded yet." />}
                  {subscribers.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-4 flex-wrap gap-4 hover:bg-ink-50/30 transition-colors">
                      <div>
                        <p className="text-sm font-bold text-ink font-mono">{s.email}</p>
                        <p className="text-xs text-ink-500 mt-0.5">Preferences: {s.preferences} · Joined {safeDateShort(s.created_at)}</p>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-sm ${s.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-signal'}`}>{s.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search Analytics */}
            {tab === 'search' && (
              <div className="space-y-6">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Total System Searches Recorded: <span className="font-black text-ink">{searchAnalytics.total || 0}</span></p>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="border border-wire rounded-sm p-5 bg-paper">
                    <p className="text-xs font-bold uppercase tracking-wider text-ink mb-4">Top User Search Queries</p>
                    <div className="border border-wire rounded-sm divide-y divide-wire">
                      {(searchAnalytics.top || []).length === 0 && <EmptyState icon={Search} label="No search data recorded." />}
                      {(searchAnalytics.top || []).map((s, i) => (
                        <div key={i} className="flex items-center justify-between p-3.5 text-xs">
                          <span className="font-bold text-ink">{s.query}</span>
                          <span className="font-mono text-ink-400">{s.count} searches</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border border-wire rounded-sm p-5 bg-paper">
                    <p className="text-xs font-bold uppercase tracking-wider text-ink mb-4">Recent Query Feed</p>
                    <div className="border border-wire rounded-sm divide-y divide-wire max-h-96 overflow-y-auto">
                      {(searchAnalytics.recent || []).length === 0 && <EmptyState icon={Search} label="No recent searches." />}
                      {(searchAnalytics.recent || []).map((s, i) => (
                        <div key={i} className="p-3.5 flex items-center justify-between text-xs">
                          <span className="font-bold text-ink">{s.query}</span>
                          <span className="font-mono text-ink-400">{safeDate(s.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Export Center */}
            {tab === 'export' && (
              <div className="space-y-6">
                <div className="bg-ink-50 border border-wire rounded-sm p-6">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-ink mb-1">Platform Data Export Center</h2>
                  <p className="text-xs text-ink-500">Download formatted CSV exports of platform databases instantly for offline auditing and reporting.</p>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    ['Users Database', 'users', UsersIcon],
                    ['Transaction Logs', 'transactions', CreditCard],
                    ['Published Stories', 'stories', FileText],
                    ['Subscriber Lists', 'subscribers', Mail],
                  ].map(([label, key, Icon]) => (
                    <button key={key} onClick={() => exportEntity(key)} className="border border-wire bg-paper rounded-sm p-6 text-left hover:border-ink transition-all shadow-sm group">
                      <div className="w-10 h-10 bg-ink-50 rounded-sm grid place-items-center mb-4 group-hover:bg-ink group-hover:text-white transition-colors">
                        <Icon size={18} />
                      </div>
                      <p className="text-sm font-bold text-ink">{label}</p>
                      <p className="text-xs font-bold uppercase tracking-wider text-signal flex items-center gap-1.5 mt-2"><FileDown size={12} /> Download CSV</p>
                    </button>
                  ))}
                </div>
                <button onClick={exportAll} className="bg-ink text-white font-bold uppercase text-xs tracking-wider px-6 py-3.5 rounded-sm hover:bg-signal transition-colors flex items-center gap-2 shadow-md">
                  <Package size={16} /> Export Complete System Package (All Datasets)
                </button>
              </div>
            )}

            {/* Admins */}
            {tab === 'admins' && isRoot && (
              <div className="space-y-6">
                <div className="flex gap-3 max-w-lg bg-ink-50 p-4 border border-wire rounded-sm">
                  <input value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} placeholder="admin@example.com" className="flex-1 border border-wire rounded-sm px-3.5 py-2.5 text-xs font-semibold bg-paper focus:outline-none focus:border-ink" />
                  <button onClick={() => runGated(`Grant admin access to ${newAdminEmail}?`, () => { addAdmin(newAdminEmail, user?.email); showToast(`${newAdminEmail} added as admin`); setNewAdminEmail(''); })} className="bg-signal text-white font-bold uppercase text-xs px-5 py-2.5 rounded-sm hover:bg-signal/90 transition-colors shadow-sm">Grant Admin Access</button>
                </div>
                <div className="border border-wire rounded-sm divide-y divide-wire bg-paper">
                  <div className="p-4 flex items-center justify-between text-xs">
                    <span className="font-bold text-ink font-mono">{user?.email}</span>
                    <span className="font-bold uppercase tracking-wider text-signal bg-red-50 px-2 py-1 rounded-sm border border-red-200">Root Owner (Immutable)</span>
                  </div>
                  {admins.map(email => (
                    <div key={email} className="p-4 flex items-center justify-between text-xs hover:bg-ink-50/30 transition-colors">
                      <span className="font-mono font-bold text-ink">{email}</span>
                      <button onClick={() => runGated(`Revoke admin access for ${email}?`, () => { removeAdmin(email, user?.email); showToast(`${email} removed`); })} className="text-signal font-bold uppercase tracking-wider hover:underline">Revoke Access</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* System Settings (root) */}
            {tab === 'settings' && isRoot && (
              <div className="space-y-8">
                {loadingTabs.settings && <p className="text-xs font-bold uppercase tracking-wider text-ink-400 flex items-center gap-2"><Spinner /> Loading system settings...</p>}
                
                <div className="border border-wire rounded-sm p-6 bg-paper space-y-4 max-w-2xl">
                  <p className="text-xs font-bold uppercase tracking-widest text-ink flex items-center gap-2"><Settings size={14} className="text-signal" /> Core Platform Configuration</p>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Platform Name</label>
                    <input value={platformSettings.name} onChange={(e) => setPlatformSettings({ ...platformSettings, name: e.target.value })} className="w-full border border-wire rounded-sm px-3.5 py-2.5 text-xs font-bold bg-paper" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Platform Description</label>
                    <textarea value={platformSettings.description} onChange={(e) => setPlatformSettings({ ...platformSettings, description: e.target.value })} rows={3} className="w-full border border-wire rounded-sm px-3.5 py-2.5 text-xs font-medium bg-paper resize-none" />
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-2">Connected Social Networks</label>
                    {platformSettings.socialLinks.map((l, i) => (
                      <div key={i} className="flex gap-2 mb-2">
                        <input value={l.platform} onChange={(e) => { const links = [...platformSettings.socialLinks]; links[i] = { ...l, platform: e.target.value }; setPlatformSettings({ ...platformSettings, socialLinks: links }); }} placeholder="Platform" className="w-32 border border-wire rounded-sm px-3 py-2 text-xs bg-paper font-semibold" />
                        <input value={l.url} onChange={(e) => { const links = [...platformSettings.socialLinks]; links[i] = { ...l, url: e.target.value }; setPlatformSettings({ ...platformSettings, socialLinks: links }); }} placeholder="https://..." className="flex-1 border border-wire rounded-sm px-3 py-2 text-xs bg-paper font-mono" />
                        <button onClick={() => setPlatformSettings({ ...platformSettings, socialLinks: platformSettings.socialLinks.filter((_, idx) => idx !== i) })} className="text-signal p-2 hover:bg-red-50 rounded-sm"><X size={15} /></button>
                      </div>
                    ))}
                    <button onClick={() => setPlatformSettings({ ...platformSettings, socialLinks: [...platformSettings.socialLinks, { platform: '', url: '' }] })} className="border border-wire bg-white hover:border-ink px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors">+ Add Social Link</button>
                  </div>

                  <label className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-ink cursor-pointer pt-2">
                    <input type="checkbox" checked={platformSettings.maintenanceMode} onChange={(e) => setPlatformSettings({ ...platformSettings, maintenanceMode: e.target.checked })} className="h-4 w-4 rounded border-wire text-ink focus:ring-0" /> 
                    Enable Platform Maintenance Mode
                  </label>

                  <div className="flex gap-3 pt-4 border-t border-wire">
                    <button onClick={() => runConfirm('Save platform settings?', null, saveSettings)} className="bg-ink text-white font-bold uppercase text-xs tracking-wider px-6 py-3 rounded-sm hover:bg-signal transition-colors shadow-sm">Save Configuration</button>
                    <button onClick={() => runGated('Clear Cloudflare / Application Cache?', clearCache)} className="border border-wire bg-white hover:border-ink font-bold uppercase text-xs tracking-wider px-6 py-3 rounded-sm transition-colors flex items-center gap-1.5"><RefreshCw size={13} /> Clear Cache</button>
                  </div>
                </div>

                <div className="border border-wire rounded-sm bg-paper">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink p-4 border-b border-wire flex items-center gap-2"><Server size={14} className="text-signal" /> System Diagnostic Logs (Last 100 Entries)</p>
                  <div className="divide-y divide-wire max-h-80 overflow-y-auto">
                    {systemLogs.length === 0 && <EmptyState icon={Server} label="No diagnostic log entries recorded." />}
                    {systemLogs.map((l, i) => (
                      <div key={i} className="p-3.5 text-xs font-mono space-y-0.5 hover:bg-ink-50/30 transition-colors">
                        <span className="font-bold text-signal uppercase tracking-wider">{l.level || 'error'}</span> · <span className="text-ink-800">{l.message}</span> 
                        <span className="text-[10px] text-ink-400 block">{safeDate(l.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Security Center (root) */}
            {tab === 'security' && isRoot && (
              <div className="space-y-8">
                {loadingTabs.security && <p className="text-xs font-bold uppercase tracking-wider text-ink-400 flex items-center gap-2"><Spinner /> Loading security telemetry...</p>}
                
                <div className="flex items-center justify-between p-4 bg-ink-50 border border-wire rounded-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-2"><Shield size={14} className="text-signal" /> Active Admin & User Sessions</p>
                  <button onClick={() => runGated('Force logout ALL users platform-wide? This cannot be undone.', forceLogoutAllUsers)} className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-4 py-2.5 rounded-sm hover:bg-signal/90 transition-colors flex items-center gap-1.5 shadow-sm">
                    <LogOut size={14} /> Force Logout All Users
                  </button>
                </div>

                <div className="border border-wire rounded-sm divide-y divide-wire bg-paper">
                  {activeSessions.length === 0 && <EmptyState icon={Clock} label="No active session metadata available." />}
                  {activeSessions.map((s, i) => (
                    <div key={i} className="p-4 flex items-center justify-between text-xs hover:bg-ink-50/30 transition-colors">
                      <span className="font-bold text-ink font-mono">{s.email || s.user}</span>
                      <span className="text-ink-500 font-mono">{s.ip} · {s.device}</span>
                      <span className="text-ink-400">{safeDate(s.lastActive)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-2"><AlertTriangle size={14} className="text-signal" /> Recorded Security Events</p>
                  <div className="border border-wire rounded-sm divide-y divide-wire bg-paper">
                    {securityEvents.length === 0 && <EmptyState icon={AlertTriangle} label="No security incidents logged." />}
                    {securityEvents.map((e, i) => (
                      <div key={i} className="p-4 text-xs space-y-1 hover:bg-ink-50/30 transition-colors">
                        <span className="font-bold text-signal uppercase tracking-wider">{e.type}</span> · <span className="font-medium text-ink">{e.detail}</span> 
                        <span className="text-[10px] text-ink-400 block">{safeDate(e.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-2"><KeyRound size={14} className="text-signal" /> Active API Keys</p>
                  <div className="border border-wire rounded-sm divide-y divide-wire bg-paper">
                    {apiKeys.length === 0 && <EmptyState icon={KeyRound} label="No active API keys registered." />}
                    {apiKeys.map((k, i) => (
                      <div key={i} className="p-4 flex items-center justify-between text-xs hover:bg-ink-50/30 transition-colors">
                        <span className="font-bold text-ink">{k.name}</span>
                        <span className="text-ink-500 font-mono">{(k.key || '').replace(/.(?=.{4})/g, '•')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Audit log */}
            {tab === 'log' && (
              <div className="border border-wire rounded-sm divide-y divide-wire bg-paper">
                {adminLogs.length === 0 && <EmptyState icon={ScrollText} label="No administrative actions logged yet." />}
                {adminLogs.map(l => (
                  <div key={l.id} className="p-4 text-xs space-y-1 hover:bg-ink-50/30 transition-colors">
                    <span className="font-bold text-ink">{l.actorEmail}</span> executed <span className="font-bold uppercase tracking-wider text-signal">{l.action.replaceAll('_', ' ')}</span> on <span className="font-mono text-ink-600">{l.target}</span>
                    <span className="text-[10px] text-ink-400 block">{safeDate(l.timestamp)}</span>
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