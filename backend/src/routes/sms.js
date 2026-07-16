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

// Send SMS via Twilio
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

  // Get Twilio credentials
  const accountSid = c.env.TWILIO_ACCOUNT_SID;
  const authToken = c.env.TWILIO_AUTH_TOKEN;
  const from = c.env.TWILIO_PHONE_NUMBER || 'OPINIONPLUS';

  if (!accountSid || !authToken) {
    return c.json({ error: 'SMS gateway not configured. Contact support.' }, 500);
  }

  const results = [];
  let totalDelivered = 0;
  let totalFailed = 0;

  // Send to each recipient individually for better tracking
  for (const to of validRecipients) {
    try {
      const formData = new URLSearchParams();
      formData.append('To', to);
      formData.append('From', from);
      formData.append('Body', trimmedMessage);

      const auth = btoa(`${accountSid}:${authToken}`);

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        }
      );

      const data = await response.json();

      if (response.ok && data.sid) {
        totalDelivered++;
        results.push({ number: to, status: 'sent', sid: data.sid, error: null });
      } else {
        totalFailed++;
        results.push({ number: to, status: 'failed', sid: null, error: data.message || 'Unknown error' });
        console.error('Twilio error for', to, ':', JSON.stringify(data));
      }
    } catch (e) {
      totalFailed++;
      results.push({ number: to, status: 'failed', sid: null, error: e.message });
      console.error('Twilio exception for', to, ':', e.message);
    }
  }

  const actualCost = totalDelivered; // Only charge for delivered
  const finalStatus = totalDelivered > 0 && totalFailed === 0 ? 'delivered' 
    : totalDelivered > 0 ? 'partial' 
    : 'failed';

  // Deduct credits only for delivered messages
  if (actualCost > 0) {
    await c.env.DB.prepare(
      'UPDATE sms_credits SET balance = balance - ?, total_sent = total_sent + ? WHERE user_id = ?'
    ).bind(actualCost, actualCost, user.id).run();
  }

  // Log history
  const historyId = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO sms_history (id, user_id, message, recipients, recipient_count, status, cost) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(historyId, user.id, trimmedMessage, validRecipients.join(','), validRecipients.length, finalStatus, actualCost).run();

  // Get updated balance
  const updated = await c.env.DB.prepare('SELECT balance FROM sms_credits WHERE user_id = ?')
    .bind(user.id).first();

  return c.json({ 
    ok: true,
    sent: totalDelivered,
    failed: totalFailed,
    remaining_credits: updated?.balance || 0,
    message_id: historyId,
    details: results
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