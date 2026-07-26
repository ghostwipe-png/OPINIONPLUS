// backend/src/routes/health.js (NEW FILE)

import { Hono } from 'hono';

const health = new Hono();

// ── Health check: Bunny Stream ──────────────────────
async function checkBunny(env) {
  const start = Date.now();
  try {
    const res = await fetch(
      `https://video.bunnycdn.com/library/${env.BUNNY_LIBRARY_ID}/videos?page=1&limit=1`,
      {
        headers: {
          'AccessKey': env.BUNNY_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );
    return {
      provider: 'bunny_stream',
      status: res.ok ? 'ok' : 'degraded',
      latencyMs: Date.now() - start,
      statusCode: res.status,
      message: res.ok ? null : `Bunny returned ${res.status}`,
    };
  } catch (e) {
    return {
      provider: 'bunny_stream',
      status: 'down',
      latencyMs: Date.now() - start,
      message: e.message,
    };
  }
}

// ── Health check: D1 Database ────────────────────────
async function checkD1(env) {
  const start = Date.now();
  try {
    await env.DB.prepare('SELECT 1').first();
    return {
      provider: 'd1_database',
      status: 'ok',
      latencyMs: Date.now() - start,
    };
  } catch (e) {
    return {
      provider: 'd1_database',
      status: 'down',
      latencyMs: Date.now() - start,
      message: e.message,
    };
  }
}

// ── Health check: Paystack ───────────────────────────
async function checkPaystack(env) {
  const start = Date.now();
  try {
    const res = await fetch('https://api.paystack.co', {
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY || ''}`,
      },
    });
    return {
      provider: 'paystack',
      status: res.status < 500 ? 'ok' : 'degraded',
      latencyMs: Date.now() - start,
      statusCode: res.status,
    };
  } catch (e) {
    return {
      provider: 'paystack',
      status: 'down',
      latencyMs: Date.now() - start,
      message: e.message,
    };
  }
}

// ── Health check: R2 Storage ─────────────────────────
async function checkR2(env) {
  const start = Date.now();
  try {
    if (env.FILES) {
      await env.FILES.head('health-check');
    }
    return {
      provider: 'r2_storage',
      status: 'ok',
      latencyMs: Date.now() - start,
    };
  } catch (e) {
    return {
      provider: 'r2_storage',
      status: 'degraded',
      latencyMs: Date.now() - start,
      message: e.message,
    };
  }
}

// ── GET /health — public, lightweight ────────────────
health.get('/', async (c) => {
  const results = await Promise.all([
    checkD1(c.env),
    checkBunny(c.env),
    checkPaystack(c.env),
    checkR2(c.env),
  ]);

  const allOk = results.every((r) => r.status === 'ok');
  const anyDown = results.some((r) => r.status === 'down');

  return c.json(
    {
      timestamp: new Date().toISOString(),
      overall: anyDown ? 'down' : allOk ? 'ok' : 'degraded',
      services: results,
    },
    anyDown ? 503 : 200
  );
});

// ── GET /health/detailed — admin only ───────────────
health.get('/detailed', async (c) => {
  const user = c.get('user');
  if (!user || (user.role !== 'admin' && user.role !== 'root')) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const results = await Promise.all([
    checkD1(c.env),
    checkBunny(c.env),
    checkPaystack(c.env),
    checkR2(c.env),
  ]);

  // Additional: recent error logs (last 50)
  let recentErrors = [];
  try {
    const { results: errors } = await c.env.DB.prepare(
      `SELECT * FROM admin_logs WHERE action LIKE '%error%' OR action LIKE '%fail%' ORDER BY created_at DESC LIMIT 50`
    ).all();
    recentErrors = errors || [];
  } catch {}

  return c.json({
    timestamp: new Date().toISOString(),
    services: results,
    recentErrors: recentErrors.length,
    uptime: 'See Cloudflare analytics for uptime history',
  });
});

// ── GET /health/bunny — quick Bunny-only check ──────
health.get('/bunny', async (c) => {
  const result = await checkBunny(c.env);
  return c.json(result, result.status === 'down' ? 503 : 200);
});

export default health;