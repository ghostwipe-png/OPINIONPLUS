import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { apiKeyAuth } from '../middleware/apiKey.js';

const stories = new Hono();

async function hydrateStory(db, row) {
  const [files, likes, ratings, comments] = await Promise.all([
    db.prepare('SELECT name, url FROM story_files WHERE story_id = ?').bind(row.id).all(),
    db.prepare('SELECT user_id FROM likes WHERE story_id = ?').bind(row.id).all(),
    db.prepare('SELECT user_id, score FROM ratings WHERE story_id = ?').bind(row.id).all(),
    db
      .prepare('SELECT id, user_id, body, parent_id, created_at FROM comments WHERE story_id = ? ORDER BY created_at ASC')
      .bind(row.id)
      .all(),
  ]);
  return {
    ...row,
    files: files.results,
    likes: likes.results.map((l) => l.user_id),
    ratings: Object.fromEntries(ratings.results.map((r) => [r.user_id, r.score])),
    comments: comments.results,
  };
}

// GET /stories?type=&privacy=public
stories.get('/', async (c) => {
  const type = c.req.query('type');
  const authorId = c.req.query('authorId');
  let sql = 'SELECT * FROM stories WHERE deleted = 0 AND privacy = "public"';
  const binds = [];
  if (type && type !== 'all') {
    sql += ' AND type = ?';
    binds.push(type);
  }
  if (authorId) {
    sql += ' AND author_id = ?';
    binds.push(authorId);
  }
  sql += ' ORDER BY created_at DESC LIMIT 100';
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all();
  const hydrated = await Promise.all(results.map((r) => hydrateStory(c.env.DB, r)));
  return c.json({ stories: hydrated });
});

// Public API endpoint — authenticated via API key
stories.get('/api/feed', apiKeyAuth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM stories WHERE author_id = ? AND deleted = 0 AND privacy = "public" ORDER BY created_at DESC LIMIT 100'
  )
    .bind(user.id)
    .all();

  const hydrated = await Promise.all(results.map((r) => hydrateStory(c.env.DB, r)));
  return c.json({ publisher: user.publisher_name, stories: hydrated });
});

stories.get('/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM stories WHERE id = ? AND deleted = 0')
    .bind(c.req.param('id'))
    .first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  const user = c.get('user');
  if (row.privacy === 'private' && row.author_id !== user?.id) {
    return c.json({ error: 'Not found' }, 404);
  }
  return c.json({ story: await hydrateStory(c.env.DB, row) });
});

stories.post('/', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO stories (id, author_id, title, excerpt, body, type, privacy, cover_image)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, user.id, body.title, body.excerpt || '', body.body, body.type || 'story', body.privacy || 'public', body.coverImage || null)
    .run();

  if (Array.isArray(body.files)) {
    for (const f of body.files) {
      await c.env.DB.prepare('INSERT INTO story_files (id, story_id, name, url) VALUES (?, ?, ?, ?)')
        .bind(crypto.randomUUID(), id, f.name, f.url)
        .run();
    }
  }
  return c.json({ id }, 201);
});

stories.patch('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT * FROM stories WHERE id = ?').bind(id).first();
  if (!existing || existing.author_id !== user.id) return c.json({ error: 'Not found' }, 404);

  const body = await c.req.json();
  await c.env.DB.prepare(
    `UPDATE stories SET title = ?, excerpt = ?, body = ?, type = ?, privacy = ?, cover_image = ?, updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(
      body.title ?? existing.title,
      body.excerpt ?? existing.excerpt,
      body.body ?? existing.body,
      body.type ?? existing.type,
      body.privacy ?? existing.privacy,
      body.coverImage ?? existing.cover_image,
      id
    )
    .run();
  return c.json({ ok: true });
});

stories.delete('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT * FROM stories WHERE id = ?').bind(id).first();
  if (!existing || existing.author_id !== user.id) return c.json({ error: 'Not found' }, 404);
  await c.env.DB.prepare('UPDATE stories SET deleted = 1 WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

stories.post('/:id/like', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT 1 FROM likes WHERE story_id = ? AND user_id = ?')
    .bind(id, user.id)
    .first();
  if (existing) {
    await c.env.DB.prepare('DELETE FROM likes WHERE story_id = ? AND user_id = ?').bind(id, user.id).run();
    return c.json({ liked: false });
  }
  await c.env.DB.prepare('INSERT INTO likes (story_id, user_id) VALUES (?, ?)').bind(id, user.id).run();
  return c.json({ liked: true });
});

stories.post('/:id/rate', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const { score } = await c.req.json();
  if (![1, 2, 3, 4, 5].includes(score)) return c.json({ error: 'score must be 1-5' }, 400);
  await c.env.DB.prepare(
    `INSERT INTO ratings (story_id, user_id, score) VALUES (?, ?, ?)
     ON CONFLICT(story_id, user_id) DO UPDATE SET score = excluded.score`
  )
    .bind(id, user.id, score)
    .run();
  return c.json({ ok: true });
});

stories.post('/:id/comments', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const { body, parentId } = await c.req.json();
  if (!body?.trim()) return c.json({ error: 'Comment cannot be empty.' }, 400);
  const commentId = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO comments (id, story_id, user_id, body, parent_id) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(commentId, id, user.id, body.trim(), parentId || null)
    .run();
  return c.json({ id: commentId }, 201);
});

stories.post('/:id/report', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const { reason } = await c.req.json();
  await c.env.DB.prepare('INSERT INTO reports (id, story_id, reporter_id, reason) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), id, user.id, reason || '')
    .run();
  return c.json({ ok: true });
});

// Invite collaborator
stories.post('/:id/collaborate', requireAuth, async (c) => {
  const user = c.get('user');
  const storyId = c.req.param('id');
  
  const story = await c.env.DB.prepare('SELECT * FROM stories WHERE id = ? AND deleted = 0').bind(storyId).first();
  if (!story || story.author_id !== user.id) return c.json({ error: 'Not found' }, 404);

  const { email } = await c.req.json();
  const coAuthor = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  if (!coAuthor) return c.json({ error: 'User not found.' }, 404);
  if (coAuthor.id === user.id) return c.json({ error: 'You cannot collaborate with yourself.' }, 400);

  const existing = await c.env.DB.prepare(
    'SELECT * FROM collaborations WHERE story_id = ? AND co_author_id = ?'
  ).bind(storyId, coAuthor.id).first();
  if (existing) return c.json({ error: 'Already invited.' }, 400);

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO collaborations (id, story_id, author_id, co_author_id, status) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, storyId, user.id, coAuthor.id, 'pending').run();

  return c.json({ id, coAuthorName: coAuthor.publisher_name, status: 'pending' }, 201);
});

// Get collaborators for a story
stories.get('/:id/collaborators', async (c) => {
  const storyId = c.req.param('id');
  const { results } = await c.env.DB.prepare(
    `SELECT c.*, u.publisher_name, u.logo_url, u.email
     FROM collaborations c JOIN users u ON c.co_author_id = u.id
     WHERE c.story_id = ?`
  ).bind(storyId).all();
  return c.json({ collaborators: results });
});

// Accept collaboration
stories.post('/collaborations/:id/accept', requireAuth, async (c) => {
  const user = c.get('user');
  const collabId = c.req.param('id');
  
  const collab = await c.env.DB.prepare(
    'SELECT * FROM collaborations WHERE id = ? AND co_author_id = ? AND status = ?'
  ).bind(collabId, user.id, 'pending').first();
  if (!collab) return c.json({ error: 'Not found' }, 404);

  await c.env.DB.prepare('UPDATE collaborations SET status = ? WHERE id = ?').bind('accepted', collabId).run();
  
  // Add co-author name to story title or metadata
  const coAuthor = await c.env.DB.prepare('SELECT publisher_name FROM users WHERE id = ?').bind(user.id).first();
  return c.json({ ok: true, message: `You are now a co-author.` });
});

// GET /stories/timeline/:userId — publishing history for visual timeline
stories.get('/timeline/:userId', async (c) => {
  const userId = c.req.param('userId');
  const { results } = await c.env.DB.prepare(
    `SELECT date(created_at) as date, COUNT(*) as count, type
     FROM stories 
     WHERE author_id = ? AND deleted = 0 AND privacy = 'public'
     GROUP BY date(created_at), type
     ORDER BY date DESC
     LIMIT 365`
  ).bind(userId).all();
  
  return c.json({ timeline: results });
});

export default stories;