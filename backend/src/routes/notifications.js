import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';

const notifications = new Hono();

// ⚡ POST /notifications/subscribe - Advanced saving with strict payload validation
notifications.post('/subscribe', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const subscription = await c.req.json();

    // Strict validation to prevent malformed rows from incomplete browser APIs
    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return c.json({ error: 'Malformed push subscription payload.' }, 400);
    }

    // INSERT OR REPLACE safely handles unique constraints (usually bound to endpoint or user_id)
    await c.env.DB.prepare(
      'INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)'
    ).bind(
      user.id,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth
    ).run();

    return c.json({ ok: true, message: 'Device subscribed successfully.' });
  } catch (e) {
    console.error('Subscription save failed:', e.message);
    return c.json({ error: 'Internal server error during subscription.' }, 500);
  }
});

// ⚡ POST /notifications/unsubscribe - Safe multi-device removal
notifications.post('/unsubscribe', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    
    // Safely parse body if provided (allows specific device unsubscription in the future)
    const body = await c.req.json().catch(() => ({}));

    if (body.endpoint) {
      // Delete only the specific device
      await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
        .bind(user.id, body.endpoint).run();
    } else {
      // Fallback: Delete all subscriptions for the user (matches current frontend behavior)
      await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ?')
        .bind(user.id).run();
    }

    return c.json({ ok: true, message: 'Device unsubscribed.' });
  } catch (e) {
    console.error('Subscription removal failed:', e.message);
    return c.json({ error: 'Internal server error during unsubscription.' }, 500);
  }
});

// ⚡ GET /notifications/status - Optimized tracking
notifications.get('/status', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    
    // Use SELECT 1 for faster checking rather than pulling full endpoint/key payloads
    const sub = await c.env.DB.prepare('SELECT 1 FROM push_subscriptions WHERE user_id = ? LIMIT 1')
      .bind(user.id)
      .first();

    return c.json({ subscribed: !!sub });
  } catch (e) {
    console.error('Subscription status check failed:', e.message);
    // Fail gracefully: return false instead of a 500 error to prevent frontend console spam
    return c.json({ subscribed: false });
  }
});

export default notifications;