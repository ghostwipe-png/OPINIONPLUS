import { Hono } from 'hono';
import { requireAdmin, requireRoot, requirePin } from '../middleware/auth.js';

const admin = new Hono();
admin.use('*', requireAdmin);

async function log(c, action, target) {
  const user = c.get('user');
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  await c.env.DB.prepare(
    'INSERT INTO admin_logs (id, actor_email, action, target, ip) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(crypto.randomUUID(), user.email, action, target, ip)
    .run();
}

admin.get('/users', async (c) => {
  const search = c.req.query('q') || '';
  const { results } = await c.env.DB.prepare(
    `SELECT id, email, publisher_name, logo_url, suspended, created_at FROM users
     WHERE publisher_name LIKE ? OR email LIKE ? ORDER BY created_at DESC LIMIT 200`
  )
    .bind(`%${search}%`, `%${search}%`)
    .all();
  return c.json({ users: results });
});

admin.post('/users/:id/suspend', requirePin, async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE users SET suspended = 1 WHERE id = ?').bind(id).run();
  await log(c, 'suspend_user', id);
  return c.json({ ok: true });
});

admin.post('/users/:id/unsuspend', requirePin, async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE users SET suspended = 0 WHERE id = ?').bind(id).run();
  await log(c, 'unsuspend_user', id);
  return c.json({ ok: true });
});

admin.get('/stories', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM stories WHERE deleted = 0 ORDER BY created_at DESC LIMIT 200'
  ).all();
  return c.json({ stories: results });
});

admin.post('/stories/:id/block-media', requirePin, async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE stories SET media_blocked = 1 WHERE id = ?').bind(id).run();
  await log(c, 'block_media', id);
  return c.json({ ok: true });
});

admin.post('/stories/:id/unblock-media', requirePin, async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE stories SET media_blocked = 0 WHERE id = ?').bind(id).run();
  await log(c, 'unblock_media', id);
  return c.json({ ok: true });
});

admin.delete('/stories/:id', requirePin, async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE stories SET deleted = 1 WHERE id = ?').bind(id).run();
  await log(c, 'delete_post', id);
  return c.json({ ok: true });
});

admin.get('/reports', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM reports ORDER BY created_at DESC').all();
  return c.json({ reports: results });
});

admin.post('/reports/:id/resolve', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE reports SET resolved = 1 WHERE id = ?').bind(id).run();
  await log(c, 'resolve_report', id);
  return c.json({ ok: true });
});

admin.get('/logs', requireRoot, async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 500'
  ).all();
  return c.json({ logs: results });
});

// --- Root-only: manage admins ---
admin.get('/admins', requireRoot, async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM admins ORDER BY created_at DESC').all();
  return c.json({ admins: results });
});

admin.post('/admins', requireRoot, requirePin, async (c) => {
  const { email } = await c.req.json();
  const actor = c.get('user');
  await c.env.DB.prepare('INSERT OR IGNORE INTO admins (email, added_by) VALUES (?, ?)')
    .bind(email, actor.email)
    .run();
  await c.env.DB.prepare('UPDATE users SET role = ? WHERE email = ? AND role = ?')
    .bind('admin', email, 'user')
    .run();
  await log(c, 'add_admin', email);
  return c.json({ ok: true });
});

admin.delete('/admins/:email', requireRoot, requirePin, async (c) => {
  const email = c.req.param('email');
  if (email === c.env.ROOT_ADMIN_EMAIL) return c.json({ error: 'Root admin cannot be removed.' }, 400);
  await c.env.DB.prepare('DELETE FROM admins WHERE email = ?').bind(email).run();
  await c.env.DB.prepare('UPDATE users SET role = ? WHERE email = ? AND role = ?')
    .bind('user', email, 'admin')
    .run();
  await log(c, 'remove_admin', email);
  return c.json({ ok: true });
});

export default admin;
