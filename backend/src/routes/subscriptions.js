import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';

const subscriptions = new Hono();

// Subscribe
subscriptions.post('/subscribe', async (c) => {
  const { email, preferences } = await c.req.json();
  
  if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return c.json({ error: 'Valid email required.' }, 400);
  }

  const prefs = ['all', 'news', 'stories', 'documentaries'].includes(preferences) ? preferences : 'all';
  
  const existing = await c.env.DB.prepare('SELECT * FROM email_subscriptions WHERE email = ?').bind(email.toLowerCase().trim()).first();
  
  if (existing) {
    // Update preferences if already subscribed
    await c.env.DB.prepare('UPDATE email_subscriptions SET preferences = ?, status = ? WHERE email = ?')
      .bind(prefs, 'active', email.toLowerCase().trim()).run();
    return c.json({ ok: true, message: 'Preferences updated!' });
  }

  const id = crypto.randomUUID();
  const confirmToken = crypto.randomUUID().slice(0, 8);
  
  await c.env.DB.prepare(
    'INSERT INTO email_subscriptions (id, email, preferences, confirm_token) VALUES (?, ?, ?, ?)'
  ).bind(id, email.toLowerCase().trim(), prefs, confirmToken).run();

  return c.json({ ok: true, message: 'Subscribed! Check your email to confirm.' });
});

// Confirm subscription
subscriptions.get('/confirm/:token', async (c) => {
  const token = c.req.param('token');
  const sub = await c.env.DB.prepare('SELECT * FROM email_subscriptions WHERE confirm_token = ?').bind(token).first();
  if (!sub) return c.json({ error: 'Invalid token.' }, 404);
  
  await c.env.DB.prepare('UPDATE email_subscriptions SET confirmed = 1, confirm_token = NULL WHERE id = ?').bind(sub.id).run();
  return c.redirect('https://www.opinionplus.online?subscribed=true');
});

// Unsubscribe
subscriptions.get('/unsubscribe/:email', async (c) => {
  const email = c.req.param('email');
  await c.env.DB.prepare('UPDATE email_subscriptions SET status = ? WHERE email = ?').bind('unsubscribed', email).run();
  return c.redirect('https://www.opinionplus.online?unsubscribed=true');
});

// Admin: Get all subscribers
subscriptions.get('/admin/list', requireAuth, async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin' && user.role !== 'root') return c.json({ error: 'Unauthorized' }, 403);
  
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM email_subscriptions ORDER BY created_at DESC'
  ).all();
  return c.json({ subscribers: results, total: results.length, active: results.filter(s => s.status === 'active').length });
});

// Admin: Export CSV
subscriptions.get('/admin/export', requireAuth, async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin' && user.role !== 'root') return c.json({ error: 'Unauthorized' }, 403);
  
  const { results } = await c.env.DB.prepare(
    'SELECT email, preferences, status, created_at FROM email_subscriptions WHERE status = ? ORDER BY created_at DESC'
  ).bind('active').all();
  
  const csv = ['Email,Preferences,Status,Date', ...results.map(r => `${r.email},${r.preferences},${r.status},${r.created_at}`)].join('\n');
  
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=subscribers.csv' },
  });
});

// Check status
subscriptions.get('/status/:email', async (c) => {
  const email = c.req.param('email');
  const sub = await c.env.DB.prepare('SELECT * FROM email_subscriptions WHERE email = ?').bind(email).first();
  return c.json({ subscribed: !!sub && sub.status === 'active', preferences: sub?.preferences || null });
});

export default subscriptions;