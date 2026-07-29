// backend/src/middleware/ipBlacklist.js
// IP Blacklist Middleware — Auto-blocks abusive IPs.
// 50+ violations in 10 minutes → temp block 1 hour.
// 3+ temp blocks → permanent block.
// Applied before all routes in index.js.

const VIOLATION_THRESHOLD = 50;
const VIOLATION_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const TEMP_BLOCK_DURATION_MS = 60 * 60 * 1000; // 1 hour
const PERMANENT_BLOCK_THRESHOLD = 3;

// In-memory violation tracker (per worker isolate — best effort)
const __violations = new Map();

function getClientIp(c) {
  return c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
}

// ── Safe DB helpers ──────────────────────────────────────────────────────

async function safeDbFirst(env, sql, ...params) {
  try { return await env.DB.prepare(sql).bind(...params).first(); }
  catch (e) { console.error('IPBL_DB_ERROR:', e.message); return null; }
}

async function safeDbRun(env, sql, ...params) {
  try { return await env.DB.prepare(sql).bind(...params).run(); }
  catch (e) { console.error('IPBL_DB_ERROR:', e.message); return null; }
}

async function safeDbAll(env, sql, ...params) {
  try { return (await env.DB.prepare(sql).bind(...params).all()).results || []; }
  catch (e) { console.error('IPBL_DB_ERROR:', e.message); return []; }
}

// ── Middleware ────────────────────────────────────────────────────────────

async function ipBlacklistMiddleware(c, next) {
  const ip = getClientIp(c);
  if (!ip || ip === 'unknown') return await next();

  // Check database blacklist
  const record = await safeDbFirst(
    c.env,
    'SELECT * FROM ip_blacklist WHERE ip_address = ?',
    ip
  );

  if (record) {
    // Permanent block
    if (record.is_permanent) {
      return c.json({ error: 'Access denied. Your IP has been permanently blocked.' }, 403);
    }

    // Temporary block — check expiry
    if (record.blocked_until) {
      const until = new Date(record.blocked_until + 'Z').getTime();
      if (Date.now() < until) {
        const minutesLeft = Math.ceil((until - Date.now()) / 60000);
        return c.json({
          error: `Access denied. Your IP is temporarily blocked for approximately ${minutesLeft} more minute(s).`
        }, 403);
      }
      // Block expired — remove it
      await safeDbRun(c.env, 'DELETE FROM ip_blacklist WHERE ip_address = ?', ip);
    }
  }

  return await next();
}

// ── Violation tracking ───────────────────────────────────────────────────

async function recordViolation(env, ip, reason) {
  if (!ip || ip === 'unknown') return;

  const now = Date.now();
  const violations = (__violations.get(ip) || []).filter(t => now - t < VIOLATION_WINDOW_MS);
  violations.push(now);
  __violations.set(ip, violations);

  // Cleanup old entries periodically
  if (__violations.size > 5000) {
    for (const [key, times] of __violations) {
      if (!times.some(t => now - t < VIOLATION_WINDOW_MS)) __violations.delete(key);
    }
  }

  const count = violations.length;
  if (count < VIOLATION_THRESHOLD) return;

  // Threshold reached — apply block
  const existing = await safeDbFirst(env, 'SELECT * FROM ip_blacklist WHERE ip_address = ?', ip);

  if (existing) {
    // Increment violation count
    const newCount = (existing.violation_count || 0) + 1;
    const isPermanent = existing.is_permanent || newCount >= PERMANENT_BLOCK_THRESHOLD;

    if (isPermanent && !existing.is_permanent) {
      await safeDbRun(
        env,
        `UPDATE ip_blacklist SET violation_count = ?, is_permanent = 1, blocked_until = NULL, reason = ? WHERE ip_address = ?`,
        newCount, `Permanent block after ${newCount} violations. Last: ${reason}`, ip
      );
      console.error(JSON.stringify({
        kind: 'ip_permanent_block',
        ip,
        violations: newCount,
        reason,
        timestamp: new Date().toISOString(),
      }));
    } else if (!isPermanent) {
      const blockedUntil = new Date(now + TEMP_BLOCK_DURATION_MS).toISOString();
      await safeDbRun(
        env,
        `UPDATE ip_blacklist SET violation_count = ?, blocked_until = ?, reason = ? WHERE ip_address = ?`,
        newCount, blockedUntil, `Temp block #${newCount}: ${reason}`, ip
      );
    }
  } else {
    // First block
    const blockedUntil = new Date(now + TEMP_BLOCK_DURATION_MS).toISOString();
    await safeDbRun(
      env,
      `INSERT INTO ip_blacklist (ip_address, reason, blocked_until, violation_count) VALUES (?, ?, ?, 1)`,
      ip, `Temp block #1: ${reason}`, blockedUntil
    );
    console.error(JSON.stringify({
      kind: 'ip_temp_block',
      ip,
      reason,
      timestamp: new Date().toISOString(),
    }));
  }
}

// ── Admin functions ──────────────────────────────────────────────────────

async function blockIp(env, ip, reason, isPermanent = false) {
  if (!ip) return { error: 'IP address required.' };

  const blockedUntil = isPermanent ? null : new Date(Date.now() + TEMP_BLOCK_DURATION_MS).toISOString();

  await safeDbRun(
    env,
    `INSERT INTO ip_blacklist (ip_address, reason, blocked_until, is_permanent, violation_count)
     VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(ip_address) DO UPDATE SET
       reason = excluded.reason,
       blocked_until = excluded.blocked_until,
       is_permanent = excluded.is_permanent,
       violation_count = ip_blacklist.violation_count + 1`,
    ip, reason, blockedUntil, isPermanent ? 1 : 0
  );

  return { ok: true, ip, permanent: isPermanent };
}

async function unblockIp(env, ip) {
  await safeDbRun(env, 'DELETE FROM ip_blacklist WHERE ip_address = ?', ip);
  __violations.delete(ip);
  return { ok: true, ip };
}

async function getBlacklist(env, page = 1, limit = 50) {
  const offset = (page - 1) * limit;
  const totalRow = await safeDbFirst(env, 'SELECT COUNT(*) as count FROM ip_blacklist');
  const rows = await safeDbAll(
    env,
    'SELECT * FROM ip_blacklist ORDER BY blocked_at DESC LIMIT ? OFFSET ?',
    limit, offset
  );
  return {
    ips: rows,
    total: totalRow?.count || 0,
    page,
    totalPages: Math.ceil((totalRow?.count || 0) / limit),
  };
}

export {
  ipBlacklistMiddleware,
  recordViolation,
  blockIp,
  unblockIp,
  getBlacklist,
};