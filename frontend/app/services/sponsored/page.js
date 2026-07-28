// app/services/sponsored/page.js
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../../lib/auth';
// PAYMENT: Uncomment when ready to charge
// import ServicePaymentButton from '../../../components/ServicePaymentButton';
import ServicePaymentVerify from '../../../components/ServicePaymentVerify';
import SponsoredCampaignDashboard from '../../../components/SponsoredCampaignDashboard';
import SponsoredMediaUploader from '../../../components/SponsoredMediaUploader';
import SponsoredPerformanceChart from '../../../components/SponsoredPerformanceChart';
import SponsoredTargetingSelector from '../../../components/SponsoredTargetingSelector';
import SponsoredCreativesManager from '../../../components/SponsoredCreativesManager';
import {
  MonitorPlay, LayoutTemplate, Link2, CheckCircle, Loader2, AlertTriangle,
  BarChart3, History, FileText, ShoppingBag, Plus, Pause, Play, Edit3,
  Eye, ChevronDown, ChevronUp, Calendar, Image as ImageIcon, Target, X, Download,
} from 'lucide-react';

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
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border ${cls}`}>
      {status || 'draft'}
    </span>
  );
}

function EmptyState({ icon: Icon, title, subtitle, actionLabel, onAction }) {
  return (
    <div className="border border-wire bg-white p-12 text-center rounded-sm">
      <Icon size={40} className="text-ink-300 mx-auto mb-4" />
      <p className="text-sm font-bold text-ink-600 uppercase tracking-wider">{title}</p>
      {subtitle && <p className="text-xs text-ink-400 mt-1">{subtitle}</p>}
      {actionLabel && (
        <button
          onClick={onAction}
          className="mt-4 bg-signal text-white font-bold uppercase text-xs tracking-wider px-5 py-3 rounded-sm hover:bg-signal/90 transition-colors inline-flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-signal"
        >
          <Plus size={14} /> {actionLabel}
        </button>
      )}
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="p-4 bg-red-50 border border-signal rounded-sm flex items-start gap-3">
      <AlertTriangle size={16} className="text-signal shrink-0 mt-0.5" />
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-signal mb-1">Something Went Wrong</p>
        <p className="text-sm font-medium text-signal">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="text-xs font-bold text-ink underline mt-2 focus-visible:ring-2 focus-visible:ring-signal">
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

const TABS = [
  { id: 'dashboard', label: 'Campaign Dashboard', icon: BarChart3 },
  { id: 'create', label: 'Create Campaign', icon: Plus },
  { id: 'history', label: 'History', icon: History },
  { id: 'reports', label: 'Reports', icon: FileText },
];

export default function SponsoredServicePage() {
  const { user, ready } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [hasAccess, setHasAccess] = useState(false);
  const [activePackage, setActivePackage] = useState(null);
  const [packages, setPackages] = useState([]);
  const [activatingFreeId, setActivatingFreeId] = useState(null);

  const [tab, setTab] = useState('dashboard');
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsTotal, setCampaignsTotal] = useState(0);
  const [campaignsPage, setCampaignsPage] = useState(1);
  const [campaignsStatusFilter, setCampaignsStatusFilter] = useState('');
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignsError, setCampaignsError] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [editingCampaignId, setEditingCampaignId] = useState(null);

  // Create/Edit form state
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [targetingRules, setTargetingRules] = useState({ categories: [], regions: [], counties: [] });
  const [scheduledStartAt, setScheduledStartAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [formErrors, setFormErrors] = useState({});

  const loadInitial = useCallback(() => {
    if (!ready || !user) {
      if (ready) setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    Promise.all([
      fetch(`${API_BASE}/sponsored-service/check`, { credentials: 'include' }).then(r => r.json()),
      fetch(`${API_BASE}/sponsored-service/packages`).then(r => r.json()),
    ])
      .then(([checkRes, pkgRes]) => {
        if (checkRes.active) {
          setHasAccess(true);
          setActivePackage(checkRes);
          if (checkRes.campaignId) setSelectedCampaignId(checkRes.campaignId);
        }
        if (pkgRes.packages) setPackages(pkgRes.packages);
      })
      .catch(() => setLoadError('Could not load your sponsored access. Please retry.'))
      .finally(() => setLoading(false));
  }, [ready, user]);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  const loadCampaigns = useCallback((page = 1, status = '') => {
    setCampaignsLoading(true);
    setCampaignsError('');
    const qs = new URLSearchParams({ page, limit: 20, ...(status ? { status } : {}) });
    fetch(`${API_BASE}/sponsored-service/campaigns?${qs.toString()}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setCampaigns(data.campaigns || []);
        setCampaignsTotal(data.total || 0);
        setCampaignsPage(data.page || 1);
        if (!selectedCampaignId && data.campaigns && data.campaigns.length) {
          setSelectedCampaignId(data.campaigns[0].id);
        }
      })
      .catch(() => setCampaignsError('Could not load campaign history.'))
      .finally(() => setCampaignsLoading(false));
  }, [selectedCampaignId]);

  useEffect(() => {
    if (hasAccess && (tab === 'history' || tab === 'reports')) {
      loadCampaigns(campaignsPage, campaignsStatusFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess, tab, campaignsStatusFilter]);

  // PAYMENT: This currently grants ANY package (free or paid) for free via /sponsored-service/pay.
  // Uncomment the ServicePaymentButton block further below and gate this function to
  // free-tier packages only when ready to charge for paid packages.
  const handleActivateFree = async (pkg) => {
    setActivatingFreeId(pkg.id);
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`${API_BASE}/sponsored-service/pay`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ packageId: pkg.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setHasAccess(true);
        setActivePackage(data);
      } else {
        setLoadError(data.error || 'Could not activate this package.');
      }
    } catch (e) {
      setLoadError('Network error activating package.');
    }
    setActivatingFreeId(null);
  };

  const resetForm = () => {
    setHeadline(''); setBody(''); setCtaUrl(''); setBannerUrl('');
    setTargetingRules({ categories: [], regions: [], counties: [] });
    setScheduledStartAt(''); setErrorMsg(''); setFormErrors({}); setSuccess(false);
  };

  const validateForm = () => {
    const errs = {};
    if (!headline.trim()) errs.headline = 'Headline is required.';
    if (!body.trim()) errs.body = 'Body copy is required.';
    if (!ctaUrl.trim()) errs.ctaUrl = 'CTA URL is required.';
    else {
      try { new URL(ctaUrl); } catch { errs.ctaUrl = 'Enter a valid URL.'; }
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const loadCampaignForEdit = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/sponsored-service/campaigns/${id}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.campaign) {
        const c = data.campaign;
        setHeadline(c.headline || '');
        setBody(c.body || '');
        setCtaUrl(c.cta_url || c.ctaUrl || '');
        setBannerUrl(c.banner_url || c.bannerUrl || '');

        // Convert backend targeting array to component format
        const rawTargeting = c.targeting || [];
        const targeting = { categories: [], regions: [], counties: [] };
        if (Array.isArray(rawTargeting)) {
          rawTargeting.forEach(t => {
            if (t.target_type === 'category') targeting.categories.push(t.target_value);
            else if (t.target_type === 'region') targeting.regions.push(t.target_value);
            else if (t.target_type === 'county') targeting.counties.push(t.target_value);
          });
        }
        setTargetingRules(targeting);

        setScheduledStartAt(c.scheduled_start_at || c.scheduledStartAt || '');
        setEditingCampaignId(id);
        setTab('create');
      }
    } catch (e) { setErrorMsg('Could not load campaign for editing.'); }
  };

  const handleSubmitCampaign = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!validateForm()) return;

    setSubmitting(true);
    setErrorMsg('');
    try {
      const csrfToken = await getCsrfToken();
      const payload = {
        headline, body, ctaUrl,
        packageId: activePackage?.packageId || activePackage?.id,
        bannerUrl: bannerUrl || undefined,
        targeting: targetingRules,
        scheduledStartAt: scheduledStartAt || undefined,
      };
      const url = editingCampaignId
        ? `${API_BASE}/sponsored-service/campaigns/${editingCampaignId}`
        : `${API_BASE}/sponsored-service/campaigns`;
      const method = editingCampaignId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        const newId = data.campaign?.id || editingCampaignId;
        if (newId) setSelectedCampaignId(newId);
      } else {
        setErrorMsg(data.error || 'Failed to submit campaign materials.');
      }
    } catch (e) {
      setErrorMsg('Network error. Check your connection and try again.');
    }
    setSubmitting(false);
  };

  const handlePauseResume = async (id, action) => {
    try {
      const csrfToken = await getCsrfToken();
      await fetch(`${API_BASE}/sponsored-service/campaigns/${id}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      });
      loadCampaigns(campaignsPage, campaignsStatusFilter);
    } catch (e) { /* self-heal silently, table will just not update */ }
  };

  const handleCancelCampaign = async (id) => {
    try {
      const csrfToken = await getCsrfToken();
      await fetch(`${API_BASE}/sponsored-service/campaigns/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      loadCampaigns(campaignsPage, campaignsStatusFilter);
    } catch (e) { /* ignore */ }
  };

  if (!ready || loading) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-ink" size={24} /></div>;
  }

  return (
    <div className="min-h-screen bg-paper py-12 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <ServicePaymentVerify serviceType="sponsored" onVerified={(data) => {
          setHasAccess(true);
          setActivePackage(data);
        }} />

        <div className="mb-8 border-b-2 border-wire pb-6">
          <h1 className="text-3xl font-black text-ink flex items-center gap-3 uppercase tracking-tight">
            <MonitorPlay className="text-signal" size={28} /> Sponsored Content Placement
          </h1>
          <p className="text-sm text-ink-500 font-medium mt-2">Feature your content prominently across the feed and sidebars of the platform.</p>
        </div>

        {loadError && <div className="mb-6"><ErrorState message={loadError} onRetry={loadInitial} /></div>}

        {!hasAccess ? (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <ShoppingBag size={18} className="text-ink" />
              <h2 className="text-sm font-black uppercase tracking-wider text-ink">Choose a Package</h2>
            </div>
            {packages.length === 0 ? (
              <EmptyState icon={ShoppingBag} title="No Packages Available" subtitle="Check back soon for sponsored placement packages." />
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {packages.map(pkg => {
                  const isFree = !pkg.price_kes_cents || pkg.price_kes_cents === 0;
                  return (
                    <div key={pkg.id} className="border border-wire bg-white p-6 sm:p-8 rounded-sm flex flex-col hover:border-ink transition-all shadow-sm">
                      <h3 className="text-xl font-black text-ink uppercase">{pkg.name}</h3>
                      <p className="text-3xl font-black text-ink mt-2">
                        {isFree ? 'FREE' : `KES ${(pkg.price_kes_cents / 100).toLocaleString()}`}
                      </p>
                      <div className="my-6 flex-1 space-y-3">
                        <p className="text-xs font-bold text-ink flex items-center gap-2 uppercase tracking-wider"><CheckCircle size={14} className="text-signal" /> {pkg.duration_days} Days Rotation</p>
                        <p className="text-xs font-bold text-ink flex items-center gap-2 uppercase tracking-wider"><CheckCircle size={14} className="text-signal" /> ~{pkg.impressions_goal?.toLocaleString()} Impressions</p>
                        {(pkg.features || ['Home Feed Placement', 'Sidebar Sticky Widget']).map((feat, i) => (
                          <p key={i} className="text-[10px] font-bold text-ink-500 flex items-center gap-2 uppercase tracking-wider"><CheckCircle size={12} className="text-ink-300" /> {feat}</p>
                        ))}
                      </div>

                      {/*
                        PAYMENT: Uncomment when ready to charge for paid packages, and gate
                        the "Get Free Access" button below so it only applies to isFree packages.

                        {isFree ? (
                          <button
                            disabled={activatingFreeId === pkg.id}
                            onClick={() => handleActivateFree(pkg)}
                            className="bg-ink text-white py-4 font-bold uppercase text-xs tracking-wider rounded-sm hover:bg-ink/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-signal"
                          >
                            {activatingFreeId === pkg.id ? <Loader2 size={16} className="animate-spin" /> : 'Get Free Access'}
                          </button>
                        ) : (
                          <ServicePaymentButton serviceType="sponsored" packageId={pkg.id} packageName={pkg.name} className="bg-ink text-white py-4" />
                        )}
                      */}

                      <button
                        disabled={activatingFreeId === pkg.id}
                        onClick={() => handleActivateFree(pkg)}
                        className="bg-ink text-white py-4 font-bold uppercase text-xs tracking-wider rounded-sm hover:bg-ink/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-signal"
                      >
                        {activatingFreeId === pkg.id ? <Loader2 size={16} className="animate-spin" /> : 'Get Free Access'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-1 mb-8 border-b border-wire overflow-x-auto">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id); if (t.id === 'create' && !editingCampaignId) resetForm(); }}
                  className={`flex items-center gap-2 px-4 py-3 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors focus-visible:ring-2 focus-visible:ring-signal ${
                    tab === t.id ? 'border-signal text-ink' : 'border-transparent text-ink-400 hover:text-ink'
                  }`}
                >
                  <t.icon size={14} /> {t.label}
                </button>
              ))}
            </div>

            {tab === 'dashboard' && (
              selectedCampaignId ? (
                <SponsoredCampaignDashboard
                  campaignId={selectedCampaignId}
                  onEdit={() => loadCampaignForEdit(selectedCampaignId)}
                  onPause={() => handlePauseResume(selectedCampaignId, 'pause')}
                  onResume={() => handlePauseResume(selectedCampaignId, 'resume')}
                  onViewReport={() => setTab('reports')}
                />
              ) : (
                <EmptyState
                  icon={MonitorPlay}
                  title="No Active Campaign"
                  subtitle="Create your first sponsored campaign to see performance here."
                  actionLabel="Create your first campaign"
                  onAction={() => { resetForm(); setEditingCampaignId(null); setTab('create'); }}
                />
              )
            )}

            {tab === 'create' && (
              success ? (
                <div className="border border-wire bg-emerald-50 p-12 text-center rounded-sm shadow-sm">
                  <CheckCircle size={48} className="text-emerald-600 mx-auto mb-4" />
                  <h2 className="text-xl font-black text-ink uppercase tracking-wider">
                    {editingCampaignId ? 'Campaign Updated' : 'Campaign Created'}
                  </h2>
                  <p className="text-sm font-medium text-ink-600 mt-2">Your sponsored campaign is ready to rotate in the prime slots.</p>
                  <button
                    onClick={() => { setTab('dashboard'); }}
                    className="mt-6 bg-ink text-white font-bold uppercase text-xs tracking-wider px-5 py-3 rounded-sm hover:bg-ink/90 transition-colors focus-visible:ring-2 focus-visible:ring-signal"
                  >
                    View Dashboard
                  </button>
                </div>
              ) : (
                <div className="border border-wire bg-white p-6 sm:p-8 rounded-sm shadow-sm">
                  <h2 className="text-sm font-black uppercase tracking-wider text-ink mb-6">
                    {editingCampaignId ? 'Edit Campaign' : 'Campaign Details'}
                  </h2>

                  {errorMsg && <div className="mb-6"><ErrorState message={errorMsg} /></div>}

                  <form onSubmit={handleSubmitCampaign} className="space-y-6">
                    <div>
                      <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1"><LayoutTemplate size={14} /> Campaign Headline</label>
                      <input value={headline} onChange={e => setHeadline(e.target.value)} className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-bold bg-paper focus:outline-none focus:border-ink transition-colors" placeholder="e.g. The Future of African FinTech..." />
                      {formErrors.headline && <p className="text-[11px] text-signal font-bold mt-1">{formErrors.headline}</p>}
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Article Teaser / Body</label>
                      <textarea value={body} onChange={e => setBody(e.target.value)} rows={6} className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors resize-y" placeholder="Enter the promotional copy..." />
                      {formErrors.body && <p className="text-[11px] text-signal font-bold mt-1">{formErrors.body}</p>}
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1"><Link2 size={14} /> Call-To-Action (CTA) URL</label>
                      <input type="url" value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-mono bg-paper focus:outline-none focus:border-ink transition-colors" placeholder="https://your-landing-page.com" />
                      {formErrors.ctaUrl && <p className="text-[11px] text-signal font-bold mt-1">{formErrors.ctaUrl}</p>}
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-2"><ImageIcon size={14} /> Banner Media</label>
                      <SponsoredMediaUploader
                        currentUrl={bannerUrl}
                        onUpload={(url) => setBannerUrl(url)}
                        onRemove={() => setBannerUrl('')}
                      />
                    </div>

                    <SponsoredTargetingSelector targeting={targetingRules} onChange={setTargetingRules} />

                    <div>
                      <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1"><Calendar size={14} /> Scheduled Start (optional)</label>
                      <input type="datetime-local" value={scheduledStartAt} onChange={e => setScheduledStartAt(e.target.value)} className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors" />
                    </div>

                    {editingCampaignId && <SponsoredCreativesManager campaignId={editingCampaignId} />}

                    <div className="flex gap-3">
                      {editingCampaignId && (
                        <button
                          type="button"
                          onClick={() => { setEditingCampaignId(null); resetForm(); setTab('dashboard'); }}
                          className="border border-wire bg-white text-ink font-bold uppercase text-xs tracking-wider px-5 py-4 rounded-sm hover:border-ink transition-colors focus-visible:ring-2 focus-visible:ring-signal"
                        >
                          Cancel
                        </button>
                      )}
                      <button disabled={submitting} type="submit" className="flex-1 bg-signal text-white font-bold uppercase tracking-wider py-4 rounded-sm hover:bg-signal/90 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-signal">
                        {submitting ? <Loader2 size={18} className="animate-spin" /> : (editingCampaignId ? 'Save Changes' : 'Launch Campaign')}
                      </button>
                    </div>
                  </form>
                </div>
              )
            )}

            {tab === 'history' && (
              <div>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <h2 className="text-sm font-black uppercase tracking-wider text-ink">Campaign History</h2>
                  <select
                    value={campaignsStatusFilter}
                    onChange={e => setCampaignsStatusFilter(e.target.value)}
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

                {campaignsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-16 bg-wire/20 animate-pulse rounded-sm" />)}
                  </div>
                ) : campaignsError ? (
                  <ErrorState message={campaignsError} onRetry={() => loadCampaigns(campaignsPage, campaignsStatusFilter)} />
                ) : campaigns.length === 0 ? (
                  <EmptyState icon={History} title="No Campaigns Yet" subtitle="Launch your first sponsored campaign to see it here." actionLabel="Create Campaign" onAction={() => { resetForm(); setEditingCampaignId(null); setTab('create'); }} />
                ) : (
                  <>
                    {/* Table on desktop */}
                    <div className="hidden md:block border border-wire rounded-sm overflow-hidden bg-white">
                      <table className="w-full text-sm">
                        <thead className="bg-ink text-white text-[10px] uppercase tracking-wider">
                          <tr>
                            <th className="text-left px-4 py-3 font-bold">Headline</th>
                            <th className="text-left px-4 py-3 font-bold">Status</th>
                            <th className="text-left px-4 py-3 font-bold">Impressions</th>
                            <th className="text-left px-4 py-3 font-bold">Clicks</th>
                            <th className="text-left px-4 py-3 font-bold">CTR</th>
                            <th className="text-left px-4 py-3 font-bold">Dates</th>
                            <th className="text-left px-4 py-3 font-bold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {campaigns.map(c => (
                            <tr key={c.id} className="border-t border-wire">
                              <td className="px-4 py-3 font-bold text-ink">{c.headline}</td>
                              <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                              <td className="px-4 py-3 font-mono text-xs">{(c.impressions_served || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 font-mono text-xs">{(c.clicks || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 font-mono text-xs">
                                {c.impressions_served > 0 ? `${((c.clicks / c.impressions_served) * 100).toFixed(2)}%` : '—'}
                              </td>
                              <td className="px-4 py-3 text-xs text-ink-500">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2 flex-wrap">
                                  {c.status === 'active' && (
                                    <button onClick={() => handlePauseResume(c.id, 'pause')} className="text-xs font-bold text-ink underline flex items-center gap-1"><Pause size={12} /> Pause</button>
                                  )}
                                  {c.status === 'paused' && (
                                    <button onClick={() => handlePauseResume(c.id, 'resume')} className="text-xs font-bold text-ink underline flex items-center gap-1"><Play size={12} /> Resume</button>
                                  )}
                                  {(c.status === 'active' || c.status === 'paused' || c.status === 'scheduled' || c.status === 'draft') && (
                                    <button onClick={() => loadCampaignForEdit(c.id)} className="text-xs font-bold text-ink underline flex items-center gap-1"><Edit3 size={12} /> Edit</button>
                                  )}
                                  {(c.status === 'scheduled' || c.status === 'draft') && (
                                    <button onClick={() => handleCancelCampaign(c.id)} className="text-xs font-bold text-signal underline flex items-center gap-1"><X size={12} /> Cancel</button>
                                  )}
                                  {c.status === 'completed' && (
                                    <button onClick={() => { setSelectedCampaignId(c.id); setTab('reports'); }} className="text-xs font-bold text-ink underline flex items-center gap-1"><Eye size={12} /> Report</button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Cards on mobile */}
                    <div className="md:hidden space-y-3">
                      {campaigns.map(c => (
                        <div key={c.id} className="border border-wire bg-white p-4 rounded-sm">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="font-bold text-ink text-sm">{c.headline}</p>
                            <StatusBadge status={c.status} />
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-[10px] font-bold uppercase text-ink-500 mb-3">
                            <span>Imp: {(c.impressions_served || 0).toLocaleString()}</span>
                            <span>Clk: {(c.clicks || 0).toLocaleString()}</span>
                            <span>CTR: {c.impressions_served > 0 ? `${((c.clicks / c.impressions_served) * 100).toFixed(2)}%` : '—'}</span>
                          </div>
                          <div className="flex gap-3 flex-wrap">
                            {c.status === 'active' && <button onClick={() => handlePauseResume(c.id, 'pause')} className="text-xs font-bold text-ink underline">Pause</button>}
                            {c.status === 'paused' && <button onClick={() => handlePauseResume(c.id, 'resume')} className="text-xs font-bold text-ink underline">Resume</button>}
                            <button onClick={() => loadCampaignForEdit(c.id)} className="text-xs font-bold text-ink underline">Edit</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <button
                        disabled={campaignsPage <= 1}
                        onClick={() => loadCampaigns(campaignsPage - 1, campaignsStatusFilter)}
                        className="text-xs font-bold text-ink underline disabled:opacity-30"
                      >Previous</button>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                        Page {campaignsPage} of {Math.max(1, Math.ceil(campaignsTotal / 20))}
                      </span>
                      <button
                        disabled={campaignsPage >= Math.ceil(campaignsTotal / 20)}
                        onClick={() => loadCampaigns(campaignsPage + 1, campaignsStatusFilter)}
                        className="text-xs font-bold text-ink underline disabled:opacity-30"
                      >Next</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === 'reports' && (
              <div>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <h2 className="text-sm font-black uppercase tracking-wider text-ink">Performance Reports</h2>
                  {campaigns.length > 0 && (
                    <select
                      value={selectedCampaignId || ''}
                      onChange={e => setSelectedCampaignId(e.target.value)}
                      className="border border-wire rounded-sm px-3 py-2 text-xs font-bold uppercase tracking-wider bg-paper focus:outline-none focus:border-ink"
                    >
                      {campaigns.map(c => <option key={c.id} value={c.id}>{c.headline}</option>)}
                    </select>
                  )}
                </div>
                {selectedCampaignId ? (
                  <SponsoredPerformanceChart campaignId={selectedCampaignId} />
                ) : (
                  <EmptyState icon={FileText} title="No Campaign Selected" subtitle="Create a campaign to view its performance report." />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}