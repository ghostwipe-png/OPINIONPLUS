import { Hono } from 'hono';
import { verifyGoogleIdToken } from '../lib/google.js';
import { createSessionToken, sessionCookieHeader, clearSessionCookieHeader } from '../lib/session.js';

const auth = new Hono();

auth.post('/google', async (c) => {
  const { id_token } = await c.req.json();
  if (!id_token) return c.json({ error: 'id_token is required.' }, 400);

  const profile = await verifyGoogleIdToken(id_token, c.env.GOOGLE_CLIENT_ID);
  if (!profile) return c.json({ error: 'Invalid Google token.' }, 401);

  const role = profile.email === c.env.ROOT_ADMIN_EMAIL ? 'root' : 'user';

  let user = await c.env.DB.prepare('SELECT * FROM users WHERE google_sub = ?')
    .bind(profile.googleSub)
    .first();

  if (!user) {
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO users (id, google_sub, email, name, publisher_name, logo_url, role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, profile.googleSub, profile.email, profile.name, profile.name, profile.picture, role)
      .run();
    user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  } else if (role === 'root' && user.role !== 'root') {
    // Promote to root if the email matches ROOT_ADMIN_EMAIL, even if it
    // registered before this env var was set.
    await c.env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind('root', user.id).run();
    user.role = 'root';
  }

  if (user.suspended) return c.json({ error: 'This account is suspended.' }, 403);

  const token = await createSessionToken(c.env.SESSION_SECRET, { userId: user.id });
  c.header('Set-Cookie', sessionCookieHeader(token));
  return c.json({ user });
});

auth.post('/logout', async (c) => {
  c.header('Set-Cookie', clearSessionCookieHeader);
  return c.json({ ok: true });
});

auth.get('/me', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ user: null });
  return c.json({ user });
});

export default auth;
