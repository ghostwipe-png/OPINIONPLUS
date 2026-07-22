// backend/src/routes/admin.js
import { Hono } from 'hono';
import { requireAdmin, requireRoot, requirePin } from '../middleware/auth.js';

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

async function verifyAdminPinInternal(env, pin) {
  if (!pin || !env.ADMIN_PIN_HASH) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  let diff = 0;
  if (hex.length !== env.ADMIN_PIN_HASH.length) return false;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ env.ADMIN_PIN_HASH.charCodeAt(i);
  return diff === 0;
}

// Ensure requirePin is rock solid inside route manually if middleware falls short
async function validatePin(c) {
  const pin = c.req.header('X-Admin-Pin');
  if (!(await verifyAdminPinInternal(c.env, pin))) {
    await log(c, 'security_alert_invalid_pin', c.req.path);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Users & Accounts
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
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
  const id = c.req.param('id');
  const body = await c.req.json();
  await c.env.DB.prepare('UPDATE users SET publisher_name = ?, email = ?, tier = ? WHERE id = ?')
    .bind(body.publisherName, body.email, body.tier, id)
    .run();
  await log(c, 'edit_user', id, `Updated details for ${body.email}`);
  return c.json({ ok: true });
});

admin.post('/users/:id/suspend', requirePin, async (c) => {
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE users SET suspended = 1 WHERE id = ?').bind(id).run();
  await log(c, 'suspend_user', id);
  return c.json({ ok: true });
});

admin.post('/users/:id/unsuspend', requirePin, async (c) => {
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE users SET suspended = 0 WHERE id = ?').bind(id).run();
  await log(c, 'unsuspend_user', id);
  return c.json({ ok: true });
});

admin.post('/user/:id/force-logout', requireRoot, requirePin, async (c) => {
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare('UPDATE users SET session_version = IFNULL(session_version, 0) + 1 WHERE id = ?').bind(id).run();
    await log(c, 'force_logout_user', id);
  } catch (e) { /* Ignore if session_version column doesn't exist yet */ }
  return c.json({ ok: true });
});

admin.post('/force-logout-all', requireRoot, requirePin, async (c) => {
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
  try {
    await c.env.DB.prepare('UPDATE users SET session_version = IFNULL(session_version, 0) + 1').run();
    await log(c, 'force_logout_all', 'GLOBAL');
  } catch (e) {}
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Content Management
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
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
  const id = c.req.param('id');
  const { featured } = await c.req.json();
  await c.env.DB.prepare('UPDATE stories SET featured = ? WHERE id = ?').bind(featured ? 1 : 0, id).run();
  await log(c, featured ? 'feature_story' : 'unfeature_story', id);
  return c.json({ ok: true });
});

admin.post('/stories/:id/block-media', requirePin, async (c) => {
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE stories SET media_blocked = 1 WHERE id = ?').bind(id).run();
  await log(c, 'block_media', id);
  return c.json({ ok: true });
});

admin.post('/stories/:id/unblock-media', requirePin, async (c) => {
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE stories SET media_blocked = 0 WHERE id = ?').bind(id).run();
  await log(c, 'unblock_media', id);
  return c.json({ ok: true });
});

admin.delete('/stories/:id', requirePin, async (c) => {
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE stories SET deleted = 1 WHERE id = ?').bind(id).run();
  await log(c, 'delete_post', id);
  return c.json({ ok: true });
});

admin.get('/reports', requirePin, async (c) => {
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
  const { results } = await c.env.DB.prepare('SELECT * FROM reports ORDER BY created_at DESC').all();
  return c.json({ reports: results });
});

admin.post('/reports/:id/resolve', requirePin, async (c) => {
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE reports SET resolved = 1 WHERE id = ?').bind(id).run();
  await log(c, 'resolve_report', id);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Financial Controls & Telemetry
// ---------------------------------------------------------------------------

admin.post('/credit-adjust', requireRoot, requirePin, async (c) => {
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
  const { email, amount, reason } = await c.req.json();
  const user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (!user) return c.json({ error: 'User not found' }, 404);
  
  await c.env.DB.prepare(
    'INSERT INTO sms_credits (user_id, balance, total_sent) VALUES (?, MAX(0, ?), 0) ON CONFLICT(user_id) DO UPDATE SET balance = MAX(0, balance + ?)'
  ).bind(user.id, amount, amount).run();
  
  await log(c, 'manual_credit_adjust', user.id, `Adjusted by ${amount}. Reason: ${reason}`);
  return c.json({ ok: true, amount });
});

admin.get('/sms/history', requirePin, async (c) => {
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
  const { results } = await c.env.DB.prepare('SELECT * FROM sms_history ORDER BY created_at DESC LIMIT 200').all();
  return c.json({ history: results });
});

admin.get('/subscriptions/admin/list', requirePin, async (c) => {
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
  const { results } = await c.env.DB.prepare('SELECT * FROM subscribers ORDER BY created_at DESC LIMIT 500').all();
  const activeCount = results.filter(s => s.status === 'active').length;
  return c.json({ subscribers: results, total: results.length, active: activeCount });
});

admin.get('/subscriptions/admin/export', requirePin, async (c) => {
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
  const { results } = await c.env.DB.prepare('SELECT email, preferences, status, created_at FROM subscribers').all();
  if (!results.length) return c.text('No subscribers available', 404);
  
  const headers = Object.keys(results[0]).join(',');
  const rows = results.map(row => Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');
  const csv = `${headers}\n${rows}`;
  
  c.header('Content-Type', 'text/csv');
  c.header('Content-Disposition', `attachment; filename="subscribers_${Date.now()}.csv"`);
  return c.text(csv);
});

// ---------------------------------------------------------------------------
// Data Export Center
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
// System & Security Settings (Root Only)
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
// Root Admins Management
// ---------------------------------------------------------------------------

admin.get('/admins', requireRoot, async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM admins ORDER BY created_at DESC').all();
  return c.json({ admins: results });
});

admin.post('/admins', requireRoot, requirePin, async (c) => {
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
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
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
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
// Service Management & Customer Support Tools (Root Only)
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
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
  try {
    const id = c.req.param('id');
    const order = await c.env.DB.prepare('SELECT * FROM service_orders WHERE id = ?').bind(id).first();
    if (!order) return c.json({ error: 'Order not found' }, 404);
    if (order.status !== 'pending') return c.json({ error: 'Order is not pending' }, 400);

    await c.env.DB.prepare('UPDATE service_orders SET status = ?, paystack_status = ? WHERE id = ? AND status = ?').bind('active', 'success', id, 'pending').run();
    await adminProvisionService(c.env.DB, order.service_type, order.package_id, order.user_id);
    await log(c, 'fulfill_order', id, `Fulfilled order ${id} for ${order.user_email}`);
    return c.json({ ok: true });
  } catch (e) { return c.json({ error: 'Internal Server Error', detail: e.message }, 500); }
});

admin.post('/services/orders/:id/cancel', requireRoot, requirePin, async (c) => {
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
  try {
    const id = c.req.param('id');
    const order = await c.env.DB.prepare('SELECT * FROM service_orders WHERE id = ?').bind(id).first();
    if (!order) return c.json({ error: 'Order not found' }, 404);
    if (order.status !== 'pending') return c.json({ error: 'Only pending orders can be cancelled' }, 400);

    await c.env.DB.prepare('UPDATE service_orders SET status = ? WHERE id = ?').bind('cancelled', id).run();
    await log(c, 'cancel_order', id, `Cancelled order ${id}`);
    return c.json({ ok: true });
  } catch (e) { return c.json({ error: 'Internal Server Error', detail: e.message }, 500); }
});

admin.post('/services/orders/:id/refund', requireRoot, requirePin, async (c) => {
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
  try {
    const id = c.req.param('id');
    const order = await c.env.DB.prepare('SELECT * FROM service_orders WHERE id = ?').bind(id).first();
    if (!order) return c.json({ error: 'Order not found' }, 404);

    await c.env.DB.prepare('UPDATE service_orders SET paystack_status = ?, status = ? WHERE id = ?').bind('refunded', 'cancelled', id).run();
    await log(c, 'refund_order', id, `Marked order ${id} as refunded`);
    return c.json({ ok: true });
  } catch (e) { return c.json({ error: 'Internal Server Error', detail: e.message }, 500); }
});

admin.post('/services/grant', requireRoot, requirePin, async (c) => {
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
  try {
    const { email, serviceType, packageId, credits } = await c.req.json();
    if (!email || !serviceType || !packageId) return c.json({ error: 'Missing required fields' }, 400);

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
  } catch (e) { return c.json({ error: 'Internal Server Error', detail: e.message }, 500); }
});

admin.post('/services/revoke', requireRoot, requirePin, async (c) => {
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
  try {
    const { email, serviceType, orderId } = await c.req.json();
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
  } catch (e) { return c.json({ error: 'Internal Server Error', detail: e.message }, 500); }
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

admin.post('/services/sms/adjust', requireRoot, requirePin, async (c) => {
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
  try {
    const { email, credits, reason } = await c.req.json();
    if (!email || credits === undefined || !reason) return c.json({ error: 'Missing required fields' }, 400);

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
  } catch (e) { return c.json({ error: 'Internal Server Error', detail: e.message }, 500); }
});

// ---------------------------------------------------------------------------
// Campus Management
// ---------------------------------------------------------------------------

admin.get('/campuses', requireRoot, async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM campus_editions ORDER BY created_at DESC').all();
  return c.json({ campuses: results });
});

admin.post('/campuses/:id/suspend', requireRoot, requirePin, async (c) => {
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
  const id = c.req.param('id');
  await c.env.DB.prepare("UPDATE campus_editions SET status = 'suspended' WHERE id = ?").bind(id).run();
  await log(c, 'suspend_campus', id);
  return c.json({ ok: true });
});

admin.post('/campuses/:id/activate', requireRoot, requirePin, async (c) => {
  if (!(await validatePin(c))) return c.json({ error: 'Incorrect PIN.' }, 401);
  const id = c.req.param('id');
  await c.env.DB.prepare("UPDATE campus_editions SET status = 'active' WHERE id = ?").bind(id).run();
  await log(c, 'activate_campus', id);
  return c.json({ ok: true });
});

export default admin;