// Validates API key from Authorization header
// Usage: apiKeyAuth middleware checks Bearer token, looks up hash, attaches user

export async function apiKeyAuth(c, next) {
  const auth = c.req.header('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return c.json({ error: 'API key required. Use Authorization: Bearer your_key' }, 401);
  }

  const raw = auth.slice(7);
  const hash = await sha256(raw);

  const key = await c.env.DB.prepare(
    'SELECT * FROM api_keys WHERE key_hash = ? AND revoked = 0'
  )
    .bind(hash)
    .first();

  if (!key) {
    return c.json({ error: 'Invalid or revoked API key.' }, 401);
  }

  // Update last_used_at
  await c.env.DB.prepare(
    "UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?"
  )
    .bind(key.id)
    .run();

  // Attach the publisher's user to the context
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(key.user_id)
    .first();

  if (!user || user.suspended) {
    return c.json({ error: 'Publisher account not found or suspended.' }, 403);
  }

  c.set('user', user);
  c.set('apiKey', key);
  await next();
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}