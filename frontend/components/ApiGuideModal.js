'use client';

import { X, Copy, Terminal, Key, Globe, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

export default function ApiGuideModal({ onClose }) {
  const [copied, setCopied] = useState(null);

  const copy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-ink/75 z-50 grid place-items-center p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-paper rounded-sm border-2 border-ink w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 bg-ink text-white border-b border-white/10">
          <h2 className="text-lg font-bold uppercase tracking-wider flex items-center gap-2">
            <Terminal size={18} className="text-signal" /> API Developer Guide
          </h2>
          <button onClick={onClose} className="text-white/60 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-8 text-sm">
          {/* Generate */}
          <section className="space-y-3">
            <h3 className="bg-ink text-white text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 inline-block rounded-sm">
              1. Generating an API Key
            </h3>
            <ol className="list-decimal pl-5 space-y-2 text-ink-600 font-medium">
              <li>Navigate to your <strong className="text-ink">Profile</strong> dashboard.</li>
              <li>Locate and expand the <strong className="text-ink">API Keys</strong> section.</li>
              <li>Enter a recognizable identifier (e.g. &quot;My External Blog&quot;).</li>
              <li>Click <strong className="text-ink">Generate</strong>. Copy the key immediately; it will not be shown again.</li>
            </ol>
          </section>

          {/* Usage */}
          <section className="space-y-3">
            <h3 className="bg-ink text-white text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 inline-block rounded-sm">
              2. Querying Your Feed
            </h3>
            <p className="text-ink-600 text-xs font-medium">
              Pass your generated key inside the <code className="bg-wire/40 px-1.5 py-0.5 rounded font-mono text-ink">Authorization</code> header:
            </p>
            
            <div className="bg-ink text-white rounded-sm p-4 relative font-mono text-xs">
              <button
                onClick={() => copy('Authorization: Bearer op_YOUR_KEY_HERE', 'header')}
                className="absolute top-3 right-3 text-white/60 hover:text-white"
                title="Copy snippet"
              >
                <Copy size={14} />
              </button>
              <pre className="text-emerald-400 whitespace-pre-wrap break-all pr-8">
                {`curl -H "Authorization: Bearer op_YOUR_KEY_HERE" \\
  https://opinionplus-api.opinionplus.workers.dev/api/feed`}
              </pre>
              {copied === 'header' && <p className="text-[10px] text-white/80 mt-2 font-sans font-bold">Snippet copied!</p>}
            </div>
          </section>

          {/* Response */}
          <section className="space-y-3">
            <h3 className="bg-ink text-white text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 inline-block rounded-sm">
              3. Response Schema
            </h3>
            <div className="bg-ink text-white rounded-sm p-4 relative font-mono text-xs">
              <button
                onClick={() => copy(JSON.stringify({ publisher: "Your Name", stories: [] }, null, 2), 'response')}
                className="absolute top-3 right-3 text-white/60 hover:text-white"
              >
                <Copy size={14} />
              </button>
              <pre className="text-emerald-400 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
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
          </section>

          {/* Revoke */}
          <section className="space-y-3">
            <h3 className="bg-ink text-white text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 inline-block rounded-sm">
              4. Key Revocation
            </h3>
            <p className="text-ink-600 text-xs font-medium">
              You can instantly terminate any key from your profile dashboard. Requests using revoked credentials will immediately receive a <code className="text-signal font-mono font-bold">401 Unauthorized</code> response.
            </p>
          </section>
        </div>

        <div className="p-6 border-t border-wire bg-ink-50">
          <button onClick={onClose} className="bg-ink text-white font-bold uppercase text-xs tracking-wider w-full py-3 rounded-sm hover:bg-signal transition-colors">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}