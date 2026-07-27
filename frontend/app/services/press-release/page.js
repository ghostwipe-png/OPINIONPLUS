// app/services/press-release/page.js
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../../lib/auth';
import ServicePaymentButton from '../../../components/ServicePaymentButton';
import ServicePaymentVerify from '../../../components/ServicePaymentVerify';
import PressReleaseCard from '../../../components/PressReleaseCard';
import PressReleaseAnalytics from '../../../components/PressReleaseAnalytics';
import PressKitUploader from '../../../components/PressKitUploader';
import {
  Megaphone, FileText, UploadCloud, CheckCircle, Loader2, AlertTriangle,
  History, BarChart3, ShoppingBag, ChevronDown, ChevronUp, Rocket,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

const CATEGORIES = ['Business', 'Technology', 'Finance', 'Health', 'Real Estate', 'Education', 'Lifestyle', 'Politics', 'Sports', 'Entertainment'];
const REGIONS = ['Nairobi', 'Coast', 'Central', 'Eastern', 'Nyanza', 'Rift Valley', 'Western', 'North Eastern'];

async function getCsrfToken() {
  try {
    const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
    const data = await res.json();
    return data.token || '';
  } catch (e) {
    return '';
  }
}

const emptyForm = {
  title: '', content: '', company: '',
  media_contact_name: '', media_contact_email: '', media_contact_phone: '',
  company_logo_url: '', company_website: '',
  meta_title: '', meta_description: '', meta_keywords: '',
  target_category: '', target_region: '', target_county: '',
  scheduled_at: '', embargo_until: '',
};

export default function PressReleasePage() {
  const { user, ready } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [packages, setPackages] = useState([]);

  const [activeTab, setActiveTab] = useState('purchase');

  // Submit form state
  const [form, setForm] = useState(emptyForm);
  const [showSeo, setShowSeo] = useState(false);
  const [pendingKitFiles, setPendingKitFiles] = useState([]); // files added before a release exists yet
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [scheduledInfo, setScheduledInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [editingReleaseId, setEditingReleaseId] = useState(null);

  // History tab state
  const [releases, setReleases] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Analytics tab state
  const [selectedReleaseId, setSelectedReleaseId] = useState(null);
  const [overview, setOverview] = useState({ totalReleases: 0, totalViews: 0, totalShares: 0, avgReadTime: 0 });

  useEffect(() => {
    if (!ready || !user) {
      if (ready) setLoading(false);
      return;
    }

    Promise.all([
      fetch(`${API_BASE}/services/check/press_release`, { credentials: 'include' }).then(r => r.json()),
      fetch(`${API_BASE}/services/packages/press_release`).then(r => r.json())
    ])
      .then(([checkRes, pkgRes]) => {
        if (checkRes.active) setHasAccess(true);
        if (pkgRes.packages) setPackages(pkgRes.packages);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ready, user]);

  const loadHistory = useCallback(async (pageNum = 1) => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const res = await fetch(`${API_BASE}/services/press-release/history?page=${pageNum}&limit=10`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setReleases(data.releases || []);
        setTotalPages(data.totalPages || 1);
        setPage(data.page || 1);

        const totals = (data.releases || []).reduce((acc, r) => ({
          totalReleases: acc.totalReleases + 1,
          totalViews: acc.totalViews + (r.analytics?.views || 0),
          totalShares: acc.totalShares + (r.analytics?.shares || 0),
          avgReadTime: acc.avgReadTime,
        }), { totalReleases: 0, totalViews: 0, totalShares: 0, avgReadTime: 0 });
        setOverview(totals);
      } else {
        setHistoryError(data.error || 'Failed to load release history.');
      }
    } catch (e) {
      setHistoryError('Network error while loading release history.');
    }
    setHistoryLoading(false);
  }, []);

  useEffect(() => {
    if (hasAccess && (activeTab === 'history' || activeTab === 'analytics')) {
      loadHistory(page);
    }
  }, [hasAccess, activeTab, loadHistory, page]);

  const updateField = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const resetForm = () => {
    setForm(emptyForm);
    setPendingKitFiles([]);
    setEditingReleaseId(null);
    setShowSeo(false);
  };

  const startEdit = async (release) => {
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE}/services/press-release/${release.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load release.');
      const r = data.release;
      setForm({
        title: r.title || '', content: r.content || '', company: r.company || '',
        media_contact_name: r.media_contact_name || '', media_contact_email: r.media_contact_email || '', media_contact_phone: r.media_contact_phone || '',
        company_logo_url: r.company_logo_url || '', company_website: r.company_website || '',
        meta_title: r.meta_title || '', meta_description: r.meta_description || '', meta_keywords: r.meta_keywords || '',
        target_category: r.target_category || '', target_region: r.target_region || '', target_county: r.target_county || '',
        scheduled_at: r.scheduled_at ? r.scheduled_at.slice(0, 16) : '', embargo_until: r.embargo_until ? r.embargo_until.slice(0, 16) : '',
      });
      setPendingKitFiles(r.kit || []);
      setEditingReleaseId(release.id);
      setActiveTab('submit');
    } catch (e) {
      setErrorMsg(e.message || 'Could not open this release for editing.');
    }
  };

  const handleDelete = async (release) => {
    if (!confirm(`Delete "${release.title}"? This cannot be undone.`)) return;
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`${API_BASE}/services/press-release/${release.id}`, {
        method: 'DELETE', credentials: 'include', headers: { 'X-CSRF-Token': csrfToken },
      });
      const data = await res.json();
      if (res.ok) {
        loadHistory(page);
      } else {
        alert(data.error || 'Failed to delete release.');
      }
    } catch (e) {
      alert('Network error while deleting release.');
    }
  };

  const handleBoost = async (release) => {
    const days = parseInt(prompt('Boost for how many days? (1-30)', '7') || '', 10);
    if (!days || days < 1) return;
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`${API_BASE}/services/press-release/${release.id}/boost`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ duration_days: days }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Boosted through ${new Date(data.boost.ends_at).toLocaleDateString()}.`);
        loadHistory(page);
      } else {
        alert(data.error || 'Failed to boost release.');
      }
    } catch (e) {
      alert('Network error while boosting release.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      const csrfToken = await getCsrfToken();
      const isEditing = Boolean(editingReleaseId);
      const url = isEditing
        ? `${API_BASE}/services/press-release/${editingReleaseId}`
        : `${API_BASE}/services/content/press-release`;

      const payload = { ...form };
      if (!payload.scheduled_at) delete payload.scheduled_at;
      if (!payload.embargo_until) delete payload.embargo_until;

      const res = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && (data.success || data.ok)) {
        if (data.scheduled) {
          setScheduledInfo(data.scheduledAt);
        }
        setSuccess(true);
        resetForm();
      } else {
        setErrorMsg(data.error || 'Failed to submit press release.');
      }
    } catch (e) {
      setErrorMsg('Network error. Check your connection and try again.');
    }
    setSubmitting(false);
  };

  if (!ready || loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-ink" /></div>;

  const TABS = [
    { id: 'purchase', label: 'Purchase Packages', icon: ShoppingBag, visible: true },
    { id: 'submit', label: 'Submit Release', icon: UploadCloud, visible: hasAccess },
    { id: 'history', label: 'Release History', icon: History, visible: hasAccess },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, visible: hasAccess },
  ];

  return (
    <div className="min-h-screen bg-paper py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <ServicePaymentVerify serviceType="press_release" onVerified={() => setHasAccess(true)} />

        <div className="mb-8 border-b-2 border-wire pb-6">
          <h1 className="text-3xl font-black text-ink flex items-center gap-3 uppercase tracking-tight">
            <Megaphone className="text-signal" size={28} /> Press Release Distribution
          </h1>
          <p className="text-sm text-ink-500 font-medium mt-2">Publish official company announcements directly to the OPINIONPLUS news network.</p>
        </div>

        {hasAccess && (
          <div className="flex flex-wrap gap-1 mb-8 border-b border-wire" role="tablist">
            {TABS.filter(t => t.visible).map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-[11px] font-bold uppercase tracking-wider border-b-2 -mb-px transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal ${
                    isActive ? 'border-signal text-ink' : 'border-transparent text-ink-400 hover:text-ink-600'
                  }`}
                >
                  <Icon size={14} /> {tab.label}
                </button>
              );
            })}
          </div>
        )}

        {(!hasAccess || activeTab === 'purchase') && (
          <div className="grid md:grid-cols-2 gap-6">
            {packages.length === 0 && (
              <p className="text-sm font-medium text-ink-500 col-span-2">No packages currently available.</p>
            )}
            {packages.map(pkg => (
              <div key={pkg.id} className="border border-wire bg-white p-6 sm:p-8 rounded-sm flex flex-col hover:border-ink transition-all shadow-sm">
                <h3 className="text-xl font-black text-ink uppercase">{pkg.name}</h3>
                <p className="text-3xl font-black text-ink mt-2">KES {(pkg.price_kes_cents / 100).toLocaleString()}</p>
                <div className="my-6 flex-1 space-y-3">
                  {(pkg.features || ['Network-wide distribution', 'SEO optimized linking', 'Editorial review']).map((feat, i) => (
                    <p key={i} className="text-xs font-bold text-ink-600 flex items-center gap-2 uppercase tracking-wider"><CheckCircle size={14} className="text-signal" /> {feat}</p>
                  ))}
                </div>
                <ServicePaymentButton serviceType="press_release" packageId={pkg.id} packageName={pkg.name} className="bg-ink text-white py-4" />
              </div>
            ))}
          </div>
        )}

        {hasAccess && activeTab === 'submit' && (
          success ? (
            <div className="border border-wire bg-emerald-50 p-12 text-center rounded-sm shadow-sm">
              <CheckCircle size={48} className="text-emerald-600 mx-auto mb-4" />
              <h2 className="text-xl font-black text-ink uppercase tracking-wider">
                {scheduledInfo ? 'Press Release Scheduled' : 'Press Release Submitted'}
              </h2>
              <p className="text-sm font-medium text-ink-600 mt-2">
                {scheduledInfo
                  ? `Your release will go live on ${new Date(scheduledInfo).toLocaleString()}.`
                  : 'Your release has been published and is now live on the network.'}
              </p>
              <div className="flex items-center justify-center gap-3 mt-6">
                <button onClick={() => { setSuccess(false); setScheduledInfo(null); }} className="text-[11px] font-bold uppercase tracking-wider text-ink px-4 py-2 border border-wire rounded-sm hover:border-ink transition-colors">
                  Submit Another
                </button>
                <button onClick={() => { setSuccess(false); setScheduledInfo(null); setActiveTab('history'); }} className="text-[11px] font-bold uppercase tracking-wider text-white bg-ink px-4 py-2 rounded-sm hover:bg-ink/90 transition-colors">
                  View History
                </button>
              </div>
            </div>
          ) : (
            <div className="border border-wire bg-white p-6 sm:p-8 rounded-sm shadow-sm">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
                <div className="bg-ink text-white text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm shadow-sm">
                  <CheckCircle size={12} className="text-emerald-400" /> Active Subscription Verified
                </div>
                {editingReleaseId && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-signal">Editing existing release</span>
                )}
              </div>

              {errorMsg && (
                <div className="mb-6 p-4 bg-red-50 border border-signal rounded-sm flex items-start gap-3">
                  <AlertTriangle size={16} className="text-signal shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-signal mb-1">Submission Error</p>
                    <p className="text-sm font-medium text-signal">{errorMsg}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Company / Organization Name</label>
                  <input required value={form.company} onChange={updateField('company')} className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-bold bg-paper focus:outline-none focus:border-ink transition-colors" placeholder="e.g. Acme Innovations Ltd." />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Press Release Headline</label>
                  <input required value={form.title} onChange={updateField('title')} className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-bold bg-paper focus:outline-none focus:border-ink transition-colors" placeholder="Clear, impactful headline..." />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Release Content</label>
                  <textarea required value={form.content} onChange={updateField('content')} rows={12} className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors resize-y" placeholder="Write your full press release here..." />
                </div>

                {/* Company branding */}
                <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-wire">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1 mt-4">Company Logo URL</label>
                    <input type="url" value={form.company_logo_url} onChange={updateField('company_logo_url')} className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors" placeholder="https://..." />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1 mt-4">Company Website</label>
                    <input type="url" value={form.company_website} onChange={updateField('company_website')} className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors" placeholder="https://..." />
                  </div>
                </div>

                {/* Media contact */}
                <div className="pt-2 border-t border-wire">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-3 mt-4">Media Contact</p>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <input value={form.media_contact_name} onChange={updateField('media_contact_name')} placeholder="Contact name" className="border border-wire rounded-sm px-4 py-3 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors" />
                    <input type="email" value={form.media_contact_email} onChange={updateField('media_contact_email')} placeholder="Contact email" className="border border-wire rounded-sm px-4 py-3 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors" />
                    <input value={form.media_contact_phone} onChange={updateField('media_contact_phone')} placeholder="Contact phone" className="border border-wire rounded-sm px-4 py-3 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors" />
                  </div>
                </div>

                {/* Targeting */}
                <div className="pt-2 border-t border-wire">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-3 mt-4">Targeting</p>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <select value={form.target_category} onChange={updateField('target_category')} className="border border-wire rounded-sm px-4 py-3 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors">
                      <option value="">Category</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={form.target_region} onChange={updateField('target_region')} className="border border-wire rounded-sm px-4 py-3 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors">
                      <option value="">Region</option>
                      {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <input value={form.target_county} onChange={updateField('target_county')} placeholder="County (optional)" className="border border-wire rounded-sm px-4 py-3 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors" />
                  </div>
                </div>

                {/* Scheduling & embargo */}
                <div className="pt-2 border-t border-wire">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-3 mt-4">Timing</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Schedule Publish (optional)</label>
                      <input type="datetime-local" value={form.scheduled_at} onChange={updateField('scheduled_at')} className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Embargo Until (optional)</label>
                      <input type="datetime-local" value={form.embargo_until} onChange={updateField('embargo_until')} className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors" />
                    </div>
                  </div>
                </div>

                {/* SEO — collapsible */}
                <div className="pt-2 border-t border-wire">
                  <button type="button" onClick={() => setShowSeo(s => !s)} className="w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-ink-400 mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal rounded-sm">
                    <span>SEO Metadata (optional)</span>
                    {showSeo ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {showSeo && (
                    <div className="space-y-4 mt-4">
                      <input value={form.meta_title} onChange={updateField('meta_title')} placeholder="Meta title" className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors" />
                      <textarea value={form.meta_description} onChange={updateField('meta_description')} rows={2} placeholder="Meta description" className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors resize-y" />
                      <input value={form.meta_keywords} onChange={updateField('meta_keywords')} placeholder="Meta keywords (comma separated)" className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors" />
                    </div>
                  )}
                </div>

                {/* Press kit uploader — only meaningful once a release exists (edit mode) */}
                {editingReleaseId && (
                  <div className="pt-2 border-t border-wire">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-3 mt-4">Press Kit</p>
                    <PressKitUploader
                      releaseId={editingReleaseId}
                      initialFiles={pendingKitFiles}
                      onFileAdded={(file) => setPendingKitFiles(f => [...f, file])}
                      onFileRemoved={(fileId) => setPendingKitFiles(f => f.filter(x => x.id !== fileId))}
                    />
                  </div>
                )}
                {!editingReleaseId && (
                  <p className="text-xs font-medium text-ink-400 italic pt-2 border-t border-wire mt-4">
                    You can attach logos, images, and documents to your press kit after submitting.
                  </p>
                )}

                <div className="flex gap-3">
                  {editingReleaseId && (
                    <button type="button" onClick={resetForm} className="flex-1 border border-wire text-ink font-bold uppercase tracking-wider py-4 rounded-sm hover:border-ink transition-colors">
                      Cancel
                    </button>
                  )}
                  <button disabled={submitting} type="submit" className="flex-1 bg-signal text-white font-bold uppercase tracking-wider py-4 rounded-sm hover:bg-signal/90 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50">
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : <><UploadCloud size={18} /> {editingReleaseId ? 'Save Changes' : 'Submit for Publication'}</>}
                  </button>
                </div>
              </form>
            </div>
          )
        )}

        {hasAccess && activeTab === 'history' && (
          <div>
            {historyError && (
              <div className="mb-6 p-4 bg-red-50 border border-signal rounded-sm flex items-start gap-3">
                <AlertTriangle size={16} className="text-signal shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-signal">{historyError}</p>
              </div>
            )}
            {historyLoading ? (
              <div className="grid place-items-center py-16"><Loader2 className="animate-spin text-ink" /></div>
            ) : releases.length === 0 ? (
              <div className="border border-wire bg-white p-12 text-center rounded-sm shadow-sm">
                <FileText size={40} className="text-ink-300 mx-auto mb-4" />
                <p className="text-sm font-bold text-ink-600 uppercase tracking-wider">No press releases yet</p>
                <button onClick={() => setActiveTab('submit')} className="mt-4 text-[11px] font-bold uppercase tracking-wider text-white bg-ink px-4 py-2 rounded-sm hover:bg-ink/90 transition-colors">
                  Submit Your First Release
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {releases.map(release => (
                    <PressReleaseCard
                      key={release.id}
                      release={release}
                      showActions
                      onEdit={() => startEdit(release)}
                      onDelete={() => handleDelete(release)}
                      onBoost={() => handleBoost(release)}
                      onView={() => { setSelectedReleaseId(release.id); setActiveTab('analytics'); }}
                    />
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-6">
                    <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="text-[11px] font-bold uppercase tracking-wider text-ink px-3 py-2 border border-wire rounded-sm disabled:opacity-40 hover:border-ink transition-colors">Previous</button>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-400">Page {page} of {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="text-[11px] font-bold uppercase tracking-wider text-ink px-3 py-2 border border-wire rounded-sm disabled:opacity-40 hover:border-ink transition-colors">Next</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {hasAccess && activeTab === 'analytics' && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Releases', value: overview.totalReleases },
                { label: 'Total Views', value: overview.totalViews },
                { label: 'Total Shares', value: overview.totalShares },
                { label: 'Avg Read Time', value: `${overview.avgReadTime}s` },
              ].map(stat => (
                <div key={stat.label} className="border border-wire bg-white p-5 rounded-sm shadow-sm">
                  <p className="text-2xl font-black text-ink">{stat.value}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {releases.length === 0 ? (
              <div className="border border-wire bg-white p-12 text-center rounded-sm shadow-sm">
                <BarChart3 size={40} className="text-ink-300 mx-auto mb-4" />
                <p className="text-sm font-bold text-ink-600 uppercase tracking-wider">No analytics data yet</p>
              </div>
            ) : (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-2">Select a release</label>
                <select
                  value={selectedReleaseId || ''}
                  onChange={(e) => setSelectedReleaseId(e.target.value || null)}
                  className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-bold bg-paper focus:outline-none focus:border-ink transition-colors mb-6"
                >
                  <option value="">Choose a press release...</option>
                  {releases.map(r => <option key={r.id} value={r.id}>{r.title} — {r.company}</option>)}
                </select>

                {selectedReleaseId && <PressReleaseAnalytics releaseId={selectedReleaseId} />}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
