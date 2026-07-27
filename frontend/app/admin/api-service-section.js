// frontend/app/admin/api-service-section.js
// ═══════════════════════════════════════════════════════════
// ADMIN MERGE INSTRUCTIONS
// ═══════════════════════════════════════════════════════════
// 1. Import this component in your admin page:
//    import ApiServiceAdminSection from './api-service-section';
//
// 2. Add a new tab to your TABS array:
//    { id: 'api-service', label: 'API Service', icon: Server, visible: user?.role === 'root' },
//
// 3. Add this to your tab content rendering section:
//    {activeTab === 'api-service' && <ApiServiceAdminSection />}
//
// 4. Ensure the following backend routes are mounted in admin.js:
//    import apiServiceAdmin from './api-service-admin.js';
//    admin.route('/api-service', apiServiceAdmin);
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Server, KeyRound, Users, Activity, Eye, Search, ChevronLeft, ChevronRight,
  Loader2, AlertTriangle, BarChart3, Zap, Shield, RefreshCw, XCircle, CheckCircle,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

async function getCsrfToken() {
  try {
    const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
    const data = await res.json();
    return data.token || '';
  } catch (e) {
    return '';
  }
}

export default function ApiServiceAdminSection() {
  const [activeSubTab, setActiveSubTab] = useState('overview');

  // Overview stats
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Keys
  const [keys, setKeys] = useState([]);
  const [keysTotal, setKeysTotal] = useState(0);
  const [keysPage, setKeysPage] = useState(1);
  const [keysTotalPages, setKeysTotalPages] = useState(1);
  const [keysLoading, setKeysLoading] = useState(false);
  const [keysStatusFilter, setKeysStatusFilter] = useState('');
  const [keysSearch, setKeysSearch] = useState('');
  const [revokingKeyId, setRevokingKeyId] = useState(null);

  // Users
  const [apiUsers, setApiUsers] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersLoading, setUsersLoading] = useState(false);
  const [changingTierId, setChangingTierId] = useState(null);

  // Usage
  const [usageData, setUsageData] = useState(null);
  const [usageDays, setUsageDays] = useState(30);
  const [usageLoading, setUsageLoading] = useState(false);

  // Logs
  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsLoading, setLogsLoading] = useState(false);

  // Webhooks
  const [adminWebhooks, setAdminWebhooks] = useState([]);
  const [webhooksLoading, setWebhooksLoading] = useState(false);

  // Alerts
  const [adminAlerts, setAdminAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  const SUB_TABS = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'keys', label: 'API Keys', icon: KeyRound },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'usage', label: 'Usage', icon: Activity },
    { id: 'logs', label: 'Logs', icon: Eye },
    { id: 'webhooks', label: 'Webhooks', icon: Zap },
    { id: 'alerts', label: 'Alerts', icon: Shield },
  ];

  // Fetch overview
  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/api-service/overview`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setOverview(data);
    } catch (e) {}
    setOverviewLoading(false);
  }, []);

  // Fetch keys
  const fetchKeys = useCallback(async (page = 1) => {
    setKeysLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', '20');
      if (keysStatusFilter) params.set('status', keysStatusFilter);
      if (keysSearch) params.set('q', keysSearch);

      const res = await fetch(`${API_BASE}/admin/api-service/keys?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setKeys(data.keys || []);
        setKeysTotal(data.total || 0);
        setKeysPage(data.page || 1);
        setKeysTotalPages(data.totalPages || 1);
      }
    } catch (e) {}
    setKeysLoading(false);
  }, [keysStatusFilter, keysSearch]);

  // Fetch users
  const fetchUsers = useCallback(async (page = 1) => {
    setUsersLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/api-service/users?page=${page}&limit=20`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setApiUsers(data.users || []);
        setUsersTotal(data.total || 0);
        setUsersPage(data.page || 1);
        setUsersTotalPages(data.totalPages || 1);
      }
    } catch (e) {}
    setUsersLoading(false);
  }, []);

  // Fetch usage
  const fetchUsage = useCallback(async () => {
    setUsageLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/api-service/usage/global?days=${usageDays}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setUsageData(data);
    } catch (e) {}
    setUsageLoading(false);
  }, [usageDays]);

  // Fetch logs
  const fetchLogs = useCallback(async (page = 1) => {
    setLogsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/api-service/logs?page=${page}&limit=30`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
        setLogsTotal(data.total || 0);
        setLogsPage(data.page || 1);
        setLogsTotalPages(data.totalPages || 1);
      }
    } catch (e) {}
    setLogsLoading(false);
  }, []);

  // Fetch webhooks
  const fetchWebhooks = useCallback(async () => {
    setWebhooksLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/api-service/webhooks`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setAdminWebhooks(data.webhooks || []);
    } catch (e) {}
    setWebhooksLoading(false);
  }, []);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/api-service/alerts`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setAdminAlerts(data.alerts || []);
    } catch (e) {}
    setAlertsLoading(false);
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (activeSubTab === 'keys') fetchKeys(keysPage);
    if (activeSubTab === 'users') fetchUsers(usersPage);
    if (activeSubTab === 'usage') fetchUsage();
    if (activeSubTab === 'logs') fetchLogs(logsPage);
    if (activeSubTab === 'webhooks') fetchWebhooks();
    if (activeSubTab === 'alerts') fetchAlerts();
  }, [activeSubTab, keysPage, usersPage, logsPage, fetchKeys, fetchUsers, fetchUsage, fetchLogs, fetchWebhooks, fetchAlerts]);

  const handleRevokeKey = async (keyId) => {
    if (!confirm('Force revoke this API key?')) return;
    setRevokingKeyId(keyId);
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`${API_BASE}/admin/api-service/keys/${keyId}/revoke`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      const data = await res.json();
      if (res.ok) fetchKeys(keysPage);
      else alert(data.error || 'Failed to revoke key.');
    } catch (e) { alert('Network error.'); }
    setRevokingKeyId(null);
  };

  const handleReactivateKey = async (keyId) => {
    if (!confirm('Reactivate this API key?')) return;
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`${API_BASE}/admin/api-service/keys/${keyId}/reactivate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      const data = await res.json();
      if (res.ok) fetchKeys(keysPage);
      else alert(data.error || 'Failed to reactivate key.');
    } catch (e) { alert('Network error.'); }
  };

  const handleChangeTier = async (userId, newTier) => {
    if (!confirm(`Change user's API tier to ${newTier}?`)) return;
    setChangingTierId(userId);
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`${API_BASE}/admin/api-service/users/${userId}/tier`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ tier: newTier }),
      });
      const data = await res.json();
      if (res.ok) fetchUsers(usersPage);
      else alert(data.error || 'Failed to update tier.');
    } catch (e) { alert('Network error.'); }
    setChangingTierId(null);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString();
  };

  const renderStatusBadge = (code) => {
    let color = 'bg-ink-50 text-ink-500';
    if (code >= 200 && code < 300) color = 'bg-emerald-50 text-emerald-700';
    else if (code >= 400 && code < 500) color = 'bg-amber-50 text-amber-700';
    else if (code >= 500) color = 'bg-red-50 text-signal';
    return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm ${color}`}>{code}</span>;
  };

  const renderMethodBadge = (method) => {
    const colors = {
      GET: 'bg-emerald-50 text-emerald-700',
      POST: 'bg-blue-50 text-blue-700',
      PUT: 'bg-amber-50 text-amber-700',
      DELETE: 'bg-red-50 text-signal',
    };
    return <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm border ${colors[method] || 'bg-ink-50'}`}>{method}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="flex flex-wrap gap-1 border-b border-wire pb-0">
        {SUB_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider border-b-2 -mb-px transition-colors ${
                isActive ? 'border-signal text-ink' : 'border-transparent text-ink-400 hover:text-ink-600'
              }`}
            >
              <Icon size={12} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW TAB */}
      {activeSubTab === 'overview' && (
        overviewLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-wire bg-white p-5 rounded-sm h-24 animate-pulse" />
            ))}
          </div>
        ) : overview ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="border border-wire bg-white p-5 rounded-sm shadow-sm">
                <p className="text-2xl font-black text-ink">{overview.totalKeys || 0}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mt-1">Total Keys</p>
              </div>
              <div className="border border-wire bg-white p-5 rounded-sm shadow-sm">
                <p className="text-2xl font-black text-ink">{overview.activeUsers || 0}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mt-1">Active Users</p>
              </div>
              <div className="border border-wire bg-white p-5 rounded-sm shadow-sm">
                <p className="text-2xl font-black text-ink">{(overview.callsToday || 0).toLocaleString()}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mt-1">Calls Today</p>
              </div>
              <div className="border border-wire bg-white p-5 rounded-sm shadow-sm">
                <p className="text-2xl font-black text-ink">{(overview.totalRequestsLogged || 0).toLocaleString()}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mt-1">Total Logs</p>
              </div>
            </div>

            {overview.topEndpoints?.length > 0 && (
              <div className="border border-wire bg-white p-5 rounded-sm shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-600 mb-4">Top Endpoints (7 days)</p>
                <div className="space-y-2">
                  {overview.topEndpoints.map((ep, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-ink-400 w-6">#{i + 1}</span>
                      <span className="text-xs font-mono text-ink flex-1 truncate">{ep.endpoint}</span>
                      <span className="text-xs font-black text-ink">{ep.count?.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="border border-wire bg-white p-10 text-center rounded-sm">
            <AlertTriangle size={32} className="text-ink-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-ink-600 uppercase tracking-wider">No data available</p>
          </div>
        )
      )}

      {/* KEYS TAB */}
      {activeSubTab === 'keys' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 bg-white border border-wire rounded-sm px-3 py-2 flex-1 min-w-[140px]">
              <Search size={12} className="text-ink-400" />
              <input
                value={keysSearch}
                onChange={e => setKeysSearch(e.target.value)}
                placeholder="Search keys..."
                className="w-full text-xs font-medium bg-transparent focus:outline-none"
              />
            </div>
            <select
              value={keysStatusFilter}
              onChange={e => setKeysStatusFilter(e.target.value)}
              className="border border-wire rounded-sm px-3 py-2 text-xs font-bold bg-white focus:outline-none"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="revoked">Revoked</option>
            </select>
            <button onClick={() => fetchKeys(1)} className="text-xs font-bold bg-white border border-wire px-4 py-2 rounded-sm hover:border-ink">Apply</button>
          </div>

          {keysLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-wire/20 rounded-sm animate-pulse" />
              ))}
            </div>
          ) : keys.length === 0 ? (
            <div className="border border-wire bg-white p-10 text-center rounded-sm">
              <KeyRound size={32} className="text-ink-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-ink-600 uppercase">No keys found</p>
            </div>
          ) : (
            <>
              <div className="border border-wire bg-white rounded-sm overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-wire bg-paper">
                      <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-4 py-3">Name</th>
                      <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-4 py-3">User</th>
                      <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-4 py-3">Tier</th>
                      <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-4 py-3">Status</th>
                      <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-4 py-3">Last Used</th>
                      <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-wire">
                    {keys.map(key => (
                      <tr key={key.id} className="hover:bg-paper/50">
                        <td className="px-4 py-3 text-xs font-bold text-ink">{key.key_name || '—'}</td>
                        <td className="px-4 py-3 text-xs text-ink-500">{key.user_email || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-ink-50 text-ink-500">{key.tier || 'free'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${key.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-signal'}`}>
                            {key.is_active ? 'Active' : 'Revoked'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[10px] text-ink-400">{formatDate(key.last_used_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {key.is_active ? (
                              <button onClick={() => handleRevokeKey(key.id)} disabled={revokingKeyId === key.id} className="text-[9px] font-bold text-signal hover:underline">
                                {revokingKeyId === key.id ? <Loader2 size={12} className="animate-spin" /> : 'Revoke'}
                              </button>
                            ) : (
                              <button onClick={() => handleReactivateKey(key.id)} className="text-[9px] font-bold text-emerald-600 hover:underline">Reactivate</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {keysTotalPages > 1 && (
                <div className="flex items-center justify-center gap-3">
                  <button disabled={keysPage <= 1} onClick={() => setKeysPage(p => p - 1)} className="text-xs font-bold px-3 py-1.5 border rounded-sm disabled:opacity-30">Prev</button>
                  <span className="text-xs text-ink-400">{keysPage} / {keysTotalPages}</span>
                  <button disabled={keysPage >= keysTotalPages} onClick={() => setKeysPage(p => p + 1)} className="text-xs font-bold px-3 py-1.5 border rounded-sm disabled:opacity-30">Next</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* USERS TAB */}
      {activeSubTab === 'users' && (
        <div className="space-y-4">
          {usersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-wire/20 rounded-sm animate-pulse" />
              ))}
            </div>
          ) : apiUsers.length === 0 ? (
            <div className="border border-wire bg-white p-10 text-center rounded-sm">
              <Users size={32} className="text-ink-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-ink-600 uppercase">No API users found</p>
            </div>
          ) : (
            <>
              <div className="border border-wire bg-white rounded-sm overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-wire bg-paper">
                      <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-4 py-3">User</th>
                      <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-4 py-3">Email</th>
                      <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-4 py-3">Tier</th>
                      <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-4 py-3">Keys</th>
                      <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-4 py-3">Calls Today</th>
                      <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-4 py-3">Change Tier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-wire">
                    {apiUsers.map(user => (
                      <tr key={user.id} className="hover:bg-paper/50">
                        <td className="px-4 py-3 text-xs font-bold text-ink">{user.name || '—'}</td>
                        <td className="px-4 py-3 text-xs text-ink-500">{user.email}</td>
                        <td className="px-4 py-3">
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-ink-50 text-ink-500">{user.tier || 'free'}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-ink-500">{user.key_count || 0}</td>
                        <td className="px-4 py-3 text-xs text-ink-500">{(user.calls_today || 0).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <select
                            value={user.tier || 'free'}
                            onChange={e => handleChangeTier(user.id, e.target.value)}
                            disabled={changingTierId === user.id}
                            className="border border-wire rounded-sm px-2 py-1 text-[10px] font-bold bg-white focus:outline-none disabled:opacity-50"
                          >
                            <option value="free">Free</option>
                            <option value="pro">Pro</option>
                            <option value="enterprise">Enterprise</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {usersTotalPages > 1 && (
                <div className="flex items-center justify-center gap-3">
                  <button disabled={usersPage <= 1} onClick={() => setUsersPage(p => p - 1)} className="text-xs font-bold px-3 py-1.5 border rounded-sm disabled:opacity-30">Prev</button>
                  <span className="text-xs text-ink-400">{usersPage} / {usersTotalPages}</span>
                  <button disabled={usersPage >= usersTotalPages} onClick={() => setUsersPage(p => p + 1)} className="text-xs font-bold px-3 py-1.5 border rounded-sm disabled:opacity-30">Next</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* USAGE TAB */}
      {activeSubTab === 'usage' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setUsageDays(7)} className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-sm border ${usageDays === 7 ? 'bg-ink text-white' : 'bg-white'}`}>7 Days</button>
            <button onClick={() => setUsageDays(30)} className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-sm border ${usageDays === 30 ? 'bg-ink text-white' : 'bg-white'}`}>30 Days</button>
            <button onClick={() => setUsageDays(90)} className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-sm border ${usageDays === 90 ? 'bg-ink text-white' : 'bg-white'}`}>90 Days</button>
          </div>

          {usageLoading ? (
            <div className="h-64 bg-wire/20 rounded-sm animate-pulse" />
          ) : usageData ? (
            <div className="space-y-6">
              {usageData.dailyTotals?.length > 0 && (
                <div className="border border-wire bg-white p-5 rounded-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-600 mb-4">Daily Calls</p>
                  <div className="flex items-end gap-1 h-40">
                    {usageData.dailyTotals.map(day => {
                      const maxCalls = Math.max(1, ...usageData.dailyTotals.map(d => d.total_calls));
                      const h = Math.max(4, (day.total_calls / maxCalls) * 100);
                      return (
                        <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-ink text-white text-[8px] px-1.5 py-0.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                            {day.date}: {day.total_calls?.toLocaleString()}
                          </div>
                          <div className="w-full bg-signal rounded-t-sm group-hover:brightness-110 transition-all" style={{ height: `${h}%` }} />
                          <span className="text-[7px] text-ink-300 uppercase">{day.date.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {usageData.byTier?.length > 0 && (
                <div className="border border-wire bg-white p-5 rounded-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-600 mb-3">By Tier</p>
                  <div className="space-y-2">
                    {usageData.byTier.map(t => (
                      <div key={t.tier} className="flex items-center gap-3">
                        <span className="text-xs font-bold uppercase text-ink-500 w-24">{t.tier}</span>
                        <div className="flex-1 h-3 bg-wire/40 rounded-sm overflow-hidden">
                          <div className="h-full bg-ink rounded-sm" style={{ width: `${Math.min(100, (t.total_calls / Math.max(1, ...usageData.byTier.map(x => x.total_calls))) * 100)}%` }} />
                        </div>
                        <span className="text-xs font-black text-ink">{(t.total_calls || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-wire bg-white p-10 text-center rounded-sm">
              <BarChart3 size={32} className="text-ink-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-ink-600 uppercase">No usage data</p>
            </div>
          )}
        </div>
      )}

      {/* LOGS TAB */}
      {activeSubTab === 'logs' && (
        <div className="space-y-4">
          {logsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 bg-wire/20 rounded-sm animate-pulse" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="border border-wire bg-white p-10 text-center rounded-sm">
              <Eye size={32} className="text-ink-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-ink-600 uppercase">No logs yet</p>
            </div>
          ) : (
            <>
              <div className="border border-wire bg-white rounded-sm overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-wire bg-paper">
                      <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-3 py-2">Time</th>
                      <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-3 py-2">User</th>
                      <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-3 py-2">Method</th>
                      <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-3 py-2">Endpoint</th>
                      <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-3 py-2">Status</th>
                      <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-3 py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-wire text-xs">
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-paper/50">
                        <td className="px-3 py-2 text-[10px] text-ink-400 whitespace-nowrap">{formatDate(log.created_at)}</td>
                        <td className="px-3 py-2 text-[10px] text-ink-500 truncate max-w-[120px]">{log.user_email || '—'}</td>
                        <td className="px-3 py-2">{renderMethodBadge(log.method)}</td>
                        <td className="px-3 py-2 text-[10px] font-mono text-ink truncate max-w-[150px]">{log.endpoint}</td>
                        <td className="px-3 py-2">{renderStatusBadge(log.status_code)}</td>
                        <td className="px-3 py-2 text-[10px] text-ink-400">{log.response_time_ms}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {logsTotalPages > 1 && (
                <div className="flex items-center justify-center gap-3">
                  <button disabled={logsPage <= 1} onClick={() => setLogsPage(p => p - 1)} className="text-xs font-bold px-3 py-1.5 border rounded-sm disabled:opacity-30">Prev</button>
                  <span className="text-xs text-ink-400">{logsPage} / {logsTotalPages}</span>
                  <button disabled={logsPage >= logsTotalPages} onClick={() => setLogsPage(p => p + 1)} className="text-xs font-bold px-3 py-1.5 border rounded-sm disabled:opacity-30">Next</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* WEBHOOKS TAB */}
      {activeSubTab === 'webhooks' && (
        webhooksLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-wire/20 rounded-sm animate-pulse" />
            ))}
          </div>
        ) : adminWebhooks.length === 0 ? (
          <div className="border border-wire bg-white p-10 text-center rounded-sm">
            <Zap size={32} className="text-ink-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-ink-600 uppercase">No webhooks configured</p>
          </div>
        ) : (
          <div className="border border-wire bg-white rounded-sm overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-wire bg-paper">
                  <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-4 py-3">Name</th>
                  <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-4 py-3">User</th>
                  <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-4 py-3">URL</th>
                  <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-4 py-3">Status</th>
                  <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-4 py-3">Failures</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wire">
                {adminWebhooks.map(wh => (
                  <tr key={wh.id} className="hover:bg-paper/50">
                    <td className="px-4 py-3 text-xs font-bold text-ink">{wh.webhook_name}</td>
                    <td className="px-4 py-3 text-xs text-ink-500">{wh.user_email || '—'}</td>
                    <td className="px-4 py-3 text-[10px] font-mono text-ink-500 truncate max-w-[200px]">{wh.webhook_url}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${wh.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-signal'}`}>
                        {wh.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500">{wh.consecutive_failures || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ALERTS TAB */}
      {activeSubTab === 'alerts' && (
        alertsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-wire/20 rounded-sm animate-pulse" />
            ))}
          </div>
        ) : adminAlerts.length === 0 ? (
          <div className="border border-wire bg-white p-10 text-center rounded-sm">
            <Shield size={32} className="text-ink-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-ink-600 uppercase">No alerts configured</p>
          </div>
        ) : (
          <div className="border border-wire bg-white rounded-sm overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-wire bg-paper">
                  <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-4 py-3">User</th>
                  <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-4 py-3">Type</th>
                  <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-4 py-3">Threshold</th>
                  <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-4 py-3">Destination</th>
                  <th className="text-left text-[9px] font-bold uppercase text-ink-400 px-4 py-3">Last Triggered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wire">
                {adminAlerts.map(alert => (
                  <tr key={alert.id} className="hover:bg-paper/50">
                    <td className="px-4 py-3 text-xs text-ink-500">{alert.user_email || '—'}</td>
                    <td className="px-4 py-3 text-[10px] font-bold uppercase text-ink">{alert.alert_type}</td>
                    <td className="px-4 py-3 text-xs font-bold text-ink">{alert.threshold_percent}%</td>
                    <td className="px-4 py-3 text-[10px] text-ink-500 truncate max-w-[150px]">{alert.destination}</td>
                    <td className="px-4 py-3 text-[10px] text-ink-400">{formatDate(alert.last_triggered_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}