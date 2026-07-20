import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';

const keys = new Hono();

// Helper to securely hash API keys before saving to D1
async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// GET /keys — list all active API keys for the logged-in user
keys.get('/', requireAuth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, prefix, created_at, last_used_at FROM api_keys WHERE user_id = ? AND revoked = 0 ORDER BY created_at DESC'
  )
    .bind(user.id)
    .all();
  return c.json({ keys: results });
});

// POST /keys — generate a new API key
keys.post('/', requireAuth, async (c) => {
  const user = c.get('user');
  const { name } = await c.req.json().catch(() => ({}));
  
  if (!name?.trim()) return c.json({ error: 'Key name is required.' }, 400);

  const id = crypto.randomUUID();
  const rawKey = `op_${crypto.randomUUID().replace(/-/g, '')}`; // The secret key shown to the user
  const prefix = rawKey.slice(0, 12); // Used to identify the key in the UI
  const hash = await sha256(rawKey); // The secure hash saved in the DB

  await c.env.DB.prepare(
    'INSERT INTO api_keys (id, user_id, name, key_hash, prefix) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(id, user.id, name.trim(), hash, prefix)
    .run();

  // Return the raw key ONLY ONCE upon creation
  return c.json({ 
    id, 
    name: name.trim(), 
    key: rawKey, 
    prefix, 
    created_at: new Date().toISOString() 
  }, 201);
});

// DELETE /keys/:id — revoke an API key
keys.delete('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  
  const existing = await c.env.DB.prepare('SELECT * FROM api_keys WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .first();
    
  if (!existing) return c.json({ error: 'Not found' }, 404);

  // Soft-delete by marking as revoked
  await c.env.DB.prepare('UPDATE api_keys SET revoked = 1 WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

export default keys;