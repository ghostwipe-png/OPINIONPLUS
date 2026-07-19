import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';

const notifications = new Hono();

// Save push subscription
notifications.post('/subscribe', requireAuth, async (c) => {
  const user = c.get('user');
  const subscription = await c.req.json();

  await c.env.DB.prepare(
    'INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)'
  ).bind(user.id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth).run();

  return c.json({ ok: true });
});

// Unsubscribe
notifications.post('/unsubscribe', requireAuth, async (c) => {
  const user = c.get('user');
  await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').bind(user.id).run();
  return c.json({ ok: true });
});

// Check subscription status
notifications.get('/status', requireAuth, async (c) => {
  const user = c.get('user');
  const sub = await c.env.DB.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').bind(user.id).first();
  return c.json({ subscribed: !!sub });
});

export default notifications;