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

// Send SMS via Infobip
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

  // Get Infobip credentials
  const apiKey = c.env.INFOBIP_API_KEY;
  const baseUrl = c.env.INFOBIP_BASE_URL || 'https://api.infobip.com';

  if (!apiKey) {
    return c.json({ error: 'SMS gateway not configured. Contact support.' }, 500);
  }

  // Format destinations
  const destinations = validRecipients.map(phone => ({
    to: phone.replace(/^\+/, '') // Infobip expects number without +
  }));

  try {
    const response = await fetch(`${baseUrl}/sms/2/text/advanced`, {
      method: 'POST',
      headers: {
        'Authorization': `App ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        messages: [{
          destinations,
          from: 'OPINIONPLUS',
          text: trimmedMessage,
        }]
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Infobip error:', JSON.stringify(data));
      return c.json({ 
        error: 'SMS gateway error.',
        details: data.requestError?.serviceException || data
      }, 502);
    }

    // Count results
    const msgResults = data.messages?.[0] || {};
    const msgStatus = msgResults.status || {};
    const sent = msgResults.destinations?.filter(d => d.status?.name === 'PENDING_ACCEPTED')?.length || 0;
    const failed = (validRecipients.length - sent);
    const statuses = msgResults.destinations?.map(d => ({
      number: d.to,
      status: d.status?.name || 'UNKNOWN',
      messageId: d.messageId
    })) || [];

    let historyStatus = 'sent';
    if (sent > 0 && failed === 0) historyStatus = 'delivered';
    else if (failed > 0 && sent === 0) historyStatus = 'failed';
    else if (sent > 0 && failed > 0) historyStatus = 'partial';

    // Deduct credits only for delivered
    if (sent > 0) {
      await c.env.DB.prepare(
        'UPDATE sms_credits SET balance = balance - ?, total_sent = total_sent + ? WHERE user_id = ?'
      ).bind(sent, sent, user.id).run();
    }

    // Log history
    const historyId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO sms_history (id, user_id, message, recipients, recipient_count, status, cost) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(historyId, user.id, trimmedMessage, validRecipients.join(','), validRecipients.length, historyStatus, sent).run();

    const updated = await c.env.DB.prepare('SELECT balance FROM sms_credits WHERE user_id = ?')
      .bind(user.id).first();

    return c.json({ 
      ok: true,
      sent,
      failed,
      remaining_credits: updated?.balance || 0,
      message_id: historyId,
      details: statuses,
      bulkId: msgResults.bulkId
    });

  } catch (e) {
    console.error('Infobip exception:', e.message);
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