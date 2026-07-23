// components/installprompt.js
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
    <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3">
      <button 
        onClick={handleInstall}
        className="bg-signal text-white p-3.5 rounded-full shadow-2xl hover:bg-ink transition-all flex items-center justify-center group border border-white/20 cursor-pointer"
        title="Install OpinionPlus App"
        aria-label="Install App"
      >
        <Download size={20} className="shrink-0" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap text-xs font-bold uppercase tracking-wider px-0 group-hover:px-2">
          Install App
        </span>
      </button>
      <button 
        onClick={() => setVisible(false)}
        className="bg-ink/80 text-white/70 hover:text-white p-1.5 rounded-full shadow-md transition-colors cursor-pointer"
        aria-label="Close prompt"
      >
        <X size={14} />
      </button>
    </div>
  );
}