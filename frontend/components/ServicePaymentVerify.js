// frontend/components/ServicePaymentVerify.js
'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Loader2, XCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const MAX_NETWORK_RETRIES = 2;

function friendlyStatusMessage(status) {
  switch (status) {
    case 'failed': return 'Your payment failed. No charge was made.';
    case 'abandoned': return 'The payment was not completed.';
    case 'pending': return 'Your payment is still processing. Please check back shortly.';
    default: return 'Payment not completed successfully.';
  }
}

function VerifierLogic({ serviceType, onVerified, onError }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const attemptRef = useRef(0);

  useEffect(() => {
    const reference = searchParams.get('reference');
    const payment = searchParams.get('payment');

    if (payment !== 'success' || !reference || verifying) return;

    let cancelled = false;
    setVerifying(true);

    const runVerification = async () => {
      for (let attempt = 0; attempt <= MAX_NETWORK_RETRIES; attempt++) {
        try {
          const res = await fetch(`${API_BASE}/services/verify/${encodeURIComponent(reference)}`, {
            credentials: 'include'
          });
          const data = await res.json();

          if (cancelled) return;

          if (data.status === 'active') {
            if (onVerified) onVerified(data);
          } else {
            const err = data.error || friendlyStatusMessage(data.status);
            setErrorMsg(err);
            if (onError) onError(err);
          }
          return; // success or definitive failure — stop retrying
        } catch (e) {
          if (attempt < MAX_NETWORK_RETRIES) {
            await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
            continue;
          }
          if (cancelled) return;
          const err = 'Network error verifying payment.';
          setErrorMsg(err);
          if (onError) onError(err);
        }
      }
    };

    runVerification().finally(() => {
      if (cancelled) return;
      // Clean URL
      router.replace(pathname, { scroll: false });
      setVerifying(false);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, pathname, router, onVerified, onError]);

  if (verifying) {
    return (
      <div className="fixed inset-0 z-50 bg-paper/90 backdrop-blur-sm grid place-items-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-signal" />
          <p className="text-sm font-bold uppercase tracking-wider text-ink">Verifying Payment...</p>
        </div>
      </div>
    );
  }

  if (errorMsg && !onVerified) {
    return (
      <div className="fixed top-24 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-4">
        <div className="bg-red-50 border border-signal rounded-sm p-4 shadow-xl flex items-start gap-3">
          <XCircle size={18} className="text-signal shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-bold text-signal uppercase tracking-wider mb-1">Verification Failed</p>
            <p className="text-xs font-medium text-signal/80">{errorMsg}</p>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-signal hover:bg-red-100 p-1 rounded-sm"><XCircle size={14} /></button>
        </div>
      </div>
    );
  }

  return null;
}

export default function ServicePaymentVerify(props) {
  return (
    <Suspense fallback={null}>
      <VerifierLogic {...props} />
    </Suspense>
  );
}
