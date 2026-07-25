import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';

const videos = new Hono();

// Sub-routers for new top-level paths (mounted separately in index.js)
const channels = new Hono();
const subscriptionsFeed = new Hono();
const history = new Hono();
const playlists = new Hono();
const watchLater = new Hono();

async function bunnyRequest(endpoint, options = {}, env) {
  const url = `https://video.bunnycdn.com/library/${env.BUNNY_LIBRARY_ID}/${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'AccessKey': env.BUNNY_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Bunny API request failed');
  return data;
}

// ═══════════════════════════════════════════════════════
// EXISTING ROUTES (unchanged)
// ═══════════════════════════════════════════════════════

videos.get('/', async (c) => {
  try {
    const category = c.req.query('category');
    const userId = c.req.query('userId');
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = parseInt(c.req.query('limit') || '20', 10);
    const offset = (page - 1) * limit;

    let query = `SELECT * FROM videos WHERE privacy = 'public' AND status = 'ready'`;
    let countQuery = `SELECT COUNT(*) as total FROM videos WHERE privacy = 'public' AND status = 'ready'`;
    const params = [];

    if (userId) {
      query = `SELECT * FROM videos WHERE user_id = ?`;
      countQuery = `SELECT COUNT(*) as total FROM videos WHERE user_id = ?`;
      params.push(userId);
      if (category) {
        query += ` AND category = ?`;
        countQuery += ` AND category = ?`;
        params.push(category);
      }
    } else {
      if (category && category !== 'all') {
        query += ` AND category = ?`;
        countQuery += ` AND category = ?`;
        params.push(category);
      }
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const { results } = await c.env.DB.prepare(query).bind(...params).all();

    const countParams = userId ? [userId, ...(category ? [category] : [])] : (category && category !== 'all' ? [category] : []);
    const totalRow = await c.env.DB.prepare(countQuery).bind(...countParams).first();
    const total = totalRow ? totalRow.total : 0;

    return c.json({
      videos: results || [],
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (e) {
    console.error('List videos error:', e);
    return c.json({ error: 'Failed to list videos' }, 500);
  }
});

videos.get('/user/videos', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM videos WHERE user_id = ? AND status != 'deleted' ORDER BY created_at DESC`
    ).bind(user.id).all();

    return c.json({ videos: results || [] });
  } catch (e) {
    console.error('User videos error:', e);
    return c.json({ error: 'Failed to fetch user videos' }, 500);
  }
});

// ── NEW: recommendations & search must be registered BEFORE the '/:id' catch-all ──

videos.get('/recommendations', async (c) => {
  try {
    const category = c.req.query('category');
    const excludeId = c.req.query('excludeId') || '';
    const limit = parseInt(c.req.query('limit') || '10', 10);

    let results = [];
    if (category) {
      const { results: catResults } = await c.env.DB.prepare(
        `SELECT * FROM videos WHERE category = ? AND status = 'ready' AND privacy = 'public' AND id != ? ORDER BY views DESC LIMIT ?`
      ).bind(category, excludeId, limit).all();
      results = catResults || [];
    }

    if (results.length < limit) {
      const remaining = limit - results.length;
      const excludeIds = [excludeId, ...results.map((r) => r.id)].filter(Boolean);
      const placeholders = excludeIds.length ? excludeIds.map(() => '?').join(',') : null;
      const trendingQuery = `SELECT * FROM videos WHERE status = 'ready' AND privacy = 'public' ${placeholders ? `AND id NOT IN (${placeholders})` : ''} ORDER BY views DESC LIMIT ?`;
      const trendingParams = placeholders ? [...excludeIds, remaining] : [remaining];
      const { results: trending } = await c.env.DB.prepare(trendingQuery).bind(...trendingParams).all();
      results = [...results, ...(trending || [])];
    }

    return c.json({ videos: results });
  } catch (e) {
    console.error('Recommendations error:', e);
    return c.json({ error: 'Failed to fetch recommendations' }, 500);
  }
});

videos.get('/search', async (c) => {
  try {
    const q = (c.req.query('q') || '').trim();
    const category = c.req.query('category');
    const limit = parseInt(c.req.query('limit') || '20', 10);

    if (!q) return c.json({ videos: [], total: 0 });

    let query = `SELECT * FROM videos WHERE (title LIKE ? OR description LIKE ?) AND status = 'ready' AND privacy = 'public'`;
    const params = [`%${q}%`, `%${q}%`];

    if (category && category !== 'all') {
      query += ` AND category = ?`;
      params.push(category);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    return c.json({ videos: results || [], total: (results || []).length });
  } catch (e) {
    console.error('Search videos error:', e);
    return c.json({ error: 'Failed to search videos' }, 500);
  }
});

videos.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const video = await c.env.DB.prepare(`SELECT * FROM videos WHERE id = ?`).bind(id).first();

    if (!video || video.status === 'deleted') {
      return c.json({ error: 'Video not found' }, 404);
    }

    await c.env.DB.prepare(`UPDATE videos SET views = views + 1 WHERE id = ?`).bind(id).run();
    video.views += 1;

    return c.json({ video });
  } catch (e) {
    console.error('Get video error:', e);
    return c.json({ error: 'Failed to fetch video' }, 500);
  }
});

videos.post('/', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const { title, description, category, privacy } = await c.req.json();

    if (!title || !title.trim()) {
      return c.json({ error: 'Title is required' }, 400);
    }

    const bunnyRes = await bunnyRequest('videos', {
      method: 'POST',
      body: JSON.stringify({ title: title.trim() }),
    }, c.env);

    const bunnyVideoId = bunnyRes.guid;
    const bunnyLibraryId = String(c.env.BUNNY_LIBRARY_ID);
    const videoId = `vid_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const userName = user.publisherName || user.publisher_name || user.name || 'Creator';

    await c.env.DB.prepare(`
      INSERT INTO videos (id, title, description, bunny_video_id, bunny_library_id, status, user_id, user_name, category, privacy)
      VALUES (?, ?, ?, ?, ?, 'processing', ?, ?, ?, ?)
    `).bind(
      videoId,
      title.trim(),
      description || '',
      bunnyVideoId,
      bunnyLibraryId,
      user.id,
      userName,
      category || 'news',
      privacy || 'public'
    ).run();

    return c.json({
      video: {
        id: videoId,
        title: title.trim(),
        bunny_video_id: bunnyVideoId,
        status: 'processing',
      },
    }, 201);
  } catch (e) {
    console.error('Create video error:', e);
    return c.json({ error: e.message || 'Failed to create video entry' }, 500);
  }
});

videos.put('/:id/upload', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const video = await c.env.DB.prepare(`SELECT * FROM videos WHERE id = ?`).bind(id).first();

    if (!video) return c.json({ error: 'Video not found' }, 404);
    if (video.user_id !== user.id && user.role !== 'admin') {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    const bunnyUrl = `https://video.bunnycdn.com/library/${video.bunny_library_id}/videos/${video.bunny_video_id}`;

    const bunnyRes = await fetch(bunnyUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': c.env.BUNNY_API_KEY,
        'Content-Type': c.req.header('Content-Type') || 'application/octet-stream',
      },
      body: c.req.raw.body,
    });

    const data = await bunnyRes.json().catch(() => ({}));
    if (!bunnyRes.ok) {
      return c.json({ error: data.message || 'Bunny stream upload failed' }, bunnyRes.status);
    }

    return c.json({ ok: true, data });
  } catch (e) {
    console.error('Proxy upload error:', e);
    return c.json({ error: 'Failed to upload video stream' }, 500);
  }
});

videos.post('/:id/upload-complete', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const video = await c.env.DB.prepare(`SELECT * FROM videos WHERE id = ?`).bind(id).first();

    if (!video) return c.json({ error: 'Video not found' }, 404);
    if (video.user_id !== user.id && user.role !== 'admin') {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    await c.env.DB.prepare(`UPDATE videos SET status = 'processing', updated_at = datetime('now') WHERE id = ?`).bind(id).run();

    return c.json({ ok: true });
  } catch (e) {
    console.error('Upload complete error:', e);
    return c.json({ error: 'Failed to mark upload complete' }, 500);
  }
});

videos.get('/:id/status', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const video = await c.env.DB.prepare(`SELECT * FROM videos WHERE id = ?`).bind(id).first();

    if (!video) return c.json({ error: 'Video not found' }, 404);

    const bunnyData = await bunnyRequest(`videos/${video.bunny_video_id}`, { method: 'GET' }, c.env);

    let status = video.status;
    let progress = bunnyData.encodeProgress || 0;
    let duration = bunnyData.length || 0;
    let thumbnailUrl = video.thumbnail_url;

    if (bunnyData.status === 3 || bunnyData.status === 4) {
      status = 'ready';
      progress = 100;
      const cdnHostname = c.env.BUNNY_CDN_HOSTNAME || 'iframe.mediadelivery.net';
      thumbnailUrl = `https://${cdnHostname}/${video.bunny_library_id}/${video.bunny_video_id}/${bunnyData.thumbnailFileName || 'thumbnail.jpg'}`;

      await c.env.DB.prepare(`
        UPDATE videos SET status = 'ready', duration_seconds = ?, thumbnail_url = ?, updated_at = datetime('now') WHERE id = ?
      `).bind(duration, thumbnailUrl, id).run();
    } else if (bunnyData.status === 5) {
      status = 'failed';
      await c.env.DB.prepare(`UPDATE videos SET status = 'failed', updated_at = datetime('now') WHERE id = ?`).bind(id).run();
    }

    return c.json({ status, progress, thumbnailUrl, duration });
  } catch (e) {
    console.error('Get status error:', e);
    return c.json({ error: 'Failed to check status' }, 500);
  }
});

videos.patch('/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const video = await c.env.DB.prepare(`SELECT * FROM videos WHERE id = ?`).bind(id).first();

    if (!video) return c.json({ error: 'Video not found' }, 404);
    if (video.user_id !== user.id && user.role !== 'admin') {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    const { title, description, category, privacy, thumbnail } = await c.req.json();

    let newTitle = title !== undefined ? title : video.title;
    let newDesc = description !== undefined ? description : video.description;
    let newCat = category !== undefined ? category : video.category;
    let newPriv = privacy !== undefined ? privacy : video.privacy;
    let newThumb = thumbnail !== undefined ? thumbnail : video.thumbnail_url;

    await c.env.DB.prepare(`
      UPDATE videos SET title = ?, description = ?, category = ?, privacy = ?, thumbnail_url = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(newTitle, newDesc, newCat, newPriv, newThumb, id).run();

    return c.json({ ok: true });
  } catch (e) {
    console.error('Patch video error:', e);
    return c.json({ error: 'Failed to update video' }, 500);
  }
});

videos.delete('/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const video = await c.env.DB.prepare(`SELECT * FROM videos WHERE id = ?`).bind(id).first();

    if (!video) return c.json({ error: 'Video not found' }, 404);
    if (video.user_id !== user.id && user.role !== 'admin') {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    try {
      await bunnyRequest(`videos/${video.bunny_video_id}`, { method: 'DELETE' }, c.env);
    } catch (err) {
      console.error('Bunny remote delete warning:', err);
    }

    await c.env.DB.prepare(`UPDATE videos SET status = 'deleted', updated_at = datetime('now') WHERE id = ?`).bind(id).run();

    return c.json({ ok: true });
  } catch (e) {
    console.error('Delete video error:', e);
    return c.json({ error: 'Failed to delete video' }, 500);
  }
});

videos.get('/:id/embed', async (c) => {
  try {
    const id = c.req.param('id');
    const video = await c.env.DB.prepare(`SELECT * FROM videos WHERE id = ?`).bind(id).first();

    if (!video || video.status !== 'ready') {
      return c.json({ error: 'Video not ready or not found' }, 404);
    }

    const embedHtml = `<iframe src="https://iframe.mediadelivery.net/embed/${video.bunny_library_id}/${video.bunny_video_id}" loading="lazy" style="border:none;position:absolute;top:0;left:0;height:100%;width:100%;" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowfullscreen="true"></iframe>`;

    return c.json({ embedHtml });
  } catch (e) {
    console.error('Embed error:', e);
    return c.json({ error: 'Failed to generate embed' }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// NEW: ENGAGEMENT ROUTES (like / dislike / like-status)
// ═══════════════════════════════════════════════════════

videos.post('/:id/like', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const liked = body.liked !== false;

    const video = await c.env.DB.prepare('SELECT id FROM videos WHERE id = ?').bind(id).first();
    if (!video) return c.json({ error: 'Video not found' }, 404);

    if (!liked) {
      await c.env.DB.prepare(
        `DELETE FROM video_likes WHERE video_id = ? AND user_id = ? AND liked = 1`
      ).bind(id, user.id).run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO video_likes (video_id, user_id, liked) VALUES (?, ?, 1)
         ON CONFLICT(video_id, user_id) DO UPDATE SET liked = 1`
      ).bind(id, user.id).run();
    }

    const countRow = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM video_likes WHERE video_id = ? AND liked = 1`
    ).bind(id).first();
    const likesCount = countRow?.count || 0;

    try {
      await c.env.DB.prepare('UPDATE videos SET likes_count = ? WHERE id = ?').bind(likesCount, id).run();
    } catch (e) {
      // likes_count column may not exist yet on older schemas — non-fatal
    }

    return c.json({ likesCount, userLiked: liked });
  } catch (e) {
    console.error('Like video error:', e);
    return c.json({ error: 'Failed to update like' }, 500);
  }
});

videos.post('/:id/dislike', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const disliked = body.disliked !== false;

    const video = await c.env.DB.prepare('SELECT id FROM videos WHERE id = ?').bind(id).first();
    if (!video) return c.json({ error: 'Video not found' }, 404);

    if (!disliked) {
      await c.env.DB.prepare(
        `DELETE FROM video_likes WHERE video_id = ? AND user_id = ? AND liked = 0`
      ).bind(id, user.id).run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO video_likes (video_id, user_id, liked) VALUES (?, ?, 0)
         ON CONFLICT(video_id, user_id) DO UPDATE SET liked = 0`
      ).bind(id, user.id).run();
    }

    return c.json({ ok: true });
  } catch (e) {
    console.error('Dislike video error:', e);
    return c.json({ error: 'Failed to update dislike' }, 500);
  }
});

videos.get('/:id/like-status', async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ liked: null });

    const id = c.req.param('id');
    const row = await c.env.DB.prepare(
      'SELECT liked FROM video_likes WHERE video_id = ? AND user_id = ?'
    ).bind(id, user.id).first();

    if (!row) return c.json({ liked: null });
    return c.json({ liked: row.liked === 1 ? true : row.liked === 0 ? false : null });
  } catch (e) {
    console.error('Like status error:', e);
    return c.json({ error: 'Failed to fetch like status' }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// NEW: CHANNEL SUBSCRIPTION ROUTES (mounted at /channels)
// ═══════════════════════════════════════════════════════

channels.post('/:channelId/subscribe', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const channelId = c.req.param('channelId');
    if (channelId === user.id) return c.json({ error: 'Cannot subscribe to yourself' }, 400);

    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO channel_subscriptions (channel_id, subscriber_id) VALUES (?, ?)'
    ).bind(channelId, user.id).run();

    const row = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM channel_subscriptions WHERE channel_id = ?'
    ).bind(channelId).first();

    return c.json({ subscribed: true, subscriberCount: row?.count || 0 });
  } catch (e) {
    console.error('Subscribe error:', e);
    return c.json({ error: 'Failed to subscribe' }, 500);
  }
});

channels.delete('/:channelId/subscribe', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const channelId = c.req.param('channelId');

    await c.env.DB.prepare(
      'DELETE FROM channel_subscriptions WHERE channel_id = ? AND subscriber_id = ?'
    ).bind(channelId, user.id).run();

    const row = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM channel_subscriptions WHERE channel_id = ?'
    ).bind(channelId).first();

    return c.json({ subscribed: false, subscriberCount: row?.count || 0 });
  } catch (e) {
    console.error('Unsubscribe error:', e);
    return c.json({ error: 'Failed to unsubscribe' }, 500);
  }
});

channels.get('/:channelId/subscriber-count', async (c) => {
  try {
    const channelId = c.req.param('channelId');
    const row = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM channel_subscriptions WHERE channel_id = ?'
    ).bind(channelId).first();
    return c.json({ count: row?.count || 0 });
  } catch (e) {
    console.error('Subscriber count error:', e);
    return c.json({ error: 'Failed to fetch subscriber count' }, 500);
  }
});

channels.get('/:channelId/is-subscribed', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const channelId = c.req.param('channelId');
    const row = await c.env.DB.prepare(
      'SELECT 1 as ok FROM channel_subscriptions WHERE channel_id = ? AND subscriber_id = ?'
    ).bind(channelId, user.id).first();
    return c.json({ subscribed: !!row });
  } catch (e) {
    console.error('Is-subscribed error:', e);
    return c.json({ error: 'Failed to fetch subscription status' }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// NEW: SUBSCRIPTIONS FEED (mounted at /subscriptions, alongside existing payment routes)
// ═══════════════════════════════════════════════════════

subscriptionsFeed.get('/videos', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const { results } = await c.env.DB.prepare(
      `SELECT v.* FROM videos v
       JOIN channel_subscriptions cs ON v.user_id = cs.channel_id
       WHERE cs.subscriber_id = ? AND v.status = 'ready' AND v.privacy = 'public'
       ORDER BY v.created_at DESC LIMIT 50`
    ).bind(user.id).all();
    return c.json({ videos: results || [] });
  } catch (e) {
    console.error('Subscriptions feed error:', e);
    return c.json({ error: 'Failed to fetch subscriptions feed' }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// NEW: WATCH HISTORY ROUTES (mounted at /history)
// ═══════════════════════════════════════════════════════

history.post('/:videoId', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const videoId = c.req.param('videoId');
    const body = await c.req.json().catch(() => ({}));
    const watchDuration = Number.isFinite(body.watchDuration) ? body.watchDuration : 0;
    const completed = body.completed ? 1 : 0;

    await c.env.DB.prepare(
      `INSERT INTO watch_history (user_id, video_id, watch_duration, completed, watched_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, video_id) DO UPDATE SET watch_duration = ?, completed = ?, watched_at = datetime('now')`
    ).bind(user.id, videoId, watchDuration, completed, watchDuration, completed).run();

    return c.json({ ok: true });
  } catch (e) {
    console.error('Record watch history error:', e);
    return c.json({ error: 'Failed to record watch history' }, 500);
  }
});

history.get('/', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const { results } = await c.env.DB.prepare(
      `SELECT wh.*, v.title, v.thumbnail_url, v.user_name FROM watch_history wh
       JOIN videos v ON wh.video_id = v.id WHERE wh.user_id = ? ORDER BY wh.watched_at DESC LIMIT 100`
    ).bind(user.id).all();
    return c.json({ history: results || [] });
  } catch (e) {
    console.error('Get watch history error:', e);
    return c.json({ error: 'Failed to fetch watch history' }, 500);
  }
});

history.delete('/', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    await c.env.DB.prepare('DELETE FROM watch_history WHERE user_id = ?').bind(user.id).run();
    return c.json({ ok: true });
  } catch (e) {
    console.error('Clear watch history error:', e);
    return c.json({ error: 'Failed to clear watch history' }, 500);
  }
});

history.delete('/:videoId', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const videoId = c.req.param('videoId');
    await c.env.DB.prepare('DELETE FROM watch_history WHERE user_id = ? AND video_id = ?').bind(user.id, videoId).run();
    return c.json({ ok: true });
  } catch (e) {
    console.error('Delete watch history item error:', e);
    return c.json({ error: 'Failed to delete watch history item' }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// NEW: PLAYLIST ROUTES (mounted at /playlists)
// ═══════════════════════════════════════════════════════

playlists.post('/', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const { title, description, privacy } = await c.req.json();

    if (!title || !title.trim()) return c.json({ error: 'Title is required' }, 400);

    const id = `pl_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const userName = user.publisherName || user.publisher_name || user.name || 'Creator';

    await c.env.DB.prepare(
      `INSERT INTO playlists (id, title, description, user_id, user_name, privacy) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(id, title.trim(), description || '', user.id, userName, privacy || 'public').run();

    return c.json({
      playlist: {
        id,
        title: title.trim(),
        description: description || '',
        user_id: user.id,
        user_name: userName,
        privacy: privacy || 'public',
        video_count: 0,
      },
    }, 201);
  } catch (e) {
    console.error('Create playlist error:', e);
    return c.json({ error: 'Failed to create playlist' }, 500);
  }
});

playlists.get('/', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM playlists WHERE user_id = ? ORDER BY updated_at DESC'
    ).bind(user.id).all();
    return c.json({ playlists: results || [] });
  } catch (e) {
    console.error('List playlists error:', e);
    return c.json({ error: 'Failed to fetch playlists' }, 500);
  }
});

playlists.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const playlist = await c.env.DB.prepare('SELECT * FROM playlists WHERE id = ?').bind(id).first();
    if (!playlist) return c.json({ error: 'Playlist not found' }, 404);

    const { results } = await c.env.DB.prepare(
      `SELECT v.*, pv.position FROM playlist_videos pv
       JOIN videos v ON pv.video_id = v.id WHERE pv.playlist_id = ? ORDER BY pv.position`
    ).bind(id).all();

    return c.json({ playlist, videos: results || [] });
  } catch (e) {
    console.error('Get playlist error:', e);
    return c.json({ error: 'Failed to fetch playlist' }, 500);
  }
});

playlists.patch('/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const playlist = await c.env.DB.prepare('SELECT * FROM playlists WHERE id = ?').bind(id).first();
    if (!playlist) return c.json({ error: 'Playlist not found' }, 404);
    if (playlist.user_id !== user.id) return c.json({ error: 'Unauthorized' }, 403);

    const { title, description, privacy } = await c.req.json();
    const newTitle = title !== undefined ? title : playlist.title;
    const newDesc = description !== undefined ? description : playlist.description;
    const newPriv = privacy !== undefined ? privacy : playlist.privacy;

    await c.env.DB.prepare(
      `UPDATE playlists SET title = ?, description = ?, privacy = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(newTitle, newDesc, newPriv, id).run();

    return c.json({ ok: true });
  } catch (e) {
    console.error('Update playlist error:', e);
    return c.json({ error: 'Failed to update playlist' }, 500);
  }
});

playlists.delete('/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const playlist = await c.env.DB.prepare('SELECT * FROM playlists WHERE id = ?').bind(id).first();
    if (!playlist) return c.json({ error: 'Playlist not found' }, 404);
    if (playlist.user_id !== user.id) return c.json({ error: 'Unauthorized' }, 403);

    await c.env.DB.prepare('DELETE FROM playlists WHERE id = ? AND user_id = ?').bind(id, user.id).run();
    await c.env.DB.prepare('DELETE FROM playlist_videos WHERE playlist_id = ?').bind(id).run();

    return c.json({ ok: true });
  } catch (e) {
    console.error('Delete playlist error:', e);
    return c.json({ error: 'Failed to delete playlist' }, 500);
  }
});

playlists.post('/:id/videos', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const playlist = await c.env.DB.prepare('SELECT * FROM playlists WHERE id = ?').bind(id).first();
    if (!playlist) return c.json({ error: 'Playlist not found' }, 404);
    if (playlist.user_id !== user.id) return c.json({ error: 'Unauthorized' }, 403);

    const { videoId } = await c.req.json();
    if (!videoId) return c.json({ error: 'videoId is required' }, 400);

    const maxRow = await c.env.DB.prepare(
      'SELECT COALESCE(MAX(position), -1) as maxPos FROM playlist_videos WHERE playlist_id = ?'
    ).bind(id).first();
    const position = (maxRow?.maxPos ?? -1) + 1;

    const inserted = await c.env.DB.prepare(
      'INSERT OR IGNORE INTO playlist_videos (playlist_id, video_id, position) VALUES (?, ?, ?)'
    ).bind(id, videoId, position).run();

    if (inserted?.meta?.changes) {
      await c.env.DB.prepare(
        `UPDATE playlists SET video_count = video_count + 1, updated_at = datetime('now') WHERE id = ?`
      ).bind(id).run();
    }

    return c.json({ ok: true });
  } catch (e) {
    console.error('Add video to playlist error:', e);
    return c.json({ error: 'Failed to add video to playlist' }, 500);
  }
});

playlists.delete('/:id/videos/:videoId', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const videoId = c.req.param('videoId');
    const playlist = await c.env.DB.prepare('SELECT * FROM playlists WHERE id = ?').bind(id).first();
    if (!playlist) return c.json({ error: 'Playlist not found' }, 404);
    if (playlist.user_id !== user.id) return c.json({ error: 'Unauthorized' }, 403);

    const deleted = await c.env.DB.prepare(
      'DELETE FROM playlist_videos WHERE playlist_id = ? AND video_id = ?'
    ).bind(id, videoId).run();

    if (deleted?.meta?.changes) {
      await c.env.DB.prepare(
        `UPDATE playlists SET video_count = MAX(video_count - 1, 0), updated_at = datetime('now') WHERE id = ?`
      ).bind(id).run();
    }

    return c.json({ ok: true });
  } catch (e) {
    console.error('Remove video from playlist error:', e);
    return c.json({ error: 'Failed to remove video from playlist' }, 500);
  }
});

playlists.post('/:id/reorder', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const playlist = await c.env.DB.prepare('SELECT * FROM playlists WHERE id = ?').bind(id).first();
    if (!playlist) return c.json({ error: 'Playlist not found' }, 404);
    if (playlist.user_id !== user.id) return c.json({ error: 'Unauthorized' }, 403);

    const { videoIds } = await c.req.json();
    if (!Array.isArray(videoIds)) return c.json({ error: 'videoIds must be an array' }, 400);

    for (let i = 0; i < videoIds.length; i++) {
      await c.env.DB.prepare(
        'UPDATE playlist_videos SET position = ? WHERE playlist_id = ? AND video_id = ?'
      ).bind(i, id, videoIds[i]).run();
    }

    return c.json({ ok: true });
  } catch (e) {
    console.error('Reorder playlist error:', e);
    return c.json({ error: 'Failed to reorder playlist' }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// NEW: WATCH LATER ROUTES (mounted at /watch-later)
// ═══════════════════════════════════════════════════════

watchLater.get('/contains/:videoId', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const videoId = c.req.param('videoId');
    const row = await c.env.DB.prepare(
      'SELECT 1 as ok FROM watch_later WHERE user_id = ? AND video_id = ?'
    ).bind(user.id, videoId).first();
    return c.json({ inWatchLater: !!row });
  } catch (e) {
    console.error('Watch later contains error:', e);
    return c.json({ error: 'Failed to check watch later' }, 500);
  }
});

watchLater.get('/', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const { results } = await c.env.DB.prepare(
      `SELECT v.* FROM watch_later wl JOIN videos v ON wl.video_id = v.id WHERE wl.user_id = ? ORDER BY wl.added_at DESC`
    ).bind(user.id).all();
    return c.json({ videos: results || [] });
  } catch (e) {
    console.error('List watch later error:', e);
    return c.json({ error: 'Failed to fetch watch later' }, 500);
  }
});

watchLater.post('/:videoId', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const videoId = c.req.param('videoId');
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO watch_later (user_id, video_id) VALUES (?, ?)'
    ).bind(user.id, videoId).run();
    return c.json({ added: true });
  } catch (e) {
    console.error('Add watch later error:', e);
    return c.json({ error: 'Failed to add to watch later' }, 500);
  }
});

watchLater.delete('/:videoId', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const videoId = c.req.param('videoId');
    await c.env.DB.prepare(
      'DELETE FROM watch_later WHERE user_id = ? AND video_id = ?'
    ).bind(user.id, videoId).run();
    return c.json({ removed: true });
  } catch (e) {
    console.error('Remove watch later error:', e);
    return c.json({ error: 'Failed to remove from watch later' }, 500);
  }
});

export default videos;
export { channels, subscriptionsFeed, history, playlists, watchLater };
