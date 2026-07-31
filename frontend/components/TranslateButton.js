// components/TranslateButton.js
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Languages,
  Loader2,
  X,
  ArrowLeftRight,
  ChevronDown,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';

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

// Cheap synchronous string hash (djb2) — only used to detect whether the
// story content changed since a translation was cached. Not cryptographic.
function hashContent(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash |= 0; // keep it a 32-bit int
  }
  return hash.toString(36);
}

// Feature-detect the browser's on-device Translator API (currently shipping,
// experimental, behind a flag/origin trial in Chrome/Edge as `self.Translator`
// or `self.ai.translator`). This is the ONLY real, no-network, in-page
// translation primitive browsers currently expose to web pages.
//
// Deliberately NOT implemented here: a "chrome.translate" call (no such API
// is exposed to web content) or an invisible-iframe trick against
// translate.google.com (the Google Translate website widget only rewrites
// the live DOM it's attached to — it does not hand back a translated string
// for arbitrary text, so it can't feed an onTranslate callback). Faking
// either of those would look like it works and then silently do nothing.
function getTranslatorApi() {
  if (typeof self === 'undefined') return null;
  if (typeof self.Translator !== 'undefined') return self.Translator;
  if (self.ai && typeof self.ai.translator !== 'undefined') return self.ai.translator;
  return null;
}

async function translateTextWithBrowserApi(sourceLanguage, targetLanguage, text) {
  if (!text) return '';

  const TranslatorApi = getTranslatorApi();
  if (!TranslatorApi) return null; // API not present on this browser

  if (typeof TranslatorApi.availability === 'function') {
    const availability = await TranslatorApi.availability({ sourceLanguage, targetLanguage });
    if (availability === 'unavailable') return null;
  }

  const translator =
    typeof TranslatorApi.create === 'function'
      ? await TranslatorApi.create({ sourceLanguage, targetLanguage })
      : TranslatorApi;

  if (!translator || typeof translator.translate !== 'function') return null;

  return translator.translate(text);
}

/**
 * @param {string} storyId
 * @param {string} title
 * @param {string} body
 * @param {(payload: {title: string, body: string, language: string, flag: string} | null) => void} [onTranslate]
 *   Optional. Called with the translated title/body when native in-page
 *   translation succeeds (or with `null` when the reader reverts to the
 *   original). If omitted, or if native translation isn't available in the
 *   current browser, the component falls back to opening the story in
 *   Google Translate in a new tab — the same behavior as before.
 */
export default function TranslateButton({ storyId, title, body, onTranslate }) {
  const [open, setOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);
  const [selectedLang, setSelectedLang] = useState(null);
  const [error, setError] = useState(null);
  const ref = useRef(null);
  const errorTimeoutRef = useRef(null);
  const contentHashRef = useRef(hashContent(`${title || ''}||${body || ''}`));

  // Keep the content hash current if the story text changes under us.
  useEffect(() => {
    contentHashRef.current = hashContent(`${title || ''}||${body || ''}`);
  }, [title, body]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, []);

  const showError = useCallback((message) => {
    setError(message);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => setError(null), 3000);
  }, []);

  // Restore a cached translation for this story, as long as the story
  // content hasn't changed since it was cached (hash mismatch = stale).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`translated_lang_${storyId}`);
      if (!raw) return;

      let cached = null;
      try {
        cached = JSON.parse(raw);
      } catch (parseErr) {
        // Older/plain-string cache format — discard, it's stale by definition.
        sessionStorage.removeItem(`translated_lang_${storyId}`);
        return;
      }

      if (!cached || cached.hash !== contentHashRef.current) {
        sessionStorage.removeItem(`translated_lang_${storyId}`);
        return;
      }

      const lang = LANGUAGES.find((l) => l.code === cached.langCode);
      if (!lang) return;

      setSelectedLang(lang);
      setShowTranslated(true);

      if (cached.title && cached.body && typeof onTranslate === 'function') {
        try {
          onTranslate({ title: cached.title, body: cached.body, language: lang.code, flag: lang.flag });
        } catch (callbackErr) {
          // Parent couldn't apply cached translation — non-fatal.
        }
      }
    } catch (e) {
      // sessionStorage unavailable (private mode, quota, etc.) — no cache, no crash.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId]);

  const openGoogleTranslateFallback = useCallback(
    (langCode) => {
      try {
        const storyUrl =
          typeof window !== 'undefined'
            ? `${window.location.origin}/story/${storyId}`
            : `https://opinionplus.online/story/${storyId}`;

        const translateUrl = `https://translate.google.com/translate?hl=${langCode}&sl=auto&tl=${langCode}&u=${encodeURIComponent(storyUrl)}`;
        window.open(translateUrl, '_blank', 'noopener,noreferrer');
      } catch (e) {
        // If even window.open is unavailable, there's nothing further we can do client-side.
      }
    },
    [storyId]
  );

  const attemptBrowserTranslation = async (langCode) => {
    const translatedTitle = await translateTextWithBrowserApi('en', langCode, title || '');
    if (translatedTitle == null) return null; // native API not supported here
    const translatedBody = await translateTextWithBrowserApi('en', langCode, body || '');
    if (translatedBody == null) return null;
    return { title: translatedTitle, body: translatedBody };
  };

  const handleTranslate = async (langCode) => {
    setOpen(false);
    setError(null);

    const lang = LANGUAGES.find((l) => l.code === langCode);
    if (!lang) return;

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      // The on-device model for a given language pair is fetched over the
      // network the first time it's used, so we can't rely on it offline.
      showError('Translation unavailable offline');
      return;
    }

    setTranslating(true);

    let result = null;
    let apiFailed = false;

    try {
      result = await attemptBrowserTranslation(langCode);
    } catch (firstErr) {
      // Auto-retry once before giving up on native translation.
      try {
        result = await attemptBrowserTranslation(langCode);
      } catch (secondErr) {
        apiFailed = true;
      }
    }

    setTranslating(false);
    setSelectedLang(lang);
    setShowTranslated(true);

    if (result && typeof onTranslate === 'function') {
      try {
        onTranslate({ title: result.title, body: result.body, language: lang.code, flag: lang.flag });
      } catch (callbackErr) {
        result = null; // parent couldn't apply it — treat as not translated
      }
    } else if (result && typeof onTranslate !== 'function') {
      // We have a real translation but no way to surface it in the page —
      // don't pretend it happened.
      result = null;
    }

    try {
      sessionStorage.setItem(
        `translated_lang_${storyId}`,
        JSON.stringify({
          langCode,
          hash: contentHashRef.current,
          title: result ? result.title : null,
          body: result ? result.body : null,
        })
      );
    } catch (e) {
      // Storage full/unavailable — translation still works for this session view.
    }

    if (!result) {
      if (apiFailed) {
        showError('Translation failed — opening Google Translate instead');
      }
      openGoogleTranslateFallback(langCode);
    }
  };

  const handleRemoveTranslation = () => {
    setSelectedLang(null);
    setShowTranslated(false);
    setError(null);
    try {
      sessionStorage.removeItem(`translated_lang_${storyId}`);
    } catch (e) {}
    if (typeof onTranslate === 'function') {
      try {
        onTranslate(null);
      } catch (e) {}
    }
  };

  return (
    <div ref={ref} className="relative inline-block">
      {/* Translation Active Indicator */}
      {showTranslated && selectedLang && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
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

      {/* Subtle, auto-dismissing error message */}
      {error && (
        <div className="flex items-center gap-2 mb-3 text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-sm border bg-red-50 border-red-300 text-red-600 animate-in fade-in slide-in-from-top-1 duration-150">
          <AlertTriangle size={13} />
          {error}
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
        {translating ? 'Translating...' : showTranslated ? 'Change Language' : 'Translate'}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-wire rounded-sm shadow-xl z-30 max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-2 border-b border-wire bg-ink-50">
            <p className="text-[9px] font-bold uppercase tracking-widest text-ink-400 px-2">
              Translate This Story
            </p>
          </div>
          {LANGUAGES.filter((l) => l.code !== 'en').map((lang) => (
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
