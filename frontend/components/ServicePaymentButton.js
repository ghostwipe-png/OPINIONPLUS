// frontend/components/ServicePaymentButton.js
'use client';

import { useState } from 'react';
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

export default function ServicePaymentButton({ serviceType, packageId, packageName, className = '' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePay = async () => {
    setLoading(true);
    setError('');

    try {
      const csrfToken = await fetchCsrfToken();
      // Generate a strict client-side idempotency lock key for this checkout attempt
      const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      
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
          idempotency_key: idempotencyKey,
          metadata: { packageName } 
        })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || 'Payment initialization failed.');
        setLoading(false);
        return;
      }

      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        setError('Payment gateway unreachable.');
        setLoading(false);
      }
    } catch (err) {
      setError('Check your connection and try again.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      <button 
        onClick={handlePay} 
        disabled={loading}
        aria-label={`Buy ${packageName} securely`}
        className={`w-full font-bold uppercase text-xs tracking-wider rounded-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${className}`}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : 'Buy Now'}
      </button>
      
      {error && <p className="text-[10px] font-bold text-signal uppercase tracking-wider mt-3 text-center">{error}</p>}
      
      {!error && (
        <p className="text-[10px] font-medium text-ink-400 mt-3 flex items-center gap-1">
          <ShieldCheck size={12} className="text-emerald-600" /> Secure Paystack Checkout
        </p>
      )}
    </div>
  );
}