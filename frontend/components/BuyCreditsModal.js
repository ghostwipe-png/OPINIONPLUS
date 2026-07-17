'use client';

import { useState } from 'react';
import { X, CreditCard, Smartphone, Check, Loader2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '';

const PACKAGES = [
  { id: 'sms_10', name: '10 SMS', credits: 10, amount: 1000, price: 'KES 10' },
  { id: 'sms_50', name: '50 SMS', credits: 50, amount: 5000, price: 'KES 50', popular: true },
  { id: 'sms_100', name: '100 SMS', credits: 100, amount: 10000, price: 'KES 100' },
  { id: 'sms_500', name: '500 SMS', credits: 500, amount: 50000, price: 'KES 500' },
  { id: 'sms_1000', name: '1,000 SMS', credits: 1000, amount: 100000, price: 'KES 1,000' },
];

export default function BuyCreditsModal({ onClose, onSuccess }) {
  const [selected, setSelected] = useState('sms_50');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('select');
  const [error, setError] = useState('');

  const pkg = PACKAGES.find(p => p.id === selected);

  const handlePayment = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/payments/initialize`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: selected }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || data.details?.message || 'Payment initialization failed.');
        setLoading(false);
        return;
      }

      // Check if PaystackPop is available
      if (!window.PaystackPop) {
        setError('Payment system is loading. Please refresh the page and try again.');
        setLoading(false);
        return;
      }

      // Open Paystack popup
      const handler = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: data.email || '',
        amount: pkg.amount,
        currency: 'KES',
        reference: data.reference,
        channels: ['card', 'mobile_money'],
        metadata: {
          package: pkg.name,
          credits: pkg.credits,
        },
        onClose: () => {
          setLoading(false);
        },
        callback: async (response) => {
          try {
            const verifyRes = await fetch(
              `${API_BASE}/payments/verify/${response.reference}`,
              { credentials: 'include' }
            );
            const verifyData = await verifyRes.json();

            if (verifyData.verified && verifyData.status === 'success') {
              setStep('success');
              if (onSuccess) onSuccess(pkg.credits);
            } else {
              setError('Payment verification failed. Please contact support.');
            }
          } catch (e) {
            setError('Verification failed. Please contact support.');
          }
          setLoading(false);
        },
      });

      handler.openIframe();
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
                {PACKAGES.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-sm border text-left ${
                      selected === p.id ? 'border-ink bg-ink-50' : 'border-wire hover:border-ink'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold">{p.name}</p>
                      <p className="text-xs text-ink-400">≈ KES 1/SMS</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{p.price}</p>
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
              <div className="bg-red-50 border border-signal rounded-sm p-3 text-sm text-signal">
                {error}
              </div>
            )}

            <div className="border-t border-wire pt-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{pkg.name}</p>
                <p className="text-xs text-ink-400">{pkg.credits} credits</p>
              </div>
              <p className="text-lg font-bold">{pkg.price}</p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handlePayment(); }}>
  <button
    type="submit"
    disabled={loading}
    className="btn-primary w-full py-3 rounded-sm text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
  >
    {loading ? (
      <><Loader2 size={16} className="animate-spin" /> Processing...</>
    ) : (
      <>Pay {pkg.price} — Get {pkg.credits} Credits</>
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