// backend/src/routes/ai-services.js
// AI Services: Summarization, Headline Suggestions, Text-to-Speech, Sentiment
// Uses Google Gemini AI (generativelanguage.googleapis.com)
// All results cached in D1 to avoid redundant API calls and cost.

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';

const aiServices = new Hono();

// ── Safe DB helpers ──────────────────────────────────────────────────────
async function safeDbFirst(env, sql, ...params) {
  try { return await env.DB.prepare(sql).bind(...params).first(); }
  catch (e) { console.error('AI_DB_ERROR:', e.message); return null; }
}

async function safeDbRun(env, sql, ...params) {
  try { return await env.DB.prepare(sql).bind(...params).run(); }
  catch (e) { console.error('AI_DB_ERROR:', e.message); return null; }
}

// ── Google Gemini API helper ─────────────────────────────────────────────
async function callGemini(apiKey, prompt, maxTokens = 500) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.3,
        topP: 0.8,
      }
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API error: ${res.status}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ── Text-to-Speech via Google Cloud TTS ──────────────────────────────────
async function generateSpeech(env, text, language = 'en') {
  const apiKey = env.GOOGLE_TTS_API_KEY || env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('TTS API key not configured.');
  }

  // Voice mapping per language
  const voices = {
    en: { name: 'en-US-News-K', ssmlGender: 'MALE' },
    sw: { name: 'sw-KE-Standard-A', ssmlGender: 'FEMALE' },
    fr: { name: 'fr-FR-Standard-A', ssmlGender: 'FEMALE' },
    ar: { name: 'ar-XA-Standard-A', ssmlGender: 'MALE' },
    pt: { name: 'pt-BR-Standard-A', ssmlGender: 'MALE' },
    es: { name: 'es-ES-Standard-A', ssmlGender: 'FEMALE' },
    zh: { name: 'cmn-CN-Standard-A', ssmlGender: 'FEMALE' },
    hi: { name: 'hi-IN-Standard-A', ssmlGender: 'FEMALE' },
    de: { name: 'de-DE-Standard-A', ssmlGender: 'MALE' },
    ja: { name: 'ja-JP-Standard-A', ssmlGender: 'FEMALE' },
    ko: { name: 'ko-KR-Standard-A', ssmlGender: 'FEMALE' },
    ru: { name: 'ru-RU-Standard-A', ssmlGender: 'FEMALE' },
    it: { name: 'it-IT-Standard-A', ssmlGender: 'FEMALE' },
    nl: { name: 'nl-NL-Standard-A', ssmlGender: 'MALE' },
    tr: { name: 'tr-TR-Standard-A', ssmlGender: 'FEMALE' },
    id: { name: 'id-ID-Standard-A', ssmlGender: 'MALE' },
    vi: { name: 'vi-VN-Standard-A', ssmlGender: 'FEMALE' },
  };

  const voice = voices[language] || voices.en;

  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text: text.slice(0, 5000) },
      voice: {
        languageCode: language,
        name: voice.name,
        ssmlGender: voice.ssmlGender,
      },
      audioConfig: { audioEncoding: 'MP3' },
    }),
  });

  if (!res.ok) {
    throw new Error(`TTS API error: ${res.status}`);
  }

  const data = await res.json();
  return data.audioContent; // Base64-encoded MP3
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// POST /ai-services/summarize — Generate AI summary for a story
aiServices.post('/summarize', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { storyId, text, title } = body;

    if (!storyId || !text) {
      return c.json({ error: 'storyId and text are required.' }, 400);
    }

    // Check cache
    const cached = await safeDbFirst(
      c.env,
      'SELECT * FROM ai_summaries WHERE story_id = ?',
      storyId
    );
    if (cached) {
      return c.json({
        storyId,
        summary: JSON.parse(cached.summary_json),
        cached: true,
      });
    }

    const apiKey = c.env.GEMINI_API_KEY || c.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return c.json({ error: 'AI service not configured.' }, 503);
    }

    const prompt = `Summarize the following news article in 3 bullet points, then provide one key takeaway, and finally give a sentiment (positive, neutral, or negative).

Title: ${title || 'Untitled'}
Article: ${text.slice(0, 8000)}

Respond in this exact JSON format:
{
  "bullets": ["bullet 1", "bullet 2", "bullet 3"],
  "keyTakeaway": "one sentence key insight",
  "sentiment": "positive|neutral|negative"
}`;

    const response = await callGemini(apiKey, prompt, 400);
    
    // Parse the JSON from Gemini's response
    let summary;
    try {
      // Extract JSON from response (Gemini may wrap in markdown)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      summary = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        bullets: ['Summary unavailable.'],
        keyTakeaway: 'Please try again.',
        sentiment: 'neutral',
      };
    } catch (e) {
      summary = {
        bullets: ['Summary generation failed.'],
        keyTakeaway: 'Please try again later.',
        sentiment: 'neutral',
      };
    }

    // Cache the result
    await safeDbRun(
      c.env,
      'INSERT INTO ai_summaries (id, story_id, summary_json, model) VALUES (?, ?, ?, ?)',
      crypto.randomUUID(), storyId, JSON.stringify(summary), 'gemini-2.0-flash'
    );

    return c.json({ storyId, summary, cached: false });
  } catch (e) {
    console.error('Summarize error:', e.message);
    return c.json({ error: 'Summarization failed.' }, 500);
  }
});

// POST /ai-services/headlines — Generate headline suggestions
aiServices.post('/headlines', requireAuth, async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { text, currentTitle, count = 5 } = body;

    if (!text) {
      return c.json({ error: 'text is required.' }, 400);
    }

    const apiKey = c.env.GEMINI_API_KEY || c.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return c.json({ error: 'AI service not configured.' }, 503);
    }

    const prompt = `Generate ${Math.min(count, 10)} compelling, click-worthy headlines for this article. Each headline should be under 80 characters, use strong verbs, and be appropriate for a news platform.

Current title: ${currentTitle || 'None'}
Article: ${text.slice(0, 5000)}

Return ONLY a JSON array of strings. Example: ["Headline 1", "Headline 2"]`;

    const response = await callGemini(apiKey, prompt, 300);
    
    let headlines;
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      headlines = jsonMatch ? JSON.parse(jsonMatch[0]) : ['Headline generation failed.'];
    } catch (e) {
      headlines = ['Could not generate headlines. Please try again.'];
    }

    return c.json({ headlines });
  } catch (e) {
    console.error('Headlines error:', e.message);
    return c.json({ error: 'Headline generation failed.' }, 500);
  }
});

// GET /ai-services/audio/:storyId — Get or generate TTS audio for a story
aiServices.get('/audio/:storyId', async (c) => {
  try {
    const storyId = c.req.param('storyId');
    const lang = c.req.query('lang') || 'en';

    // Check cache
    const cached = await safeDbFirst(
      c.env,
      'SELECT * FROM audio_cache WHERE story_id = ? AND language = ?',
      storyId, lang
    );
    
    if (cached) {
      return c.json({
        storyId,
        audioUrl: cached.audio_url,
        duration: cached.duration_seconds,
        language: cached.language,
        cached: true,
      });
    }

    // Get story
    const story = await safeDbFirst(
      c.env,
      'SELECT id, title, body FROM stories WHERE id = ? AND deleted = 0',
      storyId
    );
    if (!story) {
      return c.json({ error: 'Story not found.' }, 404);
    }

    const apiKey = c.env.GOOGLE_TTS_API_KEY || c.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return c.json({ error: 'TTS service not configured.' }, 503);
    }

    const textToSpeak = `${story.title}. ${(story.body || '').replace(/<[^>]*>/g, ' ')}`;
    const audioBase64 = await generateSpeech(c.env, textToSpeak, lang);

    // Store audio URL (in production, upload to R2 or Cloudflare Stream)
    // For now, return as data URL (capped at reasonable size)
    const audioUrl = `data:audio/mp3;base64,${audioBase64}`;
    const estimatedDuration = Math.ceil(textToSpeak.split(' ').length / 150 * 60);

    await safeDbRun(
      c.env,
      'INSERT INTO audio_cache (id, story_id, audio_url, duration_seconds, language, character_count) VALUES (?, ?, ?, ?, ?, ?)',
      crypto.randomUUID(), storyId, audioUrl, estimatedDuration, lang, textToSpeak.length
    );

    return c.json({
      storyId,
      audioUrl,
      duration: estimatedDuration,
      language: lang,
      cached: false,
    });
  } catch (e) {
    console.error('Audio error:', e.message);
    return c.json({ error: 'Audio generation failed.' }, 500);
  }
});

// POST /ai-services/sentiment — Analyze sentiment of text
aiServices.post('/sentiment', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { text } = body;

    if (!text) {
      return c.json({ error: 'text is required.' }, 400);
    }

    const apiKey = c.env.GEMINI_API_KEY || c.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return c.json({ error: 'AI service not configured.' }, 503);
    }

    const prompt = `Analyze the sentiment of this text. Return ONLY a JSON object with: { "sentiment": "positive|neutral|negative", "confidence": 0.0-1.0, "explanation": "one sentence" }

Text: ${text.slice(0, 3000)}`;

    const response = await callGemini(apiKey, prompt, 200);
    
    let result;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { sentiment: 'neutral', confidence: 0.5, explanation: 'Analysis unavailable.' };
    } catch (e) {
      result = { sentiment: 'neutral', confidence: 0.5, explanation: 'Analysis failed.' };
    }

    return c.json(result);
  } catch (e) {
    console.error('Sentiment error:', e.message);
    return c.json({ error: 'Sentiment analysis failed.' }, 500);
  }
});

export default aiServices;