// backend/src/middleware/contentFilter.js

/**
 * Simple content filter for profanity and spam detection.
 * Used by jobs, stories, comments, and other content mutations.
 * 
 * Returns { passed: boolean, reason?: string }
 * Fail-open: if the filter errors, content is allowed through.
 */

// Common spam patterns
const SPAM_PATTERNS = [
  /\b(buy now|click here|limited offer|act now|free money|casino|lottery|winner!)\b/i,
  /\b(viagra|cialis|pharmacy|meds online)\b/i,
  /(https?:\/\/[^\s]{200,})/, // Overly long URLs
  /\b(crypto|bitcoin|investment opportunity|earn money fast|work from home earn)\b/i,
];

// Common profanity (English + Swahili — basic list, extend as needed)
const PROFANITY_WORDS = [
  'fuck', 'shit', 'ass', 'bitch', 'damn', 'bastard',
  'takataka', 'fala', 'mjinga', 'kuma', 'tumbili',
  // Add more as needed for your audience
];

const PROFANITY_REGEX = new RegExp(
  `\\b(${PROFANITY_WORDS.join('|')})\\b`,
  'i'
);

/**
 * Check content for profanity and spam.
 * @param {string} text - The content to check
 * @returns {{ passed: boolean, reason?: string }}
 */
async function check(text) {
  if (!text || typeof text !== 'string') {
    return { passed: true };
  }

  const normalized = text.toLowerCase().trim();

  // Check for profanity
  if (PROFANITY_REGEX.test(normalized)) {
    return { passed: false, reason: 'Content contains inappropriate language.' };
  }

  // Check for spam patterns
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(normalized)) {
      return { passed: false, reason: 'Content matches spam patterns.' };
    }
  }

  // Check for excessive repetition (spam indicator)
  const words = normalized.split(/\s+/);
  if (words.length > 20) {
    const wordCounts = {};
    for (const word of words) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
    const maxRepeat = Math.max(...Object.values(wordCounts));
    if (maxRepeat > words.length * 0.4) {
      return { passed: false, reason: 'Content contains excessive repetition.' };
    }
  }

  // Check for ALL CAPS ratio (spam indicator)
  const letters = normalized.replace(/[^a-z]/gi, '');
  if (letters.length > 30) {
    const upperCount = (normalized.match(/[A-Z]/g) || []).length;
    if (upperCount / letters.length > 0.7) {
      return { passed: false, reason: 'Content contains too many capital letters.' };
    }
  }

  return { passed: true };
}

export const contentFilter = { check };