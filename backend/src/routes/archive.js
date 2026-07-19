import { Hono } from 'hono';

const archive = new Hono();

// ---------------------------------------------------------------------------
// Helper — upscale known thumbnail URLs to full-size images
// ---------------------------------------------------------------------------
function fixImageUrl(url) {
  if (!url) return null;
  // BBC: /240/cpsprodpb → /1024/cpsprodpb
  if (url.includes('ichef.bbci.co.uk')) {
    return url.replace(/\/\d+\/cpsprodpb/, '/1024/cpsprodpb');
  }
  // Al Jazeera / Nation / Capital FM / Tuko — use as-is
  return url;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

archive.get('/', async (c) => {
  const user = c.get('user');
  if (!user || (user.role !== 'admin' && user.role !== 'root')) return c.json({ error: 'Unauthorized' }, 403);

  const status = c.req.query('status') || 'pending';
  const source = c.req.query('source') || '';
  const search = c.req.query('q') || '';
  const page = parseInt(c.req.query('page') || '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  let sql = 'SELECT * FROM archive WHERE 1=1';
  const binds = [];

  if (status !== 'all') { sql += ' AND status = ?'; binds.push(status); }
  if (source) { sql += ' AND source_name = ?'; binds.push(source); }
  if (search) { sql += ' AND (title LIKE ? OR excerpt LIKE ?)'; binds.push(`%${search}%`, `%${search}%`); }

  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM (${sql})`).bind(...binds).first();
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  binds.push(limit, offset);

  const { results } = await c.env.DB.prepare(sql).bind(...binds).all();
  return c.json({ items: results, total: countRow?.count || 0, page, totalPages: Math.ceil((countRow?.count || 0) / limit) });
});

archive.post('/:id/approve', async (c) => {
  const user = c.get('user');
  if (!user || (user.role !== 'admin' && user.role !== 'root')) return c.json({ error: 'Unauthorized' }, 403);

  const id = c.req.param('id');
  const { type, privacy } = await c.req.json();
  const item = await c.env.DB.prepare('SELECT * FROM archive WHERE id = ?').bind(id).first();
  if (!item) return c.json({ error: 'Not found' }, 404);

  const feedId = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO stories (id, author_id, title, excerpt, body, cover_image, type, privacy, created_at, updated_at) VALUES (?, 'u_newsdesk', ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
  ).bind(feedId, item.title, item.excerpt, item.body, fixImageUrl(item.cover_image), type || 'story', privacy || 'public').run();

  await c.env.DB.prepare(
    "UPDATE archive SET status = ?, feed_id = ?, reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ?"
  ).bind('approved', feedId, user.email, id).run();

  return c.json({ ok: true, feedId });
});

archive.delete('/:id', async (c) => {
  const user = c.get('user');
  if (!user || (user.role !== 'admin' && user.role !== 'root')) return c.json({ error: 'Unauthorized' }, 403);
  const id = c.req.param('id');
  await c.env.DB.prepare(
    "UPDATE archive SET status = ?, reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ?"
  ).bind('rejected', user.email, id).run();
  return c.json({ ok: true });
});

archive.post('/bulk-approve', async (c) => {
  const user = c.get('user');
  if (!user || (user.role !== 'admin' && user.role !== 'root')) return c.json({ error: 'Unauthorized' }, 403);

  const { ids, type, privacy } = await c.req.json();
  if (!Array.isArray(ids) || ids.length === 0) return c.json({ error: 'No IDs provided' }, 400);

  let count = 0;
  for (const id of ids) {
    const item = await c.env.DB.prepare('SELECT * FROM archive WHERE id = ? AND status = ?').bind(id, 'pending').first();
    if (!item) continue;

    const feedId = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO stories (id, author_id, title, excerpt, body, cover_image, type, privacy, created_at, updated_at) VALUES (?, 'u_newsdesk', ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
    ).bind(feedId, item.title, item.excerpt, item.body, fixImageUrl(item.cover_image), type || 'story', privacy || 'public').run();

    await c.env.DB.prepare(
      "UPDATE archive SET status = ?, feed_id = ?, reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ?"
    ).bind('approved', feedId, user.email, id).run();
    count++;
  }

  return c.json({ ok: true, count });
});

archive.post('/bulk-delete', async (c) => {
  const user = c.get('user');
  if (!user || (user.role !== 'admin' && user.role !== 'root')) return c.json({ error: 'Unauthorized' }, 403);

  const { ids } = await c.req.json();
  if (!Array.isArray(ids)) return c.json({ error: 'No IDs provided' }, 400);

  for (const id of ids) {
    await c.env.DB.prepare(
      "UPDATE archive SET status = ?, reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ?"
    ).bind('rejected', user.email, id).run();
  }

  return c.json({ ok: true, count: ids.length });
});

archive.get('/stats', async (c) => {
  const user = c.get('user');
  if (!user || (user.role !== 'admin' && user.role !== 'root')) return c.json({ error: 'Unauthorized' }, 403);

  const [total, pending, approved, rejected, bySource] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as count FROM archive').first(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM archive WHERE status = 'pending'").first(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM archive WHERE status = 'approved'").first(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM archive WHERE status = 'rejected'").first(),
    c.env.DB.prepare('SELECT source_name, COUNT(*) as count FROM archive GROUP BY source_name ORDER BY count DESC').all(),
  ]);

  return c.json({
    total: total?.count || 0,
    pending: pending?.count || 0,
    approved: approved?.count || 0,
    rejected: rejected?.count || 0,
    bySource: bySource.results,
  });
});

export default archive;