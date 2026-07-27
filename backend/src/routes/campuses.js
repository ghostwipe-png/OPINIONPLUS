// backend/src/routes/campuses.js
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';

const campuses = new Hono();

// Helper: Secure Logging
async function logEvent(c, action, payload = {}) {
  try { 
    console.log(JSON.stringify({ kind: 'campus_log', action, timestamp: new Date().toISOString(), ...payload })); 
  } catch (e) {}
}

// ── Helper: Check if user is campus admin ──────────────
async function isCampusAdmin(db, campusId, userId) {
  const row = await db.prepare(
    'SELECT 1 FROM campus_students WHERE campus_id = ? AND user_id = ? AND role = ? AND status = ?'
  ).bind(campusId, userId, 'admin', 'active').first();
  return !!row;
}

// ── Helper: Check if user is campus member ─────────────
async function isCampusMember(db, campusId, userId) {
  const row = await db.prepare(
    'SELECT 1 FROM campus_students WHERE campus_id = ? AND user_id = ? AND status = ?'
  ).bind(campusId, userId, 'active').first();
  return !!row;
}

// ── Helper: Update campus stats ────────────────────────
async function updateCampusStats(db, campusId) {
  try {
    const [stories, students, subscribers] = await Promise.all([
      db.prepare('SELECT COUNT(*) as count FROM stories WHERE campus_id = ? AND deleted = 0').bind(campusId).first(),
      db.prepare("SELECT COUNT(*) as count FROM campus_students WHERE campus_id = ? AND status = 'active'").bind(campusId).first(),
      db.prepare('SELECT COUNT(*) as count FROM campus_subscriptions WHERE campus_id = ?').bind(campusId).first(),
    ]);
    await db.prepare(
      `INSERT INTO campus_stats (campus_id, total_stories, total_students, total_subscribers, total_views, total_likes, total_comments, updated_at)
       VALUES (?, ?, ?, ?, 0, 0, 0, datetime('now'))
       ON CONFLICT(campus_id) DO UPDATE SET
       total_stories = excluded.total_stories, total_students = excluded.total_students,
       total_subscribers = excluded.total_subscribers, updated_at = datetime('now')`
    ).bind(campusId, stories?.count || 0, students?.count || 0, subscribers?.count || 0).run();
  } catch (e) {
    console.error('updateCampusStats error:', e);
  }
}

// ═══════════════════════════════════════════════════════
// LEADERBOARD — must be BEFORE '/:id' catch-all
// ═══════════════════════════════════════════════════════

campuses.get('/leaderboard', async (c) => {
  try {
    const sortBy = c.req.query('sortBy') || 'stories';
    const limit = parseInt(c.req.query('limit') || '10', 10);
    
    let orderCol = 'total_stories';
    if (sortBy === 'subscribers') orderCol = 'total_subscribers';
    else if (sortBy === 'views') orderCol = 'total_views';
    
    const { results } = await c.env.DB.prepare(
      `SELECT ce.id, ce.university_name, ce.representative_name, ce.contact_email,
              cl.logo_url, cs.total_stories, cs.total_students, cs.total_subscribers, cs.total_views
       FROM campus_editions ce
       LEFT JOIN campus_logos cl ON ce.id = cl.campus_id
       LEFT JOIN campus_stats cs ON ce.id = cs.campus_id
       WHERE ce.status = 'active'
       ORDER BY cs.${orderCol} DESC
       LIMIT ?`
    ).bind(limit).all();
    
    return c.json({ leaderboard: results || [] });
  } catch (e) {
    console.error('Leaderboard error:', e);
    return c.json({ error: 'Failed to fetch leaderboard' }, 500);
  }
});

// ── User's campus subscriptions ────────────────────────
campuses.get('/subscriptions', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const { results } = await c.env.DB.prepare(
      `SELECT ce.id, ce.university_name, ce.representative_name, cl.logo_url, cs.total_stories, cs.total_subscribers
       FROM campus_subscriptions sub
       JOIN campus_editions ce ON sub.campus_id = ce.id
       LEFT JOIN campus_logos cl ON ce.id = cl.campus_id
       LEFT JOIN campus_stats cs ON ce.id = cs.campus_id
       WHERE sub.user_id = ? AND ce.status = 'active'
       ORDER BY sub.created_at DESC`
    ).bind(user.id).all();
    return c.json({ campuses: results || [] });
  } catch (e) {
    return c.json({ error: 'Failed to fetch subscriptions' }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// EXISTING ROUTES (keep unchanged)
// ═══════════════════════════════════════════════════════

campuses.get('/', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT ce.id, ce.university_name, ce.representative_name, ce.status, ce.created_at, ce.contact_email,
              cl.logo_url, cs.total_stories, cs.total_students, cs.total_subscribers
       FROM campus_editions ce
       LEFT JOIN campus_logos cl ON ce.id = cl.campus_id
       LEFT JOIN campus_stats cs ON ce.id = cs.campus_id
       WHERE ce.status = 'active'
       ORDER BY ce.created_at DESC`
    ).all();
    return c.json({ campuses: results });
  } catch (e) { 
    return c.json({ error: 'Failed to load campuses' }, 500); 
  }
});

campuses.post('/', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { university_name, representative_name, contact_email } = body;

    if (!university_name || !contact_email) {
      return c.json({ error: 'University name and contact email are required.' }, 400);
    }

    const existing = await c.env.DB.prepare('SELECT id FROM campus_editions WHERE university_name = ?')
      .bind(university_name).first();
      
    if (existing) {
      return c.json({ error: 'This university is already registered.' }, 409);
    }

    const campusId = `campus_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const repName = representative_name || user?.publisherName || user?.publisher_name || 'Campus Admin';

    await c.env.DB.prepare(
      `INSERT INTO campus_editions (id, university_name, contact_email, representative_name, status, user_id) 
       VALUES (?, ?, ?, ?, 'active', ?)`
    ).bind(campusId, university_name, contact_email, repName, user.id).run();

    // Auto-add creator as campus admin
    await c.env.DB.prepare(
      "INSERT OR IGNORE INTO campus_students (campus_id, user_id, role, status) VALUES (?, ?, 'admin', 'active')"
    ).bind(campusId, user.id).run();

    // Initialize stats
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO campus_stats (campus_id) VALUES (?)'
    ).bind(campusId).run();

    await logEvent(c, 'campus_activated_free', { university: university_name, campusId });

    return c.json({ ok: true, message: 'Campus registered successfully', campusId }, 201);
    
  } catch (e) {
    console.error("Campus Registration Error:", e);
    return c.json({ error: e.message || 'Failed to register campus.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// SINGLE CAMPUS ROUTES
// ═══════════════════════════════════════════════════════

// GET /campuses/:id — campus profile
campuses.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const campus = await c.env.DB.prepare(
      `SELECT ce.*, cl.logo_url, cs.total_stories, cs.total_students, cs.total_subscribers, cs.total_views, cs.total_likes, cs.total_comments
       FROM campus_editions ce
       LEFT JOIN campus_logos cl ON ce.id = cl.campus_id
       LEFT JOIN campus_stats cs ON ce.id = cs.campus_id
       WHERE ce.id = ?`
    ).bind(id).first();

    if (!campus) return c.json({ error: 'Campus not found' }, 404);

    const [categories, studentCount, subscriberCount] = await Promise.all([
      c.env.DB.prepare('SELECT category FROM campus_categories WHERE campus_id = ?').bind(id).all(),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM campus_students WHERE campus_id = ? AND status = 'active'").bind(id).first(),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM campus_subscriptions WHERE campus_id = ?').bind(id).first(),
    ]);

    return c.json({
      campus: {
        ...campus,
        categories: (categories.results || []).map(r => r.category),
        studentCount: studentCount?.count || 0,
        subscriberCount: subscriberCount?.count || 0,
      }
    });
  } catch (e) {
    return c.json({ error: 'Failed to fetch campus' }, 500);
  }
});

// PATCH /campuses/:id — update campus
campuses.patch('/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const campus = await c.env.DB.prepare('SELECT * FROM campus_editions WHERE id = ?').bind(id).first();
    if (!campus) return c.json({ error: 'Campus not found' }, 404);

    const isAdmin = await isCampusAdmin(c.env.DB, id, user.id);
    const isPlatformAdmin = user.role === 'admin' || user.role === 'root';
    if (!isAdmin && !isPlatformAdmin) return c.json({ error: 'Unauthorized' }, 403);

    const body = await c.req.json();
    const { university_name, representative_name, contact_email } = body;

    if (university_name) {
      await c.env.DB.prepare('UPDATE campus_editions SET university_name = ? WHERE id = ?').bind(university_name, id).run();
    }
    if (representative_name) {
      await c.env.DB.prepare('UPDATE campus_editions SET representative_name = ? WHERE id = ?').bind(representative_name, id).run();
    }
    if (contact_email) {
      await c.env.DB.prepare('UPDATE campus_editions SET contact_email = ? WHERE id = ?').bind(contact_email, id).run();
    }

    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: 'Failed to update campus' }, 500);
  }
});

// POST /campuses/:id/logo — upload logo
campuses.post('/:id/logo', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const isAdmin = await isCampusAdmin(c.env.DB, id, user.id);
    if (!isAdmin && user.role !== 'admin' && user.role !== 'root') return c.json({ error: 'Unauthorized' }, 403);

    const { logo_url } = await c.req.json();
    if (!logo_url) return c.json({ error: 'logo_url is required' }, 400);

    await c.env.DB.prepare(
      "INSERT INTO campus_logos (campus_id, logo_url) VALUES (?, ?) ON CONFLICT(campus_id) DO UPDATE SET logo_url = excluded.logo_url, updated_at = datetime('now')"
    ).bind(id, logo_url).run();

    return c.json({ logo_url });
  } catch (e) {
    return c.json({ error: 'Failed to upload logo' }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// STUDENT ROSTER
// ═══════════════════════════════════════════════════════

campuses.get('/:id/students', async (c) => {
  try {
    const id = c.req.param('id');
    const { results } = await c.env.DB.prepare(
      `SELECT cs.user_id, cs.role, cs.status, cs.joined_at, u.publisher_name, u.logo_url
       FROM campus_students cs
       JOIN users u ON cs.user_id = u.id
       WHERE cs.campus_id = ? AND cs.status = 'active'
       ORDER BY cs.role DESC, cs.joined_at ASC`
    ).bind(id).all();
    return c.json({ students: results || [] });
  } catch (e) {
    return c.json({ error: 'Failed to fetch students' }, 500);
  }
});

campuses.post('/:id/students', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const { userId } = await c.req.json();
    if (!userId) return c.json({ error: 'userId is required' }, 400);

    // Allow self-join, or admin adding others
    const isAdmin = await isCampusAdmin(c.env.DB, id, user.id);
    if (!isAdmin && userId !== user.id) return c.json({ error: 'Unauthorized' }, 403);

    await c.env.DB.prepare(
      "INSERT OR IGNORE INTO campus_students (campus_id, user_id, role, status) VALUES (?, ?, 'journalist', 'active')"
    ).bind(id, userId).run();

    await updateCampusStats(c.env.DB, id);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: 'Failed to add student' }, 500);
  }
});

campuses.delete('/:id/students/:userId', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const userId = c.req.param('userId');
    const isAdmin = await isCampusAdmin(c.env.DB, id, user.id);
    if (!isAdmin && user.id !== userId) return c.json({ error: 'Unauthorized' }, 403);

    await c.env.DB.prepare(
      "UPDATE campus_students SET status = 'removed' WHERE campus_id = ? AND user_id = ?"
    ).bind(id, userId).run();

    await updateCampusStats(c.env.DB, id);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: 'Failed to remove student' }, 500);
  }
});

campuses.patch('/:id/students/:userId', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const userId = c.req.param('userId');
    const isAdmin = await isCampusAdmin(c.env.DB, id, user.id);
    if (!isAdmin) return c.json({ error: 'Unauthorized' }, 403);

    const { role } = await c.req.json();
    if (!role || !['journalist', 'editor', 'admin'].includes(role)) {
      return c.json({ error: 'Invalid role' }, 400);
    }

    await c.env.DB.prepare(
      'UPDATE campus_students SET role = ? WHERE campus_id = ? AND user_id = ?'
    ).bind(role, id, userId).run();

    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: 'Failed to update student role' }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// CAMPUS SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════

campuses.post('/:id/subscribe', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');

    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO campus_subscriptions (campus_id, user_id) VALUES (?, ?)'
    ).bind(id, user.id).run();

    const row = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM campus_subscriptions WHERE campus_id = ?'
    ).bind(id).first();

    await updateCampusStats(c.env.DB, id);
    return c.json({ subscribed: true, subscriberCount: row?.count || 0 });
  } catch (e) {
    return c.json({ error: 'Failed to subscribe' }, 500);
  }
});

campuses.delete('/:id/subscribe', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');

    await c.env.DB.prepare(
      'DELETE FROM campus_subscriptions WHERE campus_id = ? AND user_id = ?'
    ).bind(id, user.id).run();

    const row = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM campus_subscriptions WHERE campus_id = ?'
    ).bind(id).first();

    await updateCampusStats(c.env.DB, id);
    return c.json({ subscribed: false, subscriberCount: row?.count || 0 });
  } catch (e) {
    return c.json({ error: 'Failed to unsubscribe' }, 500);
  }
});

campuses.get('/:id/subscriber-count', async (c) => {
  try {
    const id = c.req.param('id');
    const row = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM campus_subscriptions WHERE campus_id = ?'
    ).bind(id).first();
    return c.json({ count: row?.count || 0 });
  } catch (e) {
    return c.json({ error: 'Failed to fetch subscriber count' }, 500);
  }
});

campuses.get('/:id/is-subscribed', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const row = await c.env.DB.prepare(
      'SELECT 1 as ok FROM campus_subscriptions WHERE campus_id = ? AND user_id = ?'
    ).bind(id, user.id).first();
    return c.json({ subscribed: !!row });
  } catch (e) {
    return c.json({ error: 'Failed to check subscription' }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// CAMPUS STORIES
// ═══════════════════════════════════════════════════════

campuses.get('/:id/stories', async (c) => {
  try {
    const id = c.req.param('id');
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = parseInt(c.req.query('limit') || '20', 10);
    const offset = (page - 1) * limit;

    const { results } = await c.env.DB.prepare(
      `SELECT * FROM stories WHERE campus_id = ? AND deleted = 0 AND privacy = 'public' ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(id, limit, offset).all();

    const totalRow = await c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM stories WHERE campus_id = ? AND deleted = 0 AND privacy = 'public'"
    ).bind(id).first();

    return c.json({
      stories: results || [],
      total: totalRow?.total || 0,
      page,
      totalPages: Math.ceil((totalRow?.total || 0) / limit) || 1,
    });
  } catch (e) {
    return c.json({ error: 'Failed to fetch stories' }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// CAMPUS EVENTS
// ═══════════════════════════════════════════════════════

campuses.get('/:id/events', async (c) => {
  try {
    const id = c.req.param('id');
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM campus_events WHERE campus_id = ? ORDER BY event_date ASC'
    ).bind(id).all();
    return c.json({ events: results || [] });
  } catch (e) {
    return c.json({ error: 'Failed to fetch events' }, 500);
  }
});

campuses.post('/:id/events', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const isAdmin = await isCampusAdmin(c.env.DB, id, user.id);
    if (!isAdmin) return c.json({ error: 'Unauthorized' }, 403);

    const { title, description, event_date, location, category, image_url } = await c.req.json();
    if (!title || !event_date) return c.json({ error: 'Title and event date are required' }, 400);

    const eventId = `evt_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    await c.env.DB.prepare(
      'INSERT INTO campus_events (id, campus_id, title, description, event_date, location, category, image_url, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(eventId, id, title, description || '', event_date, location || '', category || 'general', image_url || null, user.id).run();

    return c.json({ event: { id: eventId, title, event_date } }, 201);
  } catch (e) {
    return c.json({ error: 'Failed to create event' }, 500);
  }
});

campuses.delete('/:id/events/:eventId', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const eventId = c.req.param('eventId');
    const isAdmin = await isCampusAdmin(c.env.DB, id, user.id);
    if (!isAdmin) return c.json({ error: 'Unauthorized' }, 403);

    await c.env.DB.prepare('DELETE FROM campus_events WHERE id = ? AND campus_id = ?').bind(eventId, id).run();
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: 'Failed to delete event' }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// CAMPUS POLLS
// ═══════════════════════════════════════════════════════

campuses.get('/:id/polls', async (c) => {
  try {
    const id = c.req.param('id');
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM campus_polls WHERE campus_id = ? ORDER BY created_at DESC'
    ).bind(id).all();

    const polls = await Promise.all((results || []).map(async (poll) => {
      const votes = await c.env.DB.prepare(
        'SELECT option_index, COUNT(*) as count FROM campus_poll_votes WHERE poll_id = ? GROUP BY option_index'
      ).bind(poll.id).all();
      
      const options = JSON.parse(poll.options || '[]');
      const voteCounts = new Array(options.length).fill(0);
      let totalVotes = 0;
      (votes.results || []).forEach(v => {
        voteCounts[v.option_index] = v.count;
        totalVotes += v.count;
      });

      return { ...poll, options, voteCounts, totalVotes };
    }));

    return c.json({ polls });
  } catch (e) {
    return c.json({ error: 'Failed to fetch polls' }, 500);
  }
});

campuses.post('/:id/polls', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const isAdmin = await isCampusAdmin(c.env.DB, id, user.id);
    if (!isAdmin) return c.json({ error: 'Unauthorized' }, 403);

    const { question, options, endsAt } = await c.req.json();
    if (!question || !options || !Array.isArray(options) || options.length < 2) {
      return c.json({ error: 'Question and at least 2 options are required' }, 400);
    }

    const pollId = `poll_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    await c.env.DB.prepare(
      'INSERT INTO campus_polls (id, campus_id, question, options, ends_at, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(pollId, id, question, JSON.stringify(options), endsAt || null, user.id).run();

    return c.json({ poll: { id: pollId, question, options } }, 201);
  } catch (e) {
    return c.json({ error: 'Failed to create poll' }, 500);
  }
});

campuses.post('/:id/polls/:pollId/vote', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const pollId = c.req.param('pollId');
    const { optionIndex } = await c.req.json();

    if (optionIndex === undefined || optionIndex === null) {
      return c.json({ error: 'optionIndex is required' }, 400);
    }

    const poll = await c.env.DB.prepare('SELECT * FROM campus_polls WHERE id = ? AND campus_id = ?').bind(pollId, id).first();
    if (!poll) return c.json({ error: 'Poll not found' }, 404);

    const options = JSON.parse(poll.options || '[]');
    if (optionIndex < 0 || optionIndex >= options.length) {
      return c.json({ error: 'Invalid option index' }, 400);
    }

    await c.env.DB.prepare(
      'INSERT OR REPLACE INTO campus_poll_votes (poll_id, user_id, option_index) VALUES (?, ?, ?)'
    ).bind(pollId, user.id, optionIndex).run();

    const votes = await c.env.DB.prepare(
      'SELECT option_index, COUNT(*) as count FROM campus_poll_votes WHERE poll_id = ? GROUP BY option_index'
    ).bind(pollId).all();

    const voteCounts = new Array(options.length).fill(0);
    (votes.results || []).forEach(v => { voteCounts[v.option_index] = v.count; });

    return c.json({ ok: true, voteCounts });
  } catch (e) {
    return c.json({ error: 'Failed to submit vote' }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// CAMPUS STATS
// ═══════════════════════════════════════════════════════

campuses.get('/:id/stats', async (c) => {
  try {
    const id = c.req.param('id');
    await updateCampusStats(c.env.DB, id);
    const stats = await c.env.DB.prepare('SELECT * FROM campus_stats WHERE campus_id = ?').bind(id).first();
    return c.json({ stats: stats || {} });
  } catch (e) {
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// PAYMENT (COMMENTED OUT — FREE FOR NOW)
// ═══════════════════════════════════════════════════════
// PAYMENT: Uncomment when ready to charge for campus registration
//
// campuses.post('/register/initialize', requireAuth, async (c) => {
//   const user = c.get('user');
//   const { university_name, representative_name, contact_email } = await c.req.json();
//   const secretKey = c.env.PAYSTACK_SECRET_KEY;
//   const reference = `campus_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
//   
//   const response = await fetch('https://api.paystack.co/transaction/initialize', {
//     method: 'POST',
//     headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       email: contact_email,
//       amount: 500000, // KES 5,000 in cents
//       reference,
//       currency: 'KES',
//       metadata: { university_name, representative_name, type: 'campus_registration', user_id: user.id }
//     })
//   });
//   const data = await response.json();
//   if (!data.status) return c.json({ error: data.message }, 502);
//   return c.json({ authorization_url: data.data.authorization_url, reference });
// });
//
// campuses.post('/register/verify', requireAuth, async (c) => {
//   const { reference } = await c.req.json();
//   const secretKey = c.env.PAYSTACK_SECRET_KEY;
//   const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
//     headers: { Authorization: `Bearer ${secretKey}` }
//   });
//   const data = await response.json();
//   if (!data.status || data.data.status !== 'success') return c.json({ error: 'Payment not verified' }, 400);
//   
//   // Create campus after successful payment
//   const user = c.get('user');
//   const { university_name, representative_name, contact_email } = data.data.metadata;
//   const campusId = `campus_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
//   
//   await c.env.DB.prepare(
//     "INSERT INTO campus_editions (id, university_name, contact_email, representative_name, status, user_id) VALUES (?, ?, ?, ?, 'active', ?)"
//   ).bind(campusId, university_name, contact_email, representative_name, user.id).run();
//   
//   await c.env.DB.prepare(
//     "INSERT OR IGNORE INTO campus_students (campus_id, user_id, role, status) VALUES (?, ?, 'admin', 'active')"
//   ).bind(campusId, user.id).run();
//   
//   return c.json({ campusId, ok: true });
// });

// ═══════════════════════════════════════════════════════
// ADMIN: DELETE CAMPUS (platform admin or campus creator)
// ═══════════════════════════════════════════════════════

campuses.delete('/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const campus = await c.env.DB.prepare('SELECT * FROM campus_editions WHERE id = ?').bind(id).first();
    if (!campus) return c.json({ error: 'Campus not found' }, 404);

    // Allow platform admin/root OR the campus creator (user_id on campus_editions)
    const isPlatformAdmin = user.role === 'admin' || user.role === 'root';
    const isCreator = campus.user_id === user.id;
    if (!isPlatformAdmin && !isCreator) return c.json({ error: 'Unauthorized' }, 403);

    // Soft delete — set status to 'deleted'
    await c.env.DB.prepare("UPDATE campus_editions SET status = 'deleted' WHERE id = ?").bind(id).run();

    await logEvent(c, 'campus_deleted', { campusId: id, deletedBy: user.email });
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: 'Failed to delete campus' }, 500);
  }
});

export default campuses;