import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { cache } from 'hono/cache';

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

users.get('/:id', async (c) => {
  const row = await c.env.DB.prepare(
    'SELECT id, publisher_name, logo_url, bio, social_link, suspended, created_at FROM users WHERE id = ?'
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
  const body = await c.req.json();
  await c.env.DB.prepare(
    'UPDATE users SET publisher_name = ?, logo_url = ?, bio = ?, social_link = ? WHERE id = ?'
  )
    .bind(
      body.publisherName ?? user.publisher_name,
      body.logoUrl ?? user.logo_url,
      body.bio ?? user.bio,
      body.socialLink ?? user.social_link,
      user.id
    )
    .run();
  return c.json({ ok: true });
});

users.post('/:id/follow', requireAuth, async (c) => {
  const user = c.get('user');
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

// Masthead Newsletter Subscription Route
users.post('/:id/subscribe', async (c) => {
  const publisherId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();

  if (!email || !email.includes('@') || email.length > 254) {
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