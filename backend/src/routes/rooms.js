// backend/src/routes/rooms.js
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';

const rooms = new Hono();

rooms.get('/', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT r.*, u.publisher_name as host_name, u.logo_url as host_logo 
       FROM rooms r 
       JOIN users u ON r.host_id = u.id 
       WHERE r.status != 'ended' ORDER BY r.created_at DESC`
    ).all();
    return c.json({ rooms: results || [] });
  } catch (e) { return c.json({ rooms: [] }); }
});

rooms.get('/:id', async (c) => {
  const roomId = c.req.param('id');
  try {
    const room = await c.env.DB.prepare(
      `SELECT r.*, u.publisher_name as host_name, u.logo_url as host_logo FROM rooms r JOIN users u ON r.host_id = u.id WHERE r.id = ?`
    ).bind(roomId).first();
    if (!room) return c.json({ error: 'Room not found.' }, 404);

    const { results: participants } = await c.env.DB.prepare(
      `SELECT rp.joined_at, u.id, u.publisher_name, u.logo_url FROM room_participants rp JOIN users u ON rp.user_id = u.id WHERE rp.room_id = ?`
    ).bind(roomId).all();
    return c.json({ room, participants: participants || [] });
  } catch (e) { return c.json({ error: 'Internal error.' }, 500); }
});

// Create a Free Live Room (Payments Disabled)
rooms.post('/', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const { title, description } = body;

  if (!title) return c.json({ error: 'Room title is required.' }, 400);
  if (!user || !user.id) return c.json({ error: 'Authentication error: User ID missing.' }, 401);

  try {
    const roomId = 'room_' + crypto.randomUUID().slice(0, 10);
    const hostName = user?.publisherName || user?.publisher_name || 'Host';
    const email = user?.email || 'host@opinionplus.online';
    
    // FIX 1: Ensure the user exists in the local database. 
    // If the user authenticated externally but isn't in the SQL 'users' table,
    // the FOREIGN KEY constraint (host_id -> users.id) will crash.
    try {
      await c.env.DB.prepare(
        `INSERT OR IGNORE INTO users (id, publisher_name, email) VALUES (?, ?, ?)`
      ).bind(user.id, hostName, email).run();
    } catch (e) {
      console.warn("User sync warning:", e);
    }

    // FIX 2: Execute sequentially instead of using c.env.DB.batch()
    // D1 sometimes incorrectly triggers FK errors if a parent (rooms) and child (room_participants) 
    // are inserted in the exact same batch transaction.
    await c.env.DB.prepare(
      `INSERT INTO rooms (id, title, description, host_id, host_name, status) VALUES (?, ?, ?, ?, ?, 'live')`
    ).bind(roomId, title, description || '', user.id, hostName).run();

    try {
      await c.env.DB.prepare(
        `INSERT OR IGNORE INTO room_participants (room_id, user_id) VALUES (?, ?)`
      ).bind(roomId, user.id).run();
    } catch (e) {
      console.warn("Participant insert warning:", e);
    }

    const room = await c.env.DB.prepare('SELECT * FROM rooms WHERE id = ?').bind(roomId).first();
    return c.json({ ok: true, room, wsUrl: `/rooms/${roomId}/ws` });

  } catch (e) { 
    console.error("Create Free Room Error:", e);
    return c.json({ error: e.message || 'Failed to create live space.' }, 500); 
  }
});

rooms.post('/:id/join', requireAuth, async (c) => {
  const roomId = c.req.param('id');
  const user = c.get('user');
  try {
    const room = await c.env.DB.prepare('SELECT * FROM rooms WHERE id = ?').bind(roomId).first();
    if (!room || room.status === 'ended') return c.json({ error: 'Room is no longer active.' }, 400);
    await c.env.DB.prepare(`INSERT OR IGNORE INTO room_participants (room_id, user_id) VALUES (?, ?)`).bind(roomId, user.id).run();
    return c.json({ ok: true });
  } catch (e) { return c.json({ error: 'Failed to join room.' }, 500); }
});

rooms.post('/:id/end', requireAuth, async (c) => {
  const user = c.get('user');
  const roomId = c.req.param('id');
  try {
    const room = await c.env.DB.prepare('SELECT * FROM rooms WHERE id = ?').bind(roomId).first();
    if (!room) return c.json({ error: 'Room not found.' }, 404);
    if (room.host_id !== user.id && user.role !== 'root' && user.role !== 'admin') return c.json({ error: 'Unauthorized.' }, 403);
    await c.env.DB.prepare("UPDATE rooms SET status = 'ended', ended_at = datetime('now') WHERE id = ?").bind(roomId).run();
    await c.env.DB.prepare("DELETE FROM room_participants WHERE room_id = ?").bind(roomId).run();
    return c.json({ ok: true });
  } catch (e) { return c.json({ error: 'Failed to end room.' }, 500); }
});

rooms.delete('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const roomId = c.req.param('id');
  try {
    const room = await c.env.DB.prepare('SELECT * FROM rooms WHERE id = ?').bind(roomId).first();
    if (!room) return c.json({ error: 'Room not found.' }, 404);
    if (room.host_id !== user.id && user.role !== 'root' && user.role !== 'admin') return c.json({ error: 'Unauthorized.' }, 403);
    
    // Execute sequentially to avoid cascade batch issues
    await c.env.DB.prepare('DELETE FROM room_chat_messages WHERE room_id = ?').bind(roomId).run();
    await c.env.DB.prepare('DELETE FROM room_participants WHERE room_id = ?').bind(roomId).run();
    await c.env.DB.prepare('DELETE FROM rooms WHERE id = ?').bind(roomId).run();
    
    return c.json({ ok: true, message: 'Room successfully deleted.' });
  } catch (e) { return c.json({ error: 'Failed to delete room securely.' }, 500); }
});

export default rooms;