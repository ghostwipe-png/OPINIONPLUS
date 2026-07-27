// backend/src/routes/api-service.js
// Standalone API Service — Complete Feature Set
// Extracted from services.js to keep codebase clean and maintainable
// 
// PAYMENT NOTE: All Paystack payment code is WRITTEN but COMMENTED OUT.
// The platform currently offers API access for FREE.
// Uncomment when ready to charge for API packages.

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';

const apiService = new Hono();

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

const API_KEY_PREFIX_LIVE = 'op_live_';
const API_KEY_PREFIX_TEST = 'op_test_';
const API_KEY_RANDOM_LENGTH = 40;

const VALID_SCOPES = [
  'stories:read', 'stories:write',
  'press_release:read', 'press_release:write',
  'sponsored:read', 'sponsored:write',
  'analytics:read',
  'webhooks:manage',
];

const TIER_LIMITS = {
  free: 100,
  pro: 10000,
  enterprise: 100000,
};

const WEBHOOK_EVENTS = [
  'story.published',
  'press_release.published',
  'sponsored.published',
];

function generateRandomString(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

async function hashApiKey(key) {
  const data = new TextEncoder().encode(key);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function maskApiKey(key) {
  if (!key || key.length < 12) return 'op_****';
  const prefix = key.startsWith('op_test_') ? 'op_test_' : 'op_live_';
  const body = key.slice(prefix.length);
  if (body.length <= 8) return `${prefix}****`;
  return `${prefix}${body.slice(0, 4)}****${body.slice(-4)}`;
}

function generateApiKey(type = 'production') {
  const prefix = type === 'test' ? API_KEY_PREFIX_TEST : API_KEY_PREFIX_LIVE;
  return prefix + generateRandomString(API_KEY_RANDOM_LENGTH);
}

function validateScopes(scopes) {
  if (!Array.isArray(scopes)) return false;
  return scopes.every(s => VALID_SCOPES.includes(s));
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

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function logApiRequest(db, apiKeyId, userId, endpoint, method, statusCode, responseTimeMs, ip, userAgent) {
  try {
    const id = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO api_request_logs (id, api_key_id, user_id, endpoint, method, status_code, response_time_ms, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, apiKeyId, userId, endpoint, method, statusCode, responseTimeMs || null, ip || null, userAgent || null).run();
  } catch (e) {
    console.error('Failed to log API request:', e.message);
  }
}

async function incrementApiUsage(db, apiKeyId, userId) {
  const today = new Date().toISOString().slice(0, 10);
  try {
    await db.prepare(
      `INSERT INTO api_usage_daily (id, api_key_id, user_id, date, calls_count)
       VALUES (?, ?, ?, ?, 1)
       ON CONFLICT(api_key_id, date) DO UPDATE SET calls_count = calls_count + 1`
    ).bind(crypto.randomUUID(), apiKeyId, userId, today).run();
  } catch (e) {
    console.error('Failed to increment API usage:', e.message);
  }
}

// API Key authentication middleware for public v1 endpoints
async function apiKeyAuth(c, next) {
  const authHeader = c.req.header('Authorization') || '';
  const apiKeyHeader = c.req.header('X-API-Key') || '';
  
  let providedKey = '';
  if (authHeader.startsWith('Bearer ')) {
    providedKey = authHeader.slice(7);
  } else if (apiKeyHeader) {
    providedKey = apiKeyHeader;
  }

  if (!providedKey) {
    return c.json({ error: 'API key required. Provide via Authorization: Bearer <key> or X-API-Key header.' }, 401);
  }

  const keyHash = await hashApiKey(providedKey);
  
  const keyRecord = await c.env.DB.prepare(
    'SELECT * FROM api_keys WHERE key = ? AND is_active = 1'
  ).bind(keyHash).first();

  if (!keyRecord) {
    return c.json({ error: 'Invalid or revoked API key.' }, 401);
  }

  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    return c.json({ error: 'API key has expired.' }, 401);
  }

  // Check IP whitelist
  const whitelist = await c.env.DB.prepare(
    'SELECT * FROM api_ip_whitelist WHERE api_key_id = ?'
  ).bind(keyRecord.id).all();
  
  if (whitelist.results && whitelist.results.length > 0) {
    const clientIp = c.req.header('CF-Connecting-IP') || 'unknown';
    const allowed = whitelist.results.some(w => {
      if (w.ip_address === clientIp) return true;
      // Simple CIDR check for /24 and /16
      if (w.cidr_range) {
        // Basic subnet matching
        const [rangeIp, bits] = w.cidr_range.split('/');
        if (bits && rangeIp) {
          const clientParts = clientIp.split('.').map(Number);
          const rangeParts = rangeIp.split('.').map(Number);
          const maskBits = parseInt(bits, 10);
          const fullMask = ~(2 ** (32 - maskBits) - 1);
          const clientNum = (clientParts[0] << 24) | (clientParts[1] << 16) | (clientParts[2] << 8) | clientParts[3];
          const rangeNum = (rangeParts[0] << 24) | (rangeParts[1] << 16) | (rangeParts[2] << 8) | rangeParts[3];
          return (clientNum & fullMask) === (rangeNum & fullMask);
        }
      }
      return false;
    });
    if (!allowed) {
      return c.json({ error: 'IP address not in whitelist for this API key.' }, 403);
    }
  }

  // Check daily rate limit
  const tier = keyRecord.tier || 'free';
  const limit = TIER_LIMITS[tier] || TIER_LIMITS.free;
  const today = new Date().toISOString().slice(0, 10);
  const usage = await c.env.DB.prepare(
    'SELECT calls_count FROM api_usage_daily WHERE api_key_id = ? AND date = ?'
  ).bind(keyRecord.id, today).first();
  
  const callsToday = usage?.calls_count || 0;
  
  c.res.headers.set('X-RateLimit-Limit', String(limit));
  c.res.headers.set('X-RateLimit-Remaining', String(Math.max(0, limit - callsToday)));
  c.res.headers.set('X-RateLimit-Reset', new Date(new Date().setHours(24, 0, 0, 0)).toISOString());

  if (callsToday >= limit) {
    return c.json({ error: 'Rate limit exceeded. Upgrade your plan for higher limits.' }, 429);
  }

  c.set('apiKeyId', keyRecord.id);
  c.set('apiUserId', keyRecord.user_id);
  c.set('apiKeyTier', tier);
  c.set('apiKeyScopes', JSON.parse(keyRecord.scopes || '[]'));

  // Update last_used_at
  await c.env.DB.prepare(
    'UPDATE api_keys SET last_used_at = datetime(\'now\') WHERE id = ?'
  ).bind(keyRecord.id).run();

  await next();

  // Log request + increment usage after response
  const startTime = c.get('requestStartTime');
  const responseTime = startTime ? Date.now() - startTime : null;
  await logApiRequest(
    c.env.DB, keyRecord.id, keyRecord.user_id,
    c.req.path, c.req.method, c.res.status,
    responseTime,
    c.req.header('CF-Connecting-IP'),
    c.req.header('User-Agent')
  );
  await incrementApiUsage(c.env.DB, keyRecord.id, keyRecord.user_id);
}

// Usage alert checker
async function checkUsageAlerts(db, userId, apiKeyId) {
  try {
    const tier = 'free'; // Default, can be overridden
    const limit = TIER_LIMITS[tier] || TIER_LIMITS.free;
    const today = new Date().toISOString().slice(0, 10);
    const usage = await db.prepare(
      'SELECT calls_count FROM api_usage_daily WHERE api_key_id = ? AND date = ?'
    ).bind(apiKeyId, today).first();
    const callsToday = usage?.calls_count || 0;
    const percentUsed = limit > 0 ? Math.floor((callsToday / limit) * 100) : 0;

    const alerts = await db.prepare(
      'SELECT * FROM api_usage_alerts WHERE user_id = ? AND is_active = 1'
    ).bind(userId).all();

    for (const alert of (alerts.results || [])) {
      if (percentUsed >= alert.threshold_percent) {
        // Check cooldown — don't re-alert within 24h
        if (alert.last_triggered_at) {
          const lastTriggered = new Date(alert.last_triggered_at).getTime();
          if (Date.now() - lastTriggered < 24 * 60 * 60 * 1000) continue;
        }

        console.log(JSON.stringify({
          kind: 'api_usage_alert',
          userId,
          alertType: alert.alert_type,
          threshold: alert.threshold_percent,
          currentUsage: percentUsed,
          destination: alert.destination,
        }));

        await db.prepare(
          'UPDATE api_usage_alerts SET last_triggered_at = datetime(\'now\') WHERE id = ?'
        ).bind(alert.id).run();
      }
    }
  } catch (e) {
    console.error('Usage alert check failed:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════
// PACKAGES — List active API packages
// ═══════════════════════════════════════════════════════════

apiService.get('/packages', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM api_packages WHERE is_active = 1'
    ).all();
    
    const packages = results.map(pkg => ({
      ...pkg,
      features: pkg.features ? JSON.parse(pkg.features) : undefined,
    }));
    
    return c.json({ packages });
  } catch (e) {
    return c.json({ error: 'Failed to load packages.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// PAY — Initialize Paystack payment for API package
// PAYMENT: Uncomment when ready to charge for API packages
// ═══════════════════════════════════════════════════════════

/*
apiService.post('/pay', requireAuth, async (c) => {
  const user = c.get('user');
  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid request body.' }, 400); }

  const { packageId, idempotency_key } = body || {};
  if (!packageId) return c.json({ error: 'packageId is required.' }, 400);

  const pkg = await c.env.DB.prepare(
    'SELECT * FROM api_packages WHERE id = ? AND is_active = 1'
  ).bind(packageId).first();
  if (!pkg) return c.json({ error: 'Invalid or inactive package.' }, 400);

  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return c.json({ error: 'Payment gateway not configured.' }, 500);

  const reference = `api_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const orderId = crypto.randomUUID();
  const customerEmail = isValidEmail(user.email) ? user.email : 'support@opinionplus.online';

  await c.env.DB.prepare(
    'INSERT INTO service_orders (id, user_id, user_email, service_type, package_id, amount_paid, paystack_reference, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(orderId, user.id, customerEmail, 'api', packageId, pkg.price_kes_cents, reference, '{}').run();

  const callbackUrl = `${new URL(c.req.url).origin}/services/api?payment=success`;
  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: customerEmail,
      amount: pkg.price_kes_cents,
      reference,
      currency: 'KES',
      callback_url: callbackUrl,
      metadata: { userId: user.id, serviceType: 'api', packageId, orderId },
    }),
  });

  const data = await response.json();
  if (!data.status) {
    await c.env.DB.prepare('UPDATE service_orders SET paystack_status = ? WHERE id = ?').bind('failed', orderId).run();
    return c.json({ error: data.message || 'Payment initialization failed.' }, 502);
  }

  return c.json({ authorization_url: data.data.authorization_url, reference, amount: pkg.price_kes_cents });
});

apiService.get('/verify/:reference', requireAuth, async (c) => {
  const reference = c.req.param('reference');
  const user = c.get('user');

  const order = await c.env.DB.prepare(
    'SELECT * FROM service_orders WHERE paystack_reference = ?'
  ).bind(reference).first();
  if (!order) return c.json({ error: 'Order not found.' }, 404);
  if (order.user_id !== user.id && user.role !== 'admin' && user.role !== 'root') {
    return c.json({ error: 'Unauthorized.' }, 403);
  }

  if (order.paystack_status === 'success' || order.status === 'active') {
    return c.json({ status: 'active', packageId: order.package_id });
  }

  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return c.json({ error: 'Gateway not configured.' }, 500);

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` }
  });
  const data = await response.json();

  if (data.status && data.data.status === 'success') {
    await c.env.DB.prepare(
      'UPDATE service_orders SET paystack_status = ?, status = ? WHERE paystack_reference = ? AND paystack_status = ?'
    ).bind('success', 'active', reference, 'pending').run();

    // Upgrade API tier based on package
    const pkg = await c.env.DB.prepare('SELECT * FROM api_packages WHERE id = ?').bind(order.package_id).first();
    if (pkg) {
      const tier = pkg.tier || 'pro';
      const existingKey = await c.env.DB.prepare('SELECT id FROM api_keys WHERE user_id = ?').bind(user.id).first();
      if (!existingKey) {
        const newKey = generateApiKey('production');
        const keyHash = await hashApiKey(newKey);
        await c.env.DB.prepare(
          'INSERT INTO api_keys (id, user_id, key, name, tier, requests_today, key_name, key_type) VALUES (?, ?, ?, ?, ?, 0, ?, ?)'
        ).bind(crypto.randomUUID(), user.id, keyHash, 'Default Production Key', tier, 'Production Key', 'production').run();
      } else {
        await c.env.DB.prepare('UPDATE api_keys SET tier = ?, requests_today = 0 WHERE user_id = ?')
          .bind(tier, user.id).run();
      }
    }

    return c.json({ status: 'active', packageId: order.package_id });
  }

  return c.json({ error: 'Payment not successful yet.', status: data.data?.status }, 400);
});
*/

// ═══════════════════════════════════════════════════════════
// CHECK — Check if user has active API subscription
// ═══════════════════════════════════════════════════════════

apiService.get('/check', requireAuth, async (c) => {
  const user = c.get('user');

  try {
    const activeOrder = await c.env.DB.prepare(
      `SELECT * FROM service_orders 
       WHERE (user_id = ? OR user_email = ?) 
       AND service_type = 'api' 
       AND (paystack_status = 'success' OR paystack_status = 'admin_grant') 
       AND status = 'active' 
       ORDER BY created_at DESC LIMIT 1`
    ).bind(user.id, user.email).first();

    if (!activeOrder) {
      // Check if user has a free API key already (auto-provisioned)
      const existingKey = await c.env.DB.prepare(
        'SELECT id, tier FROM api_keys WHERE user_id = ? AND is_active = 1'
      ).bind(user.id).first();

      if (existingKey) {
        return c.json({ active: true, tier: existingKey.tier || 'free' });
      }

      return c.json({ active: false });
    }

    return c.json({
      active: true,
      packageId: activeOrder.package_id,
      createdAt: activeOrder.created_at,
    });
  } catch (e) {
    return c.json({ active: false, error: 'Failed to verify.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// API KEYS MANAGEMENT
// ═══════════════════════════════════════════════════════════

// List user's API keys (masked)
apiService.get('/keys', requireAuth, async (c) => {
  const user = c.get('user');

  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, key_name, key_type, scopes, tier, last_used_at, expires_at, is_active, requests_today, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(user.id).all();

    return c.json({
      keys: results.map(k => ({
        ...k,
        key: maskApiKey('op_live_placeholder'), // Never expose real key
        scopes: JSON.parse(k.scopes || '[]'),
      })),
    });
  } catch (e) {
    return c.json({ error: 'Failed to load API keys.' }, 500);
  }
});

// Create new API key
apiService.post('/keys', requireAuth, async (c) => {
  const user = c.get('user');
  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }

  const { key_name = 'Default Key', key_type = 'production', scopes = ['stories:read', 'press_release:read', 'sponsored:read', 'analytics:read'] } = body || {};

  if (!['production', 'test'].includes(key_type)) {
    return c.json({ error: 'key_type must be "production" or "test".' }, 400);
  }

  if (!validateScopes(scopes)) {
    return c.json({ error: `Invalid scopes. Valid scopes: ${VALID_SCOPES.join(', ')}` }, 400);
  }

  try {
    const plainKey = generateApiKey(key_type);
    const keyHash = await hashApiKey(plainKey);
    const keyId = crypto.randomUUID();
    const clientIp = c.req.header('CF-Connecting-IP') || 'unknown';

    // Get user's tier from active order or default to free
    const order = await c.env.DB.prepare(
      `SELECT * FROM service_orders 
       WHERE (user_id = ? OR user_email = ?) 
       AND service_type = 'api' 
       AND status = 'active' 
       ORDER BY created_at DESC LIMIT 1`
    ).bind(user.id, user.email).first();

    const tier = order ? 'pro' : 'free';

    await c.env.DB.prepare(
      `INSERT INTO api_keys (id, user_id, key, name, tier, requests_today, key_name, key_type, scopes, created_by_ip)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`
    ).bind(keyId, user.id, keyHash, key_name, tier, key_name, key_type, JSON.stringify(scopes), clientIp).run();

    return c.json({
      key: {
        id: keyId,
        key: plainKey, // Full key returned ONCE
        key_name,
        key_type,
        scopes,
        tier,
        created_at: new Date().toISOString(),
      },
      message: 'Save this API key now. It will not be shown again.',
    });
  } catch (e) {
    return c.json({ error: 'Failed to create API key.' }, 500);
  }
});

// Revoke an API key (soft delete)
apiService.delete('/keys/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const keyId = c.req.param('id');

  try {
    const keyRecord = await c.env.DB.prepare(
      'SELECT * FROM api_keys WHERE id = ? AND user_id = ?'
    ).bind(keyId, user.id).first();

    if (!keyRecord) return c.json({ error: 'API key not found.' }, 404);

    await c.env.DB.prepare(
      'UPDATE api_keys SET is_active = 0 WHERE id = ? AND user_id = ?'
    ).bind(keyId, user.id).run();

    return c.json({ ok: true, message: 'API key revoked.' });
  } catch (e) {
    return c.json({ error: 'Failed to revoke API key.' }, 500);
  }
});

// Regenerate API key
apiService.post('/keys/:id/regenerate', requireAuth, async (c) => {
  const user = c.get('user');
  const keyId = c.req.param('id');

  try {
    const keyRecord = await c.env.DB.prepare(
      'SELECT * FROM api_keys WHERE id = ? AND user_id = ?'
    ).bind(keyId, user.id).first();

    if (!keyRecord) return c.json({ error: 'API key not found.' }, 404);

    const plainKey = generateApiKey(keyRecord.key_type || 'production');
    const keyHash = await hashApiKey(plainKey);

    await c.env.DB.prepare(
      'UPDATE api_keys SET key = ?, last_used_at = NULL WHERE id = ? AND user_id = ?'
    ).bind(keyHash, keyId, user.id).run();

    return c.json({
      key: {
        id: keyId,
        key: plainKey,
        key_name: keyRecord.key_name,
        key_type: keyRecord.key_type,
        message: 'Key regenerated. Old key is now invalid. Save this new key now.',
      },
    });
  } catch (e) {
    return c.json({ error: 'Failed to regenerate API key.' }, 500);
  }
});

// Update key scopes
apiService.patch('/keys/:id/scopes', requireAuth, async (c) => {
  const user = c.get('user');
  const keyId = c.req.param('id');
  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }

  const { scopes } = body || {};
  if (!scopes || !validateScopes(scopes)) {
    return c.json({ error: `Invalid scopes. Valid scopes: ${VALID_SCOPES.join(', ')}` }, 400);
  }

  try {
    const keyRecord = await c.env.DB.prepare(
      'SELECT * FROM api_keys WHERE id = ? AND user_id = ?'
    ).bind(keyId, user.id).first();

    if (!keyRecord) return c.json({ error: 'API key not found.' }, 404);

    await c.env.DB.prepare(
      'UPDATE api_keys SET scopes = ? WHERE id = ?'
    ).bind(JSON.stringify(scopes), keyId).run();

    return c.json({ ok: true, scopes });
  } catch (e) {
    return c.json({ error: 'Failed to update scopes.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// USAGE & ANALYTICS
// ═══════════════════════════════════════════════════════════

// Current usage summary
apiService.get('/usage', requireAuth, async (c) => {
  const user = c.get('user');

  try {
    const today = new Date().toISOString().slice(0, 10);
    const keyRecord = await c.env.DB.prepare(
      'SELECT id, tier FROM api_keys WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1'
    ).bind(user.id).first();

    if (!keyRecord) {
      return c.json({
        tier: 'none',
        limit: 0,
        calls_today: 0,
        keys: 0,
      });
    }

    const usage = await c.env.DB.prepare(
      'SELECT calls_count FROM api_usage_daily WHERE api_key_id = ? AND date = ?'
    ).bind(keyRecord.id, today).first();

    const tier = keyRecord.tier || 'free';
    const limit = TIER_LIMITS[tier] || TIER_LIMITS.free;

    const keyCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM api_keys WHERE user_id = ? AND is_active = 1'
    ).bind(user.id).first();

    return c.json({
      tier,
      limit,
      calls_today: usage?.calls_count || 0,
      keys: keyCount?.count || 0,
    });
  } catch (e) {
    return c.json({ error: 'Failed to load usage.' }, 500);
  }
});

// Usage history — daily breakdown
apiService.get('/usage/history', requireAuth, async (c) => {
  const user = c.get('user');
  const days = Math.min(90, Math.max(1, parseInt(c.req.query('days') || '7', 10) || 7));

  try {
    const keyRecord = await c.env.DB.prepare(
      'SELECT id FROM api_keys WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1'
    ).bind(user.id).first();

    if (!keyRecord) {
      return c.json({ history: [] });
    }

    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().slice(0, 10);

    const { results } = await c.env.DB.prepare(
      'SELECT date, calls_count, error_count FROM api_usage_daily WHERE api_key_id = ? AND date >= ? ORDER BY date ASC'
    ).bind(keyRecord.id, sinceStr).all();

    return c.json({ history: results });
  } catch (e) {
    return c.json({ error: 'Failed to load usage history.' }, 500);
  }
});

// Request logs
apiService.get('/logs', requireAuth, async (c) => {
  const user = c.get('user');
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10) || 20));
  const offset = (page - 1) * limit;
  const statusFilter = c.req.query('status');
  const dateFilter = c.req.query('date');

  try {
    const whereClauses = ['l.user_id = ?'];
    const whereValues = [user.id];

    if (statusFilter) {
      if (statusFilter === '2xx') whereClauses.push('l.status_code >= 200 AND l.status_code < 300');
      else if (statusFilter === '4xx') whereClauses.push('l.status_code >= 400 AND l.status_code < 500');
      else if (statusFilter === '5xx') whereClauses.push('l.status_code >= 500 AND l.status_code < 600');
    }

    if (dateFilter) {
      whereClauses.push('date(l.created_at) = ?');
      whereValues.push(dateFilter);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const totalRow = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM api_request_logs l ${whereSql}`
    ).bind(...whereValues).first();

    const { results } = await c.env.DB.prepare(
      `SELECT l.id, l.endpoint, l.method, l.status_code, l.response_time_ms, l.ip_address, l.created_at
       FROM api_request_logs l
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
    return c.json({ error: 'Failed to load request logs.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// WEBHOOKS
// ═══════════════════════════════════════════════════════════

// List webhooks
apiService.get('/webhooks', requireAuth, async (c) => {
  const user = c.get('user');

  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM api_webhooks WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(user.id).all();

    return c.json({
      webhooks: results.map(w => ({
        ...w,
        events: JSON.parse(w.events || '[]'),
        secret: w.secret ? '****' : null, // Mask secret
      })),
    });
  } catch (e) {
    return c.json({ error: 'Failed to load webhooks.' }, 500);
  }
});

// Create webhook
apiService.post('/webhooks', requireAuth, async (c) => {
  const user = c.get('user');
  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }

  const { webhook_name, webhook_url, events = ['story.published', 'press_release.published'], secret } = body || {};

  if (!webhook_name || typeof webhook_name !== 'string') {
    return c.json({ error: 'webhook_name is required.' }, 400);
  }
  if (!isValidUrl(webhook_url)) {
    return c.json({ error: 'webhook_url must be a valid http(s) URL.' }, 400);
  }
  if (!Array.isArray(events) || events.some(e => !WEBHOOK_EVENTS.includes(e))) {
    return c.json({ error: `Invalid events. Valid: ${WEBHOOK_EVENTS.join(', ')}` }, 400);
  }

  try {
    const id = crypto.randomUUID();
    const webhookSecret = secret || generateRandomString(32);

    await c.env.DB.prepare(
      `INSERT INTO api_webhooks (id, user_id, webhook_name, webhook_url, events, secret)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(id, user.id, webhook_name, webhook_url, JSON.stringify(events), webhookSecret).run();

    return c.json({
      webhook: { id, webhook_name, webhook_url, events, secret: webhookSecret },
      message: 'Save this secret. It will not be shown again.',
    });
  } catch (e) {
    return c.json({ error: 'Failed to create webhook.' }, 500);
  }
});

// Test webhook
apiService.post('/webhooks/:id/test', requireAuth, async (c) => {
  const user = c.get('user');
  const webhookId = c.req.param('id');

  try {
    const webhook = await c.env.DB.prepare(
      'SELECT * FROM api_webhooks WHERE id = ? AND user_id = ?'
    ).bind(webhookId, user.id).first();

    if (!webhook) return c.json({ error: 'Webhook not found.' }, 404);

    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: { message: 'This is a test webhook from OPINIONPLUS API.' },
    };

    const payloadStr = JSON.stringify(testPayload);

    let signature = '';
    if (webhook.secret) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', encoder.encode(webhook.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadStr));
      signature = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    const start = Date.now();
    let responseStatus = 0;
    let responseBody = '';
    let success = 0;

    try {
      const res = await fetch(webhook.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OP-Signature': signature,
          'X-OP-Event': 'test',
        },
        body: payloadStr,
      });
      responseStatus = res.status;
      responseBody = await res.text();
      success = responseStatus >= 200 && responseStatus < 300 ? 1 : 0;
    } catch (e) {
      responseBody = e.message;
    }

    const responseTime = Date.now() - start;

    // Log the delivery
    await c.env.DB.prepare(
      `INSERT INTO api_webhook_logs (id, webhook_id, event_type, payload, response_status, response_body, response_time_ms, success)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), webhookId, 'test', payloadStr, responseStatus, responseBody, responseTime, success).run();

    return c.json({
      success: success === 1,
      response_status: responseStatus,
      response_time_ms: responseTime,
      response_body: responseBody.slice(0, 1000),
    });
  } catch (e) {
    return c.json({ error: 'Failed to test webhook.' }, 500);
  }
});

// Webhook delivery logs
apiService.get('/webhooks/:id/logs', requireAuth, async (c) => {
  const user = c.get('user');
  const webhookId = c.req.param('id');

  try {
    const webhook = await c.env.DB.prepare(
      'SELECT * FROM api_webhooks WHERE id = ? AND user_id = ?'
    ).bind(webhookId, user.id).first();

    if (!webhook) return c.json({ error: 'Webhook not found.' }, 404);

    const { results } = await c.env.DB.prepare(
      'SELECT * FROM api_webhook_logs WHERE webhook_id = ? ORDER BY created_at DESC LIMIT 50'
    ).bind(webhookId).all();

    return c.json({ logs: results });
  } catch (e) {
    return c.json({ error: 'Failed to load webhook logs.' }, 500);
  }
});

// Delete webhook
apiService.delete('/webhooks/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const webhookId = c.req.param('id');

  try {
    await c.env.DB.prepare(
      'DELETE FROM api_webhooks WHERE id = ? AND user_id = ?'
    ).bind(webhookId, user.id).run();

    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: 'Failed to delete webhook.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// IP WHITELIST
// ═══════════════════════════════════════════════════════════

apiService.get('/ip-whitelist', requireAuth, async (c) => {
  const user = c.get('user');
  const keyId = c.req.query('key_id');

  if (!keyId) return c.json({ error: 'key_id query parameter is required.' }, 400);

  try {
    const keyRecord = await c.env.DB.prepare(
      'SELECT * FROM api_keys WHERE id = ? AND user_id = ?'
    ).bind(keyId, user.id).first();

    if (!keyRecord) return c.json({ error: 'API key not found.' }, 404);

    const { results } = await c.env.DB.prepare(
      'SELECT * FROM api_ip_whitelist WHERE api_key_id = ? ORDER BY created_at DESC'
    ).bind(keyId).all();

    return c.json({ ips: results });
  } catch (e) {
    return c.json({ error: 'Failed to load IP whitelist.' }, 500);
  }
});

apiService.post('/ip-whitelist', requireAuth, async (c) => {
  const user = c.get('user');
  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }

  const { api_key_id, ip_address, cidr_range, label } = body || {};

  if (!api_key_id || !ip_address) {
    return c.json({ error: 'api_key_id and ip_address are required.' }, 400);
  }

  try {
    const keyRecord = await c.env.DB.prepare(
      'SELECT * FROM api_keys WHERE id = ? AND user_id = ?'
    ).bind(api_key_id, user.id).first();

    if (!keyRecord) return c.json({ error: 'API key not found.' }, 404);

    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO api_ip_whitelist (id, api_key_id, ip_address, cidr_range, label) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, api_key_id, ip_address, cidr_range || null, label || null).run();

    return c.json({ ip: { id, api_key_id, ip_address, cidr_range, label } });
  } catch (e) {
    return c.json({ error: 'Failed to add IP.' }, 500);
  }
});

apiService.delete('/ip-whitelist/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const ipId = c.req.param('id');

  try {
    // Verify ownership through the API key
    const ipRecord = await c.env.DB.prepare(
      'SELECT w.* FROM api_ip_whitelist w JOIN api_keys k ON w.api_key_id = k.id WHERE w.id = ? AND k.user_id = ?'
    ).bind(ipId, user.id).first();

    if (!ipRecord) return c.json({ error: 'IP whitelist entry not found.' }, 404);

    await c.env.DB.prepare('DELETE FROM api_ip_whitelist WHERE id = ?').bind(ipId).run();
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: 'Failed to remove IP.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// OAUTH APPLICATIONS
// ═══════════════════════════════════════════════════════════

apiService.get('/oauth/apps', requireAuth, async (c) => {
  const user = c.get('user');

  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, app_name, app_description, client_id, redirect_uris, scopes, is_active, created_at FROM api_oauth_apps WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(user.id).all();

    return c.json({
      apps: results.map(a => ({
        ...a,
        redirect_uris: JSON.parse(a.redirect_uris || '[]'),
        scopes: JSON.parse(a.scopes || '[]'),
        client_secret: '****', // Never expose
      })),
    });
  } catch (e) {
    return c.json({ error: 'Failed to load OAuth apps.' }, 500);
  }
});

apiService.post('/oauth/apps', requireAuth, async (c) => {
  const user = c.get('user');
  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }

  const { app_name, app_description, redirect_uris = [], scopes = ['stories:read'] } = body || {};

  if (!app_name || typeof app_name !== 'string') {
    return c.json({ error: 'app_name is required.' }, 400);
  }

  try {
    const id = crypto.randomUUID();
    const clientId = `op_oauth_${generateRandomString(24)}`;
    const clientSecret = generateRandomString(48);
    const secretHash = await hashApiKey(clientSecret);

    await c.env.DB.prepare(
      `INSERT INTO api_oauth_apps (id, user_id, app_name, app_description, client_id, client_secret, redirect_uris, scopes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, user.id, app_name, app_description || null, clientId, secretHash, JSON.stringify(redirect_uris), JSON.stringify(scopes)).run();

    return c.json({
      app: { id, app_name, client_id: clientId, client_secret: clientSecret, redirect_uris, scopes },
      message: 'Save this client secret. It will not be shown again.',
    });
  } catch (e) {
    return c.json({ error: 'Failed to create OAuth app.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// SANDBOX — Test API calls
// ═══════════════════════════════════════════════════════════

apiService.post('/sandbox/execute', requireAuth, async (c) => {
  const user = c.get('user');
  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }

  const { method = 'GET', endpoint, headers = {}, body: requestBody } = body || {};

  if (!endpoint) return c.json({ error: 'endpoint is required.' }, 400);

  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
    return c.json({ error: 'Invalid method.' }, 400);
  }

  try {
    const apiKey = await c.env.DB.prepare(
      'SELECT * FROM api_keys WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1'
    ).bind(user.id).first();

    const plainKey = apiKey ? `op_live_placeholder_for_sandbox` : 'no_key';

    const start = Date.now();
    const url = `${new URL(c.req.url).origin}/api-service/v1${endpoint}`;
    
    const res = await fetch(url, {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${plainKey}`,
        ...headers,
      },
      body: method.toUpperCase() !== 'GET' ? JSON.stringify(requestBody) : undefined,
    });

    const responseTime = Date.now() - start;
    const responseHeaders = {};
    res.headers.forEach((value, key) => { responseHeaders[key] = value; });

    let responseData;
    try { responseData = await res.json(); } catch (e) { responseData = await res.text(); }

    return c.json({
      status: res.status,
      headers: responseHeaders,
      body: responseData,
      timing_ms: responseTime,
    });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// DOCUMENTATION — Auto-generated endpoint docs
// ═══════════════════════════════════════════════════════════

apiService.get('/docs/endpoints', async (c) => {
  const baseUrl = `${new URL(c.req.url).origin}/api-service/v1`;

  return c.json({
    base_url: baseUrl,
    authentication: {
      type: 'Bearer Token',
      header: 'Authorization: Bearer <your_api_key>',
      alternative: 'X-API-Key: <your_api_key>',
    },
    rate_limiting: {
      free: '100 requests/day',
      pro: '10,000 requests/day',
      enterprise: '100,000 requests/day',
      headers: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    },
    categories: [
      {
        name: 'Stories',
        endpoints: [
          {
            method: 'GET',
            path: '/stories',
            description: 'List published stories. Supports pagination.',
            params: [
              { name: 'page', type: 'integer', required: false, description: 'Page number (default: 1)' },
              { name: 'limit', type: 'integer', required: false, description: 'Results per page (default: 20, max: 100)' },
            ],
            scopes: ['stories:read'],
            example_request: `curl -H "Authorization: Bearer YOUR_API_KEY" ${baseUrl}/stories`,
            example_response: { stories: [], total: 0, page: 1, totalPages: 1 },
          },
          {
            method: 'GET',
            path: '/stories/:id',
            description: 'Get a single story by ID.',
            params: [{ name: 'id', type: 'string', required: true, description: 'Story ID' }],
            scopes: ['stories:read'],
            example_request: `curl -H "Authorization: Bearer YOUR_API_KEY" ${baseUrl}/stories/STORY_ID`,
            example_response: { story: { id: '...', title: '...', body: '...', created_at: '...' } },
          },
        ],
      },
      {
        name: 'Press Releases',
        endpoints: [
          {
            method: 'GET',
            path: '/press-releases',
            description: 'List published press releases.',
            params: [
              { name: 'page', type: 'integer', required: false, description: 'Page number' },
              { name: 'limit', type: 'integer', required: false, description: 'Results per page' },
            ],
            scopes: ['press_release:read'],
            example_request: `curl -H "Authorization: Bearer YOUR_API_KEY" ${baseUrl}/press-releases`,
            example_response: { releases: [], total: 0 },
          },
          {
            method: 'GET',
            path: '/press-releases/:id',
            description: 'Get a single press release with kit files and analytics.',
            params: [{ name: 'id', type: 'string', required: true, description: 'Release ID' }],
            scopes: ['press_release:read'],
            example_request: `curl -H "Authorization: Bearer YOUR_API_KEY" ${baseUrl}/press-releases/RELEASE_ID`,
            example_response: { release: { id: '...', title: '...', company: '...', kit: [] } },
          },
        ],
      },
      {
        name: 'Sponsored Content',
        endpoints: [
          {
            method: 'GET',
            path: '/sponsored',
            description: 'List sponsored content.',
            params: [
              { name: 'page', type: 'integer', required: false, description: 'Page number' },
            ],
            scopes: ['sponsored:read'],
            example_request: `curl -H "Authorization: Bearer YOUR_API_KEY" ${baseUrl}/sponsored`,
            example_response: { sponsored: [], total: 0 },
          },
        ],
      },
    ],
  });
});

// ═══════════════════════════════════════════════════════════
// USAGE ALERTS
// ═══════════════════════════════════════════════════════════

apiService.get('/alerts', requireAuth, async (c) => {
  const user = c.get('user');

  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM api_usage_alerts WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(user.id).all();

    return c.json({ alerts: results });
  } catch (e) {
    return c.json({ error: 'Failed to load alerts.' }, 500);
  }
});

apiService.post('/alerts', requireAuth, async (c) => {
  const user = c.get('user');
  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }

  const { alert_type, threshold_percent, destination } = body || {};

  if (!['email', 'sms', 'webhook'].includes(alert_type)) {
    return c.json({ error: 'alert_type must be email, sms, or webhook.' }, 400);
  }
  if (![80, 90, 100].includes(threshold_percent)) {
    return c.json({ error: 'threshold_percent must be 80, 90, or 100.' }, 400);
  }
  if (!destination) {
    return c.json({ error: 'destination is required.' }, 400);
  }

  if (alert_type === 'email' && !isValidEmail(destination)) {
    return c.json({ error: 'Invalid email address.' }, 400);
  }

  try {
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO api_usage_alerts (id, user_id, alert_type, threshold_percent, destination) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, user.id, alert_type, threshold_percent, destination).run();

    return c.json({ alert: { id, alert_type, threshold_percent, destination } });
  } catch (e) {
    return c.json({ error: 'Failed to create alert.' }, 500);
  }
});

apiService.delete('/alerts/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const alertId = c.req.param('id');

  try {
    await c.env.DB.prepare(
      'DELETE FROM api_usage_alerts WHERE id = ? AND user_id = ?'
    ).bind(alertId, user.id).run();

    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: 'Failed to delete alert.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// PUBLIC API v1 ENDPOINTS (for API consumers)
// ═══════════════════════════════════════════════════════════

// List stories
apiService.get('/v1/stories', apiKeyAuth, async (c) => {
  const scopes = c.get('apiKeyScopes') || [];
  if (!scopes.includes('stories:read')) {
    return c.json({ error: 'This API key does not have stories:read scope.' }, 403);
  }

  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10) || 20));
  const offset = (page - 1) * limit;

  try {
    const totalRow = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM stories WHERE deleted = 0 AND privacy = \'public\''
    ).first();

    const { results } = await c.env.DB.prepare(
      'SELECT id, author_id, title, body, type, created_at FROM stories WHERE deleted = 0 AND privacy = \'public\' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(limit, offset).all();

    return c.json({
      stories: results,
      total: totalRow?.count || 0,
      page,
      totalPages: Math.max(1, Math.ceil((totalRow?.count || 0) / limit)),
    });
  } catch (e) {
    return c.json({ error: 'Failed to fetch stories.' }, 500);
  }
});

// Get single story
apiService.get('/v1/stories/:id', apiKeyAuth, async (c) => {
  const scopes = c.get('apiKeyScopes') || [];
  if (!scopes.includes('stories:read')) {
    return c.json({ error: 'This API key does not have stories:read scope.' }, 403);
  }

  const id = c.req.param('id');

  try {
    const story = await c.env.DB.prepare(
      'SELECT id, author_id, title, body, type, created_at FROM stories WHERE id = ? AND deleted = 0 AND privacy = \'public\''
    ).bind(id).first();

    if (!story) return c.json({ error: 'Story not found.' }, 404);

    return c.json({ story });
  } catch (e) {
    return c.json({ error: 'Failed to fetch story.' }, 500);
  }
});

// List press releases
apiService.get('/v1/press-releases', apiKeyAuth, async (c) => {
  const scopes = c.get('apiKeyScopes') || [];
  if (!scopes.includes('press_release:read')) {
    return c.json({ error: 'This API key does not have press_release:read scope.' }, 403);
  }

  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10) || 20));
  const offset = (page - 1) * limit;

  try {
    const totalRow = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM press_releases WHERE status = \'published\''
    ).first();

    const { results } = await c.env.DB.prepare(
      'SELECT id, title, company, content, published_at, company_logo_url, target_category, target_region FROM press_releases WHERE status = \'published\' ORDER BY published_at DESC LIMIT ? OFFSET ?'
    ).bind(limit, offset).all();

    return c.json({
      releases: results,
      total: totalRow?.count || 0,
      page,
      totalPages: Math.max(1, Math.ceil((totalRow?.count || 0) / limit)),
    });
  } catch (e) {
    return c.json({ error: 'Failed to fetch press releases.' }, 500);
  }
});

// Get single press release
apiService.get('/v1/press-releases/:id', apiKeyAuth, async (c) => {
  const scopes = c.get('apiKeyScopes') || [];
  if (!scopes.includes('press_release:read')) {
    return c.json({ error: 'This API key does not have press_release:read scope.' }, 403);
  }

  const id = c.req.param('id');

  try {
    const release = await c.env.DB.prepare(
      'SELECT * FROM press_releases WHERE id = ? AND status = \'published\''
    ).bind(id).first();

    if (!release) return c.json({ error: 'Press release not found.' }, 404);

    const { results: kitFiles } = await c.env.DB.prepare(
      'SELECT id, file_name, file_url, file_type FROM press_kits WHERE release_id = ?'
    ).bind(id).all();

    return c.json({ release: { ...release, kit: kitFiles || [] } });
  } catch (e) {
    return c.json({ error: 'Failed to fetch press release.' }, 500);
  }
});

// List sponsored content
apiService.get('/v1/sponsored', apiKeyAuth, async (c) => {
  const scopes = c.get('apiKeyScopes') || [];
  if (!scopes.includes('sponsored:read')) {
    return c.json({ error: 'This API key does not have sponsored:read scope.' }, 403);
  }

  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, author_id, title, body, created_at FROM stories WHERE type = \'sponsored\' AND deleted = 0 AND privacy = \'public\' ORDER BY created_at DESC LIMIT 50'
    ).all();

    return c.json({ sponsored: results });
  } catch (e) {
    return c.json({ error: 'Failed to fetch sponsored content.' }, 500);
  }
});

export default apiService;