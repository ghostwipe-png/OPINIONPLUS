// components/NetworkStatus.js
'use client';

import { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

export default function NetworkStatus() {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [wasOffline, setWasOffline] = useState(false);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const goOffline = () => {
      setIsOffline(true);
      setWasOffline(true);
    };

    const goOnline = () => {
      setIsOffline(false);
      if (wasOffline) {
        setShowRestored(true);
        setTimeout(() => setShowRestored(false), 4000);
      }
    };

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, [wasOffline]);

  const handleRetry = () => {
    window.location.reload();
  };

  if (!isOffline && !showRestored) return null;

  return (
    <>
      {/* Offline Banner */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-ink shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <WifiOff size={16} className="shrink-0" />
              <p className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                You&apos;re offline
              </p>
              <span className="hidden sm:inline text-xs text-ink/70 font-medium normal-case tracking-normal">
                Changes will sync when you reconnect
              </span>
            </div>
            <button
              onClick={handleRetry}
              className="shrink-0 flex items-center gap-1.5 bg-ink/10 hover:bg-ink/20 text-ink text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm transition-colors"
            >
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        </div>
      )}

      {/* Connection Restored Toast */}
      {showRestored && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[100] bg-emerald-500 text-white shadow-xl rounded-sm px-5 py-3 animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="flex items-center gap-2">
            <Wifi size={14} />
            <p className="text-xs font-bold uppercase tracking-wider">Back online</p>
          </div>
        </div>
      )}
    </>
  );
}