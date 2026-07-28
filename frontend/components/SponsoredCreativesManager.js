// components/SponsoredCreativesManager.js
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, X, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const MAX_CREATIVES = 5;

async function getCsrfToken() {
  try {
    const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
    const data = await res.json();
    return data.token || '';
  } catch (e) { return ''; }
}

export default function SponsoredCreativesManager({ campaignId }) {
  const [creatives, setCreatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [fHeadline, setFHeadline] = useState('');
  const [fBody, setFBody] = useState('');
  const [fCtaUrl, setFCtaUrl] = useState('');
  const [fBannerUrl, setFBannerUrl] = useState('');
  const [fIsControl, setFIsControl] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    fetch(`${API_BASE}/sponsored-service/campaigns/${campaignId}/creatives`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => setCreatives(data.creatives || []))
      .catch(() => setError('Could not load creatives.'))
      .finally(() => setLoading(false));
  }, [campaignId]);

  useEffect(() => { if (campaignId) load(); }, [campaignId, load]);

  const resetForm = () => {
    setFHeadline(''); setFBody(''); setFCtaUrl(''); setFBannerUrl(''); setFIsControl(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!fHeadline.trim() || submitting) return;
    setSubmitting(true);
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`${API_BASE}/sponsored-service/campaigns/${campaignId}/creatives`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ headline: fHeadline, body: fBody, ctaUrl: fCtaUrl, bannerUrl: fBannerUrl, isControl: fIsControl }),
      });
      if (res.ok) {
        resetForm();
        setShowForm(false);
        load();
      } else {
        const data = await res.json();
        setError(data.error || 'Could not add creative.');
      }
    } catch (e) { setError('Network error adding creative.'); }
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    try {
      const csrfToken = await getCsrfToken();
      await fetch(`${API_BASE}/sponsored-service/campaigns/${campaignId}/creatives/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      setConfirmDeleteId(null);
      load();
    } catch (e) { setError('Could not delete creative.'); }
  };

  const handleSetControl = async (id) => {
    try {
      const csrfToken = await getCsrfToken();
      await fetch(`${API_BASE}/sponsored-service/campaigns/${campaignId}/creatives/${id}/set-control`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      load();
    } catch (e) { setError('Could not set control creative.'); }
  };

  return (
    <div className="border border-wire rounded-sm p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Ad Creatives ({creatives.length})</p>
        {creatives.length < MAX_CREATIVES ? (
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="text-xs font-bold text-ink underline hover:text-signal transition-colors flex items-center gap-1"
          >
            <Plus size={12} /> Add Creative
          </button>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-wider text-signal">Maximum 5 creatives</span>
        )}
      </div>

      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-signal rounded-sm flex items-start gap-2">
          <AlertTriangle size={14} className="text-signal shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-signal">{error}</p>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleAdd} className="mb-4 border border-wire rounded-sm p-4 space-y-3 bg-paper">
          <input required value={fHeadline} onChange={e => setFHeadline(e.target.value)} placeholder="Headline" className="w-full border border-wire rounded-sm px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:border-ink" />
          <textarea value={fBody} onChange={e => setFBody(e.target.value)} placeholder="Body (optional)" rows={3} className="w-full border border-wire rounded-sm px-3 py-2 text-sm bg-white focus:outline-none focus:border-ink resize-y" />
          <input type="url" value={fCtaUrl} onChange={e => setFCtaUrl(e.target.value)} placeholder="CTA URL (optional)" className="w-full border border-wire rounded-sm px-3 py-2 text-sm font-mono bg-white focus:outline-none focus:border-ink" />
          <input type="url" value={fBannerUrl} onChange={e => setFBannerUrl(e.target.value)} placeholder="Banner URL (optional)" className="w-full border border-wire rounded-sm px-3 py-2 text-sm font-mono bg-white focus:outline-none focus:border-ink" />
          <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
            <input type="checkbox" checked={fIsControl} onChange={e => setFIsControl(e.target.checked)} /> Set as control creative
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="border border-wire bg-white text-ink font-bold uppercase text-xs tracking-wider px-4 py-2 rounded-sm hover:border-ink transition-colors">Cancel</button>
            <button disabled={submitting} type="submit" className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-4 py-2 rounded-sm hover:bg-signal/90 transition-colors disabled:opacity-50 flex items-center gap-2">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : 'Add'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-wire/20 animate-pulse rounded-sm" />)}
        </div>
      ) : creatives.length === 0 ? (
        <p className="text-xs text-ink-400 text-center py-6">No creatives added yet. Create a variant to A/B test.</p>
      ) : (
        <div className="space-y-2">
          {creatives.map(c => (
            <div key={c.id} className="flex items-center gap-3 border border-wire rounded-sm p-3">
              {c.bannerUrl && <img src={c.bannerUrl} alt="" className="w-10 h-10 object-cover rounded-sm border border-wire shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-ink truncate">{c.headline}</p>
                  {c.is_control === 1 && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-ink text-white shrink-0">Control</span>}
                </div>
                {c.body && <p className="text-[10px] text-ink-400 truncate">{c.body.slice(0, 100)}</p>}
                {c.ctaUrl && <p className="text-[10px] font-mono text-ink-300 truncate">{c.ctaUrl.slice(0, 60)}</p>}
                <p className="text-[10px] font-bold text-ink-500 mt-0.5">{(c.impressions || 0).toLocaleString()} imp · {(c.clicks || 0).toLocaleString()} clk</p>
              </div>
              <div className="flex flex-col gap-1 items-end shrink-0">
                {c.is_control !== 1 && (
                  <button type="button" onClick={() => handleSetControl(c.id)} className="text-[10px] font-bold text-ink underline hover:text-signal">Set as Control</button>
                )}
                {confirmDeleteId === c.id ? (
                  <div className="flex gap-1">
                    <button type="button" onClick={() => handleDelete(c.id)} className="text-[10px] font-bold text-signal underline">Confirm</button>
                    <button type="button" onClick={() => setConfirmDeleteId(null)} className="text-[10px] font-bold text-ink-400 underline">Cancel</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmDeleteId(c.id)} aria-label="Delete creative" className="text-ink-300 hover:text-signal">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
