'use client';

import { useEffect, useState } from 'react';
import { X, CreditCard, Smartphone, Check, Loader2, AlertCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '';

// Fallback used only if the /payments/packages request fails, so the modal
// still works even if the backend is briefly unreachable.
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

export default function BuyCreditsModal({ onClose, onSuccess }) {
  const [packages, setPackages] = useState(FALLBACK_PACKAGES);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [selected, setSelected] = useState('sms_50');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('select');
  const [error, setError] = useState('');

  // Load packages from the backend so pricing always matches the server
  // (which is the source of truth actually charged via Paystack).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/payments/packages`, { credentials: 'include' });
        const data = await res.json();
        if (!cancelled && res.ok && Array.isArray(data.packages) && data.packages.length > 0) {
          setPackages(
            data.packages.map((p) => ({
              ...p,
              popular: p.id === 'sms_50',
            }))
          );
        }
      } catch (e) {
        // Silently keep the fallback list — the modal still works.
      } finally {
        if (!cancelled) setPackagesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const pkg = packages.find((p) => p.id === selected) || packages[0];

  const handlePayment = async () => {
    if (!pkg) return;

    if (!PAYSTACK_PUBLIC_KEY) {
      setError('Payment system is misconfigured. Please contact support.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/payments/initialize`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: selected }),
      });

      let data;
      try {
        data = await res.json();
      } catch (e) {
        setError('Payment initialization failed. Please try again.');
        setLoading(false);
        return;
      }

      if (!res.ok || data.error) {
        setError(data.error || data.details?.message || 'Payment initialization failed.');
        setLoading(false);
        return;
      }

      const openCheckout = () => {
        const handler = window.PaystackPop.setup({
          key: PAYSTACK_PUBLIC_KEY,
          email: data.email || '',
          amount: pkg.amount,
          currency: 'KES',
          ref: data.reference,
          channels: ['card', 'mobile_money'],
          metadata: {
            package: pkg.name,
            credits: pkg.credits,
          },
          onClose: () => {
            setLoading(false);
          },
          callback: (response) => {
            // Paystack expects this callback to run synchronously; kick off
            // async verification without returning a promise from it.
            verifyPayment(response.reference);
          },
        });

        handler.openIframe();
      };

      const verifyPayment = async (reference) => {
        try {
          const verifyRes = await fetch(`${API_BASE}/payments/verify/${encodeURIComponent(reference)}`, {
            credentials: 'include',
          });
          const verifyData = await verifyRes.json();

          if (verifyRes.ok && verifyData.verified && verifyData.status === 'success') {
            setStep('success');
            if (onSuccess) onSuccess(verifyData.credits || pkg.credits);
          } else {
            setError('Payment verification failed. If you were charged, please contact support with your reference: ' + reference);
          }
        } catch (e) {
          setError('Could not confirm payment. If you were charged, please contact support with your reference: ' + reference);
        } finally {
          setLoading(false);
        }
      };

      if (window.PaystackPop) {
        openCheckout();
      } else if (data.authorization_url) {
        // Inline script isn't ready yet — fall back to Paystack's hosted
        // checkout page instead of failing outright.
        window.location.href = data.authorization_url;
      } else {
        setError('Payment system is loading. Please refresh the page and try again.');
        setLoading(false);
      }
    } catch (e) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/60 z-50 grid place-items-center px-4">
      <div className="bg-paper rounded-sm border border-wire w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-wire">
          <h2 className="editorial-h text-xl font-bold">
            {step === 'success' ? 'Payment Successful!' : 'Buy SMS Credits'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-full hover:bg-ink-50">
            <X size={18} />
          </button>
        </div>

        {step === 'success' ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-ink-50 rounded-full grid place-items-center mx-auto mb-4">
              <Check size={32} className="text-ink-600" />
            </div>
            <p className="text-lg font-semibold mb-2">{pkg.credits} credits added!</p>
            <p className="text-sm text-ink-400 mb-6">You can now send {pkg.credits} SMS messages.</p>
            <button onClick={onClose} className="btn-primary w-full py-2.5 rounded-sm text-sm">
              Got it
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            <div>
              <p className="text-xs font-semibold text-ink-400 mb-3">Select a package</p>
              <div className="space-y-2">
                {packages.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    disabled={loading}
                    className={`w-full flex items-center justify-between p-3 rounded-sm border text-left disabled:opacity-50 ${
                      selected === p.id ? 'border-ink bg-ink-50' : 'border-wire hover:border-ink'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold">{p.name}</p>
                      <p className="text-xs text-ink-400">≈ KES 1/SMS</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatKes(p.amount)}</p>
                      {p.popular && <span className="text-xs text-signal font-semibold">Popular</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-ink-400 mb-3">Payment method</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="border border-wire rounded-sm p-3 text-center">
                  <Smartphone size={20} className="mx-auto mb-1" />
                  <p className="text-xs font-semibold">M-Pesa</p>
                </div>
                <div className="border border-wire rounded-sm p-3 text-center">
                  <CreditCard size={20} className="mx-auto mb-1" />
                  <p className="text-xs font-semibold">Card</p>
                </div>
              </div>
              <p className="text-xs text-ink-400 mt-2">Paystack accepts M-Pesa, Visa, Mastercard & more.</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-signal rounded-sm p-3 text-sm text-signal flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="border-t border-wire pt-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{pkg?.name}</p>
                <p className="text-xs text-ink-400">{pkg?.credits} credits</p>
              </div>
              <p className="text-lg font-bold">{pkg && formatKes(pkg.amount)}</p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handlePayment(); }}>
              <button
                type="submit"
                disabled={loading || packagesLoading || !pkg}
                className="btn-primary w-full py-3 rounded-sm text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Processing...</>
                ) : (
                  <>Pay {pkg && formatKes(pkg.amount)} — Get {pkg?.credits} Credits</>
                )}
              </button>
            </form>

            <p className="text-xs text-ink-400 text-center">
              Secured by Paystack. M-Pesa, Visa, Mastercard accepted.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
