// frontend/app/admin/PlatformAdminSection.js
// ═══════════════════════════════════════════════════════════
// MERGE INSTRUCTIONS
// ═══════════════════════════════════════════════════════════
// 1. Import in admin/page.js:
//    import PlatformAdminSection from './PlatformAdminSection';
//
// 2. Add these tabs to the TABS array (after existing tabs):
//    { id: 'feature-flags', label: 'Feature Flags', icon: Flag, visible: user?.role === 'root' },
//    { id: 'ip-blacklist', label: 'IP Blacklist', icon: Shield, visible: user?.role === 'root' },
//    { id: 'circuit-breakers', label: 'Circuit Breakers', icon: Zap, visible: user?.role === 'root' },
//    { id: 'cron-jobs', label: 'Cron Jobs', icon: Clock, visible: user?.role === 'root' },
//    { id: 'errors-log', label: 'Error Log', icon: AlertTriangle, visible: user?.role === 'root' },
//    { id: 'dead-links', label: 'Dead Links', icon: Link2, visible: user?.role === 'root' },
//    { id: 'realtime', label: 'Realtime', icon: Activity, visible: user?.role === 'root' },
//
// 3. Add these renders in the main content area:
//    {tab === 'feature-flags' && isRoot && <PlatformAdminSection subTab="feature-flags" />}
//    {tab === 'ip-blacklist' && isRoot && <PlatformAdminSection subTab="ip-blacklist" />}
//    {tab === 'circuit-breakers' && isRoot && <PlatformAdminSection subTab="circuit-breakers" />}
//    {tab === 'cron-jobs' && isRoot && <PlatformAdminSection subTab="cron-jobs" />}
//    {tab === 'errors-log' && isRoot && <PlatformAdminSection subTab="errors-log" />}
//    {tab === 'dead-links' && isRoot && <PlatformAdminSection subTab="dead-links" />}
//    {tab === 'realtime' && isRoot && <PlatformAdminSection subTab="realtime" />}
//
// 4. Add to onClick handlers: if (t.id === 'feature-flags') { } etc.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, AlertTriangle, RefreshCw, Search, Flag, Zap, Shield, Clock, Link2, Activity } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

async function getCsrfToken() {
  try {
    const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
    const data = await res.json();
    return data.token || '';
  } catch (e) { return ''; }
}

export default function PlatformAdminSection({ subTab }) {
  // Feature Flags
  const [flags, setFlags] = useState([]);
  const [flagsLoading, setFlagsLoading] = useState(false);

  // IP Blacklist
  const [blacklist, setBlacklist] = useState({ ips: [], total: 0 });
  const [blacklistPage, setBlacklistPage] = useState(1);
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [blockIpInput, setBlockIpInput] = useState('');
  const [blockReason, setBlockReason] = useState('');

  // Circuit Breakers
  const [breakers, setBreakers] = useState([]);
  const [breakersLoading, setBreakersLoading] = useState(false);

  // Cron Jobs
  const [cronJobs, setCronJobs] = useState([]);
  const [cronLoading, setCronLoading] = useState(false);

  // Errors
  const [errors, setErrors] = useState([]);
  const [errorsPage, setErrorsPage] = useState(1);
  const [errorsTotal, setErrorsTotal] = useState(0);
  const [errorsLoading, setErrorsLoading] = useState(false);

  // Dead Links
  const [deadLinks, setDeadLinks] = useState([]);
  const [deadLinksPage, setDeadLinksPage] = useState(1);
  const [deadLinksTotal, setDeadLinksTotal] = useState(0);
  const [deadLinksLoading, setDeadLinksLoading] = useState(false);

  // Realtime
  const [realtime, setRealtime] = useState(null);
  const [realtimeLoading, setRealtimeLoading] = useState(false);

  const [error, setError] = useState('');

  // ── Feature Flags ──────────────────────────────────────────────────
  const loadFlags = useCallback(async () => {
    setFlagsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/feature-flags`, { credentials: 'include' });
      const data = await res.json();
      setFlags(data.flags || []);
    } catch (e) { setError('Failed to load feature flags.'); }
    setFlagsLoading(false);
  }, []);

  const toggleFlag = async (key, currentValue) => {
    const newValue = currentValue === 'true' ? 'false' : 'true';
    try {
      const csrfToken = await getCsrfToken();
      await fetch(`${API_BASE}/admin/feature-flags/${key}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ value: newValue }),
      });
      loadFlags();
    } catch (e) { setError('Failed to update flag.'); }
  };

  // ── IP Blacklist ───────────────────────────────────────────────────
  const loadBlacklist = useCallback(async (page = 1) => {
    setBlacklistLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/ip-blacklist?page=${page}`, { credentials: 'include' });
      const data = await res.json();
      setBlacklist({ ips: data.ips || [], total: data.total || 0 });
      setBlacklistPage(page);
    } catch (e) { setError('Failed to load IP blacklist.'); }
    setBlacklistLoading(false);
  }, []);

  const handleBlockIp = async () => {
    if (!blockIpInput.trim()) return;
    try {
      const csrfToken = await getCsrfToken();
      await fetch(`${API_BASE}/admin/ip-blacklist`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ ip: blockIpInput.trim(), reason: blockReason || 'Manual block', permanent: false }),
      });
      setBlockIpInput('');
      setBlockReason('');
      loadBlacklist(blacklistPage);
    } catch (e) { setError('Failed to block IP.'); }
  };

  const handleUnblockIp = async (ip) => {
    try {
      const csrfToken = await getCsrfToken();
      await fetch(`${API_BASE}/admin/ip-blacklist/${encodeURIComponent(ip)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      loadBlacklist(blacklistPage);
    } catch (e) { setError('Failed to unblock IP.'); }
  };

  // ── Circuit Breakers ───────────────────────────────────────────────
  const loadBreakers = useCallback(async () => {
    setBreakersLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/circuit-breakers`, { credentials: 'include' });
      const data = await res.json();
      setBreakers(data.breakers || []);
    } catch (e) { setError('Failed to load circuit breakers.'); }
    setBreakersLoading(false);
  }, []);

  const resetBreaker = async (name) => {
    try {
      const csrfToken = await getCsrfToken();
      await fetch(`${API_BASE}/admin/circuit-breakers/${name}/reset`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      loadBreakers();
    } catch (e) { setError('Failed to reset circuit breaker.'); }
  };

  // ── Cron Jobs ──────────────────────────────────────────────────────
  const loadCronJobs = useCallback(async () => {
    setCronLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/cron-jobs`, { credentials: 'include' });
      const data = await res.json();
      setCronJobs(data.jobs || []);
    } catch (e) { setError('Failed to load cron jobs.'); }
    setCronLoading(false);
  }, []);

  // ── Errors ─────────────────────────────────────────────────────────
  const loadErrors = useCallback(async (page = 1) => {
    setErrorsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/errors?page=${page}`, { credentials: 'include' });
      const data = await res.json();
      setErrors(data.errors || []);
      setErrorsTotal(data.total || 0);
      setErrorsPage(page);
    } catch (e) { setError('Failed to load errors.'); }
    setErrorsLoading(false);
  }, []);

  const resolveError = async (errorKey) => {
    try {
      const csrfToken = await getCsrfToken();
      await fetch(`${API_BASE}/admin/errors/${encodeURIComponent(errorKey)}/resolve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      loadErrors(errorsPage);
    } catch (e) { setError('Failed to resolve error.'); }
  };

  // ── Dead Links ─────────────────────────────────────────────────────
  const loadDeadLinks = useCallback(async (page = 1) => {
    setDeadLinksLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/dead-links?page=${page}`, { credentials: 'include' });
      const data = await res.json();
      setDeadLinks(data.links || []);
      setDeadLinksTotal(data.total || 0);
      setDeadLinksPage(page);
    } catch (e) { setError('Failed to load dead links.'); }
    setDeadLinksLoading(false);
  }, []);

  const resolveDeadLink = async (id) => {
    try {
      const csrfToken = await getCsrfToken();
      await fetch(`${API_BASE}/admin/dead-links/${id}/resolve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      loadDeadLinks(deadLinksPage);
    } catch (e) { setError('Failed to resolve dead link.'); }
  };

  // ── Realtime Dashboard ─────────────────────────────────────────────
  const loadRealtime = useCallback(async () => {
    setRealtimeLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/dashboard/realtime`, { credentials: 'include' });
      const data = await res.json();
      setRealtime(data);
    } catch (e) { setError('Failed to load dashboard.'); }
    setRealtimeLoading(false);
  }, []);

  // Auto-refresh realtime every 10 seconds
  useEffect(() => {
    if (subTab === 'realtime') {
      loadRealtime();
      const id = setInterval(loadRealtime, 10000);
      return () => clearInterval(id);
    }
  }, [subTab, loadRealtime]);

  // Load data when tab becomes active
  useEffect(() => {
    if (subTab === 'feature-flags') loadFlags();
    if (subTab === 'ip-blacklist') loadBlacklist();
    if (subTab === 'circuit-breakers') loadBreakers();
    if (subTab === 'cron-jobs') loadCronJobs();
    if (subTab === 'errors-log') loadErrors();
    if (subTab === 'dead-links') loadDeadLinks();
    if (subTab === 'realtime') loadRealtime();
  }, [subTab]);

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-signal rounded-sm flex items-start gap-3">
          <AlertTriangle size={16} className="text-signal shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-signal">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-xs font-bold text-ink underline">Dismiss</button>
        </div>
      )}

      {/* FEATURE FLAGS */}
      {subTab === 'feature-flags' && (
        <div>
          <h2 className="text-xl font-black text-ink mb-4 flex items-center gap-2"><Flag size={20} className="text-signal" /> Feature Flags</h2>
          {flagsLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 bg-wire/20 animate-pulse rounded-sm" />)}</div>
          ) : (
            <div className="border border-wire rounded-sm divide-y divide-wire bg-white">
              {flags.map(f => (
                <div key={f.flag_key} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-bold text-ink uppercase">{f.flag_key.replace(/_/g, ' ')}</p>
                    <p className="text-[10px] text-ink-400">{f.description || 'No description'}</p>
                  </div>
                  <button
                    onClick={() => toggleFlag(f.flag_key, f.flag_value)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${f.flag_value === 'true' ? 'bg-emerald-500' : 'bg-ink-200'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${f.flag_value === 'true' ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* IP BLACKLIST */}
      {subTab === 'ip-blacklist' && (
        <div>
          <h2 className="text-xl font-black text-ink mb-4 flex items-center gap-2"><Shield size={20} className="text-signal" /> IP Blacklist ({blacklist.total})</h2>
          <div className="flex gap-2 mb-4">
            <input value={blockIpInput} onChange={e => setBlockIpInput(e.target.value)} placeholder="IP address..." className="flex-1 border border-wire rounded-sm px-3 py-2 text-sm" />
            <input value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder="Reason..." className="w-40 border border-wire rounded-sm px-3 py-2 text-sm" />
            <button onClick={handleBlockIp} className="bg-signal text-white font-bold uppercase text-xs px-4 py-2 rounded-sm hover:bg-signal/90">Block</button>
          </div>
          {blacklistLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 bg-wire/20 animate-pulse rounded-sm" />)}</div>
          ) : blacklist.ips.length === 0 ? (
            <p className="text-sm text-ink-400 border border-wire bg-white p-6 text-center rounded-sm">No blocked IPs.</p>
          ) : (
            <div className="border border-wire rounded-sm divide-y divide-wire bg-white">
              {blacklist.ips.map(ip => (
                <div key={ip.ip_address} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <span className="font-mono font-bold text-ink">{ip.ip_address}</span>
                    <span className={`ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${ip.is_permanent ? 'bg-red-100 text-signal' : 'bg-amber-100 text-amber-700'}`}>
                      {ip.is_permanent ? 'Permanent' : 'Temporary'}
                    </span>
                    <p className="text-xs text-ink-400 mt-0.5">{ip.reason}</p>
                  </div>
                  <button onClick={() => handleUnblockIp(ip.ip_address)} className="text-xs font-bold text-signal hover:underline">Unblock</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CIRCUIT BREAKERS */}
      {subTab === 'circuit-breakers' && (
        <div>
          <h2 className="text-xl font-black text-ink mb-4 flex items-center gap-2"><Zap size={20} className="text-signal" /> Circuit Breakers</h2>
          {breakersLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-wire/20 animate-pulse rounded-sm" />)}</div>
          ) : breakers.length === 0 ? (
            <p className="text-sm text-ink-400 border border-wire bg-white p-6 text-center rounded-sm">No circuit breakers configured.</p>
          ) : (
            <div className="border border-wire rounded-sm divide-y divide-wire bg-white">
              {breakers.map(b => (
                <div key={b.service_name} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-bold text-ink uppercase">{b.service_name.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-ink-400">Failures: {b.failure_count} · State: <span className={`font-bold ${b.state === 'open' ? 'text-signal' : b.state === 'half_open' ? 'text-amber-600' : 'text-emerald-600'}`}>{b.state}</span></p>
                  </div>
                  <button onClick={() => resetBreaker(b.service_name)} className="bg-ink text-white font-bold uppercase text-xs px-4 py-2 rounded-sm hover:bg-signal transition-colors">Reset</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CRON JOBS */}
      {subTab === 'cron-jobs' && (
        <div>
          <h2 className="text-xl font-black text-ink mb-4 flex items-center gap-2"><Clock size={20} className="text-signal" /> Cron Jobs</h2>
          {cronLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-wire/20 animate-pulse rounded-sm" />)}</div>
          ) : cronJobs.length === 0 ? (
            <p className="text-sm text-ink-400 border border-wire bg-white p-6 text-center rounded-sm">No cron job logs yet.</p>
          ) : (
            <div className="border border-wire rounded-sm divide-y divide-wire bg-white max-h-96 overflow-y-auto">
              {cronJobs.map(job => (
                <div key={job.id} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <p className="font-bold text-ink text-xs">{job.job_name}</p>
                    <p className="text-[10px] text-ink-400">{new Date(job.created_at).toLocaleString()} · {job.duration_ms}ms</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm ${job.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-signal'}`}>{job.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ERROR LOG */}
      {subTab === 'errors-log' && (
        <div>
          <h2 className="text-xl font-black text-ink mb-4 flex items-center gap-2"><AlertTriangle size={20} className="text-signal" /> Error Log ({errorsTotal})</h2>
          {errorsLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 bg-wire/20 animate-pulse rounded-sm" />)}</div>
          ) : errors.length === 0 ? (
            <p className="text-sm text-ink-400 border border-wire bg-white p-6 text-center rounded-sm">No errors recorded. 🎉</p>
          ) : (
            <>
              <div className="border border-wire rounded-sm divide-y divide-wire bg-white">
                {errors.map(e => (
                  <div key={e.error_key} className="flex items-start justify-between p-3 gap-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-ink text-xs truncate">{e.error_message}</p>
                      <p className="text-[10px] text-ink-400">{e.endpoint} · {e.occurrence_count}x · Last: {new Date(e.last_seen_at).toLocaleString()}</p>
                    </div>
                    <button onClick={() => resolveError(e.error_key)} className="text-xs font-bold text-signal hover:underline shrink-0">Resolve</button>
                  </div>
                ))}
              </div>
              {errorsTotal > 20 && (
                <div className="flex gap-2 mt-4 justify-center">
                  <button disabled={errorsPage <= 1} onClick={() => loadErrors(errorsPage - 1)} className="text-xs font-bold px-3 py-1.5 border rounded-sm disabled:opacity-30">Prev</button>
                  <span className="text-xs text-ink-400">{errorsPage} / {Math.ceil(errorsTotal / 20)}</span>
                  <button disabled={errorsPage >= Math.ceil(errorsTotal / 20)} onClick={() => loadErrors(errorsPage + 1)} className="text-xs font-bold px-3 py-1.5 border rounded-sm disabled:opacity-30">Next</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* DEAD LINKS */}
      {subTab === 'dead-links' && (
        <div>
          <h2 className="text-xl font-black text-ink mb-4 flex items-center gap-2"><Link2 size={20} className="text-signal" /> Dead Links ({deadLinksTotal})</h2>
          {deadLinksLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-wire/20 animate-pulse rounded-sm" />)}</div>
          ) : deadLinks.length === 0 ? (
            <p className="text-sm text-ink-400 border border-wire bg-white p-6 text-center rounded-sm">No dead links found. 🎉</p>
          ) : (
            <>
              <div className="border border-wire rounded-sm divide-y divide-wire bg-white">
                {deadLinks.map(link => (
                  <div key={link.id} className="flex items-center justify-between p-3 text-sm gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-mono text-ink truncate">{link.link_url}</p>
                      <p className="text-[10px] text-ink-400">Status: {link.status_code || 'Timeout'} · Story: {link.story_id}</p>
                    </div>
                    <button onClick={() => resolveDeadLink(link.id)} className="text-xs font-bold text-signal hover:underline shrink-0">Resolve</button>
                  </div>
                ))}
              </div>
              {deadLinksTotal > 20 && (
                <div className="flex gap-2 mt-4 justify-center">
                  <button disabled={deadLinksPage <= 1} onClick={() => loadDeadLinks(deadLinksPage - 1)} className="text-xs font-bold px-3 py-1.5 border rounded-sm disabled:opacity-30">Prev</button>
                  <span className="text-xs text-ink-400">{deadLinksPage} / {Math.ceil(deadLinksTotal / 20)}</span>
                  <button disabled={deadLinksPage >= Math.ceil(deadLinksTotal / 20)} onClick={() => loadDeadLinks(deadLinksPage + 1)} className="text-xs font-bold px-3 py-1.5 border rounded-sm disabled:opacity-30">Next</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* REALTIME DASHBOARD */}
      {subTab === 'realtime' && (
        <div>
          <h2 className="text-xl font-black text-ink mb-4 flex items-center gap-2"><Activity size={20} className="text-signal" /> Realtime Dashboard</h2>
          {realtimeLoading && !realtime ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 bg-wire/20 animate-pulse rounded-sm" />)}
            </div>
          ) : realtime ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="border border-wire bg-white p-5 rounded-sm">
                  <p className="text-2xl font-black text-ink">{realtime.totalUsers?.toLocaleString()}</p>
                  <p className="text-[10px] font-bold uppercase text-ink-400 mt-1">Total Users</p>
                </div>
                <div className="border border-wire bg-white p-5 rounded-sm">
                  <p className="text-2xl font-black text-ink">{realtime.totalStories?.toLocaleString()}</p>
                  <p className="text-[10px] font-bold uppercase text-ink-400 mt-1">Total Stories</p>
                </div>
                <div className="border border-wire bg-white p-5 rounded-sm">
                  <p className="text-2xl font-black text-ink">{realtime.activeUsersRecently || 0}</p>
                  <p className="text-[10px] font-bold uppercase text-ink-400 mt-1">Recent Signups</p>
                </div>
                <div className="border border-wire bg-white p-5 rounded-sm">
                  <p className="text-2xl font-black text-ink">{realtime.adminActionsLast5Min || 0}</p>
                  <p className="text-[10px] font-bold uppercase text-ink-400 mt-1">Actions (5 min)</p>
                </div>
                <div className="border border-wire bg-white p-5 rounded-sm">
                  <p className="text-2xl font-black text-ink">{realtime.errorsLastHour || 0}</p>
                  <p className="text-[10px] font-bold uppercase text-ink-400 mt-1">Errors (1 hour)</p>
                </div>
                <div className="border border-wire bg-white p-5 rounded-sm">
                  <p className="text-2xl font-black text-ink">{realtime.avgQueryTimeMs || 0}ms</p>
                  <p className="text-[10px] font-bold uppercase text-ink-400 mt-1">Avg Query Time</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-ink-400">
                <span>Auto-refreshes every 10 seconds</span>
                <span>Last updated: {new Date(realtime.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}