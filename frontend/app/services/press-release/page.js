'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth';
import ServicePaymentButton from '../../../components/ServicePaymentButton';
import ServicePaymentVerify from '../../../components/ServicePaymentVerify';
import { Megaphone, FileText, UploadCloud, CheckCircle, Loader2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function PressReleasePage() {
  const { user, ready } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [packages, setPackages] = useState([]);
  
  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [company, setCompany] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    // Note: You will need to create this backend endpoint to receive the content
    try {
      const res = await fetch(`${API_BASE}/content/press-release`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, company })
      });
      if (res.ok) setSuccess(true);
    } catch (e) {
      alert('Failed to submit press release.');
    }
    setSubmitting(false);
  };

  if (!ready || loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-ink" /></div>;

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

        {hasAccess ? (
          success ? (
            <div className="border border-wire bg-emerald-50 p-12 text-center rounded-sm">
              <CheckCircle size={48} className="text-emerald-600 mx-auto mb-4" />
              <h2 className="text-xl font-black text-ink uppercase tracking-wider">Press Release Submitted</h2>
              <p className="text-sm font-medium text-ink-600 mt-2">Your release is undergoing editorial review and will be published shortly.</p>
            </div>
          ) : (
            <div className="border border-wire bg-white p-6 sm:p-8 rounded-sm shadow-sm">
              <div className="bg-ink text-white text-[10px] font-bold uppercase tracking-wider inline-block px-3 py-1 mb-6 rounded-sm">Active Subscription Verified</div>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Company / Organization Name</label>
                  <input required value={company} onChange={e => setCompany(e.target.value)} className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-bold bg-paper focus:outline-none focus:border-ink transition-colors" placeholder="e.g. Acme Innovations Ltd." />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Press Release Headline</label>
                  <input required value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-bold bg-paper focus:outline-none focus:border-ink transition-colors" placeholder="Clear, impactful headline..." />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Release Content</label>
                  <textarea required value={content} onChange={e => setContent(e.target.value)} rows={10} className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors resize-y" placeholder="Write your full press release here..." />
                </div>
                <button disabled={submitting} type="submit" className="w-full bg-signal text-white font-bold uppercase tracking-wider py-4 rounded-sm hover:bg-signal/90 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50">
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <><UploadCloud size={18} /> Submit for Publication</>}
                </button>
              </form>
            </div>
          )
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
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
      </div>
    </div>
  );
}