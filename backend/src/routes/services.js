// backend/src/routes/services.js
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { verifyPaystackWebhook } from '../middleware/paystackWebhook.js';

const services = new Hono();

const SERVICE_TABLES = {
  sms: 'sms_packages',
  press_release: 'press_release_packages',
  sponsored: 'sponsored_packages',
  api: 'api_packages'
};

// ---------------------------------------------------------------------------
// Rate Limiter & Helpers
// ---------------------------------------------------------------------------
const __webhookHits = new Map();
const WEBHOOK_RATE_LIMIT = 30;
const WEBHOOK_RATE_WINDOW_MS = 60 * 1000;

function checkWebhookRateLimit(ip) {
  const now = Date.now();
  const hits = (__webhookHits.get(ip) || []).filter((t) => now - t < WEBHOOK_RATE_WINDOW_MS);
  hits.push(now);
  __webhookHits.set(ip, hits);
  if (__webhookHits.size > 5000) {
    for (const [key, arr] of __webhookHits) {
      if (!arr.some((t) => now - t < WEBHOOK_RATE_WINDOW_MS)) __webhookHits.delete(key);
    }
  }
  return hits.length <= WEBHOOK_RATE_LIMIT;
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function logEvent(c, action, payload = {}) {
  try {
    console.log(JSON.stringify({ kind: 'service_log', action, timestamp: new Date().toISOString(), ...payload }));
  } catch (e) { /* ignore log errors */ }
}

async function provisionService(db, order) {
  const { user_id, user_email, service_type, package_id } = order;

  if (service_type === 'sms') {
    const pkg = await db.prepare(`SELECT sms_count FROM sms_packages WHERE id = ?`).bind(package_id).first();
    const count = pkg ? pkg.sms_count : 100;
    await db.prepare('INSERT INTO sms_credits (user_id, balance, total_sent) VALUES (?, ?, 0) ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?')
      .bind(user_id, count, count).run();
    console.log(`SMS credits added: ${count} for user ${user_email}`);
  } else if (service_type === 'press_release') {
    console.log(`Press release package activated: ${package_id} for user ${user_email}`);
  } else if (service_type === 'sponsored') {
    const pkg = await db.prepare(`SELECT duration_days, impressions_goal FROM sponsored_packages WHERE id = ?`).bind(package_id).first();
    if (pkg) {
      await db.prepare('UPDATE service_orders SET metadata = json_insert(metadata, "$.duration_days", ?, "$.impressions_goal", ?) WHERE id = ?')
        .bind(pkg.duration_days, pkg.impressions_goal, order.id).run();
      console.log(`Sponsored content package activated for ${pkg.duration_days} days for user ${user_email}`);
    }
  } else if (service_type === 'api') {
    const pkg = await db.prepare(`SELECT requests_per_day FROM api_packages WHERE id = ?`).bind(package_id).first();
    const tier = package_id || (pkg ? package_id : 'pro');
    const existingKey = await db.prepare('SELECT id FROM api_keys WHERE user_id = ?').bind(user_id).first();
    if (!existingKey) {
      const newKey = `op_${crypto.randomUUID().replace(/-/g, '')}`;
      await db.prepare('INSERT INTO api_keys (id, user_id, key, name, tier, requests_today) VALUES (?, ?, ?, ?, ?, 0)')
        .bind(crypto.randomUUID(), user_id, newKey, 'Default Production Key', tier).run();
    } else {
      await db.prepare('UPDATE api_keys SET tier = ?, requests_today = 0 WHERE user_id = ?').bind(tier, user_id).run();
    }
    console.log(`API access upgraded to ${tier} for user ${user_email}`);
  }
}

// ---------------------------------------------------------------------------
// Packages & Payments
// ---------------------------------------------------------------------------

services.get('/packages/:serviceType', async (c) => {
  const serviceType = c.req.param('serviceType');
  const table = SERVICE_TABLES[serviceType];
  if (!table) return c.json({ error: 'Invalid service type.' }, 400);

  try {
    const { results } = await c.env.DB.prepare(`SELECT * FROM ${table} WHERE is_active = 1`).all();
    const packages = results.map(pkg => ({
      ...pkg,
      features: pkg.features ? JSON.parse(pkg.features) : undefined
    }));
    return c.json({ packages });
  } catch (e) {
    return c.json({ error: 'Failed to load packages.' }, 500);
  }
});

services.post('/pay', requireAuth, async (c) => {
  const user = c.get('user');
  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid request body.' }, 400); }

  const { serviceType, packageId, metadata = {}, idempotency_key: idempotencyKey } = body;

  if (typeof serviceType !== 'string' || typeof packageId !== 'string') {
    return c.json({ error: 'serviceType and packageId are required.' }, 400);
  }

  const table = SERVICE_TABLES[serviceType];
  if (!table) return c.json({ error: 'Invalid service type.' }, 400);

  if (idempotencyKey && typeof idempotencyKey === 'string') {
    try {
      const existing = await c.env.DB.prepare(
        'SELECT * FROM service_orders WHERE user_id = ? AND json_extract(metadata, "$.idempotencyKey") = ? LIMIT 1'
      ).bind(user.id, idempotencyKey).first();
      if (existing) {
        if (existing.status === 'active' || existing.paystack_status === 'success') {
          return c.json({ status: existing.status, reference: existing.paystack_reference, idempotent: true });
        }
      }
    } catch (e) { await logEvent(c, 'idempotency_lookup_failed', { message: e.message }); }
  }

  const pkg = await c.env.DB.prepare(`SELECT * FROM ${table} WHERE id = ? AND is_active = 1`).bind(packageId).first();
  if (!pkg) return c.json({ error: 'Invalid or inactive package.' }, 400);

  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return c.json({ error: 'Payment gateway not configured.' }, 500);

  const reference = `srv_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const orderId = crypto.randomUUID();
  const customerEmail = isValidEmail(user.email) ? user.email : 'support@opinionplus.online';

  const storedMetadata = idempotencyKey ? { ...metadata, idempotencyKey } : metadata;

  try {
    await c.env.DB.prepare(
      'INSERT INTO service_orders (id, user_id, user_email, service_type, package_id, amount_paid, paystack_reference, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(orderId, user.id, customerEmail, serviceType, packageId, pkg.price_kes_cents, reference, JSON.stringify(storedMetadata)).run();

    const callbackUrl = `${new URL(c.req.url).origin}/services/${serviceType.replace('_', '-')}?payment=success`;
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: customerEmail,
        amount: pkg.price_kes_cents,
        reference,
        currency: 'KES',
        callback_url: callbackUrl,
        metadata: { userId: user.id, serviceType, packageId, orderId, ...metadata }
      }),
    });

    const data = await response.json();
    if (!data.status) {
      await c.env.DB.prepare('UPDATE service_orders SET paystack_status = ? WHERE id = ?').bind('failed', orderId).run();
      return c.json({ error: data.message || 'Payment initialization failed.' }, 502);
    }

    return c.json({ authorization_url: data.data.authorization_url, reference, amount: pkg.price_kes_cents });
  } catch (e) {
    return c.json({ error: 'Internal server error during payment initialization.' }, 500);
  }
});

services.get('/verify/:reference', requireAuth, async (c) => {
  const reference = c.req.param('reference');
  const user = c.get('user');

  const order = await c.env.DB.prepare('SELECT * FROM service_orders WHERE paystack_reference = ?').bind(reference).first();
  if (!order) return c.json({ error: 'Order not found.' }, 404);
  if (order.user_id !== user.id && user.role !== 'admin' && user.role !== 'root') {
    return c.json({ error: 'Unauthorized access to order.' }, 403);
  }

  if (order.paystack_status === 'success' || order.paystack_status === 'admin_grant' || order.status === 'active') {
    return c.json({ status: order.status, serviceType: order.service_type, packageId: order.package_id });
  }

  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return c.json({ error: 'Gateway not configured.' }, 500);

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` }
    });
    const data = await response.json();

    if (data.status && data.data.status === 'success') {
      if (Number(data.data.amount) !== Number(order.amount_paid)) {
        await c.env.DB.prepare('UPDATE service_orders SET paystack_status = ? WHERE paystack_reference = ? AND paystack_status = ?')
          .bind('failed', reference, 'pending').run();
        return c.json({ error: 'Transaction amount mismatch detected.' }, 400);
      }

      const update = await c.env.DB.prepare('UPDATE service_orders SET paystack_status = ?, status = ? WHERE paystack_reference = ? AND paystack_status = ?')
        .bind('success', 'active', reference, 'pending').run();

      if ((update?.meta?.changes ?? update?.changes ?? 0) > 0) {
        await provisionService(c.env.DB, order);
      }
      return c.json({ status: 'active', serviceType: order.service_type, packageId: order.package_id });
    }

    return c.json({ error: 'Payment not successful yet.', status: data.data?.status }, 400);
  } catch (e) {
    return c.json({ error: 'Verification failed.' }, 500);
  }
});

// ACTIVE CHECK ENDPOINT: Uses user_id OR user_email to safely verify Root Admins
services.get('/check/:serviceType', requireAuth, async (c) => {
  const user = c.get('user');
  const serviceType = c.req.param('serviceType');

  try {
    const activeOrder = await c.env.DB.prepare(
      "SELECT * FROM service_orders WHERE (user_id = ? OR user_email = ?) AND service_type = ? AND (paystack_status = 'success' OR paystack_status = 'admin_grant') AND status = 'active' ORDER BY created_at DESC LIMIT 1"
    ).bind(user.id, user.email, serviceType).first();

    if (!activeOrder) {
      return c.json({ active: false });
    }

    return c.json({
      active: true,
      serviceType: activeOrder.service_type,
      packageId: activeOrder.package_id,
      createdAt: activeOrder.created_at
    });
  } catch (e) {
    return c.json({ active: false, error: 'Failed to verify active service.' }, 500);
  }
});

services.post('/webhook', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  if (!checkWebhookRateLimit(ip)) return c.json({ error: 'Too many requests.' }, 429);

  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return c.json({ error: 'Not configured.' }, 500);

  const { valid, body } = await verifyPaystackWebhook(c.req.raw, secretKey);
  if (!valid) return c.json({ error: 'SECURITY ALERT: Invalid Signature.' }, 401);

  if (body && body.event === 'charge.success') {
    const reference = body.data?.reference;
    try {
      const order = await c.env.DB.prepare('SELECT * FROM service_orders WHERE paystack_reference = ?').bind(reference).first();
      if (order) {
        const update = await c.env.DB.prepare('UPDATE service_orders SET paystack_status = ?, status = ? WHERE paystack_reference = ? AND paystack_status = ?')
          .bind('success', 'active', reference, 'pending').run();

        if ((update?.meta?.changes ?? update?.changes ?? 0) > 0) {
          await provisionService(c.env.DB, order);
        }
      }
    } catch (e) {
      await logEvent(c, 'webhook_provision_error', { reference, message: e.message });
    }
  }

  return c.json({ received: true }, 200);
});

services.get('/orders', requireAuth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare('SELECT * FROM service_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').bind(user.id).all();
  return c.json({ orders: results.map(r => ({ ...r, metadata: JSON.parse(r.metadata || '{}') })) });
});

services.get('/orders/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const order = await c.env.DB.prepare('SELECT * FROM service_orders WHERE id = ?').bind(id).first();

  if (!order) return c.json({ error: 'Not found' }, 404);
  if (order.user_id !== user.id && user.role !== 'admin' && user.role !== 'root') return c.json({ error: 'Unauthorized' }, 403);

  return c.json({ order: { ...order, metadata: JSON.parse(order.metadata || '{}') } });
});

// ---------------------------------------------------------------------------
// Execution & Content Dispatch Endpoints (Restored + Dual Checked)
// ---------------------------------------------------------------------------

services.get('/user/sms-credits', requireAuth, async (c) => {
  const user = c.get('user');
  try {
    const creditRecord = await c.env.DB.prepare('SELECT balance FROM sms_credits WHERE user_id = ?').bind(user.id).first();
    return c.json({ balance: creditRecord?.balance || 0 });
  } catch (e) {
    return c.json({ balance: 0, error: 'Failed to fetch credit balance.' }, 500);
  }
});

services.post('/sms/send', requireAuth, async (c) => {
  const user = c.get('user');
  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }

  const { recipients, message } = body || {};
  if (!recipients || !message) return c.json({ error: 'Recipients and message content are required.' }, 400);

  const recipientList = String(recipients).split(',').map(r => r.trim()).filter(Boolean);
  const cost = recipientList.length;

  if (cost === 0) return c.json({ error: 'No valid phone numbers supplied.' }, 400);

  const creditRecord = await c.env.DB.prepare('SELECT balance FROM sms_credits WHERE user_id = ?').bind(user.id).first();
  if (!creditRecord || creditRecord.balance < cost) {
    return c.json({ error: `Insufficient SMS credits. Required: ${cost}, Balance: ${creditRecord?.balance || 0}` }, 403);
  }

  try {
    const update = await c.env.DB.prepare('UPDATE sms_credits SET balance = balance - ?, total_sent = total_sent + ? WHERE user_id = ? AND balance >= ?')
      .bind(cost, cost, user.id, cost).run();

    const deducted = (update?.meta?.changes ?? update?.changes ?? 0) > 0;
    if (!deducted) return c.json({ error: 'Transaction collision or insufficient balance.' }, 409);

    const smsId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO sms_history (id, user_id, message, recipients, recipient_count, cost, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(smsId, user.id, message, recipientList.join(','), cost, cost, 'delivered').run();

    return c.json({ success: true, dispatched: cost, messageId: smsId });
  } catch (e) {
    return c.json({ error: 'Failed to process SMS dispatch.' }, 500);
  }
});

// PRESS RELEASE DISPATCH ENDPOINT: Uses user_id OR user_email to safely verify Root Admins
services.post('/content/press-release', requireAuth, async (c) => {
  const user = c.get('user');
  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }

  const { title, content, company } = body || {};
  if (!title || !content || !company) return c.json({ error: 'Title, content, and company name are required.' }, 400);

  const order = await c.env.DB.prepare(
    "SELECT id FROM service_orders WHERE (user_id = ? OR user_email = ?) AND service_type = 'press_release' AND status = 'active' AND (paystack_status = 'success' OR paystack_status = 'admin_grant') ORDER BY created_at DESC LIMIT 1"
  ).bind(user.id, user.email).first();

  if (!order) return c.json({ error: 'No active press release order found. Please purchase or renew a package.' }, 403);

  try {
    const storyId = crypto.randomUUID();
    const fullTitle = `${company}: ${title}`;

    await c.env.DB.prepare(
      'INSERT INTO stories (id, author_id, title, body, type, privacy, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))'
    ).bind(storyId, user.id, fullTitle, content, 'press_release', 'public').run();

    await c.env.DB.prepare("UPDATE service_orders SET status = 'completed', updated_at = datetime('now') WHERE id = ?").bind(order.id).run();

    return c.json({ success: true, storyId });
  } catch (e) {
    return c.json({ error: 'Failed to submit press release.' }, 500);
  }
});

// SPONSORED DISPATCH ENDPOINT: Uses user_id OR user_email to safely verify Root Admins
services.post('/content/sponsored', requireAuth, async (c) => {
  const user = c.get('user');
  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }

  const { headline, body: content, ctaUrl, orderId } = body || {};
  if (!headline || !content || !ctaUrl) return c.json({ error: 'Headline, content body, and CTA URL are required.' }, 400);

  try {
    let order;
    if (orderId) {
      order = await c.env.DB.prepare(
        "SELECT * FROM service_orders WHERE id = ? AND (user_id = ? OR user_email = ?) AND service_type = 'sponsored' AND status = 'active' AND (paystack_status = 'success' OR paystack_status = 'admin_grant')"
      ).bind(orderId, user.id, user.email).first();
    } else {
      order = await c.env.DB.prepare(
        "SELECT * FROM service_orders WHERE (user_id = ? OR user_email = ?) AND service_type = 'sponsored' AND status = 'active' AND (paystack_status = 'success' OR paystack_status = 'admin_grant') ORDER BY created_at DESC LIMIT 1"
      ).bind(user.id, user.email).first();
    }

    if (!order) return c.json({ error: 'No active sponsored placement order found.' }, 403);

    // 1. Update order metadata
    const metadata = JSON.parse(order.metadata || '{}');
    metadata.campaign = { headline, body: content, ctaUrl, updatedAt: new Date().toISOString() };

    await c.env.DB.prepare('UPDATE service_orders SET metadata = ? WHERE id = ?')
      .bind(JSON.stringify(metadata), order.id).run();

    // 2. Insert or update entry in the stories table so it appears on the homepage feed
    const existingStory = await c.env.DB.prepare('SELECT id FROM stories WHERE author_id = ? AND type = ? AND title = ?').bind(user.id, 'sponsored', headline).first();
    
    if (!existingStory) {
      const storyId = crypto.randomUUID();
      const formattedBody = `${content}\n\n[Sponsored Link: ${ctaUrl}]`;
      await c.env.DB.prepare(
        'INSERT INTO stories (id, author_id, title, body, type, privacy, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))'
      ).bind(storyId, user.id, headline, formattedBody, 'sponsored', 'public').run();
    }

    await logEvent(c, 'sponsored_campaign_updated', { orderId: order.id, user: user.email });
    return c.json({ success: true, orderId: order.id });
  } catch (e) {
    await logEvent(c, 'sponsored_campaign_error', { message: e.message });
    return c.json({ error: 'Failed to update sponsored campaign.' }, 500);
  }
});

export default services;