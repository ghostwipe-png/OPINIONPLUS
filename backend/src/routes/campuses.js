// backend/src/routes/campuses.js
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';

const campuses = new Hono();
const CAMPUS_FEE_CENTS = 500000; // KES 5,000

// Helper: Secure Logging
async function logEvent(c, action, payload = {}) {
  try { console.log(JSON.stringify({ kind: 'campus_log', action, timestamp: new Date().toISOString(), ...payload })); } catch (e) {}
}

// List active campus editions
campuses.get('/', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT id, university_name, representative_name, status, created_at FROM campus_editions WHERE status = 'active' ORDER BY created_at DESC`
    ).all();
    return c.json({ campuses: results });
  } catch (e) { return c.json({ error: 'Failed to load campuses' }, 500); }
});

// Initialize Paystack payment
campuses.post('/initialize', requireAuth, async (c) => {
  const user = c.get('user');
  const { university_name, representative_name, contact_email, idempotency_key } = await c.req.json();

  if (!university_name || !contact_email) {
    return c.json({ error: 'University name and contact email are required.' }, 400);
  }

  // IDEMPOTENCY CHECK: Prevent double-initialization spam
  if (idempotency_key) {
    const existing = await c.env.DB.prepare('SELECT id, status FROM campus_editions WHERE contact_email = ? AND university_name = ? AND status = ?')
      .bind(contact_email, university_name, 'pending').first();
    if (existing) {
       // If a pending transaction already exists, you can route them back to it or block creation
       return c.json({ error: 'A pending registration already exists for this university.' }, 409);
    }
  }

  const campusId = `campus_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  
  await c.env.DB.prepare(
    `INSERT INTO campus_editions (id, university_name, contact_email, representative_name, status, annual_fee_cents, user_id) 
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`
  ).bind(campusId, university_name, contact_email, representative_name || user.publisherName, CAMPUS_FEE_CENTS, user.id).run();

  const origin = c.req.header('origin') || 'https://opinionplus.online';
  const callbackUrl = `${origin}/campuses?reference=${campusId}`; // Note: Ensure your frontend folder is named 'campuses', not 'compuses'

  try {
    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: contact_email, amount: CAMPUS_FEE_CENTS, reference: campusId, callback_url: callbackUrl, metadata: { type: 'campus_license', campus_id: campusId, user_id: user.id }
      }),
    });

    const paystackData = await paystackRes.json();
    if (!paystackData.status) return c.json({ error: 'Failed to initialize payment.' }, 400);

    return c.json({ ok: true, authorization_url: paystackData.data.authorization_url });
  } catch (e) {
    return c.json({ error: 'Payment gateway unreachable.' }, 502);
  }
});

// Verify Paystack Transaction (Strict Integrity Validation)
campuses.post('/verify', requireAuth, async (c) => {
  const { reference } = await c.req.json();
  if (!reference) return c.json({ error: 'Transaction reference required.' }, 400);

  // 1. Fetch local record first to compare
  const campus = await c.env.DB.prepare('SELECT * FROM campus_editions WHERE id = ?').bind(reference).first();
  if (!campus) return c.json({ error: 'Registration not found.' }, 404);
  
  // If already active, return success immediately
  if (campus.status === 'active') return c.json({ ok: true, message: 'Campus already active.' });

  try {
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${c.env.PAYSTACK_SECRET_KEY}` },
    });
    const verifyData = await verifyRes.json();

    if (verifyData.status && verifyData.data.status === 'success') {
      
      // CRITICAL SECURITY: Verify the amount paid matches the required KES 5000 fee
      if (verifyData.data.amount !== campus.annual_fee_cents) {
        await logEvent(c, 'security_alert_campus_amount_mismatch', { reference, expected: campus.annual_fee_cents, got: verifyData.data.amount });
        return c.json({ error: 'Transaction integrity failure. Amount mismatch.' }, 400);
      }

      // OPTIMISTIC LOCKING: Ensure we only activate if it is still pending
      const update = await c.env.DB.prepare("UPDATE campus_editions SET status = 'active' WHERE id = ? AND status = 'pending'")
        .bind(reference).run();

      const changed = (update?.meta?.changes ?? update?.changes ?? 0) > 0;
      if (changed) {
         await logEvent(c, 'campus_activated', { university: campus.university_name, reference });
      }
      return c.json({ ok: true, message: 'Licensing fee confirmed. Campus edition activated!' });
    }

    return c.json({ error: 'Payment not successful.' }, 400);
  } catch (e) {
    return c.json({ error: 'Verification failed due to network error.' }, 500);
  }
});

export default campuses;