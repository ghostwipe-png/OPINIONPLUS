'use client';

import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-[9999] bg-ink text-white p-4 rounded-md shadow-2xl border border-signal flex items-center justify-between gap-4 animate-in slide-in-from-bottom-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-signal text-white rounded-sm flex items-center justify-center font-black text-sm tracking-wider">
          OP+
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider">Install OpinionPlus</p>
          <p className="text-[11px] text-white/70">Add to your home screen for an app-like reading experience.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button 
          onClick={handleInstall}
          className="bg-signal text-white font-bold uppercase text-[10px] tracking-widest px-3.5 py-2 rounded-sm hover:bg-white hover:text-signal transition-colors flex items-center gap-1 shrink-0 shadow-md"
        >
          <Download size={12} /> Install
        </button>
        <button 
          onClick={() => setVisible(false)}
          className="text-white/50 hover:text-white p-1"
          aria-label="Close prompt"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}