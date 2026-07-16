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

// Send SMS
sms.post('/send', requireAuth, async (c) => {
  const user = c.get('user');
  const { message, recipients } = await c.req.json();
  
  if (!message?.trim()) return c.json({ error: 'Message is required.' }, 400);
  if (!recipients?.length) return c.json({ error: 'At least one recipient required.' }, 400);

  // Check credits
  let credits = await c.env.DB.prepare('SELECT * FROM sms_credits WHERE user_id = ?')
    .bind(user.id).first();
  if (!credits) {
    await c.env.DB.prepare('INSERT INTO sms_credits (user_id, balance) VALUES (?, 5)')
      .bind(user.id).run();
    credits = { balance: 5 };
  }

  const cost = recipients.length;
  if (credits.balance < cost) {
    return c.json({ error: `Insufficient credits. You have ${credits.balance}, need ${cost}.` }, 402);
  }

  // Send via Africa's Talking
  const apiKey = c.env.AFRICAS_TALKING_API_KEY;
  const username = c.env.AFRICAS_TALKING_USERNAME || 'sandbox';
  
  try {
    const res = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        'apiKey': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        username,
        to: recipients.join(','),
        message: message.trim(),
        from: 'OPINIONPLUS',
      }).toString(),
    });

    const data = await res.json();

    if (!res.ok) {
      return c.json({ error: 'SMS gateway error.', details: data }, 500);
    }

    // Deduct credits
    await c.env.DB.prepare(
      'UPDATE sms_credits SET balance = balance - ?, total_sent = total_sent + ? WHERE user_id = ?'
    ).bind(cost, cost, user.id).run();

    // Log history
    const historyId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO sms_history (id, user_id, message, recipients, recipient_count, status, cost) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(historyId, user.id, message.trim(), recipients.join(','), recipients.length, 'sent', cost).run();

    return c.json({ 
      ok: true, 
      sent: recipients.length, 
      remaining_credits: credits.balance - cost,
      message_id: historyId,
    });

  } catch (e) {
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