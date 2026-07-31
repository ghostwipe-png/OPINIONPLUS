// components/TranslateButton.js
'use client';

import { useState, useEffect, useRef } from 'react';
import { Languages, Loader2, X, ArrowLeftRight, ChevronDown, ExternalLink } from 'lucide-react';

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

export default function TranslateButton({ storyId, title, body }) {
  const [open, setOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);
  const [selectedLang, setSelectedLang] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check if there's a cached language preference
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(`translated_lang_${storyId}`);
      if (cached) {
        const lang = LANGUAGES.find(l => l.code === cached);
        if (lang) {
          setSelectedLang(lang);
          setShowTranslated(true);
        }
      }
    } catch (e) {}
  }, [storyId]);

  const handleTranslate = (langCode) => {
    setOpen(false);
    setTranslating(true);

    const lang = LANGUAGES.find(l => l.code === langCode);
    
    // Open Google Translate in new tab
    const storyUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/story/${storyId}`
      : `https://opinionplus.online/story/${storyId}`;
    
    const translateUrl = `https://translate.google.com/translate?hl=${langCode}&sl=auto&tl=${langCode}&u=${encodeURIComponent(storyUrl)}`;
    
    setSelectedLang(lang);
    setShowTranslated(true);
    
    try {
      sessionStorage.setItem(`translated_lang_${storyId}`, langCode);
    } catch (e) {}

    window.open(translateUrl, '_blank');
    setTranslating(false);
  };

  const handleRemoveTranslation = () => {
    setSelectedLang(null);
    setShowTranslated(false);
    try {
      sessionStorage.removeItem(`translated_lang_${storyId}`);
    } catch (e) {}
  };

  return (
    <div ref={ref} className="relative inline-block">
      {/* Translation Active Indicator */}
      {showTranslated && selectedLang && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-sm border bg-amber-50 border-amber-400 text-amber-700">
            <ArrowLeftRight size={13} />
            {selectedLang.flag} Reading in {selectedLang.native}
          </div>
          
          <button
            onClick={handleRemoveTranslation}
            className="p-1.5 rounded-sm text-ink-400 hover:text-signal transition-colors"
            title="Remove translation"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Translate Button + Dropdown */}
      <button
        onClick={() => setOpen(!open)}
        disabled={translating}
        className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ink-500 hover:text-ink transition-colors border border-wire rounded-sm px-3 py-2 hover:border-ink disabled:opacity-50"
      >
        {translating ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Languages size={13} />
        )}
        {translating ? 'Opening...' : showTranslated ? 'Change Language' : 'Translate'}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-wire rounded-sm shadow-xl z-30 max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-2 border-b border-wire bg-ink-50">
            <p className="text-[9px] font-bold uppercase tracking-widest text-ink-400 px-2">
              Open in Google Translate
            </p>
          </div>
          {LANGUAGES.filter(l => l.code !== 'en').map(lang => (
            <button
              key={lang.code}
              onClick={() => handleTranslate(lang.code)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-ink hover:bg-ink-50 transition-colors"
            >
              <span className="text-base">{lang.flag}</span>
              <span className="flex-1 text-left">{lang.native}</span>
              <span className="text-ink-400 text-[10px]">{lang.name}</span>
              <ExternalLink size={11} className="text-ink-300" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}