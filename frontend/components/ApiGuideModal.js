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
    <div className="fixed inset-0 bg-ink/60 z-50 grid place-items-center px-4">
      <div className="bg-paper rounded-sm border border-wire w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-wire">
          <h2 className="editorial-h text-xl font-bold flex items-center gap-2">
            <Terminal size={20} /> API Guide
          </h2>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-full hover:bg-ink-50">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-8 text-sm">
          {/* Generate */}
          <section>
            <h3 className="wire-tag mb-3 flex items-center gap-2">
              <Key size={13} /> Generating a Key
            </h3>
            <ol className="list-decimal pl-5 space-y-2 text-ink-600">
              <li>Go to your <strong className="text-ink">Profile</strong> page</li>
              <li>Expand the <strong className="text-ink">API Keys</strong> section</li>
              <li>Enter a name (e.g. &quot;My Blog&quot; or &quot;News App&quot;)</li>
              <li>Click <strong className="text-ink">Generate</strong></li>
              <li>
                <span className="text-signal font-semibold">Copy the key immediately</span> — it
                won&apos;t be shown again. Store it somewhere safe.
              </li>
            </ol>
          </section>

          {/* Usage */}
          <section>
            <h3 className="wire-tag mb-3 flex items-center gap-2">
              <Globe size={13} /> Using Your Key
            </h3>
            <p className="text-ink-600 mb-3">
              Send your key in the <code className="bg-ink-50 px-1.5 py-0.5 rounded text-xs font-mono">Authorization</code> header
              to fetch your published stories:
            </p>
            
            <div className="bg-ink-50 border border-wire rounded-sm p-3 relative">
              <button
                onClick={() => copy('Authorization: Bearer op_YOUR_KEY_HERE', 'header')}
                className="absolute top-2 right-2 text-ink-400 hover:text-ink-600"
              >
                <Copy size={13} />
              </button>
              <code className="text-xs font-mono text-ink-700 block whitespace-pre-wrap break-all">
                {`curl -H "Authorization: Bearer op_YOUR_KEY_HERE" \\
  https://opinionplus-api.opinionplus.workers.dev/api/feed`}
              </code>
              {copied === 'header' && (
                <p className="text-xs text-ink-600 mt-1">Copied!</p>
              )}
            </div>
          </section>

          {/* Response */}
          <section>
            <h3 className="wire-tag mb-3">Response Format</h3>
            <div className="bg-ink-50 border border-wire rounded-sm p-3 relative">
              <button
                onClick={() => copy(JSON.stringify({
                  publisher: "Your Name",
                  stories: [{ id: "...", title: "...", body: "...", created_at: "...", cover_image: "..." }]
                }, null, 2), 'response')}
                className="absolute top-2 right-2 text-ink-400 hover:text-ink-600"
              >
                <Copy size={13} />
              </button>
              <pre className="text-xs font-mono text-ink-700 whitespace-pre-wrap break-all">
{`{
  "publisher": "Your Publisher Name",
  "stories": [
    {
      "id": "story-uuid",
      "author_id": "user-uuid",
      "title": "Story Title",
      "excerpt": "Short excerpt...",
      "body": "Full HTML body...",
      "type": "story",
      "cover_image": "https://...",
      "created_at": "2026-07-16T...",
      "updated_at": "2026-07-16T...",
      "files": [...],
      "likes": [...],
      "comments": [...]
    }
  ]
}`}
              </pre>
              {copied === 'response' && (
                <p className="text-xs text-ink-600 mt-1">Copied!</p>
              )}
            </div>
          </section>

          {/* Revoke */}
          <section>
            <h3 className="wire-tag mb-3 flex items-center gap-2">
              <AlertTriangle size={13} /> Revoking a Key
            </h3>
            <ol className="list-decimal pl-5 space-y-2 text-ink-600">
              <li>Go to the <strong className="text-ink">API Keys</strong> section in your profile</li>
              <li>Find the key you want to revoke</li>
              <li>Click <strong className="text-signal">Revoke</strong></li>
              <li>The key stops working immediately. Any site using it will get a 401 error.</li>
            </ol>
          </section>

          {/* Endpoints */}
          <section>
            <h3 className="wire-tag mb-3">Endpoints</h3>
            <div className="border border-wire rounded-sm divide-y divide-wire">
              <div className="p-3">
                <p className="font-semibold text-xs mb-1">GET /api/feed</p>
                <p className="text-xs text-ink-400">Returns all your published stories as JSON. Requires API key.</p>
              </div>
              <div className="p-3">
                <p className="font-semibold text-xs mb-1">GET /stories?authorId=YOUR_ID</p>
                <p className="text-xs text-ink-400">Public endpoint. No API key needed. Returns published stories for any author.</p>
              </div>
            </div>
          </section>
        </div>

        <div className="p-5 border-t border-wire">
          <button onClick={onClose} className="btn-primary w-full py-2.5 rounded-sm text-sm">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}