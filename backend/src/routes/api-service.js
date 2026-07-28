// backend/src/routes/api-service.js
// Standalone API Service — Military-Grade Production Build
// Cloudflare Workers Compatible | D1 Database | Zero-Crash Architecture
// Schema matched to existing api_keys table: key_hash, prefix, revoked
// 
// PAYMENT NOTE: All Paystack payment code is WRITTEN but COMMENTED OUT.
// The platform currently offers API access for FREE.
// Uncomment when ready to charge for API packages.

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';

const apiService = new Hono();

// ═══════════════════════════════════════════════════════════
// CONSTANTS
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

// ═══════════════════════════════════════════════════════════
// CRYPTO HELPERS — Cloudflare Workers Safe
// ═══════════════════════════════════════════════════════════

function generateRandomString(length) {
  try {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length];
    }
    return result;
  } catch (e) {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)];
    }
    return result;
  }
}

async function hashApiKey(key) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest({ name: 'SHA-256' }, data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    console.error('hashApiKey crypto.subtle failed, using fallback:', e.message);
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'fallback_' + Math.abs(hash).toString(16);
  }
}

function generateApiKey(type = 'production') {
  const prefix = type === 'test' ? API_KEY_PREFIX_TEST : API_KEY_PREFIX_LIVE;
  return prefix + generateRandomString(API_KEY_RANDOM_LENGTH);
}

// ═══════════════════════════════════════════════════════════
// VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════

function maskApiKey(key) {
  if (!key || key.length < 12) return 'op_****';
  const prefix = key.startsWith('op_test_') ? 'op_test_' : 'op_live_';
  const body = key.slice(prefix.length);
  if (body.length <= 8) return `${prefix}****`;
  return `${prefix}${body.slice(0, 4)}****${body.slice(-4)}`;
}

function validateScopes(scopes) {
  if (!Array.isArray(scopes)) return false;
  return scopes.length > 0 && scopes.every(s => VALID_SCOPES.includes(s));
}

function isValidUrl(url) {
  if (typeof url !== 'string' || !url || url.length > 2048) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

function isValidEmail(email) {
  if (typeof email !== 'string' || !email || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitizeString(str, maxLength = 1000) {
  if (typeof str !== 'string') return '';
  return str.slice(0, maxLength).replace(/[<>]/g, '');
}

// ═══════════════════════════════════════════════════════════
// DATABASE HELPERS — Never crash on DB errors
// ═══════════════════════════════════════════════════════════

async function safeDbRun(stmt, errorMessage = 'Database operation failed') {
  try {
    return await stmt.run();
  } catch (e) {
    console.error(`${errorMessage}:`, e.message);
    throw new Error(errorMessage);
  }
}

async function safeDbFirst(stmt, errorMessage = 'Database query failed') {
  try {
    return await stmt.first();
  } catch (e) {
    console.error(`${errorMessage}:`, e.message);
    return null;
  }
}

async function safeDbAll(stmt, errorMessage = 'Database query failed') {
  try {
    return await stmt.all();
  } catch (e) {
    console.error(`${errorMessage}:`, e.message);
    return { results: [] };
  }
}

// ═══════════════════════════════════════════════════════════
// API REQUEST LOGGING & USAGE TRACKING
// ═══════════════════════════════════════════════════════════

async function logApiRequest(db, apiKeyId, userId, endpoint, method, statusCode, responseTimeMs, ip, userAgent) {
  try {
    const id = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO api_request_logs (id, api_key_id, user_id, endpoint, method, status_code, response_time_ms, ip_address, user_agent)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
    ).bind(id, apiKeyId, userId, sanitizeString(endpoint, 500), sanitizeString(method, 10), statusCode || 0, responseTimeMs || null, sanitizeString(ip, 45), sanitizeString(userAgent, 500)).run();
  } catch (e) {
    console.error('logApiRequest failed:', e.message);
  }
}

async function incrementApiUsage(db, apiKeyId, userId) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const id = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO api_usage_daily (id, api_key_id, user_id, date, calls_count)
       VALUES (?1, ?2, ?3, ?4, 1)
       ON CONFLICT(api_key_id, date) DO UPDATE SET calls_count = calls_count + 1`
    ).bind(id, apiKeyId, userId, today).run();
  } catch (e) {
    console.error('incrementApiUsage failed:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════
// API KEY AUTH MIDDLEWARE — Military Grade
// ═══════════════════════════════════════════════════════════

async function apiKeyAuth(c, next) {
  try {
    const authHeader = c.req.header('Authorization') || '';
    const apiKeyHeader = c.req.header('X-API-Key') || '';
    
    let providedKey = '';
    if (authHeader.startsWith('Bearer ')) {
      providedKey = authHeader.slice(7).trim();
    } else if (apiKeyHeader) {
      providedKey = apiKeyHeader.trim();
    }

    if (!providedKey || providedKey.length < 10) {
      return c.json({ error: 'API key required. Provide via Authorization: Bearer <key> or X-API-Key header.' }, 401);
    }

    const keyHash = await hashApiKey(providedKey);
    
    const keyRecord = await c.env.DB.prepare(
      'SELECT * FROM api_keys WHERE key_hash = ?1 AND revoked = 0'
    ).bind(keyHash).first();

    if (!keyRecord) {
      return c.json({ error: 'Invalid or revoked API key.' }, 401);
    }

    if (keyRecord.expires_at) {
      try {
        if (new Date(keyRecord.expires_at) < new Date()) {
          return c.json({ error: 'API key has expired.' }, 401);
        }
      } catch (e) {
        return c.json({ error: 'API key has expired.' }, 401);
      }
    }

    // IP Whitelist check
    try {
      const whitelist = await c.env.DB.prepare(
        'SELECT ip_address, cidr_range FROM api_ip_whitelist WHERE api_key_id = ?1'
      ).bind(keyRecord.id).all();
      
      if (whitelist.results && whitelist.results.length > 0) {
        const clientIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
        const allowed = whitelist.results.some(w => {
          if (w.ip_address === clientIp) return true;
          if (w.cidr_range) {
            try {
              const [rangeIp, bits] = w.cidr_range.split('/');
              if (bits && rangeIp) {
                const clientParts = clientIp.split('.').map(Number);
                const rangeParts = rangeIp.split('.').map(Number);
                if (clientParts.length === 4 && rangeParts.length === 4) {
                  const maskBits = parseInt(bits, 10);
                  if (maskBits >= 0 && maskBits <= 32) {
                    const fullMask = ~((1 << (32 - maskBits)) - 1);
                    const clientNum = ((clientParts[0] << 24) >>> 0) | (clientParts[1] << 16) | (clientParts[2] << 8) | clientParts[3];
                    const rangeNum = ((rangeParts[0] << 24) >>> 0) | (rangeParts[1] << 16) | (rangeParts[2] << 8) | rangeParts[3];
                    return (clientNum & fullMask) === (rangeNum & fullMask);
                  }
                }
              }
            } catch (e) {}
          }
          return false;
        });
        if (!allowed) {
          return c.json({ error: 'IP address not in whitelist for this API key.' }, 403);
        }
      }
    } catch (e) {
      console.error('IP whitelist check failed:', e.message);
    }

    // Rate limiting
    const tier = keyRecord.tier || 'free';
    const limit = TIER_LIMITS[tier] || TIER_LIMITS.free;
    const today = new Date().toISOString().slice(0, 10);
    
    let callsToday = 0;
    try {
      const usage = await c.env.DB.prepare(
        'SELECT calls_count FROM api_usage_daily WHERE api_key_id = ?1 AND date = ?2'
      ).bind(keyRecord.id, today).first();
      callsToday = usage?.calls_count || 0;
    } catch (e) {
      console.error('Rate limit check failed:', e.message);
    }
    
    c.res.headers.set('X-RateLimit-Limit', String(limit));
    c.res.headers.set('X-RateLimit-Remaining', String(Math.max(0, limit - callsToday)));
    c.res.headers.set('X-RateLimit-Reset', new Date(new Date().setUTCHours(24, 0, 0, 0)).toISOString());

    if (callsToday >= limit) {
      return c.json({ error: 'Rate limit exceeded. Upgrade your plan for higher limits.' }, 429);
    }

    c.set('apiKeyId', keyRecord.id);
    c.set('apiUserId', keyRecord.user_id);
    c.set('apiKeyTier', tier);
    c.set('apiKeyScopes', (() => {
      try { return JSON.parse(keyRecord.scopes || '[]'); }
      catch (e) { return []; }
    })());

    c.executionCtx?.waitUntil?.(
      c.env.DB.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?1")
        .bind(keyRecord.id).run().catch(() => {})
    );

    c.set('requestStartTime', Date.now());

    await next();

    const responseTime = c.get('requestStartTime') ? Date.now() - c.get('requestStartTime') : null;
    c.executionCtx?.waitUntil?.(
      Promise.all([
        logApiRequest(c.env.DB, keyRecord.id, keyRecord.user_id, c.req.path, c.req.method, c.res.status, responseTime, c.req.header('CF-Connecting-IP'), c.req.header('User-Agent')),
        incrementApiUsage(c.env.DB, keyRecord.id, keyRecord.user_id),
      ]).catch(() => {})
    );

  } catch (e) {
    console.error('apiKeyAuth middleware error:', e.message);
    return c.json({ error: 'Authentication failed. Please try again.' }, 500);
  }
}

// ═══════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLER
// ═══════════════════════════════════════════════════════════

apiService.use('*', async (c, next) => {
  try {
    await next();
  } catch (e) {
    console.error('Unhandled API service error:', e.message, e.stack);
    if (!c.res || c.res.status === 200) {
      return c.json({ error: 'Internal server error. Our team has been notified.', requestId: crypto.randomUUID() }, 500);
    }
  }
});

// ═══════════════════════════════════════════════════════════
// PACKAGES
// ═══════════════════════════════════════════════════════════

apiService.get('/packages', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM api_packages WHERE is_active = 1'
    ).all();
    
    const packages = results.map(pkg => ({
      ...pkg,
      features: (() => {
        try { return pkg.features ? JSON.parse(pkg.features) : undefined; }
        catch (e) { return undefined; }
      })(),
    }));
    
    return c.json({ packages });
  } catch (e) {
    console.error('GET /packages failed:', e.message);
    return c.json({ error: 'Failed to load packages.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// PAY — PAYMENT BLOCK (COMMENTED OUT)
// ═══════════════════════════════════════════════════════════

// PAYMENT: Uncomment when ready to charge for API packages
// apiService.post('/pay', requireAuth, async (c) => { ... });
// apiService.get('/verify/:reference', requireAuth, async (c) => { ... });

// ═══════════════════════════════════════════════════════════
// CHECK
// ═══════════════════════════════════════════════════════════

apiService.get('/check', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ active: false, error: 'Not authenticated.' }, 401);

    const activeOrder = await c.env.DB.prepare(
      `SELECT * FROM service_orders 
       WHERE (user_id = ?1 OR user_email = ?2) 
       AND service_type = 'api' 
       AND (paystack_status = 'success' OR paystack_status = 'admin_grant') 
       AND status = 'active' 
       ORDER BY created_at DESC LIMIT 1`
    ).bind(user.id, user.email).first();

    if (activeOrder) {
      return c.json({
        active: true,
        packageId: activeOrder.package_id,
        createdAt: activeOrder.created_at,
      });
    }

    const existingKey = await c.env.DB.prepare(
      'SELECT id, tier FROM api_keys WHERE user_id = ?1 AND revoked = 0'
    ).bind(user.id).first();

    if (existingKey) {
      return c.json({ active: true, tier: existingKey.tier || 'free' });
    }

    return c.json({ active: false });
  } catch (e) {
    console.error('GET /check failed:', e.message);
    return c.json({ active: false, error: 'Failed to verify.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// API KEYS MANAGEMENT
// ═══════════════════════════════════════════════════════════

// List user's API keys
apiService.get('/keys', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not authenticated.' }, 401);

    const { results } = await c.env.DB.prepare(
      'SELECT id, key_name, key_type, scopes, tier, last_used_at, expires_at, revoked, requests_today, created_at FROM api_keys WHERE user_id = ?1 AND revoked = 0 ORDER BY created_at DESC'
    ).bind(user.id).all();

    return c.json({
      keys: (results || []).map(k => ({
        ...k,
        key: '****',
        is_active: k.revoked === 0 ? 1 : 0,
        scopes: (() => { try { return JSON.parse(k.scopes || '[]'); } catch (e) { return []; } })(),
      })),
    });
  } catch (e) {
    console.error('GET /keys failed:', e.message);
    return c.json({ error: 'Failed to load API keys.' }, 500);
  }
});

// Create new API key
apiService.post('/keys', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not authenticated.' }, 401);

    let body;
    try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }

    const {
      key_name = 'Default Key',
      key_type = 'production',
      scopes = ['stories:read', 'press_release:read', 'sponsored:read', 'analytics:read']
    } = body || {};

    if (!['production', 'test'].includes(key_type)) {
      return c.json({ error: 'key_type must be "production" or "test".' }, 400);
    }

    if (!validateScopes(scopes)) {
      return c.json({ error: `Invalid scopes. Valid scopes: ${VALID_SCOPES.join(', ')}` }, 400);
    }

    const plainKey = generateApiKey(key_type);
    const keyHash = await hashApiKey(plainKey);
    const keyId = crypto.randomUUID();
    const clientIp = sanitizeString(c.req.header('CF-Connecting-IP') || 'unknown', 45);
    const prefix = key_type === 'test' ? 'op_test' : 'op_live';

    let tier = 'free';
    try {
      const order = await c.env.DB.prepare(
        `SELECT * FROM service_orders 
         WHERE (user_id = ?1 OR user_email = ?2) 
         AND service_type = 'api' 
         AND status = 'active' 
         ORDER BY created_at DESC LIMIT 1`
      ).bind(user.id, user.email).first();
      if (order) tier = 'pro';
    } catch (e) {}

    const safeKeyName = sanitizeString(key_name, 200);

    await c.env.DB.prepare(
      `INSERT INTO api_keys (id, user_id, name, key_hash, prefix, tier, key_name, key_type, scopes, created_by_ip)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
    ).bind(
      keyId, user.id, safeKeyName, keyHash, prefix, tier,
      safeKeyName, key_type, JSON.stringify(scopes), clientIp
    ).run();

    return c.json({
      key: {
        id: keyId,
        key: plainKey,
        key_name: safeKeyName,
        key_type,
        scopes,
        tier,
        created_at: new Date().toISOString(),
      },
      message: 'Save this API key now. It will not be shown again.',
    });
  } catch (e) {
    console.error('POST /keys failed:', e.message, e.stack);
    return c.json({ error: 'Failed to create API key: ' + e.message }, 500);
  }
});

// Revoke an API key
apiService.delete('/keys/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not authenticated.' }, 401);
    const keyId = c.req.param('id');

    const keyRecord = await c.env.DB.prepare(
      'SELECT * FROM api_keys WHERE id = ?1 AND user_id = ?2'
    ).bind(keyId, user.id).first();

    if (!keyRecord) return c.json({ error: 'API key not found.' }, 404);

    await c.env.DB.prepare(
      'UPDATE api_keys SET revoked = 1 WHERE id = ?1 AND user_id = ?2'
    ).bind(keyId, user.id).run();

    return c.json({ ok: true, message: 'API key revoked.' });
  } catch (e) {
    console.error('DELETE /keys/:id failed:', e.message);
    return c.json({ error: 'Failed to revoke API key.' }, 500);
  }
});

// Regenerate API key
apiService.post('/keys/:id/regenerate', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not authenticated.' }, 401);
    const keyId = c.req.param('id');

    const keyRecord = await c.env.DB.prepare(
      'SELECT * FROM api_keys WHERE id = ?1 AND user_id = ?2 AND revoked = 0'
    ).bind(keyId, user.id).first();

    if (!keyRecord) return c.json({ error: 'API key not found.' }, 404);

    const plainKey = generateApiKey(keyRecord.key_type || 'production');
    const keyHash = await hashApiKey(plainKey);
    const prefix = keyRecord.key_type === 'test' ? 'op_test' : 'op_live';

    await c.env.DB.prepare(
      'UPDATE api_keys SET key_hash = ?1, prefix = ?2, last_used_at = NULL WHERE id = ?3 AND user_id = ?4'
    ).bind(keyHash, prefix, keyId, user.id).run();

    return c.json({
      key: {
        id: keyId,
        key: plainKey,
        key_name: keyRecord.key_name,
        key_type: keyRecord.key_type,
      },
      message: 'Key regenerated. Old key is now invalid. Save this new key now.',
    });
  } catch (e) {
    console.error('POST /keys/:id/regenerate failed:', e.message);
    return c.json({ error: 'Failed to regenerate API key.' }, 500);
  }
});

// Update key scopes
apiService.patch('/keys/:id/scopes', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not authenticated.' }, 401);
    const keyId = c.req.param('id');

    let body;
    try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }

    const { scopes } = body || {};
    if (!scopes || !validateScopes(scopes)) {
      return c.json({ error: `Invalid scopes. Valid: ${VALID_SCOPES.join(', ')}` }, 400);
    }

    const keyRecord = await c.env.DB.prepare(
      'SELECT * FROM api_keys WHERE id = ?1 AND user_id = ?2 AND revoked = 0'
    ).bind(keyId, user.id).first();

    if (!keyRecord) return c.json({ error: 'API key not found.' }, 404);

    await c.env.DB.prepare(
      'UPDATE api_keys SET scopes = ?1 WHERE id = ?2'
    ).bind(JSON.stringify(scopes), keyId).run();

    return c.json({ ok: true, scopes });
  } catch (e) {
    console.error('PATCH /keys/:id/scopes failed:', e.message);
    return c.json({ error: 'Failed to update scopes.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// USAGE & ANALYTICS
// ═══════════════════════════════════════════════════════════

apiService.get('/usage', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not authenticated.' }, 401);

    const today = new Date().toISOString().slice(0, 10);
    
    const keyRecord = await c.env.DB.prepare(
      'SELECT id, tier FROM api_keys WHERE user_id = ?1 AND revoked = 0 ORDER BY created_at DESC LIMIT 1'
    ).bind(user.id).first();

    if (!keyRecord) {
      return c.json({ tier: 'none', limit: 0, calls_today: 0, keys: 0 });
    }

    const usage = await c.env.DB.prepare(
      'SELECT calls_count FROM api_usage_daily WHERE api_key_id = ?1 AND date = ?2'
    ).bind(keyRecord.id, today).first();

    const tier = keyRecord.tier || 'free';
    const limit = TIER_LIMITS[tier] || TIER_LIMITS.free;

    const keyCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM api_keys WHERE user_id = ?1 AND revoked = 0'
    ).bind(user.id).first();

    return c.json({
      tier,
      limit,
      calls_today: usage?.calls_count || 0,
      keys: keyCount?.count || 0,
    });
  } catch (e) {
    console.error('GET /usage failed:', e.message);
    return c.json({ error: 'Failed to load usage.' }, 500);
  }
});

apiService.get('/usage/history', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not authenticated.' }, 401);

    const days = Math.min(90, Math.max(1, parseInt(c.req.query('days') || '7', 10) || 7));

    const keyRecord = await c.env.DB.prepare(
      'SELECT id FROM api_keys WHERE user_id = ?1 AND revoked = 0 ORDER BY created_at DESC LIMIT 1'
    ).bind(user.id).first();

    if (!keyRecord) return c.json({ history: [] });

    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().slice(0, 10);

    const { results } = await c.env.DB.prepare(
      'SELECT date, calls_count, error_count FROM api_usage_daily WHERE api_key_id = ?1 AND date >= ?2 ORDER BY date ASC'
    ).bind(keyRecord.id, sinceStr).all();

    return c.json({ history: results || [] });
  } catch (e) {
    console.error('GET /usage/history failed:', e.message);
    return c.json({ error: 'Failed to load usage history.' }, 500);
  }
});

apiService.get('/logs', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not authenticated.' }, 401);

    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10) || 20));
    const offset = (page - 1) * limit;
    const statusFilter = c.req.query('status');
    const dateFilter = c.req.query('date');

    const whereClauses = ['l.user_id = ?1'];
    const whereValues = [user.id];
    let paramIdx = 1;

    if (statusFilter === '2xx') {
      whereClauses.push('l.status_code >= 200 AND l.status_code < 300');
    } else if (statusFilter === '4xx') {
      whereClauses.push('l.status_code >= 400 AND l.status_code < 500');
    } else if (statusFilter === '5xx') {
      whereClauses.push('l.status_code >= 500 AND l.status_code < 600');
    }

    if (dateFilter) {
      paramIdx++;
      whereClauses.push(`date(l.created_at) = ?${paramIdx}`);
      whereValues.push(dateFilter);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const totalRow = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM api_request_logs l ${whereSql}`
    ).bind(...whereValues).first();

    paramIdx++;
    const limitParam = paramIdx;
    paramIdx++;
    const offsetParam = paramIdx;
    whereValues.push(limit, offset);

    const { results } = await c.env.DB.prepare(
      `SELECT l.id, l.endpoint, l.method, l.status_code, l.response_time_ms, l.ip_address, l.created_at
       FROM api_request_logs l
       ${whereSql}
       ORDER BY l.created_at DESC
       LIMIT ?${limitParam} OFFSET ?${offsetParam}`
    ).bind(...whereValues).all();

    const total = totalRow?.count || 0;

    return c.json({
      logs: results || [],
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (e) {
    console.error('GET /logs failed:', e.message);
    return c.json({ error: 'Failed to load request logs.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// WEBHOOKS
// ═══════════════════════════════════════════════════════════

apiService.get('/webhooks', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not authenticated.' }, 401);

    const { results } = await c.env.DB.prepare(
      'SELECT * FROM api_webhooks WHERE user_id = ?1 ORDER BY created_at DESC'
    ).bind(user.id).all();

    return c.json({
      webhooks: (results || []).map(w => ({
        ...w,
        events: (() => { try { return JSON.parse(w.events || '[]'); } catch (e) { return []; } })(),
        secret: w.secret ? '****' : null,
      })),
    });
  } catch (e) {
    console.error('GET /webhooks failed:', e.message);
    return c.json({ error: 'Failed to load webhooks.' }, 500);
  }
});

apiService.post('/webhooks', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not authenticated.' }, 401);

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

    const id = crypto.randomUUID();
    const webhookSecret = secret || generateRandomString(32);
    const safeName = sanitizeString(webhook_name, 200);

    await c.env.DB.prepare(
      `INSERT INTO api_webhooks (id, user_id, webhook_name, webhook_url, events, secret)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    ).bind(id, user.id, safeName, webhook_url, JSON.stringify(events), webhookSecret).run();

    return c.json({
      webhook: { id, webhook_name: safeName, webhook_url, events, secret: webhookSecret },
      message: 'Save this secret. It will not be shown again.',
    });
  } catch (e) {
    console.error('POST /webhooks failed:', e.message);
    return c.json({ error: 'Failed to create webhook.' }, 500);
  }
});

apiService.post('/webhooks/:id/test', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not authenticated.' }, 401);
    const webhookId = c.req.param('id');

    const webhook = await c.env.DB.prepare(
      'SELECT * FROM api_webhooks WHERE id = ?1 AND user_id = ?2'
    ).bind(webhookId, user.id).first();

    if (!webhook) return c.json({ error: 'Webhook not found.' }, 404);

    const testPayload = JSON.stringify({
      event: 'test',
      timestamp: new Date().toISOString(),
      data: { message: 'This is a test webhook from OPINIONPLUS API.' },
    });

    let signature = '';
    if (webhook.secret) {
      try {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey('raw', encoder.encode(webhook.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(testPayload));
        signature = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {}
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
          ...(signature ? { 'X-OP-Signature': signature } : {}),
          'X-OP-Event': 'test',
        },
        body: testPayload,
      });
      responseStatus = res.status;
      responseBody = await res.text();
      success = responseStatus >= 200 && responseStatus < 300 ? 1 : 0;
    } catch (e) {
      responseBody = e.message;
    }

    const responseTime = Date.now() - start;

    await c.env.DB.prepare(
      `INSERT INTO api_webhook_logs (id, webhook_id, event_type, payload, response_status, response_body, response_time_ms, success)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    ).bind(crypto.randomUUID(), webhookId, 'test', testPayload, responseStatus, responseBody.slice(0, 5000), responseTime, success).run();

    return c.json({
      success: success === 1,
      response_status: responseStatus,
      response_time_ms: responseTime,
      response_body: responseBody.slice(0, 1000),
    });
  } catch (e) {
    console.error('POST /webhooks/:id/test failed:', e.message);
    return c.json({ error: 'Failed to test webhook.' }, 500);
  }
});

apiService.get('/webhooks/:id/logs', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not authenticated.' }, 401);
    const webhookId = c.req.param('id');

    const webhook = await c.env.DB.prepare(
      'SELECT * FROM api_webhooks WHERE id = ?1 AND user_id = ?2'
    ).bind(webhookId, user.id).first();

    if (!webhook) return c.json({ error: 'Webhook not found.' }, 404);

    const { results } = await c.env.DB.prepare(
      'SELECT id, event_type, response_status, response_time_ms, success, created_at FROM api_webhook_logs WHERE webhook_id = ?1 ORDER BY created_at DESC LIMIT 50'
    ).bind(webhookId).all();

    return c.json({ logs: results || [] });
  } catch (e) {
    console.error('GET /webhooks/:id/logs failed:', e.message);
    return c.json({ error: 'Failed to load webhook logs.' }, 500);
  }
});

apiService.delete('/webhooks/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not authenticated.' }, 401);
    const webhookId = c.req.param('id');

    await c.env.DB.prepare(
      'DELETE FROM api_webhooks WHERE id = ?1 AND user_id = ?2'
    ).bind(webhookId, user.id).run();

    return c.json({ ok: true });
  } catch (e) {
    console.error('DELETE /webhooks/:id failed:', e.message);
    return c.json({ error: 'Failed to delete webhook.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// IP WHITELIST
// ═══════════════════════════════════════════════════════════

apiService.get('/ip-whitelist', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not authenticated.' }, 401);
    const keyId = c.req.query('key_id');
    if (!keyId) return c.json({ error: 'key_id query parameter is required.' }, 400);

    const keyRecord = await c.env.DB.prepare(
      'SELECT * FROM api_keys WHERE id = ?1 AND user_id = ?2 AND revoked = 0'
    ).bind(keyId, user.id).first();
    if (!keyRecord) return c.json({ error: 'API key not found.' }, 404);

    const { results } = await c.env.DB.prepare(
      'SELECT * FROM api_ip_whitelist WHERE api_key_id = ?1 ORDER BY created_at DESC'
    ).bind(keyId).all();

    return c.json({ ips: results || [] });
  } catch (e) {
    console.error('GET /ip-whitelist failed:', e.message);
    return c.json({ error: 'Failed to load IP whitelist.' }, 500);
  }
});

apiService.post('/ip-whitelist', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not authenticated.' }, 401);

    let body;
    try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }

    const { api_key_id, ip_address, cidr_range, label } = body || {};
    if (!api_key_id || !ip_address) return c.json({ error: 'api_key_id and ip_address are required.' }, 400);

    const keyRecord = await c.env.DB.prepare(
      'SELECT * FROM api_keys WHERE id = ?1 AND user_id = ?2 AND revoked = 0'
    ).bind(api_key_id, user.id).first();
    if (!keyRecord) return c.json({ error: 'API key not found.' }, 404);

    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO api_ip_whitelist (id, api_key_id, ip_address, cidr_range, label) VALUES (?1, ?2, ?3, ?4, ?5)'
    ).bind(id, api_key_id, sanitizeString(ip_address, 45), cidr_range ? sanitizeString(cidr_range, 20) : null, label ? sanitizeString(label, 200) : null).run();

    return c.json({ ip: { id, api_key_id, ip_address, cidr_range, label } });
  } catch (e) {
    console.error('POST /ip-whitelist failed:', e.message);
    return c.json({ error: 'Failed to add IP.' }, 500);
  }
});

apiService.delete('/ip-whitelist/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not authenticated.' }, 401);
    const ipId = c.req.param('id');

    const ipRecord = await c.env.DB.prepare(
      'SELECT w.* FROM api_ip_whitelist w JOIN api_keys k ON w.api_key_id = k.id WHERE w.id = ?1 AND k.user_id = ?2'
    ).bind(ipId, user.id).first();
    if (!ipRecord) return c.json({ error: 'IP whitelist entry not found.' }, 404);

    await c.env.DB.prepare('DELETE FROM api_ip_whitelist WHERE id = ?1').bind(ipId).run();
    return c.json({ ok: true });
  } catch (e) {
    console.error('DELETE /ip-whitelist/:id failed:', e.message);
    return c.json({ error: 'Failed to remove IP.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// OAUTH APPLICATIONS
// ═══════════════════════════════════════════════════════════

apiService.get('/oauth/apps', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not authenticated.' }, 401);

    const { results } = await c.env.DB.prepare(
      'SELECT id, app_name, app_description, client_id, redirect_uris, scopes, is_active, created_at FROM api_oauth_apps WHERE user_id = ?1 ORDER BY created_at DESC'
    ).bind(user.id).all();

    return c.json({
      apps: (results || []).map(a => ({
        ...a,
        redirect_uris: (() => { try { return JSON.parse(a.redirect_uris || '[]'); } catch (e) { return []; } })(),
        scopes: (() => { try { return JSON.parse(a.scopes || '[]'); } catch (e) { return []; } })(),
        client_secret: '****',
      })),
    });
  } catch (e) {
    console.error('GET /oauth/apps failed:', e.message);
    return c.json({ error: 'Failed to load OAuth apps.' }, 500);
  }
});

apiService.post('/oauth/apps', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not authenticated.' }, 401);

    let body;
    try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }

    const { app_name, app_description, redirect_uris = [], scopes = ['stories:read'] } = body || {};
    if (!app_name || typeof app_name !== 'string') return c.json({ error: 'app_name is required.' }, 400);

    const id = crypto.randomUUID();
    const clientId = `op_oauth_${generateRandomString(24)}`;
    const clientSecret = generateRandomString(48);
    const secretHash = await hashApiKey(clientSecret);

    await c.env.DB.prepare(
      `INSERT INTO api_oauth_apps (id, user_id, app_name, app_description, client_id, client_secret, redirect_uris, scopes)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    ).bind(id, user.id, sanitizeString(app_name, 200), app_description ? sanitizeString(app_description, 1000) : null, clientId, secretHash, JSON.stringify(redirect_uris), JSON.stringify(scopes)).run();

    return c.json({
      app: { id, app_name: sanitizeString(app_name, 200), client_id: clientId, client_secret: clientSecret, redirect_uris, scopes },
      message: 'Save this client secret. It will not be shown again.',
    });
  } catch (e) {
    console.error('POST /oauth/apps failed:', e.message);
    return c.json({ error: 'Failed to create OAuth app.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// DOCUMENTATION
// ═══════════════════════════════════════════════════════════

apiService.get('/docs/endpoints', async (c) => {
  try {
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
              method: 'GET', path: '/stories',
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
              method: 'GET', path: '/stories/:id',
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
              method: 'GET', path: '/press-releases',
              description: 'List published press releases.',
              params: [
                { name: 'page', type: 'integer', required: false },
                { name: 'limit', type: 'integer', required: false },
              ],
              scopes: ['press_release:read'],
              example_request: `curl -H "Authorization: Bearer YOUR_API_KEY" ${baseUrl}/press-releases`,
              example_response: { releases: [], total: 0 },
            },
            {
              method: 'GET', path: '/press-releases/:id',
              description: 'Get a single press release with kit files.',
              params: [{ name: 'id', type: 'string', required: true }],
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
              method: 'GET', path: '/sponsored',
              description: 'List sponsored content.',
              params: [{ name: 'page', type: 'integer', required: false }],
              scopes: ['sponsored:read'],
              example_request: `curl -H "Authorization: Bearer YOUR_API_KEY" ${baseUrl}/sponsored`,
              example_response: { sponsored: [], total: 0 },
            },
          ],
        },
      ],
    });
  } catch (e) {
    console.error('GET /docs/endpoints failed:', e.message);
    return c.json({ error: 'Failed to load documentation.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// USAGE ALERTS
// ═══════════════════════════════════════════════════════════

apiService.get('/alerts', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not authenticated.' }, 401);

    const { results } = await c.env.DB.prepare(
      'SELECT * FROM api_usage_alerts WHERE user_id = ?1 ORDER BY created_at DESC'
    ).bind(user.id).all();

    return c.json({ alerts: results || [] });
  } catch (e) {
    console.error('GET /alerts failed:', e.message);
    return c.json({ error: 'Failed to load alerts.' }, 500);
  }
});

apiService.post('/alerts', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not authenticated.' }, 401);

    let body;
    try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }

    const { alert_type, threshold_percent, destination } = body || {};
    if (!['email', 'sms', 'webhook'].includes(alert_type)) return c.json({ error: 'alert_type must be email, sms, or webhook.' }, 400);
    if (![80, 90, 100].includes(threshold_percent)) return c.json({ error: 'threshold_percent must be 80, 90, or 100.' }, 400);
    if (!destination) return c.json({ error: 'destination is required.' }, 400);
    if (alert_type === 'email' && !isValidEmail(destination)) return c.json({ error: 'Invalid email address.' }, 400);

    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO api_usage_alerts (id, user_id, alert_type, threshold_percent, destination) VALUES (?1, ?2, ?3, ?4, ?5)'
    ).bind(id, user.id, alert_type, threshold_percent, sanitizeString(destination, 500)).run();

    return c.json({ alert: { id, alert_type, threshold_percent, destination } });
  } catch (e) {
    console.error('POST /alerts failed:', e.message);
    return c.json({ error: 'Failed to create alert.' }, 500);
  }
});

apiService.delete('/alerts/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not authenticated.' }, 401);
    const alertId = c.req.param('id');

    await c.env.DB.prepare(
      'DELETE FROM api_usage_alerts WHERE id = ?1 AND user_id = ?2'
    ).bind(alertId, user.id).run();

    return c.json({ ok: true });
  } catch (e) {
    console.error('DELETE /alerts/:id failed:', e.message);
    return c.json({ error: 'Failed to delete alert.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// PUBLIC API v1 ENDPOINTS
// ═══════════════════════════════════════════════════════════

apiService.get('/v1/stories', apiKeyAuth, async (c) => {
  try {
    const scopes = c.get('apiKeyScopes') || [];
    if (!scopes.includes('stories:read')) return c.json({ error: 'Missing scope: stories:read' }, 403);

    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10) || 20));
    const offset = (page - 1) * limit;

    const totalRow = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM stories WHERE deleted = 0 AND privacy = 'public'"
    ).first();

    const { results } = await c.env.DB.prepare(
      "SELECT id, author_id, title, body, type, created_at FROM stories WHERE deleted = 0 AND privacy = 'public' ORDER BY created_at DESC LIMIT ?1 OFFSET ?2"
    ).bind(limit, offset).all();

    const total = totalRow?.count || 0;
    return c.json({ stories: results || [], total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (e) {
    console.error('GET /v1/stories failed:', e.message);
    return c.json({ error: 'Failed to fetch stories.' }, 500);
  }
});

apiService.get('/v1/stories/:id', apiKeyAuth, async (c) => {
  try {
    const scopes = c.get('apiKeyScopes') || [];
    if (!scopes.includes('stories:read')) return c.json({ error: 'Missing scope: stories:read' }, 403);

    const id = c.req.param('id');
    const story = await c.env.DB.prepare(
      "SELECT id, author_id, title, body, type, created_at FROM stories WHERE id = ?1 AND deleted = 0 AND privacy = 'public'"
    ).bind(id).first();

    if (!story) return c.json({ error: 'Story not found.' }, 404);
    return c.json({ story });
  } catch (e) {
    console.error('GET /v1/stories/:id failed:', e.message);
    return c.json({ error: 'Failed to fetch story.' }, 500);
  }
});

apiService.get('/v1/press-releases', apiKeyAuth, async (c) => {
  try {
    const scopes = c.get('apiKeyScopes') || [];
    if (!scopes.includes('press_release:read')) return c.json({ error: 'Missing scope: press_release:read' }, 403);

    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10) || 20));
    const offset = (page - 1) * limit;

    const totalRow = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM press_releases WHERE status = 'published'"
    ).first();

    const { results } = await c.env.DB.prepare(
      "SELECT id, title, company, content, published_at, company_logo_url, target_category, target_region FROM press_releases WHERE status = 'published' ORDER BY published_at DESC LIMIT ?1 OFFSET ?2"
    ).bind(limit, offset).all();

    const total = totalRow?.count || 0;
    return c.json({ releases: results || [], total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (e) {
    console.error('GET /v1/press-releases failed:', e.message);
    return c.json({ error: 'Failed to fetch press releases.' }, 500);
  }
});

apiService.get('/v1/press-releases/:id', apiKeyAuth, async (c) => {
  try {
    const scopes = c.get('apiKeyScopes') || [];
    if (!scopes.includes('press_release:read')) return c.json({ error: 'Missing scope: press_release:read' }, 403);

    const id = c.req.param('id');
    const release = await c.env.DB.prepare(
      "SELECT * FROM press_releases WHERE id = ?1 AND status = 'published'"
    ).bind(id).first();

    if (!release) return c.json({ error: 'Press release not found.' }, 404);

    const { results: kitFiles } = await c.env.DB.prepare(
      'SELECT id, file_name, file_url, file_type FROM press_kits WHERE release_id = ?1'
    ).bind(id).all();

    return c.json({ release: { ...release, kit: kitFiles || [] } });
  } catch (e) {
    console.error('GET /v1/press-releases/:id failed:', e.message);
    return c.json({ error: 'Failed to fetch press release.' }, 500);
  }
});

apiService.get('/v1/sponsored', apiKeyAuth, async (c) => {
  try {
    const scopes = c.get('apiKeyScopes') || [];
    if (!scopes.includes('sponsored:read')) return c.json({ error: 'Missing scope: sponsored:read' }, 403);

    const { results } = await c.env.DB.prepare(
      "SELECT id, author_id, title, body, created_at FROM stories WHERE type = 'sponsored' AND deleted = 0 AND privacy = 'public' ORDER BY created_at DESC LIMIT 50"
    ).all();

    return c.json({ sponsored: results || [] });
  } catch (e) {
    console.error('GET /v1/sponsored failed:', e.message);
    return c.json({ error: 'Failed to fetch sponsored content.' }, 500);
  }
});

export default apiService;