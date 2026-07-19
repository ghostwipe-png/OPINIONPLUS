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

// Best-effort audit log. Swallows errors so a missing audit_log table (e.g. in
// a deployment that hasn't run the migration yet) never blocks the actual
// admin action it's logging.
async function audit(env, adminEmail, action, targetId, details = {}) {
  try {
    await env.DB.prepare(
      "INSERT INTO audit_log (id, admin_email, action, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
    ).bind(crypto.randomUUID(), adminEmail, action, targetId || null, JSON.stringify(details)).run();
  } catch (e) { /* audit_log table not present in this deployment — non-fatal */ }
}

function requireAdmin(c) {
  const user = c.get('user');
  if (!user || (user.role !== 'admin' && user.role !== 'root')) return null;
  return user;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

archive.get('/', async (c) => {
  const user = requireAdmin(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 403);

  const status = c.req.query('status') || 'pending';
  const source = c.req.query('source') || '';
  const search = c.req.query('q') || '';
  const dateFrom = c.req.query('from') || '';
  const dateTo = c.req.query('to') || '';
  const page = parseInt(c.req.query('page') || '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  let sql = 'SELECT * FROM archive WHERE 1=1';
  const binds = [];

  if (status !== 'all') { sql += ' AND status = ?'; binds.push(status); }
  if (source) { sql += ' AND source_name = ?'; binds.push(source); }
  if (search) { sql += ' AND (title LIKE ? OR excerpt LIKE ?)'; binds.push(`%${search}%`, `%${search}%`); }
  if (dateFrom) { sql += ' AND date(created_at) >= date(?)'; binds.push(dateFrom); }
  if (dateTo) { sql += ' AND date(created_at) <= date(?)'; binds.push(dateTo); }

  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM (${sql})`).bind(...binds).first();
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  binds.push(limit, offset);

  const { results } = await c.env.DB.prepare(sql).bind(...binds).all();
  return c.json({ items: results, total: countRow?.count || 0, page, totalPages: Math.ceil((countRow?.count || 0) / limit) });
});

// Single item — full detail view (e.g. before editing).
archive.get('/:id', async (c) => {
  const user = requireAdmin(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 403);

  const id = c.req.param('id');
  const item = await c.env.DB.prepare('SELECT * FROM archive WHERE id = ?').bind(id).first();
  if (!item) return c.json({ error: 'Not found' }, 404);
  return c.json({ item });
});

// Edit title/excerpt/body before approving. Only touches fields provided.
archive.patch('/:id', async (c) => {
  const user = requireAdmin(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 403);

  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT * FROM archive WHERE id = ?').bind(id).first();
  if (!existing) return c.json({ error: 'Not found' }, 404);

  const body = await c.req.json();
  const title = typeof body.title === 'string' ? body.title : existing.title;
  const excerpt = typeof body.excerpt === 'string' ? body.excerpt : existing.excerpt;
  const html = typeof body.body === 'string' ? body.body : existing.body;
  const coverImage = typeof body.cover_image === 'string' ? body.cover_image : existing.cover_image;

  await c.env.DB.prepare(
    'UPDATE archive SET title = ?, excerpt = ?, body = ?, cover_image = ? WHERE id = ?'
  ).bind(title, excerpt, html, coverImage, id).run();

  await audit(c.env, user.email, 'archive.edit', id, { fields: Object.keys(body) });

  const updated = await c.env.DB.prepare('SELECT * FROM archive WHERE id = ?').bind(id).first();
  return c.json({ ok: true, item: updated });
});

archive.post('/:id/approve', async (c) => {
  const user = requireAdmin(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 403);

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

  await audit(c.env, user.email, 'archive.approve', id, { feedId });

  return c.json({ ok: true, feedId });
});

// NOTE: registered before the generic '/:id' DELETE below — Hono matches
// routes in registration order, and '/cleanup' would otherwise be swallowed
// by '/:id' (with id === "cleanup") since both are single path segments.
archive.delete('/cleanup', async (c) => {
  const user = requireAdmin(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 403);

  const approved = await c.env.DB.prepare(
    "DELETE FROM archive WHERE status = 'approved' AND reviewed_at < datetime('now', '-30 days')"
  ).run();
  const rejected = await c.env.DB.prepare(
    "DELETE FROM archive WHERE status = 'rejected' AND reviewed_at < datetime('now', '-7 days')"
  ).run();

  const byStatus = {
    approved: approved.meta?.changes || 0,
    rejected: rejected.meta?.changes || 0,
  };

  await audit(c.env, user.email, 'archive.cleanup', null, byStatus);

  return c.json({ deleted: byStatus.approved + byStatus.rejected, byStatus });
});

archive.delete('/:id', async (c) => {
  const user = requireAdmin(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 403);
  const id = c.req.param('id');
  await c.env.DB.prepare(
    "UPDATE archive SET status = ?, reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ?"
  ).bind('rejected', user.email, id).run();
  await audit(c.env, user.email, 'archive.reject', id);
  return c.json({ ok: true });
});

archive.post('/bulk-approve', async (c) => {
  const user = requireAdmin(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 403);

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

  await audit(c.env, user.email, 'archive.bulk_approve', null, { count, ids });

  return c.json({ ok: true, count });
});

archive.post('/bulk-delete', async (c) => {
  const user = requireAdmin(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 403);

  const { ids } = await c.req.json();
  if (!Array.isArray(ids)) return c.json({ error: 'No IDs provided' }, 400);

  for (const id of ids) {
    await c.env.DB.prepare(
      "UPDATE archive SET status = ?, reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ?"
    ).bind('rejected', user.email, id).run();
  }

  await audit(c.env, user.email, 'archive.bulk_delete', null, { count: ids.length, ids });

  return c.json({ ok: true, count: ids.length });
});

// Approve every currently-pending item in one pass. Deliberately requires an
// explicit confirm flag in the body so a stray click can't nuke the queue —
// the frontend should show its own "are you sure?" dialog before sending this.
archive.post('/approve-all', async (c) => {
  const user = requireAdmin(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 403);

  const { confirm, type, privacy } = await c.req.json();
  if (confirm !== true) return c.json({ error: 'Confirmation required (send { confirm: true }).' }, 400);

  const { results: pending } = await c.env.DB.prepare("SELECT * FROM archive WHERE status = 'pending'").all();

  let count = 0;
  for (const item of pending) {
    const feedId = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO stories (id, author_id, title, excerpt, body, cover_image, type, privacy, created_at, updated_at) VALUES (?, 'u_newsdesk', ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
    ).bind(feedId, item.title, item.excerpt, item.body, fixImageUrl(item.cover_image), type || 'story', privacy || 'public').run();

    await c.env.DB.prepare(
      "UPDATE archive SET status = ?, feed_id = ?, reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ?"
    ).bind('approved', feedId, user.email, item.id).run();
    count++;
  }

  await audit(c.env, user.email, 'archive.approve_all', null, { count });

  return c.json({ ok: true, count });
});

// CSV export of the current filtered view (same filters as GET /, capped at
// 5000 rows so a single export can't lock up the worker).
archive.get('/export/csv', async (c) => {
  const user = requireAdmin(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 403);

  const status = c.req.query('status') || 'all';
  let sql = 'SELECT id, source_name, title, status, created_at, reviewed_at, reviewed_by FROM archive WHERE 1=1';
  const binds = [];
  if (status !== 'all') { sql += ' AND status = ?'; binds.push(status); }
  sql += ' ORDER BY created_at DESC LIMIT 5000';

  const { results } = await c.env.DB.prepare(sql).bind(...binds).all();

  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['id', 'source_name', 'title', 'status', 'created_at', 'reviewed_at', 'reviewed_by'];
  const rows = results.map((r) => header.map((h) => escape(r[h])).join(','));
  const csv = [header.join(','), ...rows].join('\n');

  await audit(c.env, user.email, 'archive.export_csv', null, { rowCount: results.length });

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="archive-export-${Date.now()}.csv"`,
    },
  });
});

archive.get('/stats', async (c) => {
  const user = requireAdmin(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 403);

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
