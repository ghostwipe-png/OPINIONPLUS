import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { attachUser, csrfProtection } from './middleware/auth.js';
import { apiKeyAuth } from './middleware/apiKey.js';
import { apiLimit } from './middleware/apiLimit.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { createDB } from './utils/db.js';
import { AudioRoomDO } from './audio-room-do.js';

// NEW: Platform hardening middleware
import { ipBlacklistMiddleware } from './middleware/ipBlacklist.js';
import { maintenanceMiddleware } from './middleware/featureFlags.js';

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
import services, { publishScheduledPressReleases } from './routes/services.js';
import apiService from './routes/api-service.js';
import sponsoredService, { processSponsoredCampaigns, countSponsoredImpressions } from './routes/sponsored-service.js';
import health from './routes/health.js';
import videos, {
  channels as videoChannels,
  subscriptionsFeed as videoSubscriptionsFeed,
  history as watchHistory,
  playlists as videoPlaylists,
  watchLater as videoWatchLater,
} from './routes/videos.js';

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

// ── Health check helpers (used by cron too) ──────────
async function checkBunny(env) {
  const start = Date.now();
  try {
    const res = await fetch(
      `https://video.bunnycdn.com/library/${env.BUNNY_LIBRARY_ID}/videos?page=1&limit=1`,
      { headers: { 'AccessKey': env.BUNNY_API_KEY, 'Content-Type': 'application/json' } }
    );
    return { provider: 'bunny_stream', status: res.ok ? 'ok' : 'degraded', latencyMs: Date.now() - start, statusCode: res.status };
  } catch (e) {
    return { provider: 'bunny_stream', status: 'down', latencyMs: Date.now() - start, message: e.message };
  }
}

async function checkD1(env) {
  const start = Date.now();
  try {
    await env.DB.prepare('SELECT 1').first();
    return { provider: 'd1_database', status: 'ok', latencyMs: Date.now() - start };
  } catch (e) {
    return { provider: 'd1_database', status: 'down', latencyMs: Date.now() - start, message: e.message };
  }
}

async function checkPaystack(env) {
  const start = Date.now();
  try {
    const res = await fetch('https://api.paystack.co', {
      headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY || ''}` },
    });
    return { provider: 'paystack', status: res.status < 500 ? 'ok' : 'degraded', latencyMs: Date.now() - start, statusCode: res.status };
  } catch (e) {
    return { provider: 'paystack', status: 'down', latencyMs: Date.now() - start, message: e.message };
  }
}

// ── Middleware ────────────────────────────────────────

// NEW: IP Blacklist — applied first, before anything else
app.use('*', ipBlacklistMiddleware);

// NEW: Maintenance Mode — applied early, after IP check
app.use('*', maintenanceMiddleware);

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
  c.res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.res.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com js.paystack.co",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "media-src 'self' https:",
      "frame-src 'self' https://accounts.google.com https://www.youtube.com https://player.vimeo.com https://checkout.paystack.com https://iframe.mediadelivery.net",
      "connect-src 'self' https://generativelanguage.googleapis.com https://accounts.google.com wss: https://api.paystack.co https://video.bunnycdn.com",
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
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Pin', 'X-CSRF-Token', 'X-Request-ID', 'AccessKey'],
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
  if (c.req.path.startsWith('/campuses/')) return await next();
  if (c.req.path === '/payments/webhook') return await next();
  if (c.req.path === '/services/webhook') return await next();
  if (/^\/services\/press-release\/[^/]+\/track-view$/.test(c.req.path)) return await next();
  if (c.req.path.startsWith('/api-service/v1/')) return await next();
  if (c.req.path.startsWith('/sponsored-service/track/')) return await next();
  if (c.req.path.startsWith('/services/sponsored/track/')) return await next();
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

app.get('/rooms/:roomId/ws', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized: Valid secure session required.' }, 401);
  const roomId = c.req.param('roomId');
  const secureHeaders = new Headers(c.req.raw.headers);
  secureHeaders.set('X-Secure-User-Id', user.id);
  secureHeaders.set('X-Secure-User-Name', user.publisherName || user.name || 'User');
  secureHeaders.set('X-Secure-User-Avatar', user.logoUrl || '');
  secureHeaders.set('X-Secure-User-Role', user.role || 'user');
  const secureRequest = new Request(c.req.url, { method: c.req.method, headers: secureHeaders });
  const id = c.env.AUDIO_ROOM_DO.idFromName(roomId);
  const stub = c.env.AUDIO_ROOM_DO.get(id);
  return stub.fetch(secureRequest);
});

// ── Routes ────────────────────────────────────────────

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
app.route('/services', services);
app.route('/api-service', apiService);
app.route('/services/api', apiService);
app.route('/sponsored-service', sponsoredService);
app.route('/services/sponsored', sponsoredService);
app.route('/videos', videos);
app.route('/channels', videoChannels);
app.route('/subs', videoSubscriptionsFeed);
app.route('/history', watchHistory);
app.route('/playlists', videoPlaylists);
app.route('/watch-later', videoWatchLater);
app.route('/health', health);

// ── Cleanup ───────────────────────────────────────────

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

app.all('/presence/*', (c) => c.json({ online: 0, status: 'disabled' }));

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  const status = err.status || err.statusCode || 500;
  const requestId = c.get('requestId');

  // NEW: Aggregate errors for monitoring (fire and forget)
  c.executionCtx?.waitUntil?.(
    (async () => {
      try {
        const errorKey = `${(err.message || '').slice(0, 100)}::${c.req.path}`;
        await c.env.DB.prepare(
          `INSERT INTO error_aggregation (error_key, error_message, endpoint, last_seen_at, occurrence_count)
           VALUES (?, ?, ?, datetime('now'), 1)
           ON CONFLICT(error_key) DO UPDATE SET
             last_seen_at = datetime('now'),
             occurrence_count = occurrence_count + 1`
        ).bind(errorKey, (err.message || '').slice(0, 500), c.req.path).run();
      } catch (e) { /* silent */ }
    })().catch(() => {})
  );

  if (status >= 400 && status < 500) {
    return c.json({ error: err.message || 'Request error.', requestId }, status);
  }
  return c.json({ error: 'Something went wrong.', requestId }, status);
});

// NEW: Cron job logging wrapper
async function runCronJob(name, fn) {
  const start = Date.now();
  try {
    await fn();
    // Log success (fire and forget)
    const env = globalThis.__env; // Set by worker fetch if available
    if (env?.DB) {
      try {
        await env.DB.prepare(
          'INSERT INTO cron_job_log (id, job_name, status, duration_ms) VALUES (?, ?, ?, ?)'
        ).bind(crypto.randomUUID(), name, 'success', Date.now() - start).run();
      } catch (e) { /* silent */ }
    }
  } catch (e) {
    console.error(JSON.stringify({ kind: 'cron_job_failed', job: name, message: e.message }));
  }
}

// ── Worker ────────────────────────────────────────────

const worker = {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    // Set env globally so runCronJob can access it for logging
    globalThis.__env = env;
    
    const jobs = [];

    if (event.cron === '*/5 * * * *') {
      jobs.push(runCronJob('health-check', async () => {
        const results = await Promise.all([
          checkBunny(env),
          checkD1(env),
          checkPaystack(env),
        ]);
        const failures = results.filter(r => r.status !== 'ok');
        if (failures.length > 0) {
          log('error', 'HEALTH_CHECK_FAILED', {
            failures: failures.map(f => f.provider),
            details: failures,
          });
        }
      }));
      jobs.push(runCronJob('publish-scheduled-stories', async () => {
        const storiesModule = await import('./routes/stories.js');
        if (typeof storiesModule.publishScheduledStories === 'function') {
          return await storiesModule.publishScheduledStories(env);
        }
        return null;
      }));
      jobs.push(runCronJob('publish-scheduled-press-releases', async () => {
        return await publishScheduledPressReleases(env);
      }));
      jobs.push(runCronJob('process-sponsored-campaigns', () => processSponsoredCampaigns(env)));
      jobs.push(runCronJob('count-sponsored-impressions', () => countSponsoredImpressions(env)));
      jobs.push(runCronJob('api-log-cleanup', async () => {
        await env.DB.prepare("DELETE FROM api_request_logs WHERE created_at < datetime('now', '-90 days')").run();
      }));
      jobs.push(runCronJob('partner-engagement-bonuses', async () => {
        const partnerModule = await import('./routes/partner.js');
        if (typeof partnerModule.checkEngagementBonuses === 'function') {
          return await partnerModule.checkEngagementBonuses(env);
        }
      }));

            // NEW: Uptime tracking + error alert check
      jobs.push(runCronJob('uptime-check', async () => {
        const results = await Promise.all([
          checkD1(env),
          checkBunny(env),
          checkPaystack(env),
        ]);
        const overall = results.every(r => r.status === 'ok') ? 'ok' : 'degraded';
        const anyDown = results.some(r => r.status === 'down');
        
        await env.DB.prepare(
          'INSERT INTO uptime_log (id, status, detail) VALUES (?, ?, ?)'
        ).bind(crypto.randomUUID(), anyDown ? 'down' : overall, JSON.stringify({ services: results })).run();

        // Check error threshold for alerts
        if (overall !== 'ok') {
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
          const errorCount = await env.DB.prepare(
            "SELECT COUNT(*) as count FROM error_aggregation WHERE last_seen_at >= ?"
          ).bind(oneHourAgo).first();
          
          const alerts = await env.DB.prepare(
            'SELECT * FROM alert_configs WHERE is_active = 1'
          ).all();
          
          for (const alert of (alerts?.results || [])) {
            if ((errorCount?.count || 0) >= alert.error_threshold) {
              console.log(JSON.stringify({
                kind: 'alert_triggered',
                alert_type: alert.alert_type,
                destination: alert.destination,
                error_count: errorCount?.count,
                message: `ALERT: ${errorCount?.count} errors in the last hour. Platform status: ${overall}`,
              }));
              await env.DB.prepare(
                'INSERT INTO alert_history (id, alert_type, destination, error_count, message) VALUES (?, ?, ?, ?, ?)'
              ).bind(crypto.randomUUID(), alert.alert_type, alert.destination, errorCount?.count || 0, `Errors: ${errorCount?.count}. Status: ${overall}`).run();
            }
          }
        }
      }));



      // NEW: Circuit breaker health check
      jobs.push(runCronJob('circuit-breaker-health', async () => {
        const { getCircuitBreakerStatus } = await import('./middleware/circuitBreaker.js');
        const status = await getCircuitBreakerStatus(env);
        const openCircuits = (status || []).filter(s => s.state === 'open');
        if (openCircuits.length > 0) {
          log('error', 'CIRCUIT_BREAKERS_OPEN', {
            circuits: openCircuits.map(c => c.service_name),
          });
        }
      }));
      jobs.push(runCronJob('api-webhook-retries', async () => {
        try {
          const { results } = await env.DB.prepare(
            "SELECT w.*, l.id as log_id FROM api_webhook_logs l JOIN api_webhooks w ON l.webhook_id = w.id WHERE l.success = 0 AND l.created_at >= datetime('now', '-24 hours') AND w.is_active = 1"
          ).all();
          for (const row of results) {
            const attempts = await env.DB.prepare(
              "SELECT COUNT(*) as count FROM api_webhook_logs WHERE webhook_id = ? AND event_type = ? AND created_at >= datetime('now', '-24 hours')"
            ).bind(row.webhook_id, row.event_type).first();
            if ((attempts?.count || 0) < 3) {
              try {
                const start = Date.now();
                const res = await fetch(row.webhook_url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'X-OP-Event': row.event_type },
                  body: row.payload,
                });
                await env.DB.prepare(
                  'INSERT INTO api_webhook_logs (id, webhook_id, event_type, payload, response_status, response_time_ms, success) VALUES (?, ?, ?, ?, ?, ?, ?)'
                ).bind(crypto.randomUUID(), row.webhook_id, row.event_type, row.payload, res.status, Date.now() - start, res.ok ? 1 : 0).run();
              } catch (e) {
                await env.DB.prepare(
                  'INSERT INTO api_webhook_logs (id, webhook_id, event_type, payload, response_status, response_time_ms, success) VALUES (?, ?, ?, ?, 0, 0, 0)'
                ).bind(crypto.randomUUID(), row.webhook_id, row.event_type, row.payload).run();
              }
            }
          }
        } catch (e) { /* silently fail */ }
      }));
    }

    if (event.cron === '0 3 * * *') {
      jobs.push(runCronJob('retention-cleanup', () => runRetentionCleanup(env)));
      jobs.push(runCronJob('partner-tier-recalculation', async () => {
        const partnerModule = await import('./routes/partner.js');
        if (typeof partnerModule.recalculateAllTiers === 'function') {
          return await partnerModule.recalculateAllTiers(env);
        }
      }));
      jobs.push(runCronJob('partner-anomaly-detection', async () => {
        const partnerModule = await import('./routes/partner.js');
        if (typeof partnerModule.runAnomalyDetection === 'function') {
          return await partnerModule.runAnomalyDetection(env);
        }
      }));
    }

    // NEW: Every hour — dead link checker
    if (event.cron === '0 * * * *') {
      jobs.push(runCronJob('dead-link-checker', async () => {
        try {
          const { results: stories } = await env.DB.prepare(
            "SELECT id, body FROM stories WHERE deleted = 0 AND body LIKE '%http%' LIMIT 50"
          ).all();
          for (const story of stories || []) {
            const urls = (story.body || '').match(/https?:\/\/[^\s<>"']+/g) || [];
            for (const url of urls.slice(0, 5)) {
              try {
                const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
                if (res.status >= 400) {
                  await env.DB.prepare(
                    'INSERT OR IGNORE INTO dead_links (id, story_id, link_url, status_code) VALUES (?, ?, ?, ?)'
                  ).bind(crypto.randomUUID(), story.id, url.slice(0, 500), res.status).run();
                }
              } catch (e) {
                await env.DB.prepare(
                  'INSERT OR IGNORE INTO dead_links (id, story_id, link_url, status_code) VALUES (?, ?, ?, ?)'
                ).bind(crypto.randomUUID(), story.id, url.slice(0, 500), 0).run();
              }
            }
          }
        } catch (e) { /* silently fail */ }
      }));
    }

    await Promise.allSettled(jobs);
  },
};

export { AudioRoomDO };
export default worker;