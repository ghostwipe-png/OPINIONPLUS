// backend/src/routes/services.js
// NOTE: API service routes have been extracted to ./api-service.js
// API packages, keys, webhooks, logs, etc. are now handled there.
// The shared payment routes below are still used by SMS and Press Release.

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { verifyPaystackWebhook } from '../middleware/paystackWebhook.js';

const services = new Hono();

// NOTE: Sponsored content routes extracted to ./sponsored-service.js
const SERVICE_TABLES = {
  sms: 'sms_packages',
  press_release: 'press_release_packages'
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

function isValidUrl(url) {
  if (typeof url !== 'string' || !url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

const PRESS_KIT_FILE_TYPES = ['image', 'logo', 'pdf', 'document'];
const MAX_PRESS_KIT_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PRESS_KIT_FILES = 10;

// Simple in-memory rate limiter for the public track-view endpoint (per worker isolate)
const __trackViewHits = new Map();
const TRACK_VIEW_RATE_LIMIT = 60;
const TRACK_VIEW_RATE_WINDOW_MS = 60 * 1000;

function checkTrackViewRateLimit(ip) {
  const now = Date.now();
  const hits = (__trackViewHits.get(ip) || []).filter((t) => now - t < TRACK_VIEW_RATE_WINDOW_MS);
  hits.push(now);
  __trackViewHits.set(ip, hits);
  if (__trackViewHits.size > 5000) {
    for (const [key, arr] of __trackViewHits) {
      if (!arr.some((t) => now - t < TRACK_VIEW_RATE_WINDOW_MS)) __trackViewHits.delete(key);
    }
  }
  return hits.length <= TRACK_VIEW_RATE_LIMIT;
}

async function hashIp(ip) {
  try {
    const data = new TextEncoder().encode(String(ip || 'unknown'));
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
  } catch (e) {
    return 'unknown';
  }
}

// Loads a press release and verifies the requesting user owns it (or is admin/root).
// Returns { release } on success, or { error, status } on failure.
async function loadOwnedRelease(c, releaseId) {
  const user = c.get('user');
  const release = await c.env.DB.prepare('SELECT * FROM press_releases WHERE id = ?').bind(releaseId).first();
  if (!release) return { error: 'Press release not found.', status: 404 };
  const isOwner = release.user_id === user.id || (user.email && release.user_email === user.email);
  const isAdmin = user.role === 'admin' || user.role === 'root';
  if (!isOwner && !isAdmin) return { error: 'Unauthorized.', status: 403 };
  return { release };
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
  }
  // NOTE: Sponsored content provisioning moved to ./sponsored-service.js
  // NOTE: API service provisioning moved to ./api-service.js
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

  // API check moved to /api-service/check — redirect if called here
  if (serviceType === 'api') {
    return c.json({ active: false, message: 'API service check moved to /api-service/check' });
  }
  // Sponsored content check moved to /sponsored-service/check — redirect if called here
  if (serviceType === 'sponsored') {
    return c.json({ active: false, message: 'Sponsored content check moved to /sponsored-service/check' });
  }

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
// Execution & Content Dispatch Endpoints
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

// PRESS RELEASE DISPATCH ENDPOINT
services.post('/content/press-release', requireAuth, async (c) => {
  const user = c.get('user');
  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }

  const {
    title, content, company,
    media_contact_name, media_contact_email, media_contact_phone,
    company_logo_url, company_website,
    meta_title, meta_description, meta_keywords,
    target_category, target_region, target_county,
    scheduled_at, embargo_until,
  } = body || {};
  if (!title || !content || !company) return c.json({ error: 'Title, content, and company name are required.' }, 400);

  if (media_contact_email && !isValidEmail(media_contact_email)) {
    return c.json({ error: 'Media contact email is invalid.' }, 400);
  }
  if (company_logo_url && !isValidUrl(company_logo_url)) {
    return c.json({ error: 'Company logo URL is invalid.' }, 400);
  }
  if (company_website && !isValidUrl(company_website)) {
    return c.json({ error: 'Company website URL is invalid.' }, 400);
  }

  const isScheduled = scheduled_at && new Date(scheduled_at).getTime() > Date.now();

  try {
    let storyId = null;
    const fullTitle = `${company}: ${title}`;

    if (!isScheduled) {
      storyId = crypto.randomUUID();
      await c.env.DB.prepare(
        'INSERT INTO stories (id, author_id, title, body, type, privacy, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))'
      ).bind(storyId, user.id, fullTitle, content, 'press_release', 'public').run();
    }

    const releaseId = crypto.randomUUID();
    try {
      await c.env.DB.prepare(
        `INSERT INTO press_releases (
          id, story_id, order_id, user_id, user_email, title, company, content, status,
          scheduled_at, published_at, embargo_until,
          meta_title, meta_description, meta_keywords,
          media_contact_name, media_contact_email, media_contact_phone,
          company_logo_url, company_website,
          target_category, target_region, target_county
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        releaseId, storyId, null, user.id, user.email, title, company, content,
        isScheduled ? 'scheduled' : 'published',
        scheduled_at || null, isScheduled ? null : new Date().toISOString(), embargo_until || null,
        meta_title || null, meta_description || null, meta_keywords || null,
        media_contact_name || null, media_contact_email || null, media_contact_phone || null,
        company_logo_url || null, company_website || null,
        target_category || null, target_region || null, target_county || null
      ).run();
    } catch (innerErr) {
      await logEvent(c, 'press_release_record_create_failed', { message: innerErr.message });
    }

    if (isScheduled) {
      return c.json({ success: true, storyId: null, releaseId, scheduled: true, scheduledAt: scheduled_at });
    }
    return c.json({ success: true, storyId, releaseId });
  } catch (e) {
    return c.json({ error: 'Failed to submit press release.' }, 500);
  }
});

// NOTE: Sponsored content dispatch/campaign-management endpoints extracted to
// ./sponsored-service.js (see POST /sponsored-service/campaigns). The legacy
// service_orders-based sponsored flow this endpoint depended on has been
// replaced by the sponsored_campaigns table, so this route is intentionally
// no longer defined here.

// ---------------------------------------------------------------------------
// Press Release: History, Detail, Edit, Delete
// ---------------------------------------------------------------------------

services.get('/press-release/history', requireAuth, async (c) => {
  const user = c.get('user');
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20', 10) || 20));
  const offset = (page - 1) * limit;

  try {
    const totalRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM press_releases WHERE user_id = ? AND status != "deleted"').bind(user.id).first();
    const total = totalRow?.count || 0;

    const { results } = await c.env.DB.prepare(
      `SELECT pr.*, a.views as analytics_views, a.shares as analytics_shares, a.sms_sent as analytics_sms_sent
       FROM press_releases pr
       LEFT JOIN press_release_analytics a ON a.release_id = pr.id
       WHERE pr.user_id = ? AND pr.status != 'deleted'
       ORDER BY pr.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(user.id, limit, offset).all();

    const releases = results.map(r => ({
      id: r.id, title: r.title, company: r.company, status: r.status,
      created_at: r.created_at, published_at: r.published_at, scheduled_at: r.scheduled_at,
      analytics: { views: r.analytics_views || 0, shares: r.analytics_shares || 0, sms_sent: r.analytics_sms_sent || 0 },
    }));

    return c.json({ releases, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (e) {
    return c.json({ error: 'Failed to load release history.' }, 500);
  }
});

export async function publishScheduledPressReleases(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM press_releases WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= datetime('now')"
  ).all();

  let published = 0;
  for (const release of results) {
    try {
      const storyId = crypto.randomUUID();
      const fullTitle = `${release.company}: ${release.title}`;
      await env.DB.prepare(
        'INSERT INTO stories (id, author_id, title, body, type, privacy, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))'
      ).bind(storyId, release.user_id, fullTitle, release.content, 'press_release', 'public').run();

      await env.DB.prepare(
        "UPDATE press_releases SET status = 'published', story_id = ?, published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
      ).bind(storyId, release.id).run();

      if (release.order_id) {
        await env.DB.prepare("UPDATE service_orders SET status = 'completed', updated_at = datetime('now') WHERE id = ?").bind(release.order_id).run();
      }
      published += 1;
    } catch (innerErr) {
      console.error(JSON.stringify({ kind: 'scheduled_publish_error', releaseId: release.id, message: innerErr.message }));
    }
  }
  return published;
}

services.get('/press-release/admin/list', requireAuth, async (c) => {
  const user = c.get('user');
  if (user.role !== 'admin' && user.role !== 'root') return c.json({ error: 'Forbidden' }, 403);

  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20', 10) || 20));
  const offset = (page - 1) * limit;
  const statusParam = c.req.query('status');
  const q = (c.req.query('q') || '').trim();

  const whereClauses = [];
  const whereValues = [];

  if (statusParam && statusParam !== 'all') {
    whereClauses.push('pr.status = ?');
    whereValues.push(statusParam);
  } else {
    whereClauses.push("pr.status != 'deleted'");
  }
  if (q) {
    whereClauses.push('(pr.title LIKE ? OR pr.company LIKE ?)');
    whereValues.push(`%${q}%`, `%${q}%`);
  }
  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  try {
    const totalRow = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM press_releases pr ${whereSql}`).bind(...whereValues).first();
    const total = totalRow?.count || 0;

    const { results } = await c.env.DB.prepare(
      `SELECT pr.id, pr.title, pr.company, pr.user_email, pr.status, pr.created_at, pr.published_at,
              a.views as views
       FROM press_releases pr
       LEFT JOIN press_release_analytics a ON a.release_id = pr.id
       ${whereSql}
       ORDER BY pr.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(...whereValues, limit, offset).all();

    const [totalReleasesRow, publishedTodayRow, scheduledRow, totalViewsRow] = await Promise.all([
      c.env.DB.prepare("SELECT COUNT(*) as count FROM press_releases WHERE status != 'deleted'").first(),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM press_releases WHERE status = 'published' AND date(published_at) = date('now')").first(),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM press_releases WHERE status = 'scheduled'").first(),
      c.env.DB.prepare('SELECT COALESCE(SUM(views), 0) as total FROM press_release_analytics').first(),
    ]);

    return c.json({
      releases: results,
      total, page, totalPages: Math.max(1, Math.ceil(total / limit)),
      stats: {
        total: totalReleasesRow?.count || 0,
        publishedToday: publishedTodayRow?.count || 0,
        scheduled: scheduledRow?.count || 0,
        totalViews: totalViewsRow?.total || 0,
      },
    });
  } catch (e) {
    return c.json({ error: 'Failed to load press releases.' }, 500);
  }
});

services.post('/press-release/publish-scheduled', async (c) => {
  const token = c.req.query('token') || c.req.header('X-Cron-Secret');
  if (!c.env.CRON_SECRET || token !== c.env.CRON_SECRET) {
    const user = c.get('user');
    if (!user || (user.role !== 'admin' && user.role !== 'root')) {
      return c.json({ error: 'Unauthorized.' }, 401);
    }
  }

  try {
    const published = await publishScheduledPressReleases(c.env);
    return c.json({ published });
  } catch (e) {
    return c.json({ error: 'Failed to publish scheduled releases.' }, 500);
  }
});

services.get('/press-release/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const release = await c.env.DB.prepare('SELECT * FROM press_releases WHERE id = ? AND status != "deleted"').bind(id).first();
    if (!release) return c.json({ error: 'Press release not found.' }, 404);

    const [{ results: kitFiles } = { results: [] }, analytics] = await Promise.all([
      c.env.DB.prepare('SELECT id, file_name, file_url, file_type, file_size FROM press_kits WHERE release_id = ? ORDER BY uploaded_at ASC').bind(id).all(),
      c.env.DB.prepare('SELECT * FROM press_release_analytics WHERE release_id = ?').bind(id).first(),
    ]);

    return c.json({
      release: {
        ...release,
        kit: kitFiles || [],
        analytics: analytics ? { ...analytics, geo_data: JSON.parse(analytics.geo_data || '{}'), daily_views: JSON.parse(analytics.daily_views || '{}') } : null,
      }
    });
  } catch (e) {
    return c.json({ error: 'Failed to load press release.' }, 500);
  }
});

services.patch('/press-release/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  const { release, error, status } = await loadOwnedRelease(c, id);
  if (error) return c.json({ error }, status);

  if (release.published_at) {
    const publishedMs = new Date(release.published_at).getTime();
    if (Date.now() - publishedMs > 24 * 60 * 60 * 1000) {
      return c.json({ error: 'Edits are only allowed within 24 hours of publishing.' }, 403);
    }
  }

  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }

  const allowedFields = [
    'title', 'content', 'company',
    'media_contact_name', 'media_contact_email', 'media_contact_phone',
    'company_logo_url', 'company_website',
    'meta_title', 'meta_description', 'meta_keywords',
    'target_category', 'target_region', 'target_county',
  ];

  if (body.media_contact_email && !isValidEmail(body.media_contact_email)) {
    return c.json({ error: 'Media contact email is invalid.' }, 400);
  }
  if (body.company_logo_url && !isValidUrl(body.company_logo_url)) {
    return c.json({ error: 'Company logo URL is invalid.' }, 400);
  }
  if (body.company_website && !isValidUrl(body.company_website)) {
    return c.json({ error: 'Company website URL is invalid.' }, 400);
  }

  const updates = [];
  const values = [];
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      updates.push(`${field} = ?`);
      values.push(body[field]);
    }
  }
  if (updates.length === 0) return c.json({ error: 'No valid fields to update.' }, 400);

  values.push(id);

  try {
    await c.env.DB.prepare(`UPDATE press_releases SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...values).run();

    if (release.story_id && (body.title || body.content || body.company)) {
      const newTitle = `${body.company || release.company}: ${body.title || release.title}`;
      await c.env.DB.prepare('UPDATE stories SET title = ?, body = ? WHERE id = ?')
        .bind(newTitle, body.content || release.content, release.story_id).run();
    }

    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: 'Failed to update press release.' }, 500);
  }
});

services.delete('/press-release/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  const { release, error, status } = await loadOwnedRelease(c, id);
  if (error) return c.json({ error }, status);

  try {
    await c.env.DB.prepare("UPDATE press_releases SET status = 'deleted', updated_at = datetime('now') WHERE id = ?").bind(id).run();
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: 'Failed to delete press release.' }, 500);
  }
});

// ---------------------------------------------------------------------------
// Press Release: Scheduling
// ---------------------------------------------------------------------------

services.patch('/press-release/:id/schedule', requireAuth, async (c) => {
  const id = c.req.param('id');
  const { release, error, status } = await loadOwnedRelease(c, id);
  if (error) return c.json({ error }, status);
  if (release.status === 'published') return c.json({ error: 'This release is already published.' }, 400);

  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }
  const { scheduled_at } = body || {};

  if (scheduled_at && isNaN(new Date(scheduled_at).getTime())) {
    return c.json({ error: 'scheduled_at must be a valid ISO datetime string.' }, 400);
  }

  const newStatus = scheduled_at ? 'scheduled' : 'draft';

  try {
    await c.env.DB.prepare("UPDATE press_releases SET scheduled_at = ?, status = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(scheduled_at || null, newStatus, id).run();
    return c.json({ ok: true, scheduled_at: scheduled_at || null, status: newStatus });
  } catch (e) {
    return c.json({ error: 'Failed to update schedule.' }, 500);
  }
});

// ---------------------------------------------------------------------------
// Press Release: SEO metadata
// ---------------------------------------------------------------------------

services.patch('/press-release/:id/seo', requireAuth, async (c) => {
  const id = c.req.param('id');
  const { error, status } = await loadOwnedRelease(c, id);
  if (error) return c.json({ error }, status);

  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }
  const { meta_title, meta_description, meta_keywords } = body || {};

  try {
    await c.env.DB.prepare(
      "UPDATE press_releases SET meta_title = ?, meta_description = ?, meta_keywords = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(meta_title || null, meta_description || null, meta_keywords || null, id).run();
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: 'Failed to update SEO metadata.' }, 500);
  }
});

// ---------------------------------------------------------------------------
// Press Release: Analytics
// ---------------------------------------------------------------------------

services.get('/press-release/:id/analytics', requireAuth, async (c) => {
  const id = c.req.param('id');
  const { error, status } = await loadOwnedRelease(c, id);
  if (error) return c.json({ error }, status);

  try {
    const analytics = await c.env.DB.prepare('SELECT * FROM press_release_analytics WHERE release_id = ?').bind(id).first();
    if (!analytics) {
      return c.json({
        analytics: {
          release_id: id, views: 0, unique_views: 0, shares: 0, sms_sent: 0,
          email_sent: 0, click_throughs: 0, avg_read_time_seconds: 0, geo_data: {}, daily_views: {},
        }
      });
    }
    return c.json({
      analytics: {
        ...analytics,
        geo_data: JSON.parse(analytics.geo_data || '{}'),
        daily_views: JSON.parse(analytics.daily_views || '{}'),
      }
    });
  } catch (e) {
    return c.json({ error: 'Failed to load analytics.' }, 500);
  }
});

services.post('/press-release/:id/track-view', async (c) => {
  const id = c.req.param('id');
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  if (!checkTrackViewRateLimit(ip)) return c.json({ error: 'Too many requests.' }, 429);

  try {
    const release = await c.env.DB.prepare('SELECT id FROM press_releases WHERE id = ?').bind(id).first();
    if (!release) return c.json({ error: 'Press release not found.' }, 404);

    const ipHash = await hashIp(ip);
    const today = new Date().toISOString().slice(0, 10);

    const existing = await c.env.DB.prepare('SELECT * FROM press_release_analytics WHERE release_id = ?').bind(id).first();

    if (!existing) {
      const dailyViews = { [today]: 1 };
      const seenIps = { [ipHash]: true };
      await c.env.DB.prepare(
        `INSERT INTO press_release_analytics (release_id, views, unique_views, daily_views, seen_ips, updated_at)
         VALUES (?, 1, 1, ?, ?, datetime('now'))`
      ).bind(id, JSON.stringify(dailyViews), JSON.stringify(seenIps)).run();
    } else {
      const seenIps = JSON.parse(existing.seen_ips || '{}');
      const dailyViews = JSON.parse(existing.daily_views || '{}');
      const isNewUnique = !seenIps[ipHash];
      seenIps[ipHash] = true;
      dailyViews[today] = (dailyViews[today] || 0) + 1;

      await c.env.DB.prepare(
        `UPDATE press_release_analytics
         SET views = views + 1, unique_views = unique_views + ?, daily_views = ?, seen_ips = ?, updated_at = datetime('now')
         WHERE release_id = ?`
      ).bind(isNewUnique ? 1 : 0, JSON.stringify(dailyViews), JSON.stringify(seenIps), id).run();
    }

    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: 'Failed to track view.' }, 500);
  }
});

// ---------------------------------------------------------------------------
// Press Release: Press Kit (attached files)
// ---------------------------------------------------------------------------

services.get('/press-release/:id/kit', async (c) => {
  const id = c.req.param('id');
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, file_name, file_url, file_type, file_size FROM press_kits WHERE release_id = ? ORDER BY uploaded_at ASC'
    ).bind(id).all();
    return c.json({ files: results });
  } catch (e) {
    return c.json({ error: 'Failed to load press kit.' }, 500);
  }
});

services.post('/press-release/:id/kit', requireAuth, async (c) => {
  const id = c.req.param('id');
  const { error, status } = await loadOwnedRelease(c, id);
  if (error) return c.json({ error }, status);

  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }
  const { file_name, file_url, file_type, file_size } = body || {};

  if (!file_name || typeof file_name !== 'string') return c.json({ error: 'file_name is required.' }, 400);
  if (!isValidUrl(file_url)) return c.json({ error: 'file_url must be a valid http(s) URL.' }, 400);
  if (!PRESS_KIT_FILE_TYPES.includes(file_type)) {
    return c.json({ error: `file_type must be one of: ${PRESS_KIT_FILE_TYPES.join(', ')}` }, 400);
  }
  const size = Number(file_size) || 0;
  if (size < 0 || size > MAX_PRESS_KIT_FILE_SIZE) {
    return c.json({ error: 'File size must be between 0 and 10MB.' }, 400);
  }

  try {
    const countRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM press_kits WHERE release_id = ?').bind(id).first();
    if ((countRow?.count || 0) >= MAX_PRESS_KIT_FILES) {
      return c.json({ error: `A press kit can hold at most ${MAX_PRESS_KIT_FILES} files.` }, 400);
    }

    const fileId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO press_kits (id, release_id, file_name, file_url, file_type, file_size) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(fileId, id, file_name, file_url, file_type, size).run();

    return c.json({ file: { id: fileId, file_name, file_url, file_type, file_size: size } });
  } catch (e) {
    return c.json({ error: 'Failed to add file to press kit.' }, 500);
  }
});

services.delete('/press-release/:id/kit/:fileId', requireAuth, async (c) => {
  const id = c.req.param('id');
  const fileId = c.req.param('fileId');
  const { error, status } = await loadOwnedRelease(c, id);
  if (error) return c.json({ error }, status);

  try {
    await c.env.DB.prepare('DELETE FROM press_kits WHERE id = ? AND release_id = ?').bind(fileId, id).run();
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: 'Failed to remove file.' }, 500);
  }
});

// ---------------------------------------------------------------------------
// Press Release: Boost / Promote
// ---------------------------------------------------------------------------

services.post('/press-release/:id/boost', requireAuth, async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const { error, status } = await loadOwnedRelease(c, id);
  if (error) return c.json({ error }, status);

  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }
  const durationDays = Math.min(30, Math.max(1, parseInt(body?.duration_days, 10) || 7));

  // PAYMENT: Uncomment when ready to charge for boosts
  // POST /services/press-release/:id/boost/initialize
  // - Auth: release owner
  // - Body: { duration_days }
  // - Calculate amount: KES 500/day
  // - Initialize Paystack transaction
  // - Return: { authorization_url, reference }
  //
  // POST /services/press-release/:id/boost/verify
  // - Auth: release owner
  // - Body: { reference }
  // - Verify Paystack payment
  // - Create boost record
  // - Return: { boost }

  try {
    const boostId = crypto.randomUUID();
    const endsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    await c.env.DB.prepare(
      'INSERT INTO press_release_boosts (id, release_id, user_id, duration_days, ends_at, status, amount_paid) VALUES (?, ?, ?, ?, ?, ?, 0)'
    ).bind(boostId, id, user.id, durationDays, endsAt, 'active').run();

    return c.json({ boost: { id: boostId, duration_days: durationDays, ends_at: endsAt } });
  } catch (e) {
    return c.json({ error: 'Failed to boost press release.' }, 500);
  }
});

export default services;