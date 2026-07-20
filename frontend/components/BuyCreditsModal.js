'use client';

import { useEffect, useRef, useState } from 'react';
import { X, CreditCard, Check, Loader2, AlertCircle, RefreshCw, WifiOff, Download, Zap } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const QUICK_BUY_KEY = 'op_last_package_id';

const FALLBACK_PACKAGES = [
  { id: 'sms_10', name: '10 SMS', credits: 10, amount: 1000 },
  { id: 'sms_50', name: '50 SMS', credits: 50, amount: 5000, popular: true },
  { id: 'sms_100', name: '100 SMS', credits: 100, amount: 10000 },
  { id: 'sms_500', name: '500 SMS', credits: 500, amount: 50000 },
  { id: 'sms_1000', name: '1,000 SMS', credits: 1000, amount: 100000 },
];

function formatKes(amountInCents) {
  return `KES ${(amountInCents / 100).toLocaleString('en-KE')}`;
}

function perSmsCost(pkg) {
  if (!pkg || !pkg.credits) return null;
  return (pkg.amount / 100 / pkg.credits).toFixed(2);
}

function friendlyError(rawMessage) {
  const msg = (rawMessage || '').toLowerCase();
  if (msg.includes('insufficient')) return 'Your payment method declined the charge (insufficient funds).';
  if (msg.includes('declined')) return 'Your card or mobile money provider declined this payment.';
  if (msg.includes('timeout')) return 'The payment gateway timed out. Please try again.';
  return rawMessage || 'Payment failed. Please try again.';
}

async function fetchCsrfToken() {
  try {
    const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
    const data = await res.json();
    return data.token || '';
  } catch (e) { return ''; }
}

function MpesaIcon({ className }) {
  return (
    <svg viewBox="0 0 48 32" className={className} role="img" aria-label="M-Pesa">
      <rect width="48" height="32" rx="2" fill="#4CAF50" />
      <text x="24" y="21" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" fontFamily="Inter, sans-serif">M-PESA</text>
    </svg>
  );
}
function VisaIcon({ className }) {
  return (
    <svg viewBox="0 0 48 32" className={className} role="img" aria-label="Visa">
      <rect width="48" height="32" rx="2" fill="#1A1F71" />
      <text x="24" y="21" textAnchor="middle" fontSize="12" fontWeight="800" fontStyle="italic" fill="#fff" fontFamily="Inter, sans-serif">VISA</text>
    </svg>
  );
}
function MastercardIcon({ className }) {
  return (
    <svg viewBox="0 0 48 32" className={className} role="img" aria-label="Mastercard">
      <rect width="48" height="32" rx="2" fill="#1c1917" stroke="#333" />
      <circle cx="19" cy="16" r="8" fill="#EB001B" />
      <circle cx="29" cy="16" r="8" fill="#F79E1B" fillOpacity="0.85" />
    </svg>
  );
}

export default function BuyCreditsModal({ onClose, onSuccess }) {
  const [packages, setPackages] = useState(FALLBACK_PACKAGES);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [selected, setSelected] = useState('sms_50');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('select');
  const [error, setError] = useState('');
  const [errorKind, setErrorKind] = useState('generic');
  const [lastReference, setLastReference] = useState('');
  const [quickBuyId, setQuickBuyId] = useState('');
  const modalRef = useRef(null);
  const firstButtonRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/payments/packages`, { credentials: 'include' });
        const data = await res.json();
        if (!cancelled && res.ok && Array.isArray(data.packages) && data.packages.length > 0) {
          setPackages(data.packages.map(p => ({ ...p, popular: p.id === 'sms_50' })));
        }
      } catch (e) {}
      finally { if (!cancelled) setPackagesLoading(false); }
    })();
    try {
      const saved = window.localStorage.getItem(QUICK_BUY_KEY);
      if (saved) { setQuickBuyId(saved); setSelected(saved); }
    } catch (e) {}
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll('button, input, a[href]');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    firstButtonRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const pkg = packages.find(p => p.id === selected) || packages[0];
  const bestValue = packages.reduce((best, p) => (!best || perSmsCost(p) < perSmsCost(best) ? p : best), null);

  const verifyPayment = async (reference) => {
    try {
      const verifyRes = await fetch(`${API_BASE}/payments/verify/${encodeURIComponent(reference)}`, { credentials: 'include' });
      const verifyData = await verifyRes.json();
      if (verifyRes.ok && verifyData.verified && verifyData.status === 'success') {
        setStep('success');
        setLastReference(reference);
        try { window.localStorage.setItem(QUICK_BUY_KEY, selected); } catch (e) {}
        if (onSuccess) onSuccess(verifyData.credits || pkg.credits);
      } else {
        setErrorKind('generic');
        setError('Payment verification failed. Contact support with reference: ' + reference);
      }
    } catch (e) {
      setErrorKind('network');
      setError('Could not confirm payment. Contact support with reference: ' + reference);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!pkg) return;
    setLoading(true);
    setError('');

    try {
      const csrfToken = await fetchCsrfToken();
      const res = await fetch(`${API_BASE}/payments/initialize`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ packageId: selected }),
      });

      let data;
      try { data = await res.json(); } catch (e) {
        setErrorKind('generic');
        setError('Payment initialization failed.');
        setLoading(false);
        return;
      }

      if (!res.ok || data.error) {
        setErrorKind('generic');
        setError(friendlyError(data.error || data.details?.message));
        setLoading(false);
        return;
      }

      if (!data.access_code) {
        setErrorKind('generic');
        setError('Payment system error. Please try again.');
        setLoading(false);
        return;
      }

      if (window.PaystackPop) {
        const paystack = new window.PaystackPop();
        paystack.resumeTransaction(data.access_code, {
          onSuccess: (response) => { verifyPayment(response.reference); },
          onClose: () => { setLoading(false); },
          onError: (err) => { setErrorKind('generic'); setError(friendlyError(err?.message)); setLoading(false); },
        });
      } else if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        setErrorKind('generic');
        setError('Payment gateway unavailable.');
        setLoading(false);
      }
    } catch (e) {
      setErrorKind('network');
      setError('Check your connection and try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/70 z-50 grid place-items-center p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="buy-credits-title">
      <div ref={modalRef} className="bg-paper rounded-sm border-2 border-ink w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 bg-ink text-white border-b border-white/10">
          <h2 id="buy-credits-title" className="text-lg font-bold uppercase tracking-wide">
            {step === 'success' ? 'Payment Successful' : 'Top Up SMS Credits'}
          </h2>
          <button ref={firstButtonRef} onClick={onClose} aria-label="Close" className="text-white/60 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        {step === 'success' ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full grid place-items-center mx-auto text-emerald-600">
              <Check size={32} />
            </div>
            <p className="text-xl font-bold text-ink">{pkg.credits} SMS Credits Added!</p>
            <p className="text-sm text-ink-500">Your account has been successfully credited.</p>
            {lastReference && (
              <a href={`${API_BASE}/payments/receipt/${encodeURIComponent(lastReference)}`} target="_blank" rel="noreferrer"
                className="border border-ink text-ink font-bold uppercase text-xs tracking-wider w-full py-3 rounded-sm flex items-center justify-center gap-2 hover:bg-ink hover:text-white transition-colors">
                <Download size={14} /> Download Receipt
              </a>
            )}
            <button onClick={onClose} className="bg-signal text-white font-bold uppercase text-xs tracking-wider w-full py-3 rounded-sm hover:bg-signal/90 transition-colors">
              Continue
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Select Credit Package</p>
                {quickBuyId && packages.some(p => p.id === quickBuyId) && (
                  <button onClick={() => setSelected(quickBuyId)} className="text-xs font-bold text-signal flex items-center gap-1 uppercase tracking-wider">
                    <Zap size={12} fill="currentColor" /> Quick Buy
                  </button>
                )}
              </div>
              
              <div className="space-y-2.5" role="radiogroup" aria-label="SMS credit packages">
                {packages.map((p) => (
                  <button 
                    key={p.id} 
                    onClick={() => setSelected(p.id)}
                    disabled={loading} 
                    role="radio" 
                    aria-checked={selected === p.id}
                    className={`w-full flex items-center justify-between p-4 rounded-sm border text-left transition-all ${
                      selected === p.id ? 'border-2 border-ink bg-ink-50 shadow-sm' : 'border-wire bg-paper hover:border-ink'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-bold text-ink flex items-center gap-2">
                        {p.name}
                        {bestValue?.id === p.id && <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm bg-signal text-white">BEST VALUE</span>}
                      </p>
                      <p className="text-xs font-medium text-ink-500 mt-0.5">KES {perSmsCost(p)} per SMS</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-black text-ink">{formatKes(p.amount)}</p>
                      {p.popular && <span className="text-[10px] font-bold text-signal uppercase tracking-wider">Popular</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-2">Accepted Payment Methods</p>
              <div className="flex items-center gap-3">
                <MpesaIcon className="h-9 w-auto shadow-sm" />
                <VisaIcon className="h-9 w-auto shadow-sm" />
                <MastercardIcon className="h-9 w-auto shadow-sm" />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-signal rounded-sm p-4 text-xs font-bold text-signal flex items-start gap-3" role="alert">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <span>{error}</span>
                  <button onClick={handlePayment} className="flex items-center gap-1 text-[11px] underline">
                    <RefreshCw size={11} /> Try Again
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-wire pt-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Total Due</p>
                <p className="text-sm font-bold text-ink">{pkg?.name} ({pkg?.credits} credits)</p>
              </div>
              <p className="text-2xl font-black text-ink">{pkg && formatKes(pkg.amount)}</p>
            </div>

            <button 
              onClick={handlePayment} 
              disabled={loading || packagesLoading || !pkg}
              className="bg-signal text-white font-bold uppercase text-xs tracking-wider w-full py-3.5 rounded-sm hover:bg-signal/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Authorizing Payment...</> : <><CreditCard size={16} /> Pay {pkg && formatKes(pkg.amount)}</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}