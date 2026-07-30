// components/LanguageSwitcher.js
'use client';

import { useState, useEffect, useRef } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
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

export default function LanguageSwitcher({ variant = 'navbar' }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState('en');
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    // Load from localStorage first, then user preference
    try {
      const stored = localStorage.getItem('op_language');
      if (stored && LANGUAGES.find(l => l.code === stored)) {
        setSelectedLang(stored);
        return;
      }
    } catch (e) {}

    if (user?.preferred_language) {
      setSelectedLang(user.preferred_language);
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (code) => {
    setSelectedLang(code);
    setOpen(false);
    
    try {
      localStorage.setItem('op_language', code);
    } catch (e) {}

    // Save to backend if logged in
    if (user) {
      setSaving(true);
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
          body: JSON.stringify({ language: code }),
        });
      } catch (e) { /* silent */ }
      setSaving(false);
    }
  };

  const currentLang = LANGUAGES.find(l => l.code === selectedLang) || LANGUAGES[0];

  if (variant === 'footer') {
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/60 hover:text-white transition-colors px-3 py-2 rounded-sm border border-white/10 hover:border-white/30"
        >
          <Globe size={13} />
          <span>{currentLang.flag} {currentLang.native}</span>
          <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute bottom-full left-0 mb-2 w-56 bg-[#1C1917] border border-white/10 rounded-sm shadow-2xl max-h-64 overflow-y-auto z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium hover:bg-white/10 transition-colors ${
                  selectedLang === lang.code ? 'text-white' : 'text-white/70'
                }`}
              >
                <span className="text-base">{lang.flag}</span>
                <span className="flex-1 text-left">{lang.native}</span>
                <span className="text-white/40 text-[10px]">{lang.name}</span>
                {selectedLang === lang.code && <Check size={14} className="text-emerald-400 shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Navbar variant
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[10px] xl:text-[11px] font-semibold uppercase tracking-wider text-white/75 hover:text-amber-300 transition-all duration-200"
        title="Change language"
      >
        <Globe size={14} />
        <span className="hidden xl:inline">{currentLang.flag}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-[#0A0807] border border-white/10 rounded-sm shadow-2xl max-h-80 overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-2 border-b border-white/10">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 px-3 py-1">Choose Language</p>
          </div>
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium hover:bg-white/10 transition-colors ${
                selectedLang === lang.code ? 'text-amber-400 bg-white/5' : 'text-white/70'
              }`}
            >
              <span className="text-base">{lang.flag}</span>
              <span className="flex-1 text-left">{lang.native}</span>
              <span className="text-white/30 text-[10px]">{lang.name}</span>
              {selectedLang === lang.code && <Check size={14} className="text-amber-400 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}