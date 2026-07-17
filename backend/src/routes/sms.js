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

// Send SMS via Mobitech
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

  // Get Mobitech credentials
  const apiKey = c.env.MOBITECH_API_KEY;
  const senderName = c.env.MOBITECH_SENDER_ID || 'MOBITECH';

  if (!apiKey) {
    return c.json({ error: 'SMS gateway not configured. Contact support.' }, 500);
  }

  let totalSent = 0;
  let totalFailed = 0;
  const results = [];

  try {
    // Use single send for each recipient (more reliable)
    for (const phone of validRecipients) {
      const cleanPhone = phone.startsWith('+') ? phone : `+${phone}`;
      
      const requestBody = {
        mobile: cleanPhone,
        response_type: 'json',
        sender_name: senderName,
        service_id: 0,
        message: trimmedMessage,
      };

      console.log('MOBITECH REQUEST:', JSON.stringify({ ...requestBody, message: requestBody.message.slice(0, 20) + '...' }));

      try {
        const response = await fetch('https://app.mobitechtechnologies.com/sms/sendsms', {
          method: 'POST',
          headers: {
            'h_api_key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        const rawText = await response.text();
        console.log('MOBITECH RAW RESPONSE:', rawText);
        console.log('MOBITECH HTTP STATUS:', response.status);

        let data;
        try {
          data = JSON.parse(rawText);
          console.log('MOBITECH PARSED:', JSON.stringify(data));
        } catch (parseErr) {
          console.error('MOBITECH PARSE ERROR:', parseErr.message);
          totalFailed++;
          results.push({ number: phone, status: 'failed', error: 'Invalid response format' });
          continue;
        }

        const result = Array.isArray(data) ? data[0] : data;
        console.log('MOBITECH RESULT:', JSON.stringify(result));

        if (result && (result.status_code === '1000' || result.status_code === 1000 || result.status_desc === 'Success')) {
          totalSent++;
          results.push({ number: phone, status: 'sent', message_id: result.message_id });
          console.log('MOBITECH SUCCESS for', phone);
        } else {
          totalFailed++;
          const errorMsg = result?.status_desc || result?.message || 'Unknown error';
          results.push({ number: phone, status: 'failed', error: errorMsg });
          console.error('MOBITECH FAILED for', phone, ':', errorMsg);
        }
      } catch (fetchErr) {
        console.error('MOBITECH FETCH ERROR for', phone, ':', fetchErr.message);
        totalFailed++;
        results.push({ number: phone, status: 'failed', error: fetchErr.message });
      }
    }

    console.log('MOBITECH FINAL: sent=' + totalSent + ' failed=' + totalFailed);

    let historyStatus = 'sent';
    if (totalSent > 0 && totalFailed === 0) historyStatus = 'delivered';
    else if (totalFailed > 0 && totalSent === 0) historyStatus = 'failed';
    else if (totalSent > 0 && totalFailed > 0) historyStatus = 'partial';

    // Only deduct for actually sent messages
    if (totalSent > 0) {
      await c.env.DB.prepare(
        'UPDATE sms_credits SET balance = balance - ?, total_sent = total_sent + ? WHERE user_id = ?'
      ).bind(totalSent, totalSent, user.id).run();
    }

    const historyId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO sms_history (id, user_id, message, recipients, recipient_count, status, cost) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(historyId, user.id, trimmedMessage, validRecipients.join(','), validRecipients.length, historyStatus, totalSent).run();

    const updated = await c.env.DB.prepare('SELECT balance FROM sms_credits WHERE user_id = ?')
      .bind(user.id).first();

    return c.json({ 
      ok: true,
      sent: totalSent,
      failed: totalFailed,
      remaining_credits: updated?.balance || 0,
      message_id: historyId,
      details: results
    });

  } catch (e) {
    console.error('MOBITECH OUTER EXCEPTION:', e.message, e.stack);
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