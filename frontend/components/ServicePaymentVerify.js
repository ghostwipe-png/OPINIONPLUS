// frontend/components/ServicePaymentVerify.js
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Loader2, XCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function VerifierLogic({ serviceType, onVerified, onError }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const reference = searchParams.get('reference');
    const payment = searchParams.get('payment');
    
    if (payment === 'success' && reference && !verifying) {
      setVerifying(true);
      
      fetch(`${API_BASE}/services/verify/${encodeURIComponent(reference)}`, { 
        credentials: 'include' 
      })
        .then(res => res.json())
        .then(data => {
          if (data.status === 'active') {
            if (onVerified) onVerified(data);
          } else {
            const err = data.error || 'Payment not completed successfully.';
            setErrorMsg(err);
            if (onError) onError(err);
          }
        })
        .catch(() => {
          const err = 'Network error verifying payment.';
          setErrorMsg(err);
          if (onError) onError(err);
        })
        .finally(() => {
          // Clean URL strictly to prevent URL manipulation / replay attempts
          router.replace(pathname, { scroll: false });
          setVerifying(false);
        });
    }
  }, [searchParams, pathname, router, onVerified, onError, verifying]);

  if (verifying) {
    return (
      <div className="fixed inset-0 z-[100] bg-paper/90 backdrop-blur-sm grid place-items-center">
        <div className="flex flex-col items-center gap-4 bg-white p-8 rounded-sm border-2 border-wire shadow-2xl">
          <Loader2 size={32} className="animate-spin text-signal" />
          <p className="text-xs font-bold uppercase tracking-wider text-ink">Verifying Payment Security...</p>
        </div>
      </div>
    );
  }

  if (errorMsg && !onVerified) {
    return (
      <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4">
        <div className="bg-red-50 border border-signal rounded-sm p-4 shadow-xl flex items-start gap-3">
          <XCircle size={18} className="text-signal shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-bold text-signal uppercase tracking-wider mb-1">Verification Failed</p>
            <p className="text-xs font-medium text-signal/80">{errorMsg}</p>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-signal hover:bg-red-100 p-1 rounded-sm transition-colors"><XCircle size={14} /></button>
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