import { readCookie, verifySessionToken } from '../lib/session.js';

export async function attachUser(c, next) {
  const token = readCookie(c.req.raw, 'op_session');
  if (token) {
    const payload = await verifySessionToken(c.env.SESSION_SECRET, token);
    if (payload?.userId) {
      const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
        .bind(payload.userId)
        .first();
      if (user) c.set('user', user);
    }
  }
  await next();
}

export async function requireAuth(c, next) {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Sign in required.' }, 401);
  if (user.suspended) return c.json({ error: 'This account is suspended.' }, 403);
  await next();
}

export async function requireAdmin(c, next) {
  const user = c.get('user');
  if (!user) return c.notFound(); // admin routes 404 for non-admins, per spec
  const isAdmin = user.role === 'admin' || user.role === 'root';
  if (!isAdmin) return c.notFound();
  await next();
}

export async function requireRoot(c, next) {
  const user = c.get('user');
  if (!user || user.role !== 'root') return c.notFound();
  await next();
}

// Destructive admin actions require the PIN sent as X-Admin-Pin, checked
// against a SHA-256 hash stored as a secret (ADMIN_PIN_HASH).
export async function requirePin(c, next) {
  const pin = c.req.header('X-Admin-Pin');
  if (!pin) return c.json({ error: 'PIN required for this action.' }, 401);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (hex !== c.env.ADMIN_PIN_HASH) return c.json({ error: 'Incorrect PIN.' }, 401);
  await next();
}
