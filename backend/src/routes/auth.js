import { Hono } from 'hono';
import { verifyGoogleIdToken } from '../lib/google.js';
import { createSessionToken, sessionCookieHeader, clearSessionCookieHeader } from '../lib/session.js';
import { generateCsrfToken } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';

const auth = new Hono();

// --- helpers -----------------------------------------------------------

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function deviceFingerprint(userAgent, ip) {
  return sha256Hex(`${userAgent || ''}::${ip || ''}`);
}

function clientIp(c) {
  return c.req.header('CF-Connecting-IP') || 'unknown';
}

async function recordLoginAttempt(db, { userId, success, ip, userAgent, fingerprint, failureReason }) {
  try {
    await db
      .prepare(
        `INSERT INTO login_history (id, user_id, success, ip_address, user_agent, device_fingerprint, failure_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(crypto.randomUUID(), userId, success ? 1 : 0, ip, userAgent, fingerprint || null, failureReason || null)
      .run();
  } catch (e) {
    // Never let logging failures break the auth flow.
    console.error('Failed to record login attempt', e);
  }
}

async function logSecurityEvent(db, { userId, eventType, severity = 'low', detail, ip }) {
  try {
    await db
      .prepare(
        `INSERT INTO security_events (id, user_id, event_type, severity, detail, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(crypto.randomUUID(), userId, eventType, severity, detail || null, ip || null)
      .run();
  } catch (e) {
    console.error('Failed to log security event', e);
  }
}

async function upsertTrustedDevice(db, { userId, fingerprint, ip, userAgent }) {
  const existing = await db
    .prepare('SELECT * FROM trusted_devices WHERE user_id = ? AND device_fingerprint = ?')
    .bind(userId, fingerprint)
    .first();

  if (existing) {
    await db
      .prepare('UPDATE trusted_devices SET last_used_at = datetime(\'now\'), ip_address = ?, user_agent = ? WHERE id = ?')
      .bind(ip, userAgent, existing.id)
      .run();
    return { isNewDevice: false };
  }

  await db
    .prepare(
      `INSERT INTO trusted_devices (id, user_id, device_fingerprint, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), userId, fingerprint, ip, userAgent)
    .run();
  return { isNewDevice: true };
}

function requireUser(c) {
  const user = c.get('user');
  if (!user) return null;
  return user;
}

// --- routes --------------------------------------------------------------

auth.post('/google', async (c) => {
  const ip = clientIp(c);
  const userAgent = c.req.header('User-Agent') || '';

  // Rate limit: 10 login attempts per minute per IP
  const limiter = createRateLimiter(c.env.DB, 60, 10);
  const allowed = await limiter(ip, 'auth_google');
  if (!allowed) return c.json({ error: 'Too many login attempts. Please try again later.' }, 429);

  const { id_token } = await c.req.json().catch(() => ({}));
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
    await c.env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind('root', user.id).run();
    user.role = 'root';
  }

  const fingerprint = await deviceFingerprint(userAgent, ip);

  if (user.suspended) {
    await recordLoginAttempt(c.env.DB, {
      userId: user.id,
      success: false,
      ip,
      userAgent,
      fingerprint,
      failureReason: 'account_suspended',
    });
    return c.json({ error: 'This account is suspended.' }, 403);
  }

  const { isNewDevice } = await upsertTrustedDevice(c.env.DB, { userId: user.id, fingerprint, ip, userAgent });

  if (isNewDevice) {
    await logSecurityEvent(c.env.DB, {
      userId: user.id,
      eventType: 'new_device_login',
      severity: 'low',
      detail: 'Sign-in from a device not seen before.',
      ip,
    });
  }

  await recordLoginAttempt(c.env.DB, { userId: user.id, success: true, ip, userAgent, fingerprint });

  const token = await createSessionToken(c.env.SESSION_SECRET, { userId: user.id });
  c.header('Set-Cookie', sessionCookieHeader(token));

  const lastLoginRow = await c.env.DB
    .prepare(
      `SELECT created_at, ip_address, user_agent FROM login_history
       WHERE user_id = ? AND success = 1 ORDER BY created_at DESC LIMIT 1 OFFSET 1`
    )
    .bind(user.id)
    .first();

  return c.json({
    user,
    isNewDevice,
    lastLogin: lastLoginRow
      ? { time: lastLoginRow.created_at, ip: lastLoginRow.ip_address, userAgent: lastLoginRow.user_agent }
      : null,
  });
});

auth.post('/logout', async (c) => {
  c.header('Set-Cookie', clearSessionCookieHeader);
  return c.json({ ok: true });
});

auth.get('/me', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ user: null });

  const [history, deviceCount, unreadEvents] = await Promise.all([
    c.env.DB
      .prepare('SELECT created_at, ip_address, user_agent, success FROM login_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 5')
      .bind(user.id)
      .all(),
    c.env.DB
      .prepare('SELECT COUNT(*) as count FROM trusted_devices WHERE user_id = ?')
      .bind(user.id)
      .first(),
    c.env.DB
      .prepare('SELECT COUNT(*) as count FROM security_events WHERE user_id = ? AND read_at IS NULL')
      .bind(user.id)
      .first(),
  ]);

  return c.json({
    user,
    loginHistory: history.results || [],
    trustedDeviceCount: deviceCount?.count || 0,
    unreadSecurityEventCount: unreadEvents?.count || 0,
  });
});

auth.get('/csrf', async (c) => {
  const token = await generateCsrfToken(c.env.SESSION_SECRET);
  return c.json({ token });
});

auth.get('/login-history', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'Not authenticated.' }, 401);

  const rows = await c.env.DB
    .prepare(
      `SELECT id, success, ip_address, user_agent, failure_reason, created_at
       FROM login_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`
    )
    .bind(user.id)
    .all();

  return c.json({ history: rows.results || [] });
});

auth.get('/devices', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'Not authenticated.' }, 401);

  const rows = await c.env.DB
    .prepare(
      `SELECT id, device_name, ip_address, user_agent, is_trusted, last_used_at, created_at
       FROM trusted_devices WHERE user_id = ? ORDER BY last_used_at DESC`
    )
    .bind(user.id)
    .all();

  return c.json({ devices: rows.results || [] });
});

auth.delete('/devices/:id', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'Not authenticated.' }, 401);

  const id = c.req.param('id');
  const device = await c.env.DB.prepare('SELECT * FROM trusted_devices WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .first();
  if (!device) return c.json({ error: 'Device not found.' }, 404);

  await c.env.DB.prepare('DELETE FROM trusted_devices WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

auth.get('/security-events', async (c) => {
  const user = requireUser(c);
  if (!user) return c.json({ error: 'Not authenticated.' }, 401);

  const rows = await c.env.DB
    .prepare(
      `SELECT id, event_type, severity, detail, created_at, read_at
       FROM security_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`
    )
    .bind(user.id)
    .all();

  return c.json({ events: rows.results || [] });
});

export default auth;
