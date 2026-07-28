// ═══════════════════════════════════════════════════════════
// ADMIN MERGE INSTRUCTIONS
// ═══════════════════════════════════════════════════════════
// 1. Import this component in frontend/app/admin/page.js:
//    import SponsoredCampaignsAdminSection from './SponsoredCampaignsAdminSection';
//
// 2. Add a new tab to the TABS array:
//    { id: 'sponsored-admin', label: 'Sponsored Ads', icon: MonitorPlay, visible: user?.role === 'root' },
//
// 3. Add this to the tab content rendering section (near the end of main):
//    {tab === 'sponsored-admin' && isRoot && <SponsoredCampaignsAdminSection />}
//
// 4. The component handles its own data fetching — no additional setup needed.
// ═══════════════════════════════════════════════════════════
'use client';

import { useEffect, useState, useCallback } from 'react';
import { BarChart3, ListChecks, Search, AlertTriangle, Loader2, CheckCircle, XCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

const STATUS_STYLES = {
  draft: 'bg-ink-50 text-ink-500 border-ink-200',
  scheduled: 'bg-amber-50 text-amber-700 border-amber-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paused: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  cancelled: 'bg-red-50 text-signal border-red-200',
};

async function getCsrfToken() {
  try {
    const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
    const data = await res.json();
    return data.token || '';
  } catch (e) { return ''; }
}

function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || STATUS_STYLES.draft;
  return <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border ${cls}`}>{status || 'draft'}</span>;
}

const SUB_TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'campaigns', label: 'All Campaigns', icon: ListChecks },
];

export default function SponsoredCampaignsAdminSection() {
  const [subTab, setSubTab] = useState('overview');

  // Overview
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');

  // Campaigns table
  const [campaigns, setCampaigns] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');
  const [tableLoading, setTableLoading] = useState(true);
  const [tableError, setTableError] = useState('');

  const loadStats = useCallback(() => {
    setStatsLoading(true);
    setStatsError('');
    fetch(`${API_BASE}/sponsored-service/admin/stats`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(() => setStatsError('Could not load platform stats.'))
      .finally(() => setStatsLoading(false));
  }, []);

  const loadCampaigns = useCallback((p = 1, status = '', q = '') => {
    setTableLoading(true);
    setTableError('');
    const qs = new URLSearchParams({ page: p, limit: 20, ...(status ? { status } : {}), ...(q ? { q } : {}) });
    fetch(`${API_BASE}/sponsored-service/admin/campaigns?${qs.toString()}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setCampaigns(data.campaigns || []);
        setTotal(data.total || 0);
        setPage(data.page || 1);
      })
      .catch(() => setTableError('Could not load campaigns.'))
      .finally(() => setTableLoading(false));
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { if (subTab === 'campaigns') loadCampaigns(1, statusFilter, query); }, [subTab, statusFilter]);

  const handleForceStop = async (id) => {
    try {
      const csrfToken = await getCsrfToken();
      await fetch(`${API_BASE}/sponsored-service/admin/campaigns/${id}/force-stop`, {
        method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': csrfToken },
      });
      loadCampaigns(page, statusFilter, query);
    } catch (e) { setTableError('Could not force stop campaign.'); }
  };

  const handleApprove = async (id) => {
    try {
      const csrfToken = await getCsrfToken();
      await fetch(`${API_BASE}/sponsored-service/admin/campaigns/${id}/approve`, {
        method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': csrfToken },
      });
      loadCampaigns(page, statusFilter, query);
    } catch (e) { setTableError('Could not approve campaign.'); }
  };

  return (
    <div>
      <div className="flex items-center gap-1 mb-6 border-b border-wire">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-colors ${
              subTab === t.id ? 'border-signal text-ink' : 'border-transparent text-ink-400 hover:text-ink'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {subTab === 'overview' && (
        statsLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-24 bg-wire/20 animate-pulse rounded-sm" />)}
          </div>
        ) : statsError ? (
          <div className="p-4 bg-red-50 border border-signal rounded-sm flex items-start gap-3">
            <AlertTriangle size={16} className="text-signal shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-signal">{statsError}</p>
              <button onClick={loadStats} className="text-xs font-bold text-ink underline mt-2">Retry</button>
            </div>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              {[
                ['Total Campaigns', stats?.total_campaigns],
                ['Active Campaigns', stats?.active_campaigns],
                ['Total Impressions', stats?.total_impressions],
                ['Total Clicks', stats?.total_clicks],
                ['Total Conversions', stats?.total_conversions],
              ].map(([label, val]) => (
                <div key={label} className="border border-wire bg-white p-5 rounded-sm shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-2">{label}</p>
                  <p className="text-2xl font-black text-ink">{(val || 0).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className="border border-wire bg-white rounded-sm p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-4">Top Campaigns</p>
              {(!stats?.top_campaigns || stats.top_campaigns.length === 0) ? (
                <p className="text-xs text-ink-400">No campaign data yet.</p>
              ) : (
                <div className="space-y-2">
                  {stats.top_campaigns.map((c, i) => (
                    <div key={c.id || i} className="flex items-center justify-between text-xs border-b border-wire pb-2 last:border-b-0">
                      <span className="font-bold text-ink truncate flex-1">{c.headline}</span>
                      <span className="font-mono text-ink-500 shrink-0 ml-3">{(c.impressions || 0).toLocaleString()} imp / {(c.clicks || 0).toLocaleString()} clk</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      )}

      {subTab === 'campaigns' && (
        <div>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') loadCampaigns(1, statusFilter, query); }}
                placeholder="Search by headline or email..."
                className="w-full border border-wire rounded-sm pl-9 pr-3 py-2 text-xs bg-paper focus:outline-none focus:border-ink"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border border-wire rounded-sm px-3 py-2 text-xs font-bold uppercase tracking-wider bg-paper focus:outline-none focus:border-ink"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {tableError && (
            <div className="mb-4 p-4 bg-red-50 border border-signal rounded-sm flex items-start gap-3">
              <AlertTriangle size={16} className="text-signal shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-signal">{tableError}</p>
                <button onClick={() => loadCampaigns(page, statusFilter, query)} className="text-xs font-bold text-ink underline mt-2">Retry</button>
              </div>
            </div>
          )}

          {tableLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-wire/20 animate-pulse rounded-sm" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="border border-wire bg-white p-12 text-center rounded-sm">
              <ListChecks size={40} className="text-ink-300 mx-auto mb-4" />
              <p className="text-sm font-bold text-ink-600 uppercase tracking-wider">No Campaigns Found</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block border border-wire rounded-sm overflow-hidden bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-ink text-white text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-4 py-3 font-bold">Headline</th>
                      <th className="text-left px-4 py-3 font-bold">User</th>
                      <th className="text-left px-4 py-3 font-bold">Status</th>
                      <th className="text-left px-4 py-3 font-bold">Impressions</th>
                      <th className="text-left px-4 py-3 font-bold">Clicks</th>
                      <th className="text-left px-4 py-3 font-bold">CTR</th>
                      <th className="text-left px-4 py-3 font-bold">Created</th>
                      <th className="text-left px-4 py-3 font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map(c => (
                      <tr key={c.id} className="border-t border-wire">
                        <td className="px-4 py-3 font-bold text-ink">{c.headline}</td>
                        <td className="px-4 py-3 text-xs text-ink-500">{c.user_email || c.userEmail || '—'}</td>
                        <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                        <td className="px-4 py-3 font-mono text-xs">{(c.impressions_served || c.impressions || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono text-xs">{(c.clicks || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono text-xs">{c.ctr ? `${c.ctr.toFixed(2)}%` : '—'}</td>
                        <td className="px-4 py-3 text-xs text-ink-500">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {!c.approved && (
                              <button onClick={() => handleApprove(c.id)} className="border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white font-bold uppercase text-[10px] tracking-wider px-2 py-1 rounded-sm transition-colors flex items-center gap-1">
                                <CheckCircle size={11} /> Approve
                              </button>
                            )}
                            {(c.status === 'active' || c.status === 'paused') && (
                              <button onClick={() => handleForceStop(c.id)} className="border border-red-200 bg-red-50 text-signal hover:bg-signal hover:text-white font-bold uppercase text-[10px] tracking-wider px-2 py-1 rounded-sm transition-colors flex items-center gap-1">
                                <XCircle size={11} /> Force Stop
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-3">
                {campaigns.map(c => (
                  <div key={c.id} className="border border-wire bg-white p-4 rounded-sm">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-bold text-ink text-sm">{c.headline}</p>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-[10px] text-ink-400 mb-2">{c.user_email || c.userEmail}</p>
                    <div className="flex gap-2">
                      {!c.approved && <button onClick={() => handleApprove(c.id)} className="text-[10px] font-bold text-emerald-700 underline">Approve</button>}
                      {(c.status === 'active' || c.status === 'paused') && <button onClick={() => handleForceStop(c.id)} className="text-[10px] font-bold text-signal underline">Force Stop</button>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mt-4">
                <button disabled={page <= 1} onClick={() => loadCampaigns(page - 1, statusFilter, query)} className="text-xs font-bold text-ink underline disabled:opacity-30">Previous</button>
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Page {page} of {Math.max(1, Math.ceil(total / 20))}</span>
                <button disabled={page >= Math.ceil(total / 20)} onClick={() => loadCampaigns(page + 1, statusFilter, query)} className="text-xs font-bold text-ink underline disabled:opacity-30">Next</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}