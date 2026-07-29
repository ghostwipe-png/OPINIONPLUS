// backend/src/middleware/featureFlags.js
// Feature Flags Middleware — Admin toggles features without deploying.
// Cached in memory for 60 seconds to avoid DB hits on every request.

const CACHE_TTL_MS = 60 * 1000; // 60 seconds

// In-memory cache per worker isolate
const __cache = new Map();

// ── Safe DB helpers ──────────────────────────────────────────────────────

async function safeDbFirst(env, sql, ...params) {
  try { return await env.DB.prepare(sql).bind(...params).first(); }
  catch (e) { console.error('FF_DB_ERROR:', e.message); return null; }
}

async function safeDbAll(env, sql, ...params) {
  try { return (await env.DB.prepare(sql).bind(...params).all()).results || []; }
  catch (e) { console.error('FF_DB_ERROR:', e.message); return []; }
}

async function safeDbRun(env, sql, ...params) {
  try { return await env.DB.prepare(sql).bind(...params).run(); }
  catch (e) { console.error('FF_DB_ERROR:', e.message); return null; }
}

// ── Core flag functions ──────────────────────────────────────────────────

async function isFeatureEnabled(env, flagKey) {
  if (!env?.DB) return true; // No DB — allow everything (degraded mode)

  const cached = __cache.get(flagKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    return cached.value === 'true';
  }

  const row = await safeDbFirst(
    env,
    'SELECT flag_value FROM feature_flags WHERE flag_key = ?',
    flagKey
  );

  const value = row?.flag_value || 'true';
  __cache.set(flagKey, { value, timestamp: Date.now() });

  return value === 'true';
}

async function getFlagValue(env, flagKey) {
  // Returns the raw string value (for non-boolean flags like beta_features JSON)
  if (!env?.DB) return '{}';

  const cached = __cache.get(`raw:${flagKey}`);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    return cached.value;
  }

  const row = await safeDbFirst(
    env,
    'SELECT flag_value FROM feature_flags WHERE flag_key = ?',
    flagKey
  );

  const value = row?.flag_value || '{}';
  __cache.set(`raw:${flagKey}`, { value, timestamp: Date.now() });

  return value;
}

async function getAllFeatureFlags(env) {
  if (!env?.DB) return [];
  return await safeDbAll(env, 'SELECT * FROM feature_flags ORDER BY flag_key');
}

async function setFeatureFlag(env, flagKey, flagValue, updatedBy = 'system') {
  await safeDbRun(
    env,
    `INSERT INTO feature_flags (flag_key, flag_value, description, updated_by, updated_at)
     VALUES (?, ?, '', ?, datetime('now'))
     ON CONFLICT(flag_key) DO UPDATE SET
       flag_value = excluded.flag_value,
       updated_by = excluded.updated_by,
       updated_at = datetime('now')`,
    flagKey, String(flagValue), updatedBy
  );

  // Bust cache
  __cache.delete(flagKey);
  __cache.delete(`raw:${flagKey}`);

  return { ok: true, flagKey, flagValue: String(flagValue) };
}

// ── Maintenance mode middleware ──────────────────────────────────────────

async function maintenanceMiddleware(c, next) {
  // Skip maintenance check for admin routes and auth routes
  const path = c.req.path;
  if (path.startsWith('/admin') || path.startsWith('/auth') || path === '/health') {
    return await next();
  }

  // Check if maintenance mode is on
  const maintenanceOn = await isFeatureEnabled(c.env, 'maintenance_mode');
  if (!maintenanceOn) return await next();

  // Allow admin/root users through
  const user = c.get('user');
  if (user && (user.role === 'admin' || user.role === 'root')) {
    return await next();
  }

  // Return maintenance page
  return c.json({
    error: 'Platform under maintenance',
    message: 'OPINIONPLUS is currently undergoing scheduled maintenance. We\'ll be back shortly.',
    retry_after_seconds: 300,
  }, 503);
}

export {
  isFeatureEnabled,
  getFlagValue,
  getAllFeatureFlags,
  setFeatureFlag,
  maintenanceMiddleware,
};