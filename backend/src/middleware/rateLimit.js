// backend/src/middleware/rateLimit.js
// Simple rate limiter using D1
//
// RATE LIMIT TIERS (per user unless noted as IP):
// ─────────────────────────────────────────────
// auth:google           — 10/min/IP
// auth:signup           — 5/min/IP   [NEW]
// search                — 30/min/IP
// sms:send              — 10/min/IP
// story:create          — 10/hour/user  [NEW]
// story:comment         — 30/hour/user  [NEW]
// story:like            — 60/hour/user  [NEW]
// story:report          — 10/hour/user
// user:follow           — 30/hour/user  [NEW]
// user:profile_edit     — 10/hour/user  [NEW]
// user:subscribe        — 10/hour/IP
// partner:withdraw      — 3/day/user, 1/min/user
// partner:endorse       — 20/hour/user
// admin:action          — 100/hour/admin [NEW]
// api:track:impression  — 100/min/IP
// api:track:click       — 30/min/IP
// api:track:conversion  — 20/min/IP
// referral:click        — 10/min/IP

export function createRateLimiter(db, windowSeconds = 60, maxRequests = 10) {
  return async function rateLimit(identifier, action) {
    const key = `${identifier}:${action}`;
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - windowSeconds;

    // Clean old entries (best-effort — failure here should not block the request)
    try {
      await db.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now).run();
    } catch (e) {
      // Table may not exist yet — fail open
      console.error('Rate limit cleanup failed:', e.message);
      return true;
    }

    // Count recent requests
    try {
      const row = await db.prepare(
        'SELECT COUNT(*) as count FROM rate_limits WHERE key = ? AND created_at > ?'
      ).bind(key, cutoff).first();

      const count = parseInt(row?.count || 0, 10);

      if (count >= maxRequests) return false;

      // Record this request
      await db.prepare(
        'INSERT INTO rate_limits (key, created_at, expires_at) VALUES (?, ?, ?)'
      ).bind(key, now, now + windowSeconds * 2).run();

      return true;
    } catch (e) {
      // If rate limit table fails, fail open — don't block legitimate traffic
      console.error('Rate limit check failed:', e.message);
      return true;
    }
  };
}