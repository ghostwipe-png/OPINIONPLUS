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
    return c.json({ 
      error: `Insufficient credits. You have ${credits.balance}, need ${cost}.` 
    }, 402);
  }

  // Get API credentials
  const apiKey = c.env.AFRICAS_TALKING_API_KEY;
  const username = c.env.AFRICAS_TALKING_USERNAME || 'opinionplus';

  if (!apiKey) {
    return c.json({ error: 'SMS gateway not configured. Contact support.' }, 500);
  }

  // Send via Africa's Talking
  const url = username === 'sandbox' 
    ? 'https://api.sandbox.africastalking.com/version1/messaging'
    : 'https://api.africastalking.com/version1/messaging';

  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('to', validRecipients.join(','));
  formData.append('message', trimmedMessage);
  formData.append('from', 'OPINIONPLUS');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apiKey': apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: formData.toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Africa\'s Talking error:', JSON.stringify(data));
    return c.json({ 
      error: 'SMS gateway error.',
      details: data 
    }, 502);
  }

  // Deduct credits
  await c.env.DB.prepare(
    'UPDATE sms_credits SET balance = balance - ?, total_sent = total_sent + ? WHERE user_id = ?'
  ).bind(cost, cost, user.id).run();

  // Log history
  const historyId = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO sms_history (id, user_id, message, recipients, recipient_count, status, cost) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(historyId, user.id, trimmedMessage, validRecipients.join(','), validRecipients.length, 'sent', cost).run();

  // Count results
  const msgData = data.SMSMessageData || {};
  const recipients_result = msgData.Recipients || [];
  const delivered = recipients_result.filter(r => r.status === 'Success').length;
  const failed = recipients_result.filter(r => r.status !== 'Success').length;

  return c.json({ 
    ok: true,
    sent: delivered,
    failed: failed,
    remaining_credits: credits.balance - cost,
    message_id: historyId,
    gateway_response: {
      message: msgData.Message || 'Sent',
      delivered,
      failed
    }
  });
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