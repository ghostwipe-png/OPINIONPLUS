import { Hono } from 'hono';
import { requireAdmin, requireRoot, requirePin } from '../middleware/auth.js';
import apiServiceAdmin from './api-service-admin.js';
import { getAllFeatureFlags, setFeatureFlag } from '../middleware/featureFlags.js';
import { getCircuitBreakerStatus, resetCircuitBreaker } from '../middleware/circuitBreaker.js';
import { getBlacklist, blockIp, unblockIp } from '../middleware/ipBlacklist.js';

const admin = new Hono();
admin.use('*', requireAdmin);

async function log(c, action, target, detail = '') {
  const user = c.get('user');
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  await c.env.DB.prepare(
    'INSERT INTO admin_logs (id, actor_email, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(crypto.randomUUID(), user.email, action, target, detail, ip)
    .run();
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ═══════════════════════════════════════════════════════════════════════════
// NEW: Feature Flags Management (Root Only)
// ═══════════════════════════════════════════════════════════════════════════

admin.get('/feature-flags', requireRoot, async (c) => {
  try {
    const flags = await getAllFeatureFlags(c.env);
    return c.json({ flags });
  } catch (e) {
    return c.json({ error: 'Failed to load feature flags.' }, 500);
  }
});

admin.put('/feature-flags/:key', requireRoot, requirePin, async (c) => {
  const key = c.req.param('key');
  const body = await c.req.json().catch(() => ({}));
  const value = String(body.value ?? 'true');
  const user = c.get('user');

  try {
    const result = await setFeatureFlag(c.env, key, value, user.email);
    await log(c, 'update_feature_flag', key, `Set to ${value}`);
    return c.json(result);
  } catch (e) {
    return c.json({ error: 'Failed to update feature flag.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// NEW: Circuit Breaker Management (Root Only)
// ═══════════════════════════════════════════════════════════════════════════

admin.get('/circuit-breakers', requireRoot, async (c) => {
  try {
    const status = await getCircuitBreakerStatus(c.env);
    return c.json({ breakers: status });
  } catch (e) {
    return c.json({ error: 'Failed to load circuit breaker status.' }, 500);
  }
});

admin.post('/circuit-breakers/:name/reset', requireRoot, requirePin, async (c) => {
  const name = c.req.param('name');
  const user = c.get('user');

  try {
    const result = await resetCircuitBreaker(c.env, name);
    await log(c, 'reset_circuit_breaker', name);
    return c.json(result);
  } catch (e) {
    return c.json({ error: 'Failed to reset circuit breaker.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// NEW: IP Blacklist Management (Root Only)
// ═══════════════════════════════════════════════════════════════════════════

admin.get('/ip-blacklist', requireRoot, async (c) => {
  const page = parseInt(c.req.query('page') || '1', 10);
  try {
    const result = await getBlacklist(c.env, page);
    return c.json(result);
  } catch (e) {
    return c.json({ error: 'Failed to load IP blacklist.' }, 500);
  }
});

admin.post('/ip-blacklist', requireRoot, requirePin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const ip = body.ip;
  const reason = body.reason || 'Manual block by admin';
  const permanent = !!body.permanent;

  if (!ip) return c.json({ error: 'IP address is required.' }, 400);

  try {
    const result = await blockIp(c.env, ip, reason, permanent);
    await log(c, permanent ? 'permanent_block_ip' : 'temp_block_ip', ip, reason);
    return c.json(result);
  } catch (e) {
    return c.json({ error: 'Failed to block IP.' }, 500);
  }
});

admin.delete('/ip-blacklist/:ip', requireRoot, requirePin, async (c) => {
  const ip = c.req.param('ip');

  try {
    const result = await unblockIp(c.env, ip);
    await log(c, 'unblock_ip', ip);
    return c.json(result);
  } catch (e) {
    return c.json({ error: 'Failed to unblock IP.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// NEW: Cron Job Management (Root Only)
// ═══════════════════════════════════════════════════════════════════════════

admin.get('/cron-jobs', requireRoot, async (c) => {
  const limit = parseInt(c.req.query('limit') || '50', 10);
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM cron_job_log ORDER BY created_at DESC LIMIT ?'
    ).bind(limit).all();
    return c.json({ jobs: results || [] });
  } catch (e) {
    return c.json({ jobs: [], error: 'Failed to load cron job logs.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// NEW: Slow Query Log (Root Only)
// ═══════════════════════════════════════════════════════════════════════════

admin.get('/slow-queries', requireRoot, async (c) => {
  const limit = parseInt(c.req.query('limit') || '50', 10);
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM slow_query_log ORDER BY created_at DESC LIMIT ?'
    ).bind(limit).all();
    return c.json({ queries: results || [] });
  } catch (e) {
    return c.json({ queries: [], error: 'Failed to load slow queries.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// NEW: Error Aggregation (Root Only)
// ═══════════════════════════════════════════════════════════════════════════

admin.get('/errors', requireRoot, async (c) => {
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const offset = (page - 1) * limit;
  const resolved = c.req.query('resolved') === 'true';

  try {
    const totalRow = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM error_aggregation WHERE resolved = ?'
    ).bind(resolved ? 1 : 0).first();

    const { results } = await c.env.DB.prepare(
      'SELECT * FROM error_aggregation WHERE resolved = ? ORDER BY last_seen_at DESC LIMIT ? OFFSET ?'
    ).bind(resolved ? 1 : 0, limit, offset).all();

    return c.json({
      errors: results || [],
      total: totalRow?.count || 0,
      page,
      totalPages: Math.ceil((totalRow?.count || 0) / limit),
    });
  } catch (e) {
    return c.json({ errors: [], error: 'Failed to load errors.' }, 500);
  }
});

admin.post('/errors/:errorKey/resolve', requireRoot, requirePin, async (c) => {
  const errorKey = c.req.param('errorKey');
  try {
    await c.env.DB.prepare(
      'UPDATE error_aggregation SET resolved = 1 WHERE error_key = ?'
    ).bind(errorKey).run();
    await log(c, 'resolve_error', errorKey);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: 'Failed to resolve error.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// NEW: Dead Links Management (Root Only)
// ═══════════════════════════════════════════════════════════════════════════

admin.get('/dead-links', requireRoot, async (c) => {
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const offset = (page - 1) * limit;

  try {
    const totalRow = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM dead_links WHERE resolved = 0'
    ).first();

    const { results } = await c.env.DB.prepare(
      'SELECT * FROM dead_links WHERE resolved = 0 ORDER BY found_at DESC LIMIT ? OFFSET ?'
    ).bind(limit, offset).all();

    return c.json({
      links: results || [],
      total: totalRow?.count || 0,
      page,
      totalPages: Math.ceil((totalRow?.count || 0) / limit),
    });
  } catch (e) {
    return c.json({ links: [], error: 'Failed to load dead links.' }, 500);
  }
});

admin.post('/dead-links/:id/resolve', requireRoot, requirePin, async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare('UPDATE dead_links SET resolved = 1 WHERE id = ?').bind(id).run();
    await log(c, 'resolve_dead_link', id);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: 'Failed to resolve dead link.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// NEW: Real-Time Dashboard Data (Root Only)
// ═══════════════════════════════════════════════════════════════════════════

admin.get('/dashboard/realtime', requireRoot, async (c) => {
  try {
    const now = new Date();
    const fiveMinAgo = new Date(now - 5 * 60 * 1000).toISOString();
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();

    const [activeSessions, recentRequests, recentErrors, dbQueryAvg, totalUsers, totalStories] = await Promise.all([
      c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM users WHERE created_at >= datetime('now', '-5 minutes')"
      ).first().catch(() => ({ count: 0 })),
      c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM admin_logs WHERE created_at >= ?"
      ).bind(fiveMinAgo).first().catch(() => ({ count: 0 })),
      c.env.DB.prepare(
        'SELECT COUNT(*) as count FROM error_aggregation WHERE last_seen_at >= ?'
      ).bind(oneHourAgo).first().catch(() => ({ count: 0 })),
      c.env.DB.prepare(
        "SELECT COALESCE(AVG(duration_ms), 0) as avg FROM slow_query_log WHERE created_at >= datetime('now', '-1 hour')"
      ).first().catch(() => ({ avg: 0 })),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first().catch(() => ({ count: 0 })),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM stories WHERE deleted = 0').first().catch(() => ({ count: 0 })),
    ]);

    return c.json({
      activeUsersRecently: activeSessions?.count || 0,
      adminActionsLast5Min: recentRequests?.count || 0,
      errorsLastHour: recentErrors?.count || 0,
      avgQueryTimeMs: Math.round(dbQueryAvg?.avg || 0),
      totalUsers: totalUsers?.count || 0,
      totalStories: totalStories?.count || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return c.json({ error: 'Failed to load dashboard data.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// NEW: Content Filter Log (Root Only)
// ═══════════════════════════════════════════════════════════════════════════

admin.get('/content-filter-log', requireRoot, async (c) => {
  const limit = parseInt(c.req.query('limit') || '50', 10);
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM content_filter_log ORDER BY created_at DESC LIMIT ?'
    ).bind(limit).all();
    return c.json({ logs: results || [] });
  } catch (e) {
    return c.json({ logs: [], error: 'Failed to load content filter log.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// NEW: Bulk User Operations (Root Only)
// ═══════════════════════════════════════════════════════════════════════════

admin.post('/users/bulk-suspend', requireRoot, requirePin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const userIds = body.user_ids;
  const reason = body.reason || 'Bulk suspension';

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return c.json({ error: 'user_ids array is required.' }, 400);
  }

  if (userIds.length > 100) {
    return c.json({ error: 'Maximum 100 users per bulk operation.' }, 400);
  }

  let count = 0;
  for (const userId of userIds) {
    try {
      await c.env.DB.prepare('UPDATE users SET suspended = 1 WHERE id = ?').bind(userId).run();
      count++;
    } catch (e) { /* skip failed updates */ }
  }

  await log(c, 'bulk_suspend_users', 'MULTIPLE', `Suspended ${count} users. Reason: ${reason}`);
  return c.json({ ok: true, count, total: userIds.length });
});

// ---------------------------------------------------------------------------
// Users & Accounts (existing routes preserved below)
// ---------------------------------------------------------------------------

admin.get('/users', async (c) => {
  const search = c.req.query('q') || '';
  const { results } = await c.env.DB.prepare(
    `SELECT id, email, publisher_name, logo_url, tier, role, suspended, created_at FROM users
     WHERE publisher_name LIKE ? OR email LIKE ? ORDER BY created_at DESC LIMIT 500`
  )
    .bind(`%${search}%`, `%${search}%`)
    .all();
  return c.json({ users: results });
});

admin.patch('/user/:id', requirePin, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  if (body.email !== undefined && !isValidEmail(body.email)) {
    return c.json({ error: 'Invalid email address.' }, 400);
  }
  await c.env.DB.prepare('UPDATE users SET publisher_name = ?, email = ?, tier = ? WHERE id = ?')
    .bind(body.publisherName, body.email, body.tier, id)
    .run();
  await log(c, 'edit_user', id, `Updated details for ${body.email}`);
  return c.json({ ok: true });
});

admin.delete('/user/:id', requireRoot, requirePin, async (c) => {
  const id = c.req.param('id');
  const target = await c.env.DB.prepare('SELECT id, email FROM users WHERE id = ?').bind(id).first();
  if (!target) return c.json({ error: 'User not found.' }, 404);
  if (target.email === c.env.ROOT_ADMIN_EMAIL) return c.json({ error: 'Root admin cannot be deleted.' }, 400);

  try {
    await c.env.DB.prepare(
      "UPDATE users SET suspended = 1, email = ?, publisher_name = 'Deleted User' WHERE id = ?"
    ).bind(`deleted+${id}@opinionplus.invalid`, id).run();
    try {
      await c.env.DB.prepare('UPDATE users SET session_version = IFNULL(session_version, 0) + 1 WHERE id = ?').bind(id).run();
    } catch (e) { /* session_version column may not exist yet */ }
  } catch (e) {
    return c.json({ error: 'Failed to delete user.' }, 500);
  }

  await log(c, 'hard_delete_user', id, `Permanently deleted account for ${target.email}`);
  return c.json({ ok: true });
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

admin.post('/user/:id/force-logout', requireRoot, requirePin, async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare('UPDATE users SET session_version = IFNULL(session_version, 0) + 1 WHERE id = ?').bind(id).run();
    await log(c, 'force_logout_user', id);
  } catch (e) { /* Ignore if session_version column doesn't exist yet */ }
  return c.json({ ok: true });
});

admin.post('/force-logout-all', requireRoot, requirePin, async (c) => {
  try {
    await c.env.DB.prepare('UPDATE users SET session_version = IFNULL(session_version, 0) + 1').run();
    await log(c, 'force_logout_all', 'GLOBAL');
  } catch (e) {}
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Content Management (existing routes preserved)
// ---------------------------------------------------------------------------

admin.get('/stories', async (c) => {
  const type = c.req.query('type');
  let query = 'SELECT * FROM stories WHERE deleted = 0';
  const params = [];
  if (type && type !== 'all') {
    query += ' AND type = ?';
    params.push(type);
  }
  query += ' ORDER BY created_at DESC LIMIT 500';
  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ stories: results });
});

admin.post('/story/:id/feature', requirePin, async (c) => {
  const id = c.req.param('id');
  const { featured } = await c.req.json();
  await c.env.DB.prepare('UPDATE stories SET featured = ? WHERE id = ?').bind(featured ? 1 : 0, id).run();
  await log(c, featured ? 'feature_story' : 'unfeature_story', id);
  return c.json({ ok: true });
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

admin.get('/reports', requirePin, async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM reports ORDER BY created_at DESC').all();
  return c.json({ reports: results });
});

admin.post('/reports/:id/resolve', requirePin, async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE reports SET resolved = 1 WHERE id = ?').bind(id).run();
  await log(c, 'resolve_report', id);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Financial Controls (existing routes preserved)
// ---------------------------------------------------------------------------

admin.post('/credit-adjust', requireRoot, requirePin, async (c) => {
  const { email, amount, reason } = await c.req.json();
  if (!isValidEmail(email)) return c.json({ error: 'Invalid email address.' }, 400);
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount === 0) {
    return c.json({ error: 'Amount must be a non-zero integer.' }, 400);
  }
  const user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (!user) return c.json({ error: 'User not found' }, 404);

  const record = await c.env.DB.prepare('SELECT balance FROM sms_credits WHERE user_id = ?').bind(user.id).first();
  const newBalance = Math.max(0, (record?.balance || 0) + amount);
  await c.env.DB.prepare(
    'INSERT INTO sms_credits (user_id, balance, total_sent) VALUES (?, ?, 0) ON CONFLICT(user_id) DO UPDATE SET balance = ?'
  ).bind(user.id, newBalance, newBalance).run();

  await log(c, 'manual_credit_adjust', user.id, `Adjusted by ${amount}. Reason: ${reason || 'not provided'}. New balance: ${newBalance}`);
  return c.json({ ok: true, amount, newBalance });
});

// ---------------------------------------------------------------------------
// Data Export Center (existing routes preserved)
// ---------------------------------------------------------------------------

admin.get('/export/:entity', requirePin, async (c) => {
  const entity = c.req.param('entity');
  let data = [];
  try {
    if (entity === 'users') data = (await c.env.DB.prepare('SELECT id, email, publisher_name, tier, role, created_at FROM users').all()).results;
    if (entity === 'transactions') data = (await c.env.DB.prepare('SELECT reference, email, amount, credits, status, method, created_at FROM payment_transactions').all()).results;
    if (entity === 'stories') data = (await c.env.DB.prepare('SELECT id, author_id, title, type, privacy, created_at FROM stories WHERE deleted = 0').all()).results;

    if (!data.length) return c.text('No data available', 404);

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;

    c.header('Content-Type', 'text/csv');
    c.header('Content-Disposition', `attachment; filename="export_${entity}_${Date.now()}.csv"`);
    return c.text(csv);
  } catch (e) {
    return c.json({ error: 'Export failed' }, 500);
  }
});

// ---------------------------------------------------------------------------
// System & Security Settings (Root Only — existing routes preserved)
// ---------------------------------------------------------------------------

admin.get('/settings', requireRoot, async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM system_settings').all();
    const settings = results.reduce((acc, row) => ({ ...acc, [row.key]: JSON.parse(row.value) }), {});
    return c.json(settings);
  } catch (e) { return c.json({}); }
});

admin.post('/settings', requireRoot, async (c) => {
  const body = await c.req.json();
  try {
    for (const [key, value] of Object.entries(body)) {
      await c.env.DB.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?')
        .bind(key, JSON.stringify(value), JSON.stringify(value)).run();
    }
    await log(c, 'update_settings', 'GLOBAL');
  } catch (e) { /* Ignore if table doesn't exist yet */ }
  return c.json({ ok: true });
});

admin.post('/clear-cache', requireRoot, async (c) => {
  await log(c, 'clear_cache', 'GLOBAL');
  return c.json({ ok: true });
});

admin.get('/sessions', requireRoot, async (c) => {
  const { results } = await c.env.DB.prepare('SELECT email, created_at as lastActive FROM users ORDER BY created_at DESC LIMIT 10').all();
  return c.json({ sessions: results.map(r => ({ ...r, ip: 'Hidden', device: 'Web Browser' })) });
});

admin.get('/security-events', requireRoot, async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM admin_logs WHERE action LIKE '%force%' OR action LIKE '%admin%' ORDER BY created_at DESC LIMIT 50").all();
  return c.json({ events: results.map(r => ({ type: r.action, detail: r.target, created_at: r.created_at })) });
});

admin.get('/api-keys', requireRoot, async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT name, key FROM api_keys').all();
    return c.json({ keys: results });
  } catch (e) { return c.json({ keys: [] }); }
});

admin.get('/logs', requireRoot, async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 500').all();
  return c.json({ logs: results });
});

// ---------------------------------------------------------------------------
// Root Admins Management (existing routes preserved)
// ---------------------------------------------------------------------------

admin.get('/admins', requireRoot, async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM admins ORDER BY created_at DESC').all();
  return c.json({ admins: results });
});

admin.post('/admins', requireRoot, requirePin, async (c) => {
  const { email } = await c.req.json();
  if (!isValidEmail(email)) return c.json({ error: 'Invalid email address.' }, 400);
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

// ---------------------------------------------------------------------------
// Service Management & Customer Support Tools (Root Only — existing preserved)
// ---------------------------------------------------------------------------

async function adminProvisionService(db, serviceType, packageId, userId, customCredits) {
  if (serviceType === 'sms') {
    let count = customCredits;
    if (!count) {
      const pkg = await db.prepare(`SELECT sms_count FROM sms_packages WHERE id = ?`).bind(packageId).first();
      count = pkg ? pkg.sms_count : 100;
    }
    await db.prepare('INSERT INTO sms_credits (user_id, balance, total_sent) VALUES (?, ?, 0) ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?')
      .bind(userId, count, count).run();
  } else if (serviceType === 'api') {
    const existingKey = await db.prepare('SELECT id FROM api_keys WHERE user_id = ?').bind(userId).first();
    if (!existingKey) {
      const newKey = `op_${crypto.randomUUID().replace(/-/g, '')}`;
      await db.prepare('INSERT INTO api_keys (id, user_id, key, name, tier, requests_today) VALUES (?, ?, ?, ?, ?, 0)')
        .bind(crypto.randomUUID(), userId, newKey, 'Admin Granted Key', packageId).run();
    } else {
      await db.prepare('UPDATE api_keys SET tier = ?, requests_today = 0 WHERE user_id = ?').bind(packageId, userId).run();
    }
  }
}

admin.get('/services/orders', requireRoot, async (c) => {
  const serviceType = c.req.query('serviceType');
  const status = c.req.query('status');
  const userId = c.req.query('userId');
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const offset = (page - 1) * limit;

  let query = 'SELECT o.*, u.email as user_email_resolved, u.publisher_name FROM service_orders o LEFT JOIN users u ON o.user_id = u.id WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) as count FROM service_orders o WHERE 1=1';
  const params = [];
  const countParams = [];

  if (serviceType && serviceType !== 'all') {
    query += ' AND o.service_type = ?';
    countQuery += ' AND o.service_type = ?';
    params.push(serviceType);
    countParams.push(serviceType);
  }
  if (status && status !== 'all') {
    query += ' AND o.status = ?';
    countQuery += ' AND o.status = ?';
    params.push(status);
    countParams.push(status);
  }
  if (userId) {
    query += ' AND o.user_id = ?';
    countQuery += ' AND o.user_id = ?';
    params.push(userId);
    countParams.push(userId);
  }

  query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  const countRes = await c.env.DB.prepare(countQuery).bind(...countParams).first();
  const total = countRes?.count || 0;

  const orders = results.map(o => ({
    ...o,
    user_email: o.user_email || o.user_email_resolved,
    metadata: JSON.parse(o.metadata || '{}')
  }));

  return c.json({ orders, total, page, totalPages: Math.ceil(total / limit) });
});

admin.get('/services/orders/:id', requireRoot, async (c) => {
  const id = c.req.param('id');
  const order = await c.env.DB.prepare('SELECT o.*, u.email as user_email_resolved, u.publisher_name FROM service_orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = ?').bind(id).first();
  if (!order) return c.json({ error: 'Order not found' }, 404);
  return c.json({ order: { ...order, user_email: order.user_email || order.user_email_resolved, metadata: JSON.parse(order.metadata || '{}') } });
});

admin.post('/services/orders/:id/fulfill', requireRoot, requirePin, async (c) => {
  const id = c.req.param('id');
  const update = await c.env.DB.prepare("UPDATE service_orders SET status = ?, paystack_status = ? WHERE id = ? AND status = ?")
    .bind('active', 'success', id, 'pending').run();
  const flipped = (update?.meta?.changes ?? update?.changes ?? 0) > 0;
  if (!flipped) return c.json({ error: 'Order not found or not pending' }, 400);

  const order = await c.env.DB.prepare('SELECT * FROM service_orders WHERE id = ?').bind(id).first();
  await adminProvisionService(c.env.DB, order.service_type, order.package_id, order.user_id);
  await log(c, 'fulfill_order', id, `Fulfilled order ${id} for ${order.user_email}`);
  return c.json({ ok: true });
});

admin.post('/services/orders/:id/cancel', requireRoot, requirePin, async (c) => {
  const id = c.req.param('id');
  const update = await c.env.DB.prepare("UPDATE service_orders SET status = ? WHERE id = ? AND status = ?")
    .bind('cancelled', id, 'pending').run();
  const flipped = (update?.meta?.changes ?? update?.changes ?? 0) > 0;
  if (!flipped) return c.json({ error: 'Only pending orders can be cancelled' }, 400);

  await log(c, 'cancel_order', id, `Cancelled order ${id}`);
  return c.json({ ok: true });
});

admin.post('/services/orders/:id/refund', requireRoot, requirePin, async (c) => {
  const id = c.req.param('id');
  const order = await c.env.DB.prepare('SELECT * FROM service_orders WHERE id = ?').bind(id).first();
  if (!order) return c.json({ error: 'Order not found' }, 404);
  if (order.paystack_status === 'refunded') return c.json({ error: 'Order already refunded.' }, 400);

  const update = await c.env.DB.prepare('UPDATE service_orders SET paystack_status = ?, status = ? WHERE id = ? AND paystack_status != ?')
    .bind('refunded', 'cancelled', id, 'refunded').run();
  const flipped = (update?.meta?.changes ?? update?.changes ?? 0) > 0;

  let creditsDeducted = 0;
  if (flipped && order.service_type === 'sms') {
    const pkg = await c.env.DB.prepare('SELECT sms_count FROM sms_packages WHERE id = ?').bind(order.package_id).first();
    const count = pkg ? pkg.sms_count : 0;
    if (count > 0) {
      await c.env.DB.prepare('UPDATE sms_credits SET balance = MAX(0, balance - ?) WHERE user_id = ?')
        .bind(count, order.user_id).run();
      creditsDeducted = count;
    }
  }

  await log(c, 'refund_order', id, `Marked order ${id} as refunded. Credits deducted: ${creditsDeducted}`);
  return c.json({ ok: true, credits_deducted: creditsDeducted });
});

admin.post('/services/grant', requireRoot, requirePin, async (c) => {
  const { email, serviceType, packageId, credits } = await c.req.json();
  if (!isValidEmail(email)) return c.json({ error: 'Invalid email address.' }, 400);
  if (!serviceType || !packageId) return c.json({ error: 'Missing required fields' }, 400);
  if (credits !== undefined && (typeof credits !== 'number' || !Number.isInteger(credits) || credits < 0)) {
    return c.json({ error: 'Credits must be a non-negative integer.' }, 400);
  }

  const user = await c.env.DB.prepare('SELECT id, email FROM users WHERE email = ?').bind(email).first();
  if (!user) return c.json({ error: 'User not found' }, 404);

  const amountPaid = 0;
  const orderId = crypto.randomUUID();
  const ref = `admin_grant_${crypto.randomUUID()}`;

  await c.env.DB.prepare(
    'INSERT INTO service_orders (id, user_id, user_email, service_type, package_id, amount_paid, paystack_reference, paystack_status, status, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(orderId, user.id, user.email, serviceType, packageId, amountPaid, ref, 'admin_grant', 'active', JSON.stringify({ grantedBy: c.get('user').email })).run();

  await adminProvisionService(c.env.DB, serviceType, packageId, user.id, credits);
  await log(c, 'grant_service', user.email, `Granted ${serviceType} (${packageId}) to ${email}`);
  return c.json({ ok: true, message: `Service granted to ${email}` });
});

admin.post('/services/revoke', requireRoot, requirePin, async (c) => {
  const { email, serviceType, orderId } = await c.req.json();
  if (!isValidEmail(email)) return c.json({ error: 'Invalid email address.' }, 400);
  const user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (!user) return c.json({ error: 'User not found' }, 404);

  if (serviceType === 'sms') {
    await c.env.DB.prepare('UPDATE sms_credits SET balance = 0 WHERE user_id = ?').bind(user.id).run();
  } else if (serviceType === 'api') {
    await c.env.DB.prepare('UPDATE api_keys SET tier = ?, requests_today = 0 WHERE user_id = ?').bind('free', user.id).run();
  }

  if (orderId) {
    await c.env.DB.prepare('UPDATE service_orders SET status = ? WHERE id = ?').bind('cancelled', orderId).run();
  } else {
    await c.env.DB.prepare('UPDATE service_orders SET status = ? WHERE user_id = ? AND service_type = ? AND status = ?').bind('cancelled', user.id, serviceType, 'active').run();
  }

  await log(c, 'revoke_service', email, `Revoked ${serviceType} access for ${email}`);
  return c.json({ ok: true });
});

admin.get('/services/users', requireRoot, async (c) => {
  const search = c.req.query('search') || '';
  const { results: users } = await c.env.DB.prepare(
    `SELECT id, email, publisher_name as name FROM users WHERE email LIKE ? OR publisher_name LIKE ? LIMIT 100`
  ).bind(`%${search}%`, `%${search}%`).all();

  const userList = [];
  for (const u of users) {
    const { results: orders } = await c.env.DB.prepare('SELECT service_type, package_id, status, created_at FROM service_orders WHERE user_id = ? AND status = ?').bind(u.id, 'active').all();
    userList.push({
      id: u.id,
      email: u.email,
      name: u.name,
      activeServices: orders.map(o => ({ serviceType: o.service_type, packageId: o.package_id, status: o.status, grantedAt: o.created_at }))
    });
  }
  return c.json({ users: userList });
});

admin.get('/services/analytics', requireRoot, async (c) => {
  const completedSum = await c.env.DB.prepare("SELECT SUM(amount_paid) as total FROM service_orders WHERE paystack_status = 'success' OR paystack_status = 'admin_grant'").first();
  const totalRevenue = completedSum?.total || 0;

  const { results: byService } = await c.env.DB.prepare("SELECT service_type, SUM(amount_paid) as sum FROM service_orders WHERE paystack_status = 'success' OR paystack_status = 'admin_grant' GROUP BY service_type").all();
  const revenueByService = { sms: 0, press_release: 0, sponsored: 0, api: 0 };
  for (const r of byService) {
    revenueByService[r.service_type] = r.sum || 0;
  }

  const { results: byStatus } = await c.env.DB.prepare("SELECT status, COUNT(*) as count FROM service_orders GROUP BY status").all();
  const ordersByStatus = { pending: 0, active: 0, completed: 0, cancelled: 0 };
  for (const r of byStatus) {
    ordersByStatus[r.status] = r.count || 0;
  }

  const { results: popular } = await c.env.DB.prepare("SELECT package_id, COUNT(*) as count FROM service_orders GROUP BY package_id ORDER BY count DESC LIMIT 5").all();
  const popularPackages = popular;

  const rev30 = await c.env.DB.prepare("SELECT SUM(amount_paid) as total FROM service_orders WHERE (paystack_status = 'success' OR paystack_status = 'admin_grant') AND created_at >= datetime('now', '-30 days')").first();
  const revenueLast30Days = rev30?.total || 0;

  const ord30 = await c.env.DB.prepare("SELECT COUNT(*) as count FROM service_orders WHERE created_at >= datetime('now', '-30 days')").first();
  const ordersLast30Days = ord30?.count || 0;

  return c.json({
    totalRevenue,
    revenueByService,
    ordersByStatus,
    popularPackages,
    revenueLast30Days,
    ordersLast30Days
  });
});

admin.get('/services/export', requireRoot, async (c) => {
  const serviceType = c.req.query('serviceType');
  const status = c.req.query('status');
  const from = c.req.query('from');
  const to = c.req.query('to');

  let query = 'SELECT o.*, u.email as user_email_resolved FROM service_orders o LEFT JOIN users u ON o.user_id = u.id WHERE 1=1';
  const params = [];
  if (serviceType) { query += ' AND o.service_type = ?'; params.push(serviceType); }
  if (status) { query += ' AND o.status = ?'; params.push(status); }
  if (from) { query += ' AND o.created_at >= ?'; params.push(from); }
  if (to) { query += ' AND o.created_at <= ?'; params.push(to); }
  query += ' ORDER BY o.created_at DESC';

  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  if (!results.length) return c.text('No data available', 404);

  const data = results.map(o => ({
    'Order ID': o.id,
    'User Email': o.user_email || o.user_email_resolved,
    'Service Type': o.service_type,
    'Package': o.package_id,
    'Amount (KES)': Number(o.amount_paid) / 100,
    'Status': o.status,
    'Date': o.created_at
  }));

  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');
  const csv = `${headers}\n${rows}`;

  c.header('Content-Type', 'text/csv');
  c.header('Content-Disposition', `attachment; filename="service_orders_${Date.now()}.csv"`);
  return c.text(csv);
});

admin.get('/services/reconcile', requireRoot, async (c) => {
  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return c.json({ error: 'Payment gateway not configured.' }, 500);

  const { results: pending } = await c.env.DB.prepare(
    "SELECT id, paystack_reference, status, paystack_status FROM service_orders WHERE status = 'pending' ORDER BY created_at DESC LIMIT 50"
  ).all();

  const mismatches = [];
  for (const order of pending) {
    try {
      const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(order.paystack_reference)}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      const data = await res.json();
      if (data.status && data.data?.status === 'success') {
        mismatches.push({ orderId: order.id, reference: order.paystack_reference, localStatus: order.status, paystackStatus: data.data.status });
      }
    } catch (e) { /* skip transient errors */ }
  }

  return c.json({ checked: pending.length, mismatches });
});

admin.post('/services/sms/adjust', requireRoot, requirePin, async (c) => {
  const { email, credits, reason } = await c.req.json();
  if (!isValidEmail(email)) return c.json({ error: 'Invalid email address.' }, 400);
  if (typeof credits !== 'number' || !Number.isInteger(credits) || credits === 0) {
    return c.json({ error: 'Credits must be a non-zero integer.' }, 400);
  }
  if (!reason || typeof reason !== 'string') return c.json({ error: 'A reason is required.' }, 400);

  const user = await c.env.DB.prepare('SELECT id, email FROM users WHERE email = ?').bind(email).first();
  if (!user) return c.json({ error: 'User not found' }, 404);

  const creditRecord = await c.env.DB.prepare('SELECT balance FROM sms_credits WHERE user_id = ?').bind(user.id).first();
  const currentBalance = creditRecord?.balance || 0;
  const newBalance = Math.max(0, currentBalance + Number(credits));

  await c.env.DB.prepare('INSERT INTO sms_credits (user_id, balance, total_sent) VALUES (?, ?, 0) ON CONFLICT(user_id) DO UPDATE SET balance = ?')
    .bind(user.id, newBalance, newBalance).run();

  const orderId = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO service_orders (id, user_id, user_email, service_type, package_id, amount_paid, paystack_reference, paystack_status, status, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(orderId, user.id, user.email, 'sms', 'admin_adjustment', 0, `admin_adj_${crypto.randomUUID()}`, 'admin_adjustment', 'completed', JSON.stringify({ creditsChanged: credits, reason, adjustedBy: c.get('user').email })).run();

  await log(c, 'adjust_sms_credits', email, `Adjusted SMS credits by ${credits}. Reason: ${reason}. New balance: ${newBalance}`);
  return c.json({ ok: true, newBalance });
});

// ═══════════════════════════════════════════════════════════════════════════
// NEW: Alert Configuration (Root Only)
// ═══════════════════════════════════════════════════════════════════════════

admin.get('/alerts/config', requireRoot, async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM alert_configs ORDER BY created_at DESC'
    ).all();
    return c.json({ configs: results || [] });
  } catch (e) {
    return c.json({ configs: [], error: 'Failed to load alert configs.' }, 500);
  }
});

admin.post('/alerts/config', requireRoot, requirePin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { alert_type, destination, error_threshold } = body;

  if (!['email', 'sms'].includes(alert_type)) {
    return c.json({ error: 'alert_type must be email or sms.' }, 400);
  }
  if (!destination || typeof destination !== 'string') {
    return c.json({ error: 'destination is required.' }, 400);
  }
  if (alert_type === 'email' && !isValidEmail(destination)) {
    return c.json({ error: 'Invalid email address.' }, 400);
  }
  if (error_threshold && (!Number.isInteger(error_threshold) || error_threshold < 1)) {
    return c.json({ error: 'error_threshold must be a positive integer.' }, 400);
  }

  const id = crypto.randomUUID();
  const threshold = error_threshold || 10;

  await c.env.DB.prepare(
    'INSERT INTO alert_configs (id, alert_type, destination, error_threshold) VALUES (?, ?, ?, ?)'
  ).bind(id, alert_type, destination.trim(), threshold).run();

  await log(c, 'create_alert_config', id, `${alert_type} -> ${destination.trim()} (threshold: ${threshold})`);
  return c.json({ ok: true, config: { id, alert_type, destination: destination.trim(), error_threshold: threshold } });
});

admin.delete('/alerts/config/:id', requireRoot, requirePin, async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM alert_configs WHERE id = ?').bind(id).run();
  await log(c, 'delete_alert_config', id);
  return c.json({ ok: true });
});

admin.get('/alerts/history', requireRoot, async (c) => {
  const limit = parseInt(c.req.query('limit') || '30', 10);
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM alert_history ORDER BY created_at DESC LIMIT ?'
    ).bind(limit).all();
    return c.json({ history: results || [] });
  } catch (e) {
    return c.json({ history: [], error: 'Failed to load alert history.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// NEW: Uptime Dashboard (Root Only)
// ═══════════════════════════════════════════════════════════════════════════

admin.get('/uptime', requireRoot, async (c) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

    // Current month
    const currentMonthLogs = await c.env.DB.prepare(
      "SELECT status, created_at FROM uptime_log WHERE created_at >= ? ORDER BY created_at ASC"
    ).bind(monthStart).all();

    // Last month
    const lastMonthLogs = await c.env.DB.prepare(
      "SELECT status, created_at FROM uptime_log WHERE created_at >= ? AND created_at <= ? ORDER BY created_at ASC"
    ).bind(lastMonthStart, lastMonthEnd).all();

    const calcUptime = (logs) => {
      if (!logs || logs.length === 0) return { percentage: 100, checks: 0, failures: 0 };
      const total = logs.length;
      const failures = logs.filter(l => l.status !== 'ok').length;
      return {
        percentage: total > 0 ? Number(((total - failures) / total * 100).toFixed(2)) : 100,
        checks: total,
        failures,
      };
    };

    const current = calcUptime(currentMonthLogs?.results || []);
    const previous = calcUptime(lastMonthLogs?.results || []);

    // Recent incidents (last 30 days, only failures)
    const incidents = await c.env.DB.prepare(
      "SELECT * FROM uptime_log WHERE status != 'ok' AND created_at >= datetime('now', '-30 days') ORDER BY created_at DESC LIMIT 20"
    ).all();

    // Uptime by service (last 24h)
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const recentLogs = await c.env.DB.prepare(
      "SELECT * FROM uptime_log WHERE created_at >= ? ORDER BY created_at ASC"
    ).bind(oneDayAgo).all();

    const services = {};
    for (const log of (recentLogs?.results || [])) {
      try {
        const detail = JSON.parse(log.detail || '{}');
        if (detail.services) {
          for (const svc of detail.services) {
            if (!services[svc.provider]) {
              services[svc.provider] = { ok: 0, total: 0 };
            }
            services[svc.provider].total++;
            if (svc.status === 'ok') services[svc.provider].ok++;
          }
        }
      } catch (e) {}
    }

    const serviceUptime = Object.entries(services).map(([name, stats]) => ({
      name,
      percentage: stats.total > 0 ? Number(((stats.ok / stats.total) * 100).toFixed(2)) : 100,
      checks: stats.total,
    }));

    return c.json({
      currentMonth: current,
      previousMonth: previous,
      incidents: incidents?.results || [],
      serviceUptime,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return c.json({ error: 'Failed to load uptime data.' }, 500);
  }
});

// Public uptime endpoint (for status badge)
admin.get('/uptime/public', async (c) => {
  try {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const logs = await c.env.DB.prepare(
      "SELECT status FROM uptime_log WHERE created_at >= ?"
    ).bind(monthStart).all();

    const results = logs?.results || [];
    const total = results.length || 1;
    const failures = results.filter(l => l.status !== 'ok').length;
    const percentage = Number(((total - failures) / total * 100).toFixed(2));

    return c.json({
      uptime: percentage,
      period: 'current_month',
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return c.json({ uptime: 100, period: 'current_month' }, 200);
  }
});

admin.route('/api-service', apiServiceAdmin);
export default admin;