// Simple rate limiter using D1
export function createRateLimiter(db, windowSeconds = 60, maxRequests = 10) {
  return async function rateLimit(identifier, action) {
    const key = `${identifier}:${action}`;
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - windowSeconds;

    // Clean old entries
    await db.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now).run();

    // Count recent requests
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
  };
}