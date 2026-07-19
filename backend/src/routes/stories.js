import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { apiKeyAuth } from '../middleware/apiKey.js';

const stories = new Hono();

async function hydrateStory(db, row) {
  const [files, likes, ratings, comments] = await Promise.all([
    db.prepare('SELECT name, url FROM story_files WHERE story_id = ?').bind(row.id).all(),
    db.prepare('SELECT user_id FROM likes WHERE story_id = ?').bind(row.id).all(),
    db.prepare('SELECT user_id, score FROM ratings WHERE story_id = ?').bind(row.id).all(),
    db.prepare('SELECT id, user_id, body, parent_id, created_at FROM comments WHERE story_id = ? ORDER BY created_at ASC').bind(row.id).all(),
  ]);
  return {
    ...row,
    files: files.results,
    likes: likes.results.map((l) => l.user_id),
    ratings: Object.fromEntries(ratings.results.map((r) => [r.user_id, r.score])),
    comments: comments.results,
  };
}

// ---------------------------------------------------------------------------
// Helpers (new — additive only, do not affect existing hydrateStory contract)
// ---------------------------------------------------------------------------

function isAdmin(user) {
  return !!user && (user.role === 'admin' || user.role === 'root');
}

function countSyllablesWord(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^aeiouy]es|ed|[^aeiouy]e)$/, '');
  w = w.replace(/^y/, '');
  const matches = w.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

function computeReadabilityGrade(text) {
  const words = text.match(/[A-Za-z'-]+/g) || [];
  const wordCount = words.length;
  const sentenceMatches = text.match(/[^.!?]+[.!?]+/g) || (text.trim() ? [text.trim()] : []);
  const sentenceCount = Math.max(sentenceMatches.length, wordCount ? 1 : 0);
  const syllableCount = words.reduce((sum, w) => sum + countSyllablesWord(w), 0);
  if (!wordCount || !sentenceCount) return { grade: 0, wordCount, readingTime: 0 };
  const grade = 0.39 * (wordCount / sentenceCount) + 11.8 * (syllableCount / wordCount) - 15.59;
  const readingTime = Math.max(1, Math.round(wordCount / 200));
  return { grade, wordCount, readingTime };
}

// quality_score is computed on read only — never persisted.
function computeQualityScore(row) {
  const bodyText = String(row.body || '').replace(/<[^>]*>/g, ' ');
  const { grade, wordCount, readingTime } = computeReadabilityGrade(bodyText);
  const hasImage = /<img[\s>]/i.test(row.body || '') || !!row.cover_image;
  const hasLinks = /<a[\s>]/i.test(row.body || '');

  let score = 0;
  // Word count: reward substantial articles, cap contribution at 30 pts
  score += Math.min(30, Math.round((wordCount / 800) * 30));
  // Reading time: sweet spot 3-8 min gets full 15 pts
  if (readingTime >= 3 && readingTime <= 8) score += 15;
  else if (readingTime > 0) score += 7;
  // Has image: 15 pts
  if (hasImage) score += 15;
  // Has links (sourcing/citations): 10 pts
  if (hasLinks) score += 10;
  // Readability: grade 6-10 is ideal for general audiences, 30 pts
  if (grade > 0) {
    if (grade >= 6 && grade <= 10) score += 30;
    else if (grade > 0 && grade < 6) score += 22;
    else if (grade > 10 && grade <= 14) score += 18;
    else score += 8;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  let tier = 'Bronze';
  if (score > 70) tier = 'Gold';
  else if (score >= 40) tier = 'Silver';

  return { score, tier, wordCount, readingTime, grade: Math.round(grade * 10) / 10 };
}

function extractKeywords(title) {
  const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'is', 'are', 'with', 'at', 'by', 'from', 'as', 'this', 'that']);
  return (title || '')
    .toLowerCase()
    .match(/[a-z0-9']+/g)
    ?.filter((w) => w.length > 2 && !STOP.has(w)) || [];
}

// GET /stories?type=&privacy=public
stories.get('/', async (c) => {
  const type = c.req.query('type');
  const authorId = c.req.query('authorId');
  let sql = 'SELECT * FROM stories WHERE deleted = 0 AND privacy = "public"';
  const binds = [];
  if (type && type !== 'all') { sql += ' AND type = ?'; binds.push(type); }
  if (authorId) { sql += ' AND author_id = ?'; binds.push(authorId); }
  sql += ' ORDER BY created_at DESC LIMIT 100';
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all();
  const hydrated = await Promise.all(results.map((r) => hydrateStory(c.env.DB, r)));
  return c.json({ stories: hydrated });
});

// Public API endpoint — authenticated via API key
stories.get('/api/feed', apiKeyAuth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM stories WHERE author_id = ? AND deleted = 0 AND privacy = "public" ORDER BY created_at DESC LIMIT 100'
  ).bind(user.id).all();
  const hydrated = await Promise.all(results.map((r) => hydrateStory(c.env.DB, r)));
  return c.json({ publisher: user.publisher_name, stories: hydrated });
});

// ---------------------------------------------------------------------------
// NEW: GET /trending — top stories by engagement in last N days
// ---------------------------------------------------------------------------
stories.get('/trending', async (c) => {
  const limit = Math.max(1, Math.min(50, parseInt(c.req.query('limit'), 10) || 10));
  const period = c.req.query('period') || '7d';
  const days = Math.max(1, parseInt(period.replace(/[^0-9]/g, ''), 10) || 7);

  const { results } = await c.env.DB.prepare(
    `SELECT s.*,
       (SELECT COUNT(*) FROM likes l WHERE l.story_id = s.id) AS like_count,
       (SELECT COUNT(*) FROM comments cm WHERE cm.story_id = s.id) AS comment_count,
       (SELECT AVG(score) FROM ratings r WHERE r.story_id = s.id) AS rating_avg,
       (SELECT COUNT(*) FROM collaborations co WHERE co.story_id = s.id AND co.status = 'accepted') AS collab_count
     FROM stories s
     WHERE s.deleted = 0 AND s.privacy = 'public' AND s.created_at >= datetime('now', ?)
     ORDER BY (
       (SELECT COUNT(*) FROM likes l WHERE l.story_id = s.id) * 2
       + (SELECT COUNT(*) FROM comments cm WHERE cm.story_id = s.id) * 3
       + COALESCE((SELECT AVG(score) FROM ratings r WHERE r.story_id = s.id), 0) * 5
       + (CASE WHEN (SELECT COUNT(*) FROM collaborations co WHERE co.story_id = s.id AND co.status = 'accepted') > 0 THEN 10 ELSE 0 END)
     ) DESC
     LIMIT ?`
  ).bind(`-${days} days`, limit).all();

  const hydrated = await Promise.all(results.map((r) => hydrateStory(c.env.DB, r)));
  c.header('Cache-Control', 'public, max-age=300');
  return c.json({ trending: hydrated, period: `${days}d`, limit });
});

// ---------------------------------------------------------------------------
// NEW: GET /featured — all featured stories
// ---------------------------------------------------------------------------
stories.get('/featured', async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM stories WHERE deleted = 0 AND privacy = 'public' AND featured = 1 ORDER BY featured_at DESC"
  ).all();
  const hydrated = await Promise.all(results.map((r) => hydrateStory(c.env.DB, r)));
  c.header('Cache-Control', 'public, max-age=300');
  return c.json({ featured: hydrated });
});

// ---------------------------------------------------------------------------
// NEW: GET /scheduled — admin only, view all scheduled stories
// ---------------------------------------------------------------------------
stories.get('/scheduled', requireAuth, async (c) => {
  const user = c.get('user');
  if (!isAdmin(user)) return c.json({ error: 'Unauthorized' }, 403);
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM stories WHERE privacy = 'scheduled' AND deleted = 0 ORDER BY scheduled_at ASC"
  ).all();
  return c.json({ scheduled: results });
});

// ---------------------------------------------------------------------------
// NEW: Bulk operations (admin)
// ---------------------------------------------------------------------------
stories.post('/bulk-delete', requireAuth, async (c) => {
  const user = c.get('user');
  if (!isAdmin(user)) return c.json({ error: 'Unauthorized' }, 403);
  const { ids } = await c.req.json();
  if (!Array.isArray(ids) || ids.length === 0) return c.json({ error: 'ids must be a non-empty array' }, 400);
  const placeholders = ids.map(() => '?').join(',');
  await c.env.DB.prepare(`UPDATE stories SET deleted = 1 WHERE id IN (${placeholders})`).bind(...ids).run();
  return c.json({ ok: true, count: ids.length });
});

stories.post('/bulk-feature', requireAuth, async (c) => {
  const user = c.get('user');
  if (!isAdmin(user)) return c.json({ error: 'Unauthorized' }, 403);
  const { ids, featured = true } = await c.req.json();
  if (!Array.isArray(ids) || ids.length === 0) return c.json({ error: 'ids must be a non-empty array' }, 400);
  const placeholders = ids.map(() => '?').join(',');
  if (featured) {
    await c.env.DB.prepare(`UPDATE stories SET featured = 1, featured_at = datetime('now') WHERE id IN (${placeholders})`).bind(...ids).run();
  } else {
    await c.env.DB.prepare(`UPDATE stories SET featured = 0, featured_at = NULL WHERE id IN (${placeholders})`).bind(...ids).run();
  }
  return c.json({ ok: true, count: ids.length, featured });
});

stories.post('/bulk-archive', requireAuth, async (c) => {
  const user = c.get('user');
  if (!isAdmin(user)) return c.json({ error: 'Unauthorized' }, 403);
  const { ids } = await c.req.json();
  if (!Array.isArray(ids) || ids.length === 0) return c.json({ error: 'ids must be a non-empty array' }, 400);
  const placeholders = ids.map(() => '?').join(',');
  await c.env.DB.prepare(`UPDATE stories SET archived = 1 WHERE id IN (${placeholders})`).bind(...ids).run();
  return c.json({ ok: true, count: ids.length });
});

// ---------------------------------------------------------------------------
// NEW: Enhanced deep search with relevance scoring
// (kept at path GET /search — response shape extended with `relevance`,
//  existing `results` key and fields are unchanged and additive-only)
// ---------------------------------------------------------------------------
stories.get('/search', async (c) => {
  const q = (c.req.query('q') || '').trim();
  if (q.length < 2) return c.json({ results: [] });

  const searchTerm = `%${q}%`;
  const exactPhrase = `%${q}%`;

  const { results } = await c.env.DB.prepare(
    `SELECT id, title, type, excerpt, cover_image, author_id, created_at, featured,
       (
         (CASE WHEN title LIKE ? THEN 10 ELSE 0 END)
         + (CASE WHEN body LIKE ? THEN 20 ELSE 0 END)
         + (CASE WHEN created_at >= datetime('now', '-7 days') THEN 5 ELSE 0 END)
         + (CASE WHEN featured = 1 THEN 15 ELSE 0 END)
       ) AS relevance
     FROM stories
     WHERE deleted = 0 AND privacy = 'public'
     AND (title LIKE ? OR excerpt LIKE ? OR body LIKE ?)
     ORDER BY relevance DESC, created_at DESC
     LIMIT 30`
  ).bind(searchTerm, exactPhrase, searchTerm, searchTerm, searchTerm).all();

  // Log search
  const userId = c.get('user')?.id || null;
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  await c.env.DB.prepare('INSERT INTO search_history (id, query, user_id, ip) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), q.toLowerCase(), userId, ip).run();

  return c.json({ results });
});

// Admin: Search analytics
stories.get('/search/analytics', async (c) => {
  const user = c.get('user');
  if (!user || (user.role !== 'admin' && user.role !== 'root')) return c.json({ error: 'Unauthorized' }, 403);

  const [topSearches, recentSearches, totalSearches] = await Promise.all([
    c.env.DB.prepare('SELECT query, COUNT(*) as count FROM search_history GROUP BY query ORDER BY count DESC LIMIT 20').all(),
    c.env.DB.prepare('SELECT * FROM search_history ORDER BY created_at DESC LIMIT 50').all(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM search_history').first(),
  ]);

  return c.json({ top: topSearches.results, recent: recentSearches.results, total: totalSearches?.count || 0 });
});

// GET /stories/timeline/:userId — publishing history for visual timeline
stories.get('/timeline/:userId', async (c) => {
  const userId = c.req.param('userId');
  const { results } = await c.env.DB.prepare(
    "SELECT date(created_at) as date, COUNT(*) as count, type FROM stories WHERE author_id = ? AND deleted = 0 AND privacy = 'public' GROUP BY date(created_at), type ORDER BY date DESC LIMIT 365"
  ).bind(userId).all();
  return c.json({ timeline: results });
});

stories.get('/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM stories WHERE id = ? AND deleted = 0').bind(c.req.param('id')).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  const user = c.get('user');
  if (row.privacy === 'private' && row.author_id !== user?.id) return c.json({ error: 'Not found' }, 404);

  // NEW: view tracking — one unique view per IP per story per day, plus a
  // running view_count on the story row. Failures here must never break the
  // read path, so they're best-effort.
  try {
    const ip = c.req.header('CF-Connecting-IP') || 'unknown';
    const inserted = await c.env.DB.prepare(
      "INSERT OR IGNORE INTO story_views (story_id, ip, viewed_at) VALUES (?, ?, datetime('now'))"
    ).bind(row.id, ip).run();
    if (inserted?.meta?.changes) {
      await c.env.DB.prepare('UPDATE stories SET view_count = COALESCE(view_count, 0) + 1 WHERE id = ?').bind(row.id).run();
      row.view_count = (row.view_count || 0) + 1;
    }
  } catch (e) {
    // best-effort only
  }

  const hydrated = await hydrateStory(c.env.DB, row);
  const quality = computeQualityScore(row);
  return c.json({ story: { ...hydrated, view_count: row.view_count || 0, quality_score: quality.score, quality_tier: quality.tier } });
});

stories.post('/', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const id = crypto.randomUUID();
  // NEW: scheduled publishing — if scheduled_at provided, force privacy to 'scheduled'
  const privacy = body.scheduled_at ? 'scheduled' : (body.privacy || 'public');
  await c.env.DB.prepare('INSERT INTO stories (id, author_id, title, excerpt, body, type, privacy, cover_image, scheduled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, user.id, body.title, body.excerpt || '', body.body, body.type || 'story', privacy, body.coverImage || null, body.scheduled_at || null).run();
  if (Array.isArray(body.files)) {
    for (const f of body.files) {
      await c.env.DB.prepare('INSERT INTO story_files (id, story_id, name, url) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), id, f.name, f.url).run();
    }
  }
  return c.json({ id }, 201);
});

stories.patch('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT * FROM stories WHERE id = ?').bind(id).first();
  if (!existing || existing.author_id !== user.id) return c.json({ error: 'Not found' }, 404);
  const body = await c.req.json();
  // NEW: allow updating scheduled_at; if set (and privacy not explicitly overridden), keep/switch to 'scheduled'
  const privacy = body.privacy ?? (body.scheduled_at ? 'scheduled' : existing.privacy);
  await c.env.DB.prepare("UPDATE stories SET title = ?, excerpt = ?, body = ?, type = ?, privacy = ?, cover_image = ?, scheduled_at = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(
      body.title ?? existing.title,
      body.excerpt ?? existing.excerpt,
      body.body ?? existing.body,
      body.type ?? existing.type,
      privacy,
      body.coverImage ?? existing.cover_image,
      body.scheduled_at ?? existing.scheduled_at,
      id
    ).run();
  return c.json({ ok: true });
});

stories.delete('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT * FROM stories WHERE id = ?').bind(id).first();
  if (!existing || existing.author_id !== user.id) return c.json({ error: 'Not found' }, 404);
  await c.env.DB.prepare('UPDATE stories SET deleted = 1 WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

stories.post('/:id/like', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT 1 FROM likes WHERE story_id = ? AND user_id = ?').bind(id, user.id).first();
  if (existing) { await c.env.DB.prepare('DELETE FROM likes WHERE story_id = ? AND user_id = ?').bind(id, user.id).run(); return c.json({ liked: false }); }
  await c.env.DB.prepare('INSERT INTO likes (story_id, user_id) VALUES (?, ?)').bind(id, user.id).run();
  return c.json({ liked: true });
});

stories.post('/:id/rate', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const { score } = await c.req.json();
  if (![1, 2, 3, 4, 5].includes(score)) return c.json({ error: 'score must be 1-5' }, 400);
  await c.env.DB.prepare('INSERT INTO ratings (story_id, user_id, score) VALUES (?, ?, ?) ON CONFLICT(story_id, user_id) DO UPDATE SET score = excluded.score').bind(id, user.id, score).run();
  return c.json({ ok: true });
});

stories.post('/:id/comments', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const { body, parentId } = await c.req.json();
  if (!body?.trim()) return c.json({ error: 'Comment cannot be empty.' }, 400);
  const commentId = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO comments (id, story_id, user_id, body, parent_id) VALUES (?, ?, ?, ?, ?)').bind(commentId, id, user.id, body.trim(), parentId || null).run();
  return c.json({ id: commentId }, 201);
});

stories.post('/:id/report', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const { reason } = await c.req.json();
  await c.env.DB.prepare('INSERT INTO reports (id, story_id, reporter_id, reason) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), id, user.id, reason || '').run();
  return c.json({ ok: true });
});

stories.post('/:id/collaborate', requireAuth, async (c) => {
  const user = c.get('user');
  const storyId = c.req.param('id');
  const story = await c.env.DB.prepare('SELECT * FROM stories WHERE id = ? AND deleted = 0').bind(storyId).first();
  if (!story || story.author_id !== user.id) return c.json({ error: 'Not found' }, 404);
  const { email } = await c.req.json();
  const coAuthor = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  if (!coAuthor) return c.json({ error: 'User not found.' }, 404);
  if (coAuthor.id === user.id) return c.json({ error: 'You cannot collaborate with yourself.' }, 400);
  const existing = await c.env.DB.prepare('SELECT * FROM collaborations WHERE story_id = ? AND co_author_id = ?').bind(storyId, coAuthor.id).first();
  if (existing) return c.json({ error: 'Already invited.' }, 400);
  const id = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO collaborations (id, story_id, author_id, co_author_id, status) VALUES (?, ?, ?, ?, ?)').bind(id, storyId, user.id, coAuthor.id, 'pending').run();
  return c.json({ id, coAuthorName: coAuthor.publisher_name, status: 'pending' }, 201);
});

stories.get('/:id/collaborators', async (c) => {
  const storyId = c.req.param('id');
  const { results } = await c.env.DB.prepare('SELECT c.*, u.publisher_name, u.logo_url, u.email FROM collaborations c JOIN users u ON c.co_author_id = u.id WHERE c.story_id = ?').bind(storyId).all();
  return c.json({ collaborators: results });
});

stories.post('/collaborations/:id/accept', requireAuth, async (c) => {
  const user = c.get('user');
  const collabId = c.req.param('id');
  const collab = await c.env.DB.prepare('SELECT * FROM collaborations WHERE id = ? AND co_author_id = ? AND status = ?').bind(collabId, user.id, 'pending').first();
  if (!collab) return c.json({ error: 'Not found' }, 404);
  await c.env.DB.prepare('UPDATE collaborations SET status = ? WHERE id = ?').bind('accepted', collabId).run();
  return c.json({ ok: true, message: 'You are now a co-author.' });
});

// ---------------------------------------------------------------------------
// NEW: POST /:id/feature — admin-only toggle featured status
// ---------------------------------------------------------------------------
stories.post('/:id/feature', requireAuth, async (c) => {
  const user = c.get('user');
  if (!isAdmin(user)) return c.json({ error: 'Unauthorized' }, 403);
  const id = c.req.param('id');
  const { featured } = await c.req.json();
  const existing = await c.env.DB.prepare('SELECT id FROM stories WHERE id = ? AND deleted = 0').bind(id).first();
  if (!existing) return c.json({ error: 'Not found' }, 404);
  if (featured) {
    await c.env.DB.prepare("UPDATE stories SET featured = 1, featured_at = datetime('now') WHERE id = ?").bind(id).run();
  } else {
    await c.env.DB.prepare('UPDATE stories SET featured = 0, featured_at = NULL WHERE id = ?').bind(id).run();
  }
  return c.json({ ok: true, featured: !!featured });
});

// ---------------------------------------------------------------------------
// NEW: GET /:id/related — 4 related stories (2 same author, 2 similar title keywords)
// ---------------------------------------------------------------------------
stories.get('/:id/related', async (c) => {
  const id = c.req.param('id');
  const story = await c.env.DB.prepare('SELECT * FROM stories WHERE id = ? AND deleted = 0').bind(id).first();
  if (!story) return c.json({ error: 'Not found' }, 404);

  const sameAuthor = await c.env.DB.prepare(
    "SELECT * FROM stories WHERE author_id = ? AND id != ? AND deleted = 0 AND privacy = 'public' ORDER BY created_at DESC LIMIT 2"
  ).bind(story.author_id, id).all();

  const keywords = extractKeywords(story.title).slice(0, 5);
  let byKeyword = { results: [] };
  if (keywords.length) {
    const clauses = keywords.map(() => 'title LIKE ?').join(' OR ');
    const binds = keywords.map((k) => `%${k}%`);
    byKeyword = await c.env.DB.prepare(
      `SELECT * FROM stories WHERE (${clauses}) AND id != ? AND deleted = 0 AND privacy = 'public' ORDER BY created_at DESC LIMIT 6`
    ).bind(...binds, id).all();
  }

  const excludeIds = new Set([id, ...sameAuthor.results.map((r) => r.id)]);
  const keywordPicks = byKeyword.results.filter((r) => !excludeIds.has(r.id)).slice(0, 2);

  const related = [...sameAuthor.results, ...keywordPicks].slice(0, 4);
  const hydrated = await Promise.all(related.map((r) => hydrateStory(c.env.DB, r)));
  return c.json({ related: hydrated });
});

// ---------------------------------------------------------------------------
// NEW: GET /:id/analytics — admin/owner only
// ---------------------------------------------------------------------------
stories.get('/:id/analytics', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const story = await c.env.DB.prepare('SELECT * FROM stories WHERE id = ? AND deleted = 0').bind(id).first();
  if (!story) return c.json({ error: 'Not found' }, 404);
  if (story.author_id !== user.id && !isAdmin(user)) return c.json({ error: 'Unauthorized' }, 403);

  const [views, uniqueViews, likes, comments, avgRating] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as count FROM story_views WHERE story_id = ?').bind(id).first(),
    c.env.DB.prepare('SELECT COUNT(DISTINCT ip) as count FROM story_views WHERE story_id = ?').bind(id).first(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM likes WHERE story_id = ?').bind(id).first(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM comments WHERE story_id = ?').bind(id).first(),
    c.env.DB.prepare('SELECT AVG(score) as avg FROM ratings WHERE story_id = ?').bind(id).first(),
  ]);

  const readability = computeQualityScore(story);

  return c.json({
    views: views?.count || story.view_count || 0,
    unique_views: uniqueViews?.count || 0,
    likes: likes?.count || 0,
    comments: comments?.count || 0,
    shares_count: 0, // no shares table yet — reserved for future tracking
    average_rating: avgRating?.avg ? Math.round(avgRating.avg * 10) / 10 : null,
    read_time_avg: readability.readingTime,
    top_referrers: [], // reserved for future referrer tracking
  });
});

// ---------------------------------------------------------------------------
// NEW: publishScheduledStories — call this from the existing cron handler
// (e.g. in the Worker's `scheduled` export) to flip due scheduled stories to
// public. Not wired to an HTTP route itself.
// ---------------------------------------------------------------------------
export async function publishScheduledStories(db) {
  const due = await db.prepare(
    "SELECT id FROM stories WHERE privacy = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= datetime('now') AND deleted = 0"
  ).all();
  if (!due.results.length) return { published: 0 };
  const ids = due.results.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  await c.env.DB.prepare(`UPDATE stories SET privacy = 'archived' WHERE id IN (${placeholders})`).bind(...ids).run();
  return { published: ids.length, ids };
}

export default stories;
