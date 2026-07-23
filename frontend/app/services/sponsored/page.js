// app/services/sponsored/page.js
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth';
import ServicePaymentButton from '../../../components/ServicePaymentButton';
import ServicePaymentVerify from '../../../components/ServicePaymentVerify';
import { MonitorPlay, LayoutTemplate, Link as LinkIcon, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function SponsoredServicePage() {
  const { user, ready } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [packages, setPackages] = useState([]);
  
  // Dashboard State
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!ready || !user) {
      if (ready) setLoading(false);
      return;
    }

    Promise.all([
      fetch(`${API_BASE}/services/check/sponsored`, { credentials: 'include' }).then(r => r.json()),
      fetch(`${API_BASE}/services/packages/sponsored`).then(r => r.json())
    ])
    .then(([checkRes, pkgRes]) => {
      if (checkRes.active) {
        setHasAccess(true);
        setActiveOrder(checkRes); // Contains date info to calculate remaining days
      }
      if (pkgRes.packages) setPackages(pkgRes.packages);
    })
    .catch(() => {})
    .finally(() => setLoading(false));
  }, [ready, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      // 1. Fetch CSRF token for security validation
      let csrfToken = '';
      try {
        const csrfRes = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
        const csrfData = await csrfRes.json();
        csrfToken = csrfData.token || '';
      } catch (err) { /* ignore, fallback to middleware bypass */ }

      // 2. Submit to the exact backend endpoint path (/services/content/sponsored)
      const res = await fetch(`${API_BASE}/services/content/sponsored`, {
        method: 'POST',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ headline, body, ctaUrl, orderId: activeOrder?.id })
      });
      
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(true);
      } else {
        setErrorMsg(data.error || 'Failed to submit campaign materials.');
      }
    } catch (e) {
      setErrorMsg('Network error. Check your connection and try again.');
    }
    setSubmitting(false);
  };

  if (!ready || loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-ink" /></div>;

  return (
    <div className="min-h-screen bg-paper py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <ServicePaymentVerify serviceType="sponsored" onVerified={(data) => {
          setHasAccess(true);
          setActiveOrder(data);
        }} />

        <div className="mb-8 border-b-2 border-wire pb-6">
          <h1 className="text-3xl font-black text-ink flex items-center gap-3 uppercase tracking-tight">
            <MonitorPlay className="text-signal" size={28} /> Sponsored Content Placement
          </h1>
          <p className="text-sm text-ink-500 font-medium mt-2">Feature your content prominently across the feed and sidebars of the platform.</p>
        </div>

        {hasAccess ? (
          success ? (
            <div className="border border-wire bg-emerald-50 p-12 text-center rounded-sm shadow-sm">
              <CheckCircle size={48} className="text-emerald-600 mx-auto mb-4" />
              <h2 className="text-xl font-black text-ink uppercase tracking-wider">Campaign Material Uploaded</h2>
              <p className="text-sm font-medium text-ink-600 mt-2">Your sponsored article is ready. It will rotate in the prime slots for the duration of your package.</p>
            </div>
          ) : (
            <div className="border border-wire bg-white p-6 sm:p-8 rounded-sm shadow-sm">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div className="bg-ink text-white text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm shadow-sm">
                  <CheckCircle size={12} className="text-emerald-400" /> Slot Reserved & Active
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500 font-mono">Package ID: {activeOrder?.packageId || 'Active'}</div>
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
                  <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1"><LayoutTemplate size={14} /> Campaign Headline</label>
                  <input required value={headline} onChange={e => setHeadline(e.target.value)} className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-bold bg-paper focus:outline-none focus:border-ink transition-colors" placeholder="e.g. The Future of African FinTech..." />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Article Teaser / Body</label>
                  <textarea required value={body} onChange={e => setBody(e.target.value)} rows={6} className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors resize-y" placeholder="Enter the promotional copy..." />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1"><LinkIcon size={14} /> Call-To-Action (CTA) URL</label>
                  <input required type="url" value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-mono bg-paper focus:outline-none focus:border-ink transition-colors" placeholder="https://your-landing-page.com" />
                </div>
                
                <button disabled={submitting} type="submit" className="w-full bg-signal text-white font-bold uppercase tracking-wider py-4 rounded-sm hover:bg-signal/90 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50">
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : 'Launch Campaign'}
                </button>
              </form>
            </div>
          )
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map(pkg => (
              <div key={pkg.id} className="border border-wire bg-white p-6 sm:p-8 rounded-sm flex flex-col hover:border-ink transition-all shadow-sm">
                <h3 className="text-xl font-black text-ink uppercase">{pkg.name}</h3>
                <p className="text-3xl font-black text-ink mt-2">KES {(pkg.price_kes_cents / 100).toLocaleString()}</p>
                <div className="my-6 flex-1 space-y-3">
                  <p className="text-xs font-bold text-ink flex items-center gap-2 uppercase tracking-wider"><CheckCircle size={14} className="text-signal" /> {pkg.duration_days} Days Rotation</p>
                  <p className="text-xs font-bold text-ink flex items-center gap-2 uppercase tracking-wider"><CheckCircle size={14} className="text-signal" /> ~{pkg.impressions_goal?.toLocaleString()} Impressions</p>
                  {(pkg.features || ['Home Feed Placement', 'Sidebar Sticky Widget']).map((feat, i) => (
                    <p key={i} className="text-[10px] font-bold text-ink-500 flex items-center gap-2 uppercase tracking-wider"><CheckCircle size={12} className="text-ink-300" /> {feat}</p>
                  ))}
                </div>
                <ServicePaymentButton serviceType="sponsored" packageId={pkg.id} packageName={pkg.name} className="bg-ink text-white py-4" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}