// components/SponsoredMediaUploader.js
'use client';

import { useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, X, AlertTriangle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES = 5 * 1024 * 1024;

function isValidUrl(str) {
  try { const u = new URL(str); return u.protocol === 'http:' || u.protocol === 'https:'; }
  catch { return false; }
}

export default function SponsoredMediaUploader({ onUpload, currentUrl, onRemove }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file) => {
    setError('');
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Unsupported file type. Use PNG, JPG, WEBP, or GIF.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('File too large. Max 5MB.');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/uploads`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && (data.url || data.location)) {
        onUpload(data.url || data.location);
      } else {
        setError(data.error || 'Upload failed. Try pasting an image URL instead.');
      }
    } catch (e) {
      setError('Network error uploading image. Try pasting an image URL instead.');
    }
    setUploading(false);
  };

  const handleUseUrl = () => {
    setError('');
    if (!isValidUrl(urlInput)) {
      setError('Enter a valid image URL.');
      return;
    }
    onUpload(urlInput);
    setUrlInput('');
  };

  if (currentUrl) {
    return (
      <div className="flex items-center gap-4 border border-wire bg-white p-3 rounded-sm">
        <div className="relative">
          <img src={currentUrl} alt="Banner preview" className="w-[100px] h-[75px] object-cover rounded-sm border border-wire" />
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove banner image"
            className="absolute -top-2 -right-2 bg-ink text-white rounded-full p-1 hover:bg-signal transition-colors focus-visible:ring-2 focus-visible:ring-signal"
          >
            <X size={12} />
          </button>
        </div>
        <p className="text-xs font-bold text-ink-500 uppercase tracking-wider break-all">Banner set</p>
      </div>
    );
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
        className={`h-[200px] border-2 border-dashed rounded-sm grid place-items-center text-center px-6 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-signal ${
          dragOver ? 'border-ink bg-wire/10' : 'border-wire hover:border-ink'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={24} className="animate-spin text-ink" />
            <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Uploading...</p>
          </div>
        ) : (
          <div>
            <ImageIcon size={28} className="text-ink-300 mx-auto mb-3" />
            <p className="text-xs font-bold text-ink-600 uppercase tracking-wider">Drag &amp; drop banner image or click to browse</p>
            <p className="text-[10px] text-ink-400 mt-1">PNG, JPG, WEBP, GIF — Max 5MB</p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-signal rounded-sm flex items-start gap-2">
          <AlertTriangle size={14} className="text-signal shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-signal">{error}</p>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="Or paste image URL"
          className="flex-1 border border-wire rounded-sm px-3 py-2 text-xs font-mono bg-paper focus:outline-none focus:border-ink transition-colors"
        />
        <button
          type="button"
          onClick={handleUseUrl}
          className="border border-wire bg-white text-ink font-bold uppercase text-xs tracking-wider px-4 py-2 rounded-sm hover:border-ink transition-colors focus-visible:ring-2 focus-visible:ring-signal"
        >
          Use URL
        </button>
      </div>
    </div>
  );
}
