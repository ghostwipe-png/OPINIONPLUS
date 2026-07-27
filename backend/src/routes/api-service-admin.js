// backend/src/routes/api-service-admin.js
// Standalone Admin Routes for API Service
// ═══════════════════════════════════════════════════════════
// ADMIN MERGE INSTRUCTIONS
// ═══════════════════════════════════════════════════════════
// 1. Import this module in backend/src/routes/admin.js:
//    import apiServiceAdmin from './api-service-admin.js';
//
// 2. Mount it inside the admin route group:
//    admin.route('/api-service', apiServiceAdmin);
//
// 3. These routes require admin or root role (checked inline).
//    The frontend admin dashboard can call these endpoints.
//
// 4. Example frontend tab addition:
//    { id: 'api-service', label: 'API Service', icon: Server, visible: user?.role === 'root' }
// ═══════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';

const apiServiceAdmin = new Hono();

// Role check middleware
async function requireAdmin(c, next) {
  const user = c.get('user');
  if (!user || (user.role !== 'admin' && user.role !== 'root')) {
    return c.json({ error: 'Forbidden — admin access required.' }, 403);
  }
  await next();
}

// Apply auth + admin check to all routes
apiServiceAdmin.use('*', requireAuth);
apiServiceAdmin.use('*', requireAdmin);

// ═══════════════════════════════════════════════════════════
// OVERVIEW — Platform-wide API stats
// ═══════════════════════════════════════════════════════════

apiServiceAdmin.get('/overview', async (c) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const [
      totalKeysRow,
      activeUsersRow,
      callsTodayRow,
      totalLogsRow,
      topEndpoints,
    ] = await Promise.all([
      c.env.DB.prepare('SELECT COUNT(*) as count FROM api_keys WHERE is_active = 1').first(),
      c.env.DB.prepare('SELECT COUNT(DISTINCT user_id) as count FROM api_keys WHERE is_active = 1').first(),
      c.env.DB.prepare("SELECT COALESCE(SUM(calls_count), 0) as total FROM api_usage_daily WHERE date = ?").bind(today).first(),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM api_request_logs').first(),
      c.env.DB.prepare(
        "SELECT endpoint, COUNT(*) as count FROM api_request_logs WHERE created_at >= datetime('now', '-7 days') GROUP BY endpoint ORDER BY count DESC LIMIT 10"
      ).all(),
    ]);

    return c.json({
      totalKeys: totalKeysRow?.count || 0,
      activeUsers: activeUsersRow?.count || 0,
      callsToday: callsTodayRow?.total || 0,
      totalRequestsLogged: totalLogsRow?.count || 0,
      topEndpoints: topEndpoints.results || [],
    });
  } catch (e) {
    return c.json({ error: 'Failed to load overview.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// KEYS — Manage all API keys across users
// ═══════════════════════════════════════════════════════════

apiServiceAdmin.get('/keys', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10) || 20));
  const offset = (page - 1) * limit;
  const statusFilter = c.req.query('status'); // active, revoked, all
  const searchQuery = (c.req.query('q') || '').trim();

  try {
    const whereClauses = [];
    const whereValues = [];

    if (statusFilter === 'active') {
      whereClauses.push('k.is_active = 1');
    } else if (statusFilter === 'revoked') {
      whereClauses.push('k.is_active = 0');
    }

    if (searchQuery) {
      whereClauses.push('(k.key_name LIKE ? OR u.email LIKE ?)');
      whereValues.push(`%${searchQuery}%`, `%${searchQuery}%`);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const totalRow = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM api_keys k LEFT JOIN users u ON k.user_id = u.id ${whereSql}`
    ).bind(...whereValues).first();

    const { results } = await c.env.DB.prepare(
      `SELECT k.id, k.key_name, k.key_type, k.tier, k.scopes, k.is_active, k.last_used_at, k.requests_today, k.created_at,
              u.email as user_email, u.name as user_name
       FROM api_keys k
       LEFT JOIN users u ON k.user_id = u.id
       ${whereSql}
       ORDER BY k.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(...whereValues, limit, offset).all();

    return c.json({
      keys: results.map(k => ({
        ...k,
        scopes: JSON.parse(k.scopes || '[]'),
        key: '****', // Never expose key hash
      })),
      total: totalRow?.count || 0,
      page,
      totalPages: Math.max(1, Math.ceil((totalRow?.count || 0) / limit)),
    });
  } catch (e) {
    return c.json({ error: 'Failed to load keys.' }, 500);
  }
});

// Force revoke any key
apiServiceAdmin.post('/keys/:id/revoke', async (c) => {
  const keyId = c.req.param('id');

  try {
    const keyRecord = await c.env.DB.prepare('SELECT * FROM api_keys WHERE id = ?').bind(keyId).first();
    if (!keyRecord) return c.json({ error: 'API key not found.' }, 404);

    await c.env.DB.prepare('UPDATE api_keys SET is_active = 0 WHERE id = ?').bind(keyId).run();

    return c.json({ ok: true, message: `Key "${keyRecord.key_name}" revoked.` });
  } catch (e) {
    return c.json({ error: 'Failed to revoke key.' }, 500);
  }
});

// Reactivate a key
apiServiceAdmin.post('/keys/:id/reactivate', async (c) => {
  const keyId = c.req.param('id');

  try {
    const keyRecord = await c.env.DB.prepare('SELECT * FROM api_keys WHERE id = ?').bind(keyId).first();
    if (!keyRecord) return c.json({ error: 'API key not found.' }, 404);

    await c.env.DB.prepare('UPDATE api_keys SET is_active = 1 WHERE id = ?').bind(keyId).run();

    return c.json({ ok: true, message: `Key "${keyRecord.key_name}" reactivated.` });
  } catch (e) {
    return c.json({ error: 'Failed to reactivate key.' }, 500);
  }
});

// View logs for a specific key
apiServiceAdmin.get('/keys/:id/logs', async (c) => {
  const keyId = c.req.param('id');
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '30', 10) || 30));
  const offset = (page - 1) * limit;

  try {
    const totalRow = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM api_request_logs WHERE api_key_id = ?'
    ).bind(keyId).first();

    const { results } = await c.env.DB.prepare(
      'SELECT * FROM api_request_logs WHERE api_key_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(keyId, limit, offset).all();

    return c.json({
      logs: results,
      total: totalRow?.count || 0,
      page,
      totalPages: Math.max(1, Math.ceil((totalRow?.count || 0) / limit)),
    });
  } catch (e) {
    return c.json({ error: 'Failed to load logs.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// USERS — API users management
// ═══════════════════════════════════════════════════════════

apiServiceAdmin.get('/users', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10) || 20));
  const offset = (page - 1) * limit;

  try {
    const totalRow = await c.env.DB.prepare(
      'SELECT COUNT(DISTINCT user_id) as count FROM api_keys'
    ).first();

    const { results } = await c.env.DB.prepare(
      `SELECT u.id, u.email, u.name,
              (SELECT tier FROM api_keys WHERE user_id = u.id AND is_active = 1 ORDER BY created_at DESC LIMIT 1) as tier,
              (SELECT COUNT(*) FROM api_keys WHERE user_id = u.id) as key_count,
              (SELECT COALESCE(SUM(calls_count), 0) FROM api_usage_daily WHERE user_id = u.id AND date = date('now')) as calls_today,
              (SELECT MAX(created_at) FROM api_request_logs WHERE user_id = u.id) as last_request_at
       FROM api_keys k
       JOIN users u ON k.user_id = u.id
       GROUP BY u.id
       ORDER BY last_request_at DESC NULLS LAST
       LIMIT ? OFFSET ?`
    ).bind(limit, offset).all();

    return c.json({
      users: results,
      total: totalRow?.count || 0,
      page,
      totalPages: Math.max(1, Math.ceil((totalRow?.count || 0) / limit)),
    });
  } catch (e) {
    return c.json({ error: 'Failed to load users.' }, 500);
  }
});

// Change user's API tier
apiServiceAdmin.patch('/users/:id/tier', async (c) => {
  const userId = c.req.param('id');
  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }

  const { tier } = body || {};
  if (!['free', 'pro', 'enterprise'].includes(tier)) {
    return c.json({ error: 'Tier must be free, pro, or enterprise.' }, 400);
  }

  try {
    await c.env.DB.prepare(
      'UPDATE api_keys SET tier = ?, requests_today = 0 WHERE user_id = ? AND is_active = 1'
    ).bind(tier, userId).run();

    return c.json({ ok: true, message: `User tier updated to ${tier}.` });
  } catch (e) {
    return c.json({ error: 'Failed to update tier.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// USAGE — Global platform usage
// ═══════════════════════════════════════════════════════════

apiServiceAdmin.get('/usage/global', async (c) => {
  const days = Math.min(90, Math.max(1, parseInt(c.req.query('days') || '30', 10) || 30));

  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().slice(0, 10);

    // Daily totals
    const { results: dailyTotals } = await c.env.DB.prepare(
      'SELECT date, SUM(calls_count) as total_calls, SUM(error_count) as total_errors FROM api_usage_daily WHERE date >= ? GROUP BY date ORDER BY date ASC'
    ).bind(sinceStr).all();

    // By tier
    const { results: byTier } = await c.env.DB.prepare(
      `SELECT k.tier, COALESCE(SUM(u.calls_count), 0) as total_calls
       FROM api_keys k
       LEFT JOIN api_usage_daily u ON k.id = u.api_key_id AND u.date >= ?
       WHERE k.is_active = 1
       GROUP BY k.tier`
    ).bind(sinceStr).all();

    // By endpoint
    const { results: byEndpoint } = await c.env.DB.prepare(
      `SELECT endpoint, COUNT(*) as count, AVG(response_time_ms) as avg_response_time
       FROM api_request_logs
       WHERE created_at >= datetime('now', '-' || ? || ' days')
       GROUP BY endpoint
       ORDER BY count DESC
       LIMIT 20`
    ).bind(days).all();

    return c.json({
      dailyTotals,
      byTier,
      byEndpoint,
      periodDays: days,
    });
  } catch (e) {
    return c.json({ error: 'Failed to load global usage.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// WEBHOOKS — All webhooks across platform
// ═══════════════════════════════════════════════════════════

apiServiceAdmin.get('/webhooks', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20', 10) || 20));
  const offset = (page - 1) * limit;

  try {
    const totalRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM api_webhooks').first();

    const { results } = await c.env.DB.prepare(
      `SELECT w.*, u.email as user_email
       FROM api_webhooks w
       LEFT JOIN users u ON w.user_id = u.id
       ORDER BY w.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(limit, offset).all();

    return c.json({
      webhooks: results.map(w => ({
        ...w,
        events: JSON.parse(w.events || '[]'),
        secret: '****',
      })),
      total: totalRow?.count || 0,
      page,
      totalPages: Math.max(1, Math.ceil((totalRow?.count || 0) / limit)),
    });
  } catch (e) {
    return c.json({ error: 'Failed to load webhooks.' }, 500);
  }
});

apiServiceAdmin.get('/webhooks/:id/logs', async (c) => {
  const webhookId = c.req.param('id');

  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM api_webhook_logs WHERE webhook_id = ? ORDER BY created_at DESC LIMIT 100'
    ).bind(webhookId).all();

    return c.json({ logs: results });
  } catch (e) {
    return c.json({ error: 'Failed to load webhook logs.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// ALERTS — All alerts across platform
// ═══════════════════════════════════════════════════════════

apiServiceAdmin.get('/alerts', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT a.*, u.email as user_email
       FROM api_usage_alerts a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC`
    ).all();

    return c.json({ alerts: results });
  } catch (e) {
    return c.json({ error: 'Failed to load alerts.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// LOGS — Global request logs
// ═══════════════════════════════════════════════════════════

apiServiceAdmin.get('/logs', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '30', 10) || 30));
  const offset = (page - 1) * limit;
  const userIdFilter = c.req.query('user_id');
  const statusFilter = c.req.query('status');
  const endpointFilter = c.req.query('endpoint');

  try {
    const whereClauses = [];
    const whereValues = [];

    if (userIdFilter) {
      whereClauses.push('l.user_id = ?');
      whereValues.push(userIdFilter);
    }
    if (statusFilter) {
      if (statusFilter === '2xx') whereClauses.push('l.status_code >= 200 AND l.status_code < 300');
      else if (statusFilter === '4xx') whereClauses.push('l.status_code >= 400 AND l.status_code < 500');
      else if (statusFilter === '5xx') whereClauses.push('l.status_code >= 500 AND l.status_code < 600');
    }
    if (endpointFilter) {
      whereClauses.push('l.endpoint LIKE ?');
      whereValues.push(`%${endpointFilter}%`);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const totalRow = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM api_request_logs l ${whereSql}`
    ).bind(...whereValues).first();

    const { results } = await c.env.DB.prepare(
      `SELECT l.*, u.email as user_email
       FROM api_request_logs l
       LEFT JOIN users u ON l.user_id = u.id
       ${whereSql}
       ORDER BY l.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(...whereValues, limit, offset).all();

    return c.json({
      logs: results,
      total: totalRow?.count || 0,
      page,
      totalPages: Math.max(1, Math.ceil((totalRow?.count || 0) / limit)),
    });
  } catch (e) {
    return c.json({ error: 'Failed to load logs.' }, 500);
  }
});

export default apiServiceAdmin;