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

rooms.post('/', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const { title, description, reference } = body;

  if (!title || !reference) return c.json({ error: 'Missing required parameters.' }, 400);

  try {
    // 1. Double-Spend Protection
    const existingPayment = await c.env.DB.prepare(`SELECT reference FROM room_payments WHERE reference = ?`).bind(reference).first();
    if (existingPayment) return c.json({ error: 'Security alert: Transaction reference already consumed.' }, 400);

    // 2. Server-to-Server Verification
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${c.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' }
    });

    const paystackData = await paystackRes.json();
    if (!paystackRes.ok || !paystackData.status || paystackData.data?.status !== 'success') {
      return c.json({ error: 'Payment verification failed.' }, 400);
    }

    const tx = paystackData.data;
    if (tx.amount < 10000 || !tx.currency || tx.currency.toUpperCase() !== 'KES') {
      return c.json({ error: `Invalid payment amount or currency.` }, 400);
    }

    // 3. MAXIMUM SECURITY: Atomic Database Batching
    // If the room creation fails, the payment log rolls back. Money is never "lost" in a void.
    const roomId = 'room_' + crypto.randomUUID().slice(0, 10);
    
    const insertPayment = c.env.DB.prepare(
      `INSERT INTO room_payments (reference, user_id, amount, currency, status) VALUES (?, ?, ?, ?, ?)`
    ).bind(reference, user.id, tx.amount, tx.currency, tx.status);

    const insertRoom = c.env.DB.prepare(
      `INSERT INTO rooms (id, title, description, host_id, host_name, status, scheduled_at) VALUES (?, ?, ?, ?, ?, 'live', ?)`
    ).bind(roomId, title, description || '', user.id, user.publisherName || 'Host', null);

    const insertParticipant = c.env.DB.prepare(
      `INSERT OR IGNORE INTO room_participants (room_id, user_id) VALUES (?, ?)`
    ).bind(roomId, user.id);

    await c.env.DB.batch([insertPayment, insertRoom, insertParticipant]);

    const room = await c.env.DB.prepare('SELECT * FROM rooms WHERE id = ?').bind(roomId).first();
    return c.json({ ok: true, room, wsUrl: `/rooms/${roomId}/ws` });

  } catch (e) { return c.json({ error: 'Secure transaction failed.' }, 500); }
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
    
    // Atomic cascade delete
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM room_chat_messages WHERE room_id = ?').bind(roomId),
      c.env.DB.prepare('DELETE FROM room_participants WHERE room_id = ?').bind(roomId),
      c.env.DB.prepare('DELETE FROM rooms WHERE id = ?').bind(roomId)
    ]);
    return c.json({ ok: true, message: 'Room successfully deleted.' });
  } catch (e) { return c.json({ error: 'Failed to delete room securely.' }, 500); }
});

export default rooms;