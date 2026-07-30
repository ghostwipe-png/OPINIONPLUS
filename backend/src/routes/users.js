import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { cache } from 'hono/cache';
import { createRateLimiter } from '../middleware/rateLimit.js';

const users = new Hono();

// ⚡ LEADERBOARD ROUTE (Must be placed BEFORE /:id to prevent routing conflicts)
users.get('/leaderboard', cache({ cacheName: 'op-leaderboard', cacheControl: 'public, max-age=3600' }), async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT 
        u.id, 
        u.publisher_name, 
        u.logo_url,
        COUNT(DISTINCT s.id) as story_count,
        SUM(COALESCE(s.view_count, 0)) as total_views,
        (SELECT COUNT(*) FROM likes l JOIN stories st ON l.story_id = st.id WHERE st.author_id = u.id) as total_likes,
        (
          SUM(COALESCE(s.view_count, 0)) + 
          ((SELECT COUNT(*) FROM likes l JOIN stories st ON l.story_id = st.id WHERE st.author_id = u.id) * 5)
        ) as impact_score
      FROM users u
      JOIN stories s ON u.id = s.author_id
      WHERE s.deleted = 0 AND s.privacy = 'public'
      GROUP BY u.id
      ORDER BY impact_score DESC
      LIMIT 100
    `).all();

    return c.json({ leaderboard: results });
  } catch (e) {
    console.error('Leaderboard error:', e);
    return c.json({ error: 'Failed to load leaderboard' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// NOTE ON ROUTE ORDERING: All literal-segment routes below
// are registered BEFORE the generic /:id route.
// ═══════════════════════════════════════════════════════════

// ---------- Language Preference ----------
users.patch('/me/language', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const lang = String(body.language || 'en').trim().slice(0, 5).toLowerCase();

    // Simple validation: 2-5 char language code
    if (!/^[a-z]{2,5}(-[A-Z]{2})?$/.test(lang)) {
      return c.json({ error: 'Invalid language code.' }, 400);
    }

    await c.env.DB.prepare('UPDATE users SET preferred_language = ? WHERE id = ?')
      .bind(lang, user.id)
      .run();

    return c.json({ ok: true, language: lang });
  } catch (e) {
    console.error('Language update error:', e.message);
    return c.json({ error: 'Failed to update language preference.' }, 500);
  }
});

users.patch('/me/ui-language', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const lang = String(body.language || 'en').trim().slice(0, 5).toLowerCase();

    if (!/^[a-z]{2,5}(-[A-Z]{2})?$/.test(lang)) {
      return c.json({ error: 'Invalid language code.' }, 400);
    }

    await c.env.DB.prepare('UPDATE users SET preferred_ui_language = ? WHERE id = ?')
      .bind(lang, user.id)
      .run();

    return c.json({ ok: true, uiLanguage: lang });
  } catch (e) {
    console.error('UI language update error:', e.message);
    return c.json({ error: 'Failed to update UI language preference.' }, 500);
  }
});

users.get('/me/language', requireAuth, async (c) => {
  const user = c.get('user');
  return c.json({
    contentLanguage: user.preferred_language || 'en',
    uiLanguage: user.preferred_ui_language || 'en',
  });
});

// ---------- 6. Cover image ----------
users.patch('/me/cover-image', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const coverImage = String(body.coverImage ?? body.cover_image ?? '').trim().slice(0, 1000);

    if (coverImage && !/^https?:\/\//i.test(coverImage)) {
      return c.json({ error: 'Invalid cover image URL.' }, 400);
    }

    await c.env.DB.prepare('UPDATE users SET cover_image = ? WHERE id = ?')
      .bind(coverImage || null, user.id)
      .run();

    return c.json({ ok: true, coverImage: coverImage || null });
  } catch (e) {
    console.error('Cover image update error:', e.message);
    return c.json({ error: 'Failed to update cover image.' }, 500);
  }
});

// ---------- 5. Pinned / featured story ----------
users.post('/me/pin-story', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const storyId = String(body.story_id || body.storyId || '').trim();

    if (!storyId) {
      return c.json({ error: 'story_id is required.' }, 400);
    }

    const story = await c.env.DB.prepare(
      'SELECT id, author_id, deleted FROM stories WHERE id = ?'
    ).bind(storyId).first();

    if (!story || story.deleted) {
      return c.json({ error: 'Story not found.' }, 404);
    }
    if (story.author_id !== user.id) {
      return c.json({ error: 'You can only pin your own stories.' }, 403);
    }

    await c.env.DB.prepare(
      `INSERT INTO pinned_stories (user_id, story_id, pinned_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET story_id = excluded.story_id, pinned_at = excluded.pinned_at`
    ).bind(user.id, storyId).run();

    return c.json({ ok: true, pinnedStoryId: storyId });
  } catch (e) {
    console.error('Pin story error:', e.message);
    return c.json({ error: 'Failed to pin story.' }, 500);
  }
});

users.delete('/me/pin-story', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    await c.env.DB.prepare('DELETE FROM pinned_stories WHERE user_id = ?')
      .bind(user.id)
      .run();
    return c.json({ ok: true });
  } catch (e) {
    console.error('Unpin story error:', e.message);
    return c.json({ error: 'Failed to unpin story.' }, 500);
  }
});

users.get('/me/pinned-story', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const pin = await c.env.DB.prepare(
      'SELECT story_id FROM pinned_stories WHERE user_id = ?'
    ).bind(user.id).first();

    if (!pin) return c.json({ story: null });

    const story = await c.env.DB.prepare(
      'SELECT * FROM stories WHERE id = ? AND deleted = 0'
    ).bind(pin.story_id).first();

    return c.json({ story: story || null });
  } catch (e) {
    console.error('Get pinned story error:', e.message);
    return c.json({ error: 'Failed to load pinned story.' }, 500);
  }
});

users.get('/:id/pinned-story', async (c) => {
  try {
    const publisherId = c.req.param('id');
    const pin = await c.env.DB.prepare(
      'SELECT story_id FROM pinned_stories WHERE user_id = ?'
    ).bind(publisherId).first();

    if (!pin) return c.json({ story: null });

    const story = await c.env.DB.prepare(
      "SELECT * FROM stories WHERE id = ? AND deleted = 0 AND privacy = 'public'"
    ).bind(pin.story_id).first();

    return c.json({ story: story || null });
  } catch (e) {
    console.error('Get publisher pinned story error:', e.message);
    return c.json({ error: 'Failed to load featured story.' }, 500);
  }
});

// ---------- 9. Badges & achievements ----------
users.get('/me/badges', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const { results } = await c.env.DB.prepare(
      'SELECT id, badge_type, badge_label, badge_icon, category, awarded_at FROM user_badges WHERE user_id = ? ORDER BY awarded_at DESC'
    ).bind(user.id).all();
    return c.json({ badges: results || [] });
  } catch (e) {
    console.error('Get badges error:', e.message);
    return c.json({ error: 'Failed to load badges.' }, 500);
  }
});

users.get('/:id/badges', async (c) => {
  try {
    const publisherId = c.req.param('id');
    const { results } = await c.env.DB.prepare(
      'SELECT id, badge_type, badge_label, badge_icon, category, awarded_at FROM user_badges WHERE user_id = ? ORDER BY awarded_at DESC'
    ).bind(publisherId).all();
    return c.json({ badges: results || [] });
  } catch (e) {
    console.error('Get publisher badges error:', e.message);
    return c.json({ error: 'Failed to load badges.' }, 500);
  }
});

// ---------- 13. Content export (CSV) ----------
function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

users.get('/me/export-content', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const { results } = await c.env.DB.prepare(`
      SELECT
        s.id,
        s.title,
        s.type,
        s.created_at,
        COALESCE(s.view_count, 0) as view_count,
        (SELECT COUNT(*) FROM likes l WHERE l.story_id = s.id) as like_count,
        (SELECT COUNT(*) FROM comments cm WHERE cm.story_id = s.id) as comment_count
      FROM stories s
      WHERE s.author_id = ? AND s.deleted = 0
      ORDER BY s.created_at DESC
    `).bind(user.id).all();

    const header = ['Title', 'Type', 'Date', 'Views', 'Likes', 'Comments'];
    const rows = (results || []).map((r) => [
      csvEscape(r.title),
      csvEscape(r.type || 'story'),
      csvEscape(r.created_at),
      csvEscape(r.view_count),
      csvEscape(r.like_count),
      csvEscape(r.comment_count),
    ].join(','));

    const csv = [header.join(','), ...rows].join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="my-content-export.csv"`,
      },
    });
  } catch (e) {
    console.error('Export content error:', e.message);
    return c.json({ error: 'Failed to export content.' }, 500);
  }
});

// ---------- 12. Reader insights (owner only) ----------
users.get('/me/reader-insights', requireAuth, async (c) => {
  try {
    const user = c.get('user');

    const topReaders = await c.env.DB.prepare(`
      SELECT
        u2.id, u2.publisher_name,
        COUNT(DISTINCT l.id) as like_count,
        COUNT(DISTINCT cm.id) as comment_count,
        (COUNT(DISTINCT l.id) + COUNT(DISTINCT cm.id)) as engagement_score
      FROM users u2
      LEFT JOIN likes l ON l.user_id = u2.id AND l.story_id IN (SELECT id FROM stories WHERE author_id = ?)
      LEFT JOIN comments cm ON cm.user_id = u2.id AND cm.story_id IN (SELECT id FROM stories WHERE author_id = ?)
      WHERE u2.id != ?
      GROUP BY u2.id
      HAVING engagement_score > 0
      ORDER BY engagement_score DESC
      LIMIT 5
    `).bind(user.id, user.id, user.id).all().catch(() => ({ results: [] }));

    const viewsOverTime = await c.env.DB.prepare(`
      SELECT date(sv.viewed_at) as day, COUNT(*) as views
      FROM story_views sv
      JOIN stories s ON sv.story_id = s.id
      WHERE s.author_id = ? AND sv.viewed_at >= datetime('now', '-30 days')
      GROUP BY day
      ORDER BY day ASC
    `).bind(user.id).all().catch(() => ({ results: [] }));

    const geography = await c.env.DB.prepare(`
      SELECT sv.region, COUNT(*) as views
      FROM story_views sv
      JOIN stories s ON sv.story_id = s.id
      WHERE s.author_id = ? AND sv.region IS NOT NULL AND sv.region != ''
      GROUP BY sv.region
      ORDER BY views DESC
      LIMIT 10
    `).bind(user.id).all().catch(() => ({ results: [] }));

    return c.json({
      topReaders: topReaders.results || [],
      viewsOverTime: viewsOverTime.results || [],
      geography: geography.results || [],
    });
  } catch (e) {
    console.error('Reader insights error:', e.message);
    return c.json({ error: 'Failed to load reader insights.' }, 500);
  }
});

// ---------- 15. Endorsements ----------
users.post('/:id/endorse', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const endorsedUserId = c.req.param('id');

    if (endorsedUserId === user.id) {
      return c.json({ error: 'You cannot endorse yourself.' }, 400);
    }

    const body = await c.req.json().catch(() => ({}));
    const topic = String(body.topic || '').trim().slice(0, 60).replace(/<[^>]*>/g, '');
    if (!topic) {
      return c.json({ error: 'A topic is required to endorse.' }, 400);
    }

    const limiter = createRateLimiter(c.env.DB, 3600, 20);
    const allowed = await limiter(user.id, 'endorse');
    if (!allowed) {
      return c.json({ error: 'Too many endorsements. Please try later.' }, 429);
    }

    const target = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(endorsedUserId).first();
    if (!target) {
      return c.json({ error: 'Publisher not found.' }, 404);
    }

    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO user_endorsements (id, endorser_id, endorsed_user_id, topic) VALUES (?, ?, ?, ?)`
    ).bind(id, user.id, endorsedUserId, topic).run();

    return c.json({ ok: true });
  } catch (e) {
    console.error('Endorse error:', e.message);
    return c.json({ error: 'Failed to save endorsement.' }, 500);
  }
});

users.delete('/:id/endorse', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const endorsedUserId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const topic = String(body.topic || '').trim().slice(0, 60);

    if (!topic) {
      return c.json({ error: 'A topic is required to remove an endorsement.' }, 400);
    }

    await c.env.DB.prepare(
      'DELETE FROM user_endorsements WHERE endorser_id = ? AND endorsed_user_id = ? AND topic = ?'
    ).bind(user.id, endorsedUserId, topic).run();

    return c.json({ ok: true });
  } catch (e) {
    console.error('Remove endorsement error:', e.message);
    return c.json({ error: 'Failed to remove endorsement.' }, 500);
  }
});

users.get('/:id/endorsements', async (c) => {
  try {
    const publisherId = c.req.param('id');
    const { results } = await c.env.DB.prepare(`
      SELECT ue.topic, ue.created_at, u.id as endorser_id, u.publisher_name as endorser_name
      FROM user_endorsements ue
      JOIN users u ON ue.endorser_id = u.id
      WHERE ue.endorsed_user_id = ?
      ORDER BY ue.created_at DESC
      LIMIT 50
    `).bind(publisherId).all();
    return c.json({ endorsements: results || [] });
  } catch (e) {
    console.error('Get endorsements error:', e.message);
    return c.json({ error: 'Failed to load endorsements.' }, 500);
  }
});

// ---------- 11. Collaborations ----------
users.get('/:id/collaborations', async (c) => {
  try {
    const publisherId = c.req.param('id');
    const { results } = await c.env.DB.prepare(`
      SELECT s.id as story_id, s.title, u.id as collaborator_id, u.publisher_name as collaborator_name
      FROM collaborations c2
      JOIN stories s ON c2.story_id = s.id
      JOIN users u ON c2.collaborator_id = u.id
      WHERE s.author_id = ? AND s.deleted = 0
      ORDER BY s.created_at DESC
    `).bind(publisherId).all().catch(() => ({ results: [] }));
    return c.json({ collaborations: results || [] });
  } catch (e) {
    console.error('Get collaborations error:', e.message);
    return c.json({ error: 'Failed to load collaborations.' }, 500);
  }
});

users.get('/:id', async (c) => {
  const row = await c.env.DB.prepare(
    'SELECT id, publisher_name, logo_url, bio, social_link, cover_image, tier, preferred_language, preferred_ui_language, suspended, created_at FROM users WHERE id = ?'
  )
    .bind(c.req.param('id'))
    .first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  const followers = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM follows WHERE publisher_id = ?')
    .bind(row.id)
    .first();
  return c.json({ user: { ...row, followerCount: followers.n } });
});

users.patch('/me', requireAuth, async (c) => {
  const user = c.get('user');

  const limiter = createRateLimiter(c.env.DB, 3600, 10);
  const allowed = await limiter(user.id, 'user:profile_edit');
  if (!allowed) {
    return c.json({ error: 'Too many profile edits. Please wait before trying again.' }, 429);
  }

  const body = await c.req.json();
  
  const publisherName = String(body.publisherName ?? user.publisher_name ?? '').trim().slice(0, 100).replace(/<[^>]*>/g, '');
  const bio = String(body.bio ?? user.bio ?? '').trim().slice(0, 500).replace(/<[^>]*>/g, '');
  const socialLink = String(body.socialLink ?? user.social_link ?? '').trim().slice(0, 500);
  const logoUrl = body.logoUrl ?? user.logo_url;
  const coverImage = body.coverImage ?? body.cover_image ?? user.cover_image ?? null;
  
  await c.env.DB.prepare(
    'UPDATE users SET publisher_name = ?, logo_url = ?, bio = ?, social_link = ?, cover_image = ? WHERE id = ?'
  )
    .bind(
      publisherName,
      logoUrl,
      bio,
      socialLink,
      coverImage,
      user.id
    )
    .run();
  return c.json({ ok: true });
});

users.post('/:id/follow', requireAuth, async (c) => {
  const user = c.get('user');

  const limiter = createRateLimiter(c.env.DB, 3600, 30);
  const allowed = await limiter(user.id, 'user:follow');
  if (!allowed) {
    return c.json({ error: 'Too many follow actions. Please slow down.' }, 429);
  }

  const publisherId = c.req.param('id');
  const existing = await c.env.DB.prepare(
    'SELECT 1 FROM follows WHERE follower_id = ? AND publisher_id = ?'
  )
    .bind(user.id, publisherId)
    .first();
  if (existing) {
    await c.env.DB.prepare('DELETE FROM follows WHERE follower_id = ? AND publisher_id = ?')
      .bind(user.id, publisherId)
      .run();
    return c.json({ following: false });
  }
  await c.env.DB.prepare('INSERT INTO follows (follower_id, publisher_id) VALUES (?, ?)')
    .bind(user.id, publisherId)
    .run();
  return c.json({ following: true });
});

users.post('/:id/subscribe', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const limiter = createRateLimiter(c.env.DB, 3600, 10);
  const allowed = await limiter(ip, 'subscribe');
  if (!allowed) return c.json({ error: 'Too many subscription attempts. Please try later.' }, 429);

  const publisherId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return c.json({ error: 'Please provide a valid email address.' }, 400);
  }

  try {
    const publisher = await c.env.DB.prepare('SELECT id, publisher_name FROM users WHERE id = ?').bind(publisherId).first();
    if (!publisher) {
      return c.json({ error: 'Publisher not found.' }, 404);
    }

    const id = crypto.randomUUID();
    
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO publisher_subscribers (id, publisher_id, email) VALUES (?, ?, ?)`
    ).bind(id, publisherId, email).run();

    return c.json({ 
      ok: true, 
      message: `Successfully subscribed to ${publisher.publisher_name}'s masthead!` 
    });
  } catch (e) {
    console.error('Masthead subscription error:', e.message);
    return c.json({ error: 'Failed to process subscription. Please try again later.' }, 500);
  }
});

export default users;