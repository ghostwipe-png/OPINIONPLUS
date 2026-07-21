import { Hono } from 'hono';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const campuses = new Hono();

// List active campus editions
campuses.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM campus_editions WHERE status = 'active' ORDER BY created_at DESC`
  ).all();
  return c.json({ campuses: results });
});

// Initialize Paystack payment for annual licensing fee (KES 5,000)
campuses.post('/initialize', requireAuth, async (c) => {
  const user = c.get('user');
  const { university_name, representative_name, contact_email } = await c.req.json();

  if (!university_name || !contact_email) {
    return c.json({ error: 'University name and contact email are required.' }, 400);
  }

  const campusId = 'campus_' + crypto.randomUUID().slice(0, 10);
  const feeCents = 500000; // KES 5,000

  // Insert as pending
  await c.env.DB.prepare(
    `INSERT INTO campus_editions (id, university_name, contact_email, representative_name, status, annual_fee_cents) 
     VALUES (?, ?, ?, ?, 'pending', ?)`
  ).bind(campusId, university_name, contact_email, representative_name || user.publisherName, feeCents).run();

  const origin = c.req.header('origin') || 'https://opinionplus.online';
  const callbackUrl = `${origin}/campuses?reference=${campusId}`;

  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${c.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: contact_email,
      amount: feeCents,
      reference: campusId,
      callback_url: callbackUrl,
      metadata: { campus_id: campusId }
    }),
  });

  const paystackData = await paystackRes.json();
  if (!paystackData.status) {
    return c.json({ error: 'Failed to initialize Paystack licensing session.' }, 400);
  }

  return c.json({ ok: true, authorization_url: paystackData.data.authorization_url });
});

// Verify Paystack Transaction & Activate Campus Edition
campuses.post('/verify', async (c) => {
  const { reference } = await c.req.json();
  if (!reference) return c.json({ error: 'Transaction reference required.' }, 400);

  const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${c.env.PAYSTACK_SECRET_KEY}`,
    },
  });

  const verifyData = await verifyRes.json();
  if (verifyData.status && verifyData.data.status === 'success') {
    await c.env.DB.prepare("UPDATE campus_editions SET status = 'active' WHERE id = ?").bind(reference).run();
    return c.json({ ok: true, message: 'Licensing fee confirmed. Campus edition activated!' });
  }

  return c.json({ error: 'Payment verification failed.' }, 400);
});

export default campuses;