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
  const kes = amountInCents / 100;
  return `KES ${kes.toLocaleString('en-KE')}`;
}

function perSmsCost(pkg) {
  if (!pkg || !pkg.credits) return null;
  return (pkg.amount / 100 / pkg.credits).toFixed(2);
}

// Maps common Paystack-style error text to a friendlier message.
function friendlyError(rawMessage) {
  const msg = (rawMessage || '').toLowerCase();
  if (msg.includes('insufficient')) return 'Your payment method declined the charge (insufficient funds).';
  if (msg.includes('declined')) return 'Your card or mobile money provider declined this payment.';
  if (msg.includes('timeout') || msg.includes('timed out')) return 'The payment provider took too long to respond. Please try again.';
  if (msg.includes('network') || msg.includes('fetch')) return 'Check your connection and try again.';
  return rawMessage || 'Payment failed. Please try again.';
}

async function fetchCsrfToken() {
  try {
    const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
    const data = await res.json();
    return data.token || '';
  } catch (e) { return ''; }
}

// Simple inline SVGs so we don't depend on external asset hosting.
function MpesaIcon({ className }) {
  return (
    <svg viewBox="0 0 48 32" className={className} role="img" aria-label="M-Pesa">
      <rect width="48" height="32" rx="4" fill="#4CAF50" />
      <text x="24" y="21" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="Arial, sans-serif">M-PESA</text>
    </svg>
  );
}
function VisaIcon({ className }) {
  return (
    <svg viewBox="0 0 48 32" className={className} role="img" aria-label="Visa">
      <rect width="48" height="32" rx="4" fill="#1A1F71" />
      <text x="24" y="21" textAnchor="middle" fontSize="12" fontWeight="700" fontStyle="italic" fill="#fff" fontFamily="Arial, sans-serif">VISA</text>
    </svg>
  );
}
function MastercardIcon({ className }) {
  return (
    <svg viewBox="0 0 48 32" className={className} role="img" aria-label="Mastercard">
      <rect width="48" height="32" rx="4" fill="#f5f5f5" stroke="#e2e2e2" />
      <circle cx="20" cy="16" r="9" fill="#EB001B" />
      <circle cx="28" cy="16" r="9" fill="#F79E1B" fillOpacity="0.9" />
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
  const [errorKind, setErrorKind] = useState('generic'); // generic | network
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
      } catch (e) { /* keep fallback */ }
      finally { if (!cancelled) setPackagesLoading(false); }
    })();
    try {
      const saved = window.localStorage.getItem(QUICK_BUY_KEY);
      if (saved) { setQuickBuyId(saved); setSelected(saved); }
    } catch (e) { /* localStorage may be unavailable */ }
    return () => { cancelled = true; };
  }, []);

  // Basic focus trap + Escape-to-close for accessibility.
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
        setError('Payment verification failed. If you were charged, contact support with reference: ' + reference);
      }
    } catch (e) {
      setErrorKind('network');
      setError('Could not confirm payment. If you were charged, contact support with reference: ' + reference);
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
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
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

      const accessCode = data.access_code;
      if (!accessCode) {
        setErrorKind('generic');
        setError('Payment system error. Please try again.');
        setLoading(false);
        return;
      }

      if (window.PaystackPop) {
        const paystack = new window.PaystackPop();
        paystack.resumeTransaction(accessCode, {
          onSuccess: (response) => { verifyPayment(response.reference); },
          onClose: () => { setLoading(false); },
          onError: (err) => { setErrorKind('generic'); setError(friendlyError(err?.message)); setLoading(false); },
        });
      } else if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        setErrorKind('generic');
        setError('Payment system is loading. Please refresh and try again.');
        setLoading(false);
      }
    } catch (e) {
      setErrorKind('network');
      setError('Check your connection and try again.');
      setLoading(false);
    }
  };

  const handleKeyNav = (e, index) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const nextIndex = e.key === 'ArrowDown' ? Math.min(index + 1, packages.length - 1) : Math.max(index - 1, 0);
    setSelected(packages[nextIndex].id);
    document.getElementById(`pkg-${packages[nextIndex].id}`)?.focus();
  };

  return (
    <div className="fixed inset-0 bg-ink/60 z-50 grid place-items-center px-4" role="dialog" aria-modal="true" aria-labelledby="buy-credits-title">
      <div ref={modalRef} className="bg-paper rounded-sm border border-wire w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-wire">
          <h2 id="buy-credits-title" className="editorial-h text-xl font-bold">{step === 'success' ? 'Payment Successful!' : 'Buy SMS Credits'}</h2>
          <button ref={firstButtonRef} onClick={onClose} aria-label="Close" className="w-8 h-8 grid place-items-center rounded-full hover:bg-ink-50"><X size={18} /></button>
        </div>

        {step === 'success' ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-ink-50 rounded-full grid place-items-center mx-auto mb-4 animate-[pulse_1.2s_ease-in-out]">
              <Check size={32} className="text-ink-600" style={{ animation: 'op-check-pop 0.4s ease-out' }} />
            </div>
            <style>{`@keyframes op-check-pop { 0% { transform: scale(0.4); opacity: 0; } 70% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); } }`}</style>
            <p className="text-lg font-semibold mb-2">{pkg.credits} credits added!</p>
            <p className="text-sm text-ink-400 mb-6">You can now send {pkg.credits} SMS messages.</p>
            {lastReference && (
              <a href={`${API_BASE}/payments/receipt/${encodeURIComponent(lastReference)}`} target="_blank" rel="noreferrer"
                className="btn-outline w-full py-2.5 rounded-sm text-sm flex items-center justify-center gap-2 mb-3">
                <Download size={14} /> Download Receipt
              </a>
            )}
            <button onClick={onClose} className="btn-primary w-full py-2.5 rounded-sm text-sm">Got it</button>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-ink-400">Select a package</p>
                {quickBuyId && packages.some(p => p.id === quickBuyId) && (
                  <button onClick={() => setSelected(quickBuyId)} className="text-xs font-semibold text-signal flex items-center gap-1">
                    <Zap size={12} /> Quick Buy
                  </button>
                )}
              </div>
              <div className="space-y-2" role="radiogroup" aria-label="SMS credit packages">
                {packages.map((p, i) => (
                  <button key={p.id} id={`pkg-${p.id}`} onClick={() => setSelected(p.id)} onKeyDown={(e) => handleKeyNav(e, i)}
                    disabled={loading} role="radio" aria-checked={selected === p.id} tabIndex={selected === p.id ? 0 : -1}
                    className={`w-full flex items-center justify-between p-3 rounded-sm border text-left disabled:opacity-50 transition-all duration-150 ${selected === p.id ? 'border-ink bg-ink-50 scale-[1.01]' : 'border-wire hover:border-ink'}`}>
                    <div>
                      <p className="text-sm font-semibold flex items-center gap-2">
                        {p.name}
                        {bestValue?.id === p.id && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-signal text-paper">BEST VALUE</span>}
                      </p>
                      <p className="text-xs text-ink-400">KES {perSmsCost(p)}/SMS</p>
                    </div>
                    <div className="text-right"><p className="text-sm font-bold">{formatKes(p.amount)}</p>{p.popular && <span className="text-xs text-signal font-semibold">Popular</span>}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-ink-400 mb-3">Payment method</p>
              <div className="flex items-center gap-2">
                <MpesaIcon className="h-8 w-auto" />
                <VisaIcon className="h-8 w-auto" />
                <MastercardIcon className="h-8 w-auto" />
              </div>
              <p className="text-xs text-ink-400 mt-2">Paystack accepts M-Pesa, Visa, Mastercard & more.</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-signal rounded-sm p-3 text-sm text-signal flex items-start gap-2" role="alert">
                {errorKind === 'network' ? <WifiOff size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
                <div className="flex-1">
                  <span>{error}</span>
                  <button onClick={handlePayment} className="mt-2 flex items-center gap-1 text-xs font-semibold underline">
                    <RefreshCw size={12} /> Try Again
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-wire pt-4 flex items-center justify-between">
              <div><p className="text-sm font-semibold">{pkg?.name}</p><p className="text-xs text-ink-400">{pkg?.credits} credits</p></div>
              <p className="text-lg font-bold">{pkg && formatKes(pkg.amount)}</p>
            </div>

            <button onClick={handlePayment} disabled={loading || packagesLoading || !pkg}
              className="btn-primary w-full py-3 rounded-sm text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : <><CreditCard size={15} /> Pay {pkg && formatKes(pkg.amount)} — Get {pkg?.credits} Credits</>}
            </button>

            <p className="text-xs text-ink-400 text-center">Secured by Paystack. M-Pesa, Visa, Mastercard accepted.</p>
          </div>
        )}
      </div>
    </div>
  );
}
