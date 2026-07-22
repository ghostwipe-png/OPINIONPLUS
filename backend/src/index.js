import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { attachUser, csrfProtection } from './middleware/auth.js';
import { apiKeyAuth } from './middleware/apiKey.js';
import { apiLimit } from './middleware/apiLimit.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { createDB } from './utils/db.js';
import { AudioRoomDO } from './audio-room-do.js';

import auth from './routes/auth.js';
import stories from './routes/stories.js';
import users from './routes/users.js';
import uploads from './routes/uploads.js';
import admin from './routes/admin.js';
import keys from './routes/keys.js';
import sms from './routes/sms.js';
import payments from './routes/payments.js';
import partner from './routes/partner.js';
import notifications from './routes/notifications.js';
import subscriptions from './routes/subscriptions.js';
import archive from './routes/archive.js';
import polls from './routes/polls.js';
import rooms from './routes/rooms.js';
import jobs from './routes/jobs.js';
import campuses from './routes/campuses.js';
import services from './routes/services.js'; // NEW: Services Router

const app = new Hono();

const ALLOWED_ORIGINS = [
  'https://www.opinionplus.online',
  'https://opinionplus.online',
  'https://opinionplus.opinionplus.workers.dev',
];

function log(level, message, meta = {}) {
  const entry = { level, message, ts: new Date().toISOString(), ...meta };
  if (level === 'error') console.error(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

app.use('*', async (c, next) => {
  const requestId = c.req.header('X-Request-ID') || crypto.randomUUID();
  c.set('requestId', requestId);
  const start = Date.now();
  await next();
  c.res.headers.set('X-Request-ID', requestId);
  log('info', 'request', {
    requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: Date.now() - start,
  });
});

app.use('*', async (c, next) => {
  await next();
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('X-Frame-Options', 'DENY');
  c.res.headers.set('X-XSS-Protection', '1; mode=block');
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.res.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );
  c.res.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com js.paystack.co",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "media-src 'self' https:",
      "frame-src 'self' https://accounts.google.com https://www.youtube.com https://player.vimeo.com https://checkout.paystack.com",
      "connect-src 'self' https://generativelanguage.googleapis.com https://accounts.google.com wss: https://api.paystack.co",
      "frame-ancestors 'none'",
    ].join('; ')
  );
  try {
    if (new URL(c.req.url).protocol === 'https:') {
      c.res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }
  } catch (e) { /* skip HSTS */ }
});

app.use('*', cors({
  origin: (origin) => ALLOWED_ORIGINS.includes(origin) ? origin : null,
  credentials: true,
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Pin', 'X-CSRF-Token', 'X-Request-ID'],
}));

app.use('*', async (c, next) => {
  await next();
  const contentType = c.res.headers.get('Content-Type') || '';
  const path = c.req.path;
  
  if (/application\/json/.test(contentType) && (path.includes('/trending') || path.includes('/feed'))) {
    c.res.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    c.res.headers.set('CDN-Cache-Control', 'max-age=300');
  } else if (/text\/html|application\/json|application\/javascript/.test(contentType)) {
    if (!c.res.headers.get('CDN-Cache-Control')) {
      c.res.headers.set('CDN-Cache-Control', 'max-age=0, must-revalidate');
    }
  }
});

app.use('*', async (c, next) => {
  try {
    if (c.env?.DB) {
      c.set('db', createDB(c.env.DB, log));
    }
  } catch (e) {
    log('warn', 'db wrapper attach failed', { error: e.message });
  }
  await next();
});

app.use('*', async (c, next) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('__REQUEST_TIMEOUT__')), 25000);
  });
  try {
    await Promise.race([next(), timeout]);
  } catch (e) {
    if (e && e.message === '__REQUEST_TIMEOUT__') {
      log('error', 'request timeout', { path: c.req.path, method: c.req.method, requestId: c.get('requestId') });
      if (!c.finalized) c.res = c.json({ error: 'Request timeout', requestId: c.get('requestId') }, 504);
      return;
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
});

app.use('*', attachUser);
app.use('*', async (c, next) => {
  if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') return await next();
  if (c.req.path === '/subscriptions/subscribe') return await next();
  if (c.req.path === '/payments/initialize') return await next();
  if (c.req.path.startsWith('/archive/')) return await next();
  if (c.req.path.startsWith('/admin/')) return await next();
  if (c.req.path === '/payments/webhook') return await next(); // Webhooks rely on HMAC signature, not CSRF
  if (c.req.path === '/services/webhook') return await next(); // NEW: Bypass CSRF for Service Webhooks
  return csrfProtection(c, next);
});

app.use('/auth/*', async (c, next) => {
  if (c.req.path === '/auth/csrf') return await next();
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const limiter = createRateLimiter(c.env.DB, 60, 10);
  const allowed = await limiter(ip, 'auth');
  if (!allowed) return c.json({ error: 'Too many attempts. Try again later.' }, 429);
  await next();
});

app.use('/sms/*', async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const limiter = createRateLimiter(c.env.DB, 60, 10);
  const allowed = await limiter(ip, 'sms');
  if (!allowed) return c.json({ error: 'Rate limit exceeded.' }, 429);
  await next();
});

app.get('/', async (c) => {
  let dbStatus = 'unknown';
  const dbStart = Date.now();
  try { await c.env.DB.prepare('SELECT 1').first(); dbStatus = 'ok'; } 
  catch (e) { dbStatus = 'error'; }
  return c.json({ ok: dbStatus === 'ok', service: 'opinionplus-api', db: dbStatus, dbLatencyMs: Date.now() - dbStart, requestId: c.get('requestId') });
});

async function safeFirst(env, sql) {
  try { return await env.DB.prepare(sql).first(); } catch (e) { return null; }
}

app.get('/metrics', async (c) => {
  const user = c.get('user');
  if (!user || (user.role !== 'admin' && user.role !== 'root')) return c.json({ error: 'Forbidden' }, 403);
  try {
    const [usersRow, storiesRow, engagementRow, last24hRow] = await Promise.all([
      safeFirst(c.env, 'SELECT COUNT(*) as count FROM users'),
      safeFirst(c.env, 'SELECT COUNT(*) as count FROM stories WHERE deleted = 0'),
      safeFirst(c.env, `SELECT COALESCE(SUM(json_array_length(likes)), 0) as totalLikes, COALESCE(SUM(json_array_length(comments)), 0) as totalComments FROM stories WHERE deleted = 0`),
      safeFirst(c.env, "SELECT COUNT(*) as count FROM stories WHERE deleted = 0 AND created_at >= datetime('now', '-1 day')"),
    ]);
    return c.json({
      totalUsers: usersRow?.count ?? null,
      totalStories: storiesRow?.count ?? null,
      totalComments: engagementRow?.totalComments ?? null,
      totalLikes: engagementRow?.totalLikes ?? null,
      storiesLast24h: last24hRow?.count ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (e) { return c.json({ error: 'Failed to load metrics' }, 500); }
});

app.get('/api/feed', apiKeyAuth, apiLimit, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare('SELECT * FROM stories WHERE author_id = ? AND deleted = 0 AND privacy = "public" ORDER BY created_at DESC LIMIT 100').bind(user.id).all();
  return c.json({ publisher: user.publisher_name, stories: results });
});

// =========================================================================
// MAXIMUM SECURITY WEBSOCKET UPGRADE ROUTE
// =========================================================================
app.get('/rooms/:roomId/ws', async (c) => {
  const user = c.get('user');
  
  // 1. Hard block unauthenticated users from initiating signaling
  if (!user) {
    return c.json({ error: 'Unauthorized: Valid secure session required.' }, 401);
  }

  const roomId = c.req.param('roomId');
  
  // 2. Cryptographic Server-Side Identity Injection
  // We strip all client control over their identity by securely passing verified DB state
  // to the Durable Object via internal headers. Clients cannot forge these.
  const secureHeaders = new Headers(c.req.raw.headers);
  secureHeaders.set('X-Secure-User-Id', user.id);
  secureHeaders.set('X-Secure-User-Name', user.publisherName || user.name || 'User');
  secureHeaders.set('X-Secure-User-Avatar', user.logoUrl || '');
  secureHeaders.set('X-Secure-User-Role', user.role || 'user');

  const secureRequest = new Request(c.req.url, {
    method: c.req.method,
    headers: secureHeaders,
  });

  const id = c.env.AUDIO_ROOM_DO.idFromName(roomId);
  const stub = c.env.AUDIO_ROOM_DO.get(id);
  return stub.fetch(secureRequest);
});

app.route('/auth', auth);
app.route('/stories', stories);
app.route('/users', users);
app.route('/uploads', uploads);
app.route('/admin', admin);
app.route('/keys', keys);
app.route('/sms', sms);
app.route('/payments', payments);
app.route('/partner', partner);
app.route('/notifications', notifications);
app.route('/subscriptions', subscriptions);
app.route('/archive', archive);
app.route('/polls', polls);
app.route('/rooms', rooms);
app.route('/jobs', jobs);
app.route('/campuses', campuses);
app.route('/services', services); // NEW: Mount Services route

async function runRetentionCleanup(env) {
  const results = { archiveApproved: 0, archiveRejected: 0, searchHistory: 0, rateLimits: 0 };
  try {
    const r = await env.DB.prepare("DELETE FROM archive WHERE status = 'approved' AND reviewed_at < datetime('now', '-30 days')").run();
    results.archiveApproved = r.meta?.changes || 0;
  } catch (e) {}
  try {
    const r = await env.DB.prepare("DELETE FROM archive WHERE status = 'rejected' AND reviewed_at < datetime('now', '-7 days')").run();
    results.archiveRejected = r.meta?.changes || 0;
  } catch (e) {}
  try {
    const r = await env.DB.prepare("DELETE FROM search_history WHERE created_at < datetime('now', '-90 days')").run();
    results.searchHistory = r.meta?.changes || 0;
  } catch (e) {}
  try {
    const r = await env.DB.prepare("DELETE FROM rate_limits WHERE created_at < datetime('now', '-1 days')").run();
    results.rateLimits = r.meta?.changes || 0;
  } catch (e) {}
  return results;
}

app.get('/admin-cleanup', async (c) => {
  const token = c.req.query('token');
  if (token !== c.env.CRON_SECRET) return c.json({ error: 'Unauthorized' }, 401);
  try {
    const results = await runRetentionCleanup(c.env);
    return c.json({ ok: true, ...results });
  } catch (e) { return c.json({ ok: false, error: 'Cleanup failed' }, 500); }
});

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  const status = err.status || err.statusCode || 500;
  const requestId = c.get('requestId');
  if (status >= 400 && status < 500) {
    return c.json({ error: err.message || 'Request error.', requestId }, status);
  }
  return c.json({ error: 'Something went wrong.', requestId }, status);
});

async function runCronJob(name, fn) {
  try { await fn(); } catch (e) {}
}

const worker = {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    const jobs = [];
    if (event.cron === '*/5 * * * *') {
      jobs.push(runCronJob('publish-scheduled-stories', async () => {
        const storiesModule = await import('./routes/stories.js');
        if (typeof storiesModule.publishScheduledStories === 'function') {
          return await storiesModule.publishScheduledStories(env);
        }
        return null;
      }));
    }
    if (event.cron === '0 3 * * *') {
      jobs.push(runCronJob('retention-cleanup', () => runRetentionCleanup(env)));
    }
    await Promise.allSettled(jobs);
  },
};

export { AudioRoomDO };
export default worker;