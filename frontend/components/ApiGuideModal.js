'use client';

import { X, Copy, Terminal, CheckCircle2 } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function ApiGuideModal({ onClose }) {
  const [copied, setCopied] = useState(null);

  // Lock body scroll and handle Escape key to close
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const copy = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2500);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const CopyButton = ({ text, id }) => (
    <button
      onClick={() => copy(text, id)}
      className="absolute top-3 right-3 text-white/50 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-1.5 rounded-sm flex items-center gap-1.5"
      title="Copy to clipboard"
      aria-label="Copy snippet"
    >
      {copied === id ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
      {copied === id && <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Copied</span>}
    </button>
  );

  return (
    <div 
      className="fixed inset-0 bg-ink/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" 
      role="dialog" 
      aria-modal="true"
      onClick={onClose}
    >
      <div 
        className="bg-paper rounded-sm border-2 border-ink w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
      >
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 bg-ink text-white shrink-0">
          <h2 className="text-base font-black uppercase tracking-widest flex items-center gap-2">
            <Terminal size={18} className="text-signal" /> API Developer Guide
          </h2>
          <button 
            onClick={onClose} 
            className="text-white/60 hover:text-white hover:bg-white/10 p-1.5 rounded-sm transition-colors"
            aria-label="Close guide"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 md:p-8 space-y-10 text-sm overflow-y-auto">
          {/* Step 1: Generate */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-ink border-b border-wire pb-2">
              <span className="bg-ink text-white w-5 h-5 flex items-center justify-center rounded-full text-[10px]">1</span>
              Generating an API Key
            </h3>
            <ol className="list-decimal pl-6 space-y-2 text-ink-600 font-medium leading-relaxed">
              <li>Navigate to your <strong className="text-ink">Profile</strong> dashboard settings.</li>
              <li>Locate and expand the <strong className="text-ink">API Keys</strong> security section.</li>
              <li>Enter a recognizable identifier (e.g. &quot;My External Blog Script&quot;).</li>
              <li>Click <strong className="text-ink">Generate</strong>. <span className="text-signal">Copy the key immediately; it will not be shown again for security purposes.</span></li>
            </ol>
          </section>

          {/* Step 2: Usage */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-ink border-b border-wire pb-2">
              <span className="bg-ink text-white w-5 h-5 flex items-center justify-center rounded-full text-[10px]">2</span>
              Querying Your Feed
            </h3>
            <p className="text-ink-600 font-medium text-[13px]">
              Pass your generated key inside the <code className="bg-wire/30 px-1.5 py-0.5 rounded font-mono text-ink text-xs font-bold border border-wire">Authorization</code> header:
            </p>
            
            <div className="bg-[#1e1e1e] rounded-sm relative shadow-inner overflow-hidden border border-[#333]">
              {/* Terminal Window Decoration */}
              <div className="bg-[#2d2d2d] flex items-center gap-1.5 px-3 py-2 border-b border-[#1e1e1e]">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                <span className="ml-2 text-[10px] font-mono text-white/40 uppercase tracking-widest">bash</span>
              </div>
              <CopyButton text={`curl -H "Authorization: Bearer op_YOUR_KEY_HERE" \\\n  https://opinionplus-api.opinionplus.workers.dev/api/feed`} id="header" />
              <div className="p-4 overflow-x-auto">
                <pre className="text-emerald-400 font-mono text-[13px] leading-relaxed">
                  <span className="text-pink-400">curl</span> -H <span className="text-yellow-300">"Authorization: Bearer op_YOUR_KEY_HERE"</span> \
                  <br/>  https://opinionplus-api.opinionplus.workers.dev/api/feed
                </pre>
              </div>
            </div>
          </section>

          {/* Step 3: Response */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-ink border-b border-wire pb-2">
              <span className="bg-ink text-white w-5 h-5 flex items-center justify-center rounded-full text-[10px]">3</span>
              Response Schema
            </h3>
            <div className="bg-[#1e1e1e] rounded-sm relative shadow-inner overflow-hidden border border-[#333]">
              <div className="bg-[#2d2d2d] flex items-center px-3 py-2 border-b border-[#1e1e1e]">
                 <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">json</span>
              </div>
              <CopyButton 
                text={JSON.stringify({ publisher: "Your Name", stories: [{ id: "story-uuid", title: "Story Title", body: "HTML content...", created_at: "2026-07-20T..." }] }, null, 2)} 
                id="response" 
              />
              <div className="p-4 overflow-x-auto max-h-56">
                <pre className="text-sky-300 font-mono text-[13px] leading-relaxed">
{`{
  "publisher": "Your Publisher Name",
  "stories": [
    {
      "id": "story-uuid",
      "title": "Story Title",
      "body": "HTML content...",
      "created_at": "2026-07-20T..."
    }
  ]
}`}
                </pre>
              </div>
            </div>
          </section>

          {/* Step 4: Revoke */}
          <section className="space-y-4 pb-4">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-ink border-b border-wire pb-2">
              <span className="bg-ink text-white w-5 h-5 flex items-center justify-center rounded-full text-[10px]">4</span>
              Key Revocation
            </h3>
            <p className="text-ink-600 font-medium text-[13px] bg-red-50 p-4 border-l-2 border-red-500 rounded-r-sm">
              You can instantly terminate any key from your profile dashboard. Requests using revoked credentials will immediately receive a <code className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-mono font-bold mx-1">401 Unauthorized</code> response and drop from cache.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-wire bg-ink-50 shrink-0">
          <button 
            onClick={onClose} 
            className="bg-ink text-white font-black uppercase text-xs tracking-widest w-full py-3.5 rounded-sm hover:bg-signal transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-ink"
          >
            I Understand
          </button>
        </div>

      </div>
    </div>
  );
}