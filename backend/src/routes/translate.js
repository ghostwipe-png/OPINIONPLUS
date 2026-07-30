// backend/src/routes/translate.js
// Multi-Language Translation API — 25 Languages
// Uses Google Cloud Translation API with D1 caching.
// Falls back to LibreTranslate (free) if Google API key not configured.

import { Hono } from 'hono';

const translate = new Hono();

// ── 25 Supported Languages ──────────────────────────────────────────────
const LANGUAGES = {
  en: { name: 'English', native: 'English', flag: '🇬🇧' },
  sw: { name: 'Swahili', native: 'Kiswahili', flag: '🇰🇪' },
  fr: { name: 'French', native: 'Français', flag: '🇫🇷' },
  ar: { name: 'Arabic', native: 'العربية', flag: '🇸🇦' },
  pt: { name: 'Portuguese', native: 'Português', flag: '🇧🇷' },
  es: { name: 'Spanish', native: 'Español', flag: '🇪🇸' },
  zh: { name: 'Chinese (Simplified)', native: '中文', flag: '🇨🇳' },
  hi: { name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  de: { name: 'German', native: 'Deutsch', flag: '🇩🇪' },
  ja: { name: 'Japanese', native: '日本語', flag: '🇯🇵' },
  ko: { name: 'Korean', native: '한국어', flag: '🇰🇷' },
  ru: { name: 'Russian', native: 'Русский', flag: '🇷🇺' },
  am: { name: 'Amharic', native: 'አማርኛ', flag: '🇪🇹' },
  yo: { name: 'Yoruba', native: 'Yorùbá', flag: '🇳🇬' },
  zu: { name: 'Zulu', native: 'isiZulu', flag: '🇿🇦' },
  ha: { name: 'Hausa', native: 'Hausa', flag: '🇳🇬' },
  so: { name: 'Somali', native: 'Soomaali', flag: '🇸🇴' },
  ig: { name: 'Igbo', native: 'Igbo', flag: '🇳🇬' },
  it: { name: 'Italian', native: 'Italiano', flag: '🇮🇹' },
  nl: { name: 'Dutch', native: 'Nederlands', flag: '🇳🇱' },
  tr: { name: 'Turkish', native: 'Türkçe', flag: '🇹🇷' },
  bn: { name: 'Bengali', native: 'বাংলা', flag: '🇧🇩' },
  ur: { name: 'Urdu', native: 'اردو', flag: '🇵🇰' },
  id: { name: 'Indonesian', native: 'Bahasa Indonesia', flag: '🇮🇩' },
  vi: { name: 'Vietnamese', native: 'Tiếng Việt', flag: '🇻🇳' },
};

// ── Safe DB helpers ──────────────────────────────────────────────────────
async function safeDbFirst(env, sql, ...params) {
  try { return await env.DB.prepare(sql).bind(...params).first(); }
  catch (e) { console.error('TR_DB_ERROR:', e.message); return null; }
}

async function safeDbRun(env, sql, ...params) {
  try { return await env.DB.prepare(sql).bind(...params).run(); }
  catch (e) { console.error('TR_DB_ERROR:', e.message); return null; }
}

// ── Simple text hash for cache key ──────────────────────────────────────
function simpleHash(text) {
  let hash = 0;
  for (let i = 0; i < Math.min(text.length, 500); i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'h' + Math.abs(hash).toString(36);
}

// ── Translation via Google Cloud Translation API ────────────────────────
async function translateViaGoogle(text, targetLanguage, apiKey) {
  const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      target: targetLanguage,
      format: 'text',
    }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || 'Google Translate API error');
  }
  return {
    translatedText: data.data.translations[0].translatedText,
    detectedLanguage: data.data.translations[0].detectedSourceLanguage || 'unknown',
  };
}

// ── Translation via LibreTranslate (free, no API key needed) ────────────
async function translateViaLibre(text, targetLanguage) {
  const res = await fetch('https://libretranslate.com/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source: 'auto',
      target: targetLanguage,
      format: 'text',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'LibreTranslate request failed');
  }
  const data = await res.json();
  return {
    translatedText: data.translatedText,
    detectedLanguage: data.detectedLanguage?.language || 'unknown',
  };
}

// ── Main translation function with caching ──────────────────────────────
async function getTranslation(env, { sourceType, sourceId, text, targetLanguage }) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return { translatedText: '', sourceLanguage: 'en' };
  }

  const textHash = simpleHash(text.trim());

  // Check cache first
  const cached = await safeDbFirst(
    env,
    'SELECT * FROM translations_cache WHERE source_type = ? AND source_id = ? AND target_language = ? AND source_text_hash = ?',
    sourceType, sourceId, targetLanguage, textHash
  );

  if (cached) {
    return {
      translatedText: cached.translated_text,
      sourceLanguage: cached.source_language,
      cached: true,
    };
  }

  // Translate
  let result;
  const googleApiKey = env.GOOGLE_TRANSLATE_API_KEY || env.GOOGLE_API_KEY;

  try {
    if (googleApiKey) {
      result = await translateViaGoogle(text, targetLanguage, googleApiKey);
    } else {
      result = await translateViaLibre(text, targetLanguage);
    }
  } catch (e) {
    console.error('Translation failed:', e.message);
    // If both fail, try one more time with the other service
    try {
      if (googleApiKey) {
        result = await translateViaLibre(text, targetLanguage);
      } else {
        throw e; // No fallback available
      }
    } catch (e2) {
      return {
        translatedText: text,
        sourceLanguage: 'en',
        error: 'Translation service unavailable. Showing original text.',
      };
    }
  }

  // Cache the result
  await safeDbRun(
    env,
    `INSERT INTO translations_cache (id, source_type, source_id, source_text_hash, source_language, target_language, translated_text, character_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    crypto.randomUUID(), sourceType, sourceId, textHash,
    result.detectedLanguage || 'en', targetLanguage,
    result.translatedText, text.length
  );

  return {
    translatedText: result.translatedText,
    sourceLanguage: result.detectedLanguage || 'en',
    cached: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// GET /translate/languages — List all supported languages
translate.get('/languages', async (c) => {
  return c.json({ languages: LANGUAGES });
});

// POST /translate — Translate text
// Body: { text, targetLanguage, sourceType?, sourceId? }
translate.post('/', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { text, targetLanguage, sourceType = 'generic', sourceId = 'adhoc' } = body;

    if (!text || typeof text !== 'string') {
      return c.json({ error: 'text is required.' }, 400);
    }
    if (!targetLanguage || !LANGUAGES[targetLanguage]) {
      return c.json({ error: `targetLanguage must be one of: ${Object.keys(LANGUAGES).join(', ')}` }, 400);
    }

    const result = await getTranslation(c.env, {
      sourceType,
      sourceId,
      text,
      targetLanguage,
    });

    return c.json(result);
  } catch (e) {
    console.error('Translate error:', e.message);
    return c.json({ error: 'Translation failed.' }, 500);
  }
});

// GET /translate/story/:id?lang=sw — Translate a story
translate.get('/story/:id', async (c) => {
  try {
    const storyId = c.req.param('id');
    const targetLang = c.req.query('lang') || 'sw';

    if (!LANGUAGES[targetLang]) {
      return c.json({ error: `Unsupported language: ${targetLang}` }, 400);
    }

    const story = await safeDbFirst(
      c.env,
      'SELECT id, title, body, excerpt FROM stories WHERE id = ? AND deleted = 0',
      storyId
    );

    if (!story) {
      return c.json({ error: 'Story not found.' }, 404);
    }

    const [titleResult, bodyResult] = await Promise.all([
      getTranslation(c.env, { sourceType: 'story_title', sourceId: storyId, text: story.title, targetLanguage: targetLang }),
      getTranslation(c.env, { sourceType: 'story_body', sourceId: storyId, text: story.body || '', targetLanguage: targetLang }),
    ]);

    return c.json({
      storyId,
      targetLanguage: targetLang,
      language: LANGUAGES[targetLang],
      title: titleResult.translatedText,
      body: bodyResult.translatedText,
      sourceLanguage: titleResult.sourceLanguage,
    });
  } catch (e) {
    console.error('Story translate error:', e.message);
    return c.json({ error: 'Story translation failed.' }, 500);
  }
});

// GET /translate/detect — Auto-detect language of text
translate.post('/detect', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return c.json({ error: 'text is required.' }, 400);
    }

    // Use Google's detect endpoint or LibreTranslate
    const googleApiKey = c.env.GOOGLE_TRANSLATE_API_KEY || c.env.GOOGLE_API_KEY;

    if (googleApiKey) {
      const res = await fetch(`https://translation.googleapis.com/language/translate/v2/detect?key=${googleApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text }),
      });
      const data = await res.json();
      if (data.data?.detections?.[0]?.length > 0) {
        const detection = data.data.detections[0][0];
        return c.json({
          language: detection.language,
          confidence: detection.confidence,
          languageName: LANGUAGES[detection.language]?.name || detection.language,
        });
      }
    }

    // Fallback: basic detection by character set
    const lang = /[\u0600-\u06FF]/.test(text) ? 'ar' :
                 /[\u0900-\u097F]/.test(text) ? 'hi' :
                 /[\u4E00-\u9FFF]/.test(text) ? 'zh' :
                 /[\u3040-\u309F\u30A0-\u30FF]/.test(text) ? 'ja' :
                 /[\uAC00-\uD7AF]/.test(text) ? 'ko' :
                 'en';

    return c.json({
      language: lang,
      confidence: 0.5,
      languageName: LANGUAGES[lang]?.name || 'English',
    });
  } catch (e) {
    console.error('Detect language error:', e.message);
    return c.json({ error: 'Language detection failed.' }, 500);
  }
});

export default translate;