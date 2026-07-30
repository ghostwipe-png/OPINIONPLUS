// components/LanguagePrefsModal.js
'use client';

import { useState, useEffect } from 'react';
import { Globe, Check, X, Search } from 'lucide-react';
import { useAuth } from '../lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'sw', name: 'Swahili', native: 'Kiswahili', flag: '🇰🇪' },
  { code: 'fr', name: 'French', native: 'Français', flag: '🇫🇷' },
  { code: 'ar', name: 'Arabic', native: 'العربية', flag: '🇸🇦' },
  { code: 'pt', name: 'Portuguese', native: 'Português', flag: '🇧🇷' },
  { code: 'es', name: 'Spanish', native: 'Español', flag: '🇪🇸' },
  { code: 'zh', name: 'Chinese', native: '中文', flag: '🇨🇳' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'de', name: 'German', native: 'Deutsch', flag: '🇩🇪' },
  { code: 'ja', name: 'Japanese', native: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', native: '한국어', flag: '🇰🇷' },
  { code: 'ru', name: 'Russian', native: 'Русский', flag: '🇷🇺' },
  { code: 'am', name: 'Amharic', native: 'አማርኛ', flag: '🇪🇹' },
  { code: 'yo', name: 'Yoruba', native: 'Yorùbá', flag: '🇳🇬' },
  { code: 'zu', name: 'Zulu', native: 'isiZulu', flag: '🇿🇦' },
  { code: 'ha', name: 'Hausa', native: 'Hausa', flag: '🇳🇬' },
  { code: 'so', name: 'Somali', native: 'Soomaali', flag: '🇸🇴' },
  { code: 'ig', name: 'Igbo', native: 'Igbo', flag: '🇳🇬' },
  { code: 'it', name: 'Italian', native: 'Italiano', flag: '🇮🇹' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands', flag: '🇳🇱' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe', flag: '🇹🇷' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', flag: '🇧🇩' },
  { code: 'ur', name: 'Urdu', native: 'اردو', flag: '🇵🇰' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa', flag: '🇮🇩' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', flag: '🇻🇳' },
];

export default function LanguagePrefsModal({ open, onClose }) {
  const { user } = useAuth();
  const [selectedLang, setSelectedLang] = useState('en');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    
    // Detect browser language
    const browserLang = (navigator.language || 'en').split('-')[0];
    const supported = LANGUAGES.find(l => l.code === browserLang);
    const initial = supported ? browserLang : 'en';
    
    // Override with user preference if available
    if (user?.preferred_language) {
      setSelectedLang(user.preferred_language);
    } else {
      setSelectedLang(initial);
    }
  }, [open, user]);

  const handleSave = async () => {
    setSaving(true);
    
    try {
      localStorage.setItem('op_language', selectedLang);
    } catch (e) {}

    if (user) {
      try {
        const csrfRes = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
        const csrfData = await csrfRes.json();
        await fetch(`${API_BASE}/users/me/language`, {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfData.token || '',
          },
          body: JSON.stringify({ language: selectedLang }),
        });
      } catch (e) { /* silent */ }
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1500);
  };

  if (!open) return null;

  const filtered = LANGUAGES.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.native.toLowerCase().includes(search.toLowerCase())
  );

  const selected = LANGUAGES.find(l => l.code === selectedLang);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white border-2 border-ink rounded-md max-w-lg w-full max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-wire">
          <div className="flex items-center gap-2">
            <Globe size={20} className="text-signal" />
            <h2 className="text-lg font-black text-ink uppercase tracking-tight">Reading Language</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-ink-50 transition-colors"
          >
            <X size={18} className="text-ink-400" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-wire">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search languages..."
              className="w-full border border-wire rounded-sm pl-9 pr-3 py-2 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors"
            />
          </div>
        </div>

        {/* Language Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {saved ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center">
                <Check size={28} className="text-emerald-600" />
              </div>
              <p className="text-sm font-bold text-ink uppercase tracking-wider">Language Saved!</p>
              <p className="text-xs text-ink-500">
                Content will now be shown in {selected?.native || selectedLang} when available.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1">
              {filtered.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => setSelectedLang(lang.code)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-sm text-left transition-colors ${
                    selectedLang === lang.code
                      ? 'bg-amber-50 border-2 border-amber-400'
                      : 'border-2 border-transparent hover:bg-ink-50'
                  }`}
                >
                  <span className="text-xl">{lang.flag}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink truncate">{lang.native}</p>
                    <p className="text-[10px] text-ink-400">{lang.name}</p>
                  </div>
                  {selectedLang === lang.code && (
                    <Check size={16} className="text-amber-500 shrink-0 ml-auto" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!saved && (
          <div className="p-5 border-t border-wire bg-ink-50">
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-500">
                Selected: <span className="font-bold">{selected?.flag} {selected?.native}</span>
              </p>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-ink text-white font-bold uppercase text-xs tracking-wider px-6 py-2.5 rounded-sm hover:bg-signal transition-colors disabled:opacity-50 shadow-sm"
              >
                {saving ? 'Saving...' : 'Set as Default'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}