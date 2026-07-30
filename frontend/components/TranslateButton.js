// components/TranslateButton.js
'use client';

import { useState, useEffect, useRef } from 'react';
import { Languages, Loader2, Check, X, ArrowLeftRight, ChevronDown } from 'lucide-react';

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
  const [translated, setTranslated] = useState(null);
  const [error, setError] = useState('');
  const [showTranslated, setShowTranslated] = useState(false);
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

  // Check cache on mount
  useEffect(() => {
    const cached = sessionStorage.getItem(`translated_${storyId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setTranslated(parsed);
      } catch (e) {}
    }
  }, [storyId]);

  const handleTranslate = async (langCode) => {
    setOpen(false);
    setTranslating(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${title}\n\n${(body || '').replace(/<[^>]*>/g, ' ')}`,
          targetLanguage: langCode,
          sourceType: 'story',
          sourceId: storyId,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const lang = LANGUAGES.find(l => l.code === langCode);
        const result = {
          title: data.translatedText.split('\n\n')[0] || title,
          body: data.translatedText.split('\n\n').slice(1).join('\n\n') || data.translatedText,
          language: lang?.native || langCode,
          flag: lang?.flag || '🌐',
          sourceLanguage: data.sourceLanguage,
        };
        setTranslated(result);
        setShowTranslated(true);
        
        try {
          sessionStorage.setItem(`translated_${storyId}`, JSON.stringify(result));
        } catch (e) {}
      } else {
        setError(data.error || 'Translation failed.');
      }
    } catch (e) {
      setError('Network error. Please try again.');
    }

    setTranslating(false);
  };

  return (
    <div ref={ref} className="relative inline-block">
      {/* Translation Toggle Bar */}
      {translated && (
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setShowTranslated(!showTranslated)}
            className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-sm border transition-all ${
              showTranslated 
                ? 'bg-amber-400 text-ink border-amber-400' 
                : 'bg-white text-ink border-wire hover:border-ink'
            }`}
          >
            <ArrowLeftRight size={13} />
            {showTranslated ? (
              <>Show Original</>
            ) : (
              <>{translated.flag} Read in {translated.language}</>
            )}
          </button>
          
          <button
            onClick={() => {
              setTranslated(null);
              setShowTranslated(false);
              try { sessionStorage.removeItem(`translated_${storyId}`); } catch (e) {}
            }}
            className="p-1.5 rounded-sm text-ink-400 hover:text-signal transition-colors"
            title="Remove translation"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Translate Button + Dropdown */}
      {!showTranslated && (
        <>
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
            {translating ? 'Translating...' : 'Translate'}
            <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-wire rounded-sm shadow-xl z-30 max-h-72 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
              {LANGUAGES.filter(l => l.code !== 'en').map(lang => (
                <button
                  key={lang.code}
                  onClick={() => handleTranslate(lang.code)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-ink hover:bg-ink-50 transition-colors"
                >
                  <span className="text-base">{lang.flag}</span>
                  <span className="flex-1 text-left">{lang.native}</span>
                  <span className="text-ink-400 text-[10px]">{lang.name}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {error && (
        <p className="text-[11px] font-bold text-signal mt-2">{error}</p>
      )}
    </div>
  );
}