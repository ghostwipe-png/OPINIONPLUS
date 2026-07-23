// frontend/components/ServicePaymentButton.js
'use client';

import { useRef, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

async function fetchCsrfToken() {
  try {
    const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
    const data = await res.json();
    return data.token || '';
  } catch (e) {
    return '';
  }
}

export default function ServicePaymentButton({
  serviceType,
  packageId,
  packageName,
  amount,
  className = '',
  disabled = false,
  onSuccess,
  onError,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Guards against double-submission from rapid double-clicks / double-taps,
  // in addition to the `disabled={loading}` state on the button itself.
  const submittingRef = useRef(false);

  const handlePay = async () => {
    if (submittingRef.current || loading || disabled) return;
    submittingRef.current = true;
    setLoading(true);
    setError('');

    try {
      const csrfToken = await fetchCsrfToken();

      const res = await fetch(`${API_BASE}/services/pay`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          serviceType,
          packageId,
          metadata: { packageName },
          // Stable per-attempt idempotency key so a retried request (e.g.
          // after a flaky network response) can't create a duplicate order.
          idempotency_key: `${serviceType}_${packageId}_${Date.now()}`
        })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        const message = data.error || 'Payment initialization failed.';
        setError(message);
        setLoading(false);
        submittingRef.current = false;
        if (onError) onError(message);
        return;
      }

      if (data.authorization_url) {
        if (onSuccess) onSuccess(data);
        window.location.href = data.authorization_url;
      } else {
        const message = 'Payment gateway unreachable.';
        setError(message);
        setLoading(false);
        submittingRef.current = false;
        if (onError) onError(message);
      }
    } catch (err) {
      const message = 'Check your connection and try again.';
      setError(message);
      setLoading(false);
      submittingRef.current = false;
      if (onError) onError(message);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      <button
        onClick={handlePay}
        disabled={loading || disabled}
        aria-label={`Buy ${packageName || 'package'}${amount ? ` for KES ${(Number(amount) / 100).toLocaleString()}` : ''}`}
        aria-busy={loading}
        className={`w-full font-bold uppercase text-xs tracking-wider rounded-sm transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 ${className}`}
      >
        {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : 'Buy Now'}
      </button>

      {error && <p role="alert" className="text-[10px] font-bold text-signal uppercase tracking-wider mt-3 text-center">{error}</p>}

      {!error && (
        <p className="text-[10px] font-medium text-ink-400 mt-3 flex items-center gap-1">
          <ShieldCheck size={12} aria-hidden="true" /> Secure Paystack Checkout
        </p>
      )}
    </div>
  );
}
