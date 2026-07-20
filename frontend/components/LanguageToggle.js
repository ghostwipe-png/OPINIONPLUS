'use client';

import { useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

let csrfToken = null;
async function fetchCsrfToken() {
  if (csrfToken) return csrfToken;
  try {
    const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
    const data = await res.json();
    csrfToken = data.token;
    return csrfToken;
  } catch (e) { return ''; }
}

export default function LanguageToggle({ storyId, onTranslate }) {
  const [lang, setLang] = useState('en');
  const [loading, setLoading] = useState(false);

  const toggleLanguage = async () => {
    if (lang === 'sw') {
      setLang('en');
      onTranslate(null); // Revert to original English version
      return;
    }

    setLoading(true);
    try {
      const token = await fetchCsrfToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['X-CSRF-Token'] = token;

      const res = await fetch(`${API_BASE}/stories/${storyId}/translate`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ lang: 'sw' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Translation failed.');
      
      setLang('sw');
      onTranslate(data); // Pass translated title and body up to the story page
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggleLanguage}
      disabled={loading}
      className="bg-paper border border-wire text-ink hover:border-ink font-bold uppercase text-xs tracking-wider px-3.5 py-2 rounded-sm transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
    >
      {loading ? <Loader2 size={13} className="animate-spin text-signal" /> : <Languages size={13} className="text-signal" />}
      {lang === 'en' ? 'Soma kwa Kiswahili' : 'Switch to English'}
    </button>
  );
}