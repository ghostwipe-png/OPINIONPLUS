import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';

const rooms = new Hono();

// List active or scheduled rooms
rooms.get('/', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT r.*, u.publisher_name as host_name, u.logo_url as host_logo 
       FROM audio_rooms r 
       JOIN users u ON r.host_id = u.id 
       WHERE r.status != 'ended' 
       ORDER BY r.created_at DESC`
    ).all();
    return c.json({ rooms: results || [] });
  } catch (e) {
    return c.json({ rooms: [] });
  }
});

// Get a specific room and its participants
rooms.get('/:id', async (c) => {
  const roomId = c.req.param('id');
  try {
    const room = await c.env.DB.prepare(
      `SELECT r.*, u.publisher_name as host_name, u.logo_url as host_logo 
       FROM audio_rooms r 
       JOIN users u ON r.host_id = u.id 
       WHERE r.id = ?`
    ).bind(roomId).first();

    if (!room) return c.json({ error: 'Room not found.' }, 404);

    const { results: participants } = await c.env.DB.prepare(
      `SELECT p.role, p.joined_at, u.id, u.publisher_name, u.logo_url 
       FROM room_participants p 
       JOIN users u ON p.user_id = u.id 
       WHERE p.room_id = ? 
       ORDER BY p.role ASC, p.joined_at ASC`
    ).bind(roomId).all();

    return c.json({ room, participants: participants || [] });
  } catch (e) {
    return c.json({ error: 'Internal error.' }, 500);
  }
});

// Create a new audio room
rooms.post('/', requireAuth, async (c) => {
  const user = c.get('user');
  const { title, description, category, is_premium, price_cents } = await c.req.json();

  if (!title) return c.json({ error: 'Room title is required.' }, 400);

  const roomId = 'room_' + crypto.randomUUID().slice(0, 10);
  
  try {
    await c.env.DB.prepare(
      `INSERT INTO audio_rooms (id, host_id, title, description, category, is_premium, price_cents, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'live')`
    ).bind(
      roomId, 
      user.id, 
      title, 
      description || '', 
      category || 'Breaking News', 
      is_premium ? 1 : 0, 
      price_cents || 0
    ).run();

    // Automatically add host as a speaker/host
    await c.env.DB.prepare(
      `INSERT INTO room_participants (id, room_id, user_id, role) VALUES (?, ?, ?, 'host')`
    ).bind(crypto.randomUUID(), roomId, user.id).run();

    const room = await c.env.DB.prepare('SELECT * FROM audio_rooms WHERE id = ?').bind(roomId).first();
    return c.json({ ok: true, room });
  } catch (e) {
    return c.json({ error: 'Failed to create room.' }, 500);
  }
});

// Join an active room
rooms.post('/:id/join', requireAuth, async (c) => {
  const roomId = c.req.param('id');
  const user = c.get('user');

  try {
    const room = await c.env.DB.prepare('SELECT * FROM audio_rooms WHERE id = ?').bind(roomId).first();
    if (!room || room.status === 'ended') {
      return c.json({ error: 'Room is no longer active.' }, 400);
    }

    // Add user to participants if not already in the room
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO room_participants (id, room_id, user_id, role) VALUES (?, ?, ?, 'listener')`
    ).bind(crypto.randomUUID(), roomId, user.id).run();

    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: 'Failed to join room.' }, 500);
  }
});

// End an audio room
rooms.post('/:id/end', requireAuth, async (c) => {
  const user = c.get('user');
  const roomId = c.req.param('id');

  try {
    const room = await c.env.DB.prepare('SELECT * FROM audio_rooms WHERE id = ?').bind(roomId).first();
    if (!room) return c.json({ error: 'Room not found.' }, 404);

    if (room.host_id !== user.id && user.role !== 'root' && user.role !== 'admin') {
      return c.json({ error: 'Unauthorized to end this room.' }, 403);
    }

    await c.env.DB.prepare("UPDATE audio_rooms SET status = 'ended' WHERE id = ?").bind(roomId).run();
    await c.env.DB.prepare("DELETE FROM room_participants WHERE room_id = ?").bind(roomId).run();
    
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: 'Failed to end room.' }, 500);
  }
});

// Get chat history for a room
rooms.get('/:id/chat', async (c) => {
  const roomId = c.req.param('id');
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT id, room_id, sender_id, sender_name, text, created_at 
       FROM room_chat_messages WHERE room_id = ? ORDER BY created_at ASC LIMIT 500`
    ).bind(roomId).all();

    return c.json({ messages: results || [] });
  } catch (e) {
    return c.json({ messages: [] });
  }
});

// User's room history
rooms.get('/history', requireAuth, async (c) => {
  const user = c.get('user');
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT r.* FROM audio_rooms r 
       JOIN room_participants p ON r.id = p.room_id 
       WHERE p.user_id = ? ORDER BY r.created_at DESC LIMIT 50`
    ).bind(user.id).all();

    return c.json({ rooms: results || [] });
  } catch (e) {
    return c.json({ rooms: [] });
  }
});

export default rooms;