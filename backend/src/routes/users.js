import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';

const users = new Hono();

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

export default users;
