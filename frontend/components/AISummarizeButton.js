// components/AISummarizeButton.js
'use client';

import { useState, useEffect, useRef } from 'react';
import { Sparkles, Loader2, ChevronDown, ChevronUp, Zap, TrendingUp, AlertTriangle, FileText, Clock } from 'lucide-react';

/* ────────────────────────────────────────────────────────────────
   LOCAL SUMMARIZATION ENGINE (no network calls, runs entirely
   in the browser)
   ──────────────────────────────────────────────────────────────── */

const ABBREVIATIONS = ['Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Prof.', 'Sr.', 'Jr.', 'St.', 'vs.', 'etc.', 'e.g.', 'i.e.', 'U.S.', 'U.K.', 'U.N.', 'Inc.', 'Ltd.', 'Co.', 'No.', 'Fig.', 'Gov.', 'Sen.', 'Rep.', 'Ave.', 'Jan.', 'Feb.', 'Mar.', 'Apr.', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'so', 'because', 'as', 'of', 'at', 'by', 'for',
  'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does',
  'did', 'doing', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'that',
  'this', 'these', 'those', 'it', 'its', 'they', 'them', 'their', 'he', 'she', 'his', 'her', 'we',
  'you', 'your', 'i', 'me', 'my', 'not', 'no', 'nor', 'than', 'too', 'very', 'just', 'also',
]);

const POSITIVE_WORDS = [
  'win', 'wins', 'won', 'success', 'successful', 'growth', 'improve', 'improved', 'celebrate',
  'launch', 'launched', 'achieve', 'achieved', 'gain', 'gains', 'boost', 'rise', 'rising', 'record',
  'breakthrough', 'innovation', 'expand', 'expansion', 'profit', 'opportunity', 'promising',
  'optimistic', 'recovery', 'milestone', 'thrive', 'surge',
];

const NEGATIVE_WORDS = [
  'fail', 'failed', 'failure', 'crisis', 'loss', 'losses', 'death', 'deaths', 'attack', 'attacks',
  'protest', 'protests', 'corruption', 'decline', 'drop', 'dropped', 'crash', 'war', 'disaster',
  'bankruptcy', 'scandal', 'fraud', 'collapse', 'recession', 'violence', 'tragedy', 'emergency',
  'lawsuit', 'threat', 'controversy',
];

function hashContent(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function splitIntoSentences(text) {
  // Protect abbreviations from being treated as sentence boundaries
  let protectedText = text;
  ABBREVIATIONS.forEach((abbr, idx) => {
    const token = `__ABBR${idx}__`;
    protectedText = protectedText.split(abbr).join(token);
  });

  const rawSentences = protectedText.match(/[^.!?]+[.!?]+(\s|$)/g) || [protectedText];

  return rawSentences
    .map((s) => {
      let restored = s;
      ABBREVIATIONS.forEach((abbr, idx) => {
        const token = `__ABBR${idx}__`;
        restored = restored.split(token).join(abbr);
      });
      return restored.trim();
    })
    .filter((s) => s.length > 0);
}

function countParagraphs(rawBody) {
  const parts = (rawBody || '').split(/<\/p>|\n{2,}/i).map((p) => stripHtml(p)).filter((p) => p.length > 20);
  return Math.max(1, parts.length);
}

function scoreSentences(sentences, title) {
  const titleWords = new Set(
    (title || '')
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );

  return sentences.map((sentence, index) => {
    let score = 0;
    const words = sentence.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Position bonus
    if (index === 0) score += 2;
    else if (index === 1) score += 1.5;
    else if (index === 2) score += 1;

    // Length penalty / reward
    if (wordCount < 8 || wordCount > 50) score -= 1;
    else score += 0.5;

    // Keyword density (non-stop-word ratio)
    const meaningfulWords = words.filter((w) => !STOP_WORDS.has(w.toLowerCase().replace(/[^a-z0-9]/g, '')));
    score += Math.min(2, meaningfulWords.length / 10);

    // Title overlap bonus
    const sentenceLower = sentence.toLowerCase();
    let overlap = 0;
    titleWords.forEach((tw) => {
      if (sentenceLower.includes(tw)) overlap += 1;
    });
    score += Math.min(1.5, overlap * 0.5);

    // Named entity bonus (capitalized words mid-sentence)
    const capitalizedMidSentence = words.slice(1).filter((w) => /^[A-Z][a-z]+/.test(w));
    if (capitalizedMidSentence.length > 0) score += 0.5;

    // Numeric / statistic bonus
    if (/\d/.test(sentence) || /%/.test(sentence)) score += 0.5;

    return { sentence, index, score };
  });
}

function selectTopSentences(scored, count = 3) {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const selected = [];
  const usedIndices = [];

  for (const candidate of sorted) {
    if (selected.length >= count) break;
    const tooClose = usedIndices.some((i) => Math.abs(i - candidate.index) < 2);
    if (!tooClose || selected.length === 0) {
      selected.push(candidate);
      usedIndices.push(candidate.index);
    }
  }

  // Fill up with next best if coverage constraint left us short
  if (selected.length < count) {
    for (const candidate of sorted) {
      if (selected.length >= count) break;
      if (!selected.includes(candidate)) selected.push(candidate);
    }
  }

  // Return in original reading order for coherence
  return selected.sort((a, b) => a.index - b.index).map((s) => s.sentence);
}

function analyzeSentiment(text) {
  const lower = text.toLowerCase();
  const countMatches = (list) =>
    list.reduce((sum, word) => {
      const re = new RegExp(`\\b${word}\\b`, 'g');
      const matches = lower.match(re);
      return sum + (matches ? matches.length : 0);
    }, 0);

  const posCount = countMatches(POSITIVE_WORDS);
  const negCount = countMatches(NEGATIVE_WORDS);

  if (posCount > negCount + 1) return 'positive';
  if (negCount > posCount + 1) return 'negative';
  return 'neutral';
}

function buildStats(cleanText, rawBody, sentenceCount) {
  const words = cleanText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const readTime = Math.max(1, Math.round(wordCount / 200));
  const paragraphCount = countParagraphs(rawBody);

  return {
    wordCount,
    readTime,
    paragraphCount,
    keyTakeaway: `${wordCount.toLocaleString()} words · ${readTime} min read · covers ${paragraphCount} main topic${paragraphCount === 1 ? '' : 's'}`,
  };
}

function generateLocalSummary(rawBody, title) {
  const cleanText = stripHtml(rawBody);

  if (!cleanText || cleanText.length < 20) {
    return {
      bullets: ['Read the full story for complete details and insights.'],
      keyTakeaway: 'Summary unavailable for this story.',
      sentiment: 'neutral',
      source: 'local',
    };
  }

  const sentences = splitIntoSentences(cleanText);
  const scored = scoreSentences(sentences, title);
  const bullets = selectTopSentences(scored, 3).filter((s) => s.length > 10);
  const stats = buildStats(cleanText, rawBody, sentences.length);
  const sentiment = analyzeSentiment(cleanText);

  return {
    bullets: bullets.length > 0 ? bullets : ['Read the full story for complete details and insights.'],
    keyTakeaway: stats.keyTakeaway,
    sentiment,
    source: 'local',
  };
}

/* ────────────────────────────────────────────────────────────────
   BROWSER-NATIVE AI (window.ai / Gemini Nano, Chrome 129+)
   ──────────────────────────────────────────────────────────────── */

async function isBrowserAIAvailable() {
  try {
    if (typeof window === 'undefined') return false;
    const summarizerApi = window.ai?.summarizer ?? self.ai?.summarizer;
    if (!summarizerApi) return false;

    if (typeof summarizerApi.capabilities === 'function') {
      const capabilities = await summarizerApi.capabilities();
      return capabilities?.available && capabilities.available !== 'no';
    }
    if (typeof summarizerApi.availability === 'function') {
      const availability = await summarizerApi.availability();
      return availability && availability !== 'unavailable';
    }
    // If no capability check exists but the API is present, assume usable
    return true;
  } catch (e) {
    return false;
  }
}

async function withTimeout(promise, ms) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('timeout')), ms);
  });
  try {
    const result = await Promise.race([promise, timeout]);
    clearTimeout(timeoutId);
    return result;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

async function generateBrowserAISummary(rawBody, title) {
  const cleanText = stripHtml(rawBody);
  const summarizerApi = window.ai?.summarizer ?? self.ai?.summarizer;
  if (!summarizerApi) throw new Error('Browser AI unavailable');

  let resultText = '';

  if (typeof summarizerApi.create === 'function') {
    const summarizerInstance = await summarizerApi.create({
      sharedContext: title || '',
      type: 'key-points',
      format: 'plain-text',
      length: 'short',
    });
    resultText = await withTimeout(summarizerInstance.summarize(cleanText), 9000);
    if (typeof summarizerInstance.destroy === 'function') {
      try { summarizerInstance.destroy(); } catch (e) {}
    }
  } else if (typeof summarizerApi.summarize === 'function') {
    resultText = await withTimeout(summarizerApi.summarize(cleanText, { context: title || '' }), 9000);
  } else {
    throw new Error('No summarize method available');
  }

  if (!resultText || typeof resultText !== 'string' || resultText.trim().length < 5) {
    throw new Error('Empty summary from browser AI');
  }

  const bullets = splitIntoSentences(resultText)
    .map((s) => s.replace(/^[-•*]\s*/, '').trim())
    .filter((s) => s.length > 5)
    .slice(0, 3);

  const stats = buildStats(cleanText, rawBody, splitIntoSentences(cleanText).length);
  const sentiment = analyzeSentiment(cleanText);

  return {
    bullets: bullets.length > 0 ? bullets : [resultText.trim()],
    keyTakeaway: stats.keyTakeaway,
    sentiment,
    source: 'browser',
  };
}

/* ────────────────────────────────────────────────────────────────
   COMPONENT
   ──────────────────────────────────────────────────────────────── */

export default function AISummarizeButton({ storyId, title, body }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const [slowNotice, setSlowNotice] = useState(false);
  const slowTimerRef = useRef(null);

  const contentHash = hashContent(`${title || ''}::${body || ''}`);
  const cacheKey = `summary_${storyId}`;

  // Check cache on mount — invalidate if story content changed
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.contentHash === contentHash && parsed.data) {
          setSummary(parsed.data);
        } else {
          sessionStorage.removeItem(cacheKey);
        }
      }
    } catch (e) {
      // Corrupt cache entry — ignore and continue
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId]);

  const persistToCache = (data) => {
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ contentHash, data }));
    } catch (e) {
      // sessionStorage may be full or unavailable — non-fatal
    }
  };

  const handleSummarize = async () => {
    if (summary) {
      setExpanded(!expanded);
      return;
    }

    setLoading(true);
    setError('');
    setSlowNotice(false);

    slowTimerRef.current = setTimeout(() => setSlowNotice(true), 5000);

    let result = null;

    try {
      const browserAIReady = await isBrowserAIAvailable();
      if (browserAIReady) {
        try {
          result = await generateBrowserAISummary(body, title);
        } catch (aiError) {
          // Browser AI failed or timed out — fall through to local engine
          result = null;
        }
      }

      if (!result) {
        result = generateLocalSummary(body, title);
      }

      setSummary(result);
      setExpanded(true);
      persistToCache(result);
    } catch (fatalError) {
      // Absolute last resort — never crash, offer retry
      setError('Summary unavailable. Please try again.');
    } finally {
      clearTimeout(slowTimerRef.current);
      setSlowNotice(false);
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError('');
    handleSummarize();
  };

  const sentimentColors = {
    positive: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    neutral: 'text-ink-500 bg-ink-50 border-wire',
    negative: 'text-signal bg-red-50 border-red-200',
  };

  return (
    <div className="relative">
      <button
        onClick={handleSummarize}
        disabled={loading}
        className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-purple-600 hover:text-purple-800 transition-colors border border-purple-200 rounded-sm px-3 py-2 hover:border-purple-400 bg-purple-50/50 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Sparkles size={13} />
        )}
        {loading ? (slowNotice ? 'Taking longer than expected...' : 'Analyzing...') : summary ? (expanded ? 'Hide Summary' : 'Quick Summary') : 'Quick Summary'}
        {summary && !loading && (
          expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />
        )}
      </button>

      {/* Summary Card */}
      {summary && expanded && (
        <div className="mt-3 border border-purple-200 bg-purple-50/30 rounded-sm p-5 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Bullets */}
          <div className="space-y-2 mb-4">
            {summary.bullets?.map((bullet, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center shrink-0 mt-0.5">
                  <Zap size={11} className="text-purple-600" />
                </div>
                <p className="text-sm font-medium text-ink leading-relaxed">{bullet}</p>
              </div>
            ))}
          </div>

          {/* Key Takeaway */}
          {summary.keyTakeaway && (
            <div className="border-t border-purple-200 pt-3 mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-purple-500 mb-1 flex items-center gap-1.5">
                <FileText size={12} /> Overview
              </p>
              <p className="text-sm font-bold text-ink">{summary.keyTakeaway}</p>
            </div>
          )}

          {/* Meta Row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Sentiment Badge */}
            {summary.sentiment && (
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm border ${sentimentColors[summary.sentiment] || sentimentColors.neutral}`}>
                <TrendingUp size={10} className="inline mr-1" />
                {summary.sentiment}
              </span>
            )}

            {/* Source badge */}
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm border bg-ink-50 text-ink-500 border-wire">
              <Sparkles size={10} className="inline mr-1" />
              {summary.source === 'browser' ? 'Browser AI' : 'Smart Extract'}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 flex items-center gap-2">
          <p className="text-[11px] font-bold text-signal flex items-center gap-1">
            <AlertTriangle size={12} /> {error}
          </p>
          <button
            onClick={handleRetry}
            className="text-[11px] font-bold uppercase tracking-wider text-purple-600 hover:text-purple-800 underline"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}