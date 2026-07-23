// backend/src/middleware/auth.js
import { readCookie, verifySessionToken } from '../lib/session.js';

const ROOT_EMAIL = 'adipotech@gmail.com';

export async function attachUser(c, next) {
  const token = readCookie(c.req.raw, 'op_session');
  if (token) {
    const payload = await verifySessionToken(c.env.SESSION_SECRET, token);
    if (payload?.userId) {
      let user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
        .bind(payload.userId)
        .first();
      
      if (user) {
        // Ensure adipotech@gmail.com always holds absolute root privileges
        if (user.email === ROOT_EMAIL && user.role !== 'root') {
          try {
            await c.env.DB.prepare('UPDATE users SET role = "root" WHERE id = ?').bind(user.id).run();
            user.role = 'root';
          } catch (e) {
            user.role = 'root';
          }
        }

        c.set('user', user);
        c.set('isAuthenticated', true);
        c.set('isAdmin', user.role === 'admin' || user.role === 'root' || user.email === ROOT_EMAIL);
        c.set('isRoot', user.role === 'root' || user.email === ROOT_EMAIL);
      }
    }
  }

  if (!c.get('user')) {
    c.set('user', null);
    c.set('isAuthenticated', false);
    c.set('isAdmin', false);
    c.set('isRoot', false);
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
  if (!user) return c.json({ error: 'Authentication required.' }, 401);
  if (user.suspended) return c.json({ error: 'This account is suspended.' }, 403);
  
  const isAdmin = user.role === 'admin' || user.role === 'root' || user.email === ROOT_EMAIL;
  if (!isAdmin) return c.json({ error: 'Admin access required.' }, 403);
  
  await next();
}

export async function requireRoot(c, next) {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Authentication required.' }, 401);
  if (user.suspended) return c.json({ error: 'This account is suspended.' }, 403);

  const isRoot = user.role === 'root' || user.email === ROOT_EMAIL;
  if (!isRoot) return c.json({ error: 'Root administrator access required.' }, 403);

  await next();
}

export async function requirePin(c, next) {
  const user = c.get('user');
  if (user?.email === ROOT_EMAIL) {
    return await next();
  }

  const pin = c.req.header('X-Admin-Pin');
  if (!pin) return c.json({ error: 'PIN required for this action.' }, 401);
  
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  
  if (hex !== c.env.ADMIN_PIN_HASH) {
    return c.json({ error: 'Incorrect PIN.' }, 401);
  }
  
  await next();
}

// ---------------------------------------------------------------------------
// CSRF Protection
// ---------------------------------------------------------------------------

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function generateCsrfToken(secret) {
  const token = crypto.randomUUID();
  const sig = await hmac(secret, token);
  return `${token}.${sig}`;
}

export async function verifyCsrfToken(secret, token) {
  if (!token || !token.includes('.')) return false;
  const [body, sig] = token.split('.');
  const expected = await hmac(secret, body);
  return sig === expected;
}

export async function csrfProtection(c, next) {
  if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') {
    return await next();
  }

  const path = c.req.path;
  // Bypass CSRF checks for webhooks and authenticated content submission routes
  if (path.includes('/webhook') || path.includes('/content/')) {
    return await next();
  }

  const token = c.req.header('X-CSRF-Token');
  if (!token) return c.json({ error: 'CSRF token required.' }, 403);

  const valid = await verifyCsrfToken(c.env.SESSION_SECRET, token);
  if (!valid) return c.json({ error: 'Invalid CSRF token.' }, 403);

  await next();
}