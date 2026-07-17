import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';

const sms = new Hono();

// Get credit balance
sms.get('/credits', requireAuth, async (c) => {
  const user = c.get('user');
  let credits = await c.env.DB.prepare('SELECT * FROM sms_credits WHERE user_id = ?')
    .bind(user.id).first();
  
  if (!credits) {
    await c.env.DB.prepare('INSERT INTO sms_credits (user_id, balance) VALUES (?, 5)')
      .bind(user.id).run();
    credits = { user_id: user.id, balance: 5, total_sent: 0 };
  }
  return c.json({ credits: credits.balance, total_sent: credits.total_sent });
});

// Get contacts
sms.get('/contacts', requireAuth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM sms_contacts WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(user.id).all();
  return c.json({ contacts: results });
});

// Add contact
sms.post('/contacts', requireAuth, async (c) => {
  const user = c.get('user');
  const { name, phone } = await c.req.json();
  if (!name?.trim() || !phone?.trim()) return c.json({ error: 'Name and phone required.' }, 400);
  
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO sms_contacts (id, user_id, name, phone) VALUES (?, ?, ?, ?)'
  ).bind(id, user.id, name.trim(), phone.trim()).run();
  return c.json({ id, name: name.trim(), phone: phone.trim() }, 201);
});

// Delete contact
sms.delete('/contacts/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM sms_contacts WHERE id = ? AND user_id = ?')
    .bind(id, user.id).run();
  return c.json({ ok: true });
});

// Send SMS via SMS Leopard
sms.post('/send', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { message, recipients } = body;

  if (!message || !message.trim()) {
    return c.json({ error: 'Message is required.' }, 400);
  }
  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return c.json({ error: 'At least one recipient required.' }, 400);
  }

  const trimmedMessage = message.trim();
  const validRecipients = recipients.filter(r => r && String(r).trim());
  
  if (validRecipients.length === 0) {
    return c.json({ error: 'No valid recipient numbers.' }, 400);
  }

  // Check credits
  let credits = await c.env.DB.prepare('SELECT balance, total_sent FROM sms_credits WHERE user_id = ?')
    .bind(user.id).first();
  
  if (!credits) {
    await c.env.DB.prepare('INSERT INTO sms_credits (user_id, balance, total_sent) VALUES (?, 5, 0)')
      .bind(user.id).run();
    credits = { balance: 5, total_sent: 0 };
  }

  const cost = validRecipients.length;
  if (credits.balance < cost) {
    return c.json({ error: `Insufficient credits. You have ${credits.balance}, need ${cost}.` }, 402);
  }

  // Get SMS Leopard credentials
  const apiKey = c.env.SMSLEOPARD_API_KEY;
  const apiSecret = c.env.SMSLEOPARD_API_SECRET;

  if (!apiKey || !apiSecret) {
    return c.json({ error: 'SMS gateway not configured. Contact support.' }, 500);
  }

  try {
    // Format numbers and message for URL
    const destination = validRecipients.map(p => p.replace(/^\+/, '').replace(/\s/g, '')).join(',');
    const encodedMessage = encodeURIComponent(trimmedMessage);
    const senderId = c.env.SMSLEOPARD_SENDER_ID || 'SMS_TEST';
    const encodedSender = encodeURIComponent(senderId);

    const url = `https://api.smsleopard.com/v1/sms/send?username=${apiKey}&password=${apiSecret}&message=${encodedMessage}&destination=${destination}&source=${encodedSender}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('SMS Leopard non-JSON response:', text);
      return c.json({ error: 'SMS gateway returned invalid response.' }, 502);
    }

    if (!response.ok || data.error) {
      console.error('SMS Leopard error:', JSON.stringify(data));
      return c.json({ 
        error: data.message || data.error || 'SMS gateway error.',
        details: data
      }, 502);
    }

    // Success
    const sent = validRecipients.length;

    if (sent > 0) {
      await c.env.DB.prepare(
        'UPDATE sms_credits SET balance = balance - ?, total_sent = total_sent + ? WHERE user_id = ?'
      ).bind(sent, sent, user.id).run();
    }

    const historyId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO sms_history (id, user_id, message, recipients, recipient_count, status, cost) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(historyId, user.id, trimmedMessage, validRecipients.join(','), validRecipients.length, 'delivered', sent).run();

    const updated = await c.env.DB.prepare('SELECT balance FROM sms_credits WHERE user_id = ?')
      .bind(user.id).first();

    return c.json({ 
      ok: true,
      sent,
      failed: 0,
      remaining_credits: updated?.balance || 0,
      message_id: historyId,
    });

  } catch (e) {
    console.error('SMS Leopard exception:', e.message);
    return c.json({ error: 'Failed to send SMS.', details: e.message }, 500);
  }
});

// Get SMS history
sms.get('/history', requireAuth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM sms_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 100'
  ).bind(user.id).all();
  return c.json({ history: results });
});

export default sms;