import { Hono } from 'hono';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const jobs = new Hono();

// List all active media jobs
jobs.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT j.*, u.logo_url as employer_logo, u.publisher_name as posted_by
     FROM jobs j 
     LEFT JOIN users u ON j.employer_id = u.id 
     WHERE j.status = 'active' 
     ORDER BY j.created_at DESC LIMIT 100`
  ).all();
  
  return c.json({ jobs: results });
});

// Step 1: Initialize Paystack Transaction for Job Listing
jobs.post('/initialize', requireAuth, async (c) => {
  const user = c.get('user');
  const { title, company, location, type, description, apply_link } = await c.req.json();

  if (!title || !company || !apply_link) {
    return c.json({ error: 'Title, company, and application link are required.' }, 400);
  }

  const jobId = 'job_' + crypto.randomUUID().slice(0, 10);
  const amountCents = 100000; // KES 1,000 (Paystack takes amount in minor units/cents)

  // Store job details as pending in DB
  await c.env.DB.prepare(
    `INSERT INTO jobs (id, employer_id, title, company, location, type, description, apply_link, amount_paid, status) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
  ).bind(jobId, user.id, title, company, location || 'Remote', type || 'Full-time', description || '', apply_link, amountCents).run();

  // Call Paystack API to initialize transaction
  const origin = c.req.header('origin') || 'https://opinionplus.online';
  const callbackUrl = `${origin}/jobs?reference=${jobId}`; // Using jobId as reference prefix or tracking ID

  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${c.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: user.email || 'adipotech@gmail.com',
      amount: amountCents,
      reference: jobId,
      callback_url: callbackUrl,
      metadata: { job_id: jobId }
    }),
  });

  const paystackData = await paystackRes.json();

  if (!paystackData.status) {
    return c.json({ error: 'Failed to initialize payment gateway with Paystack.' }, 400);
  }

  return c.json({ ok: true, authorization_url: paystackData.data.authorization_url });
});

// Step 2: Verify Paystack Transaction & Publish Job
jobs.post('/verify', requireAuth, async (c) => {
  const { reference } = await c.req.json();
  if (!reference) return c.json({ error: 'Transaction reference required.' }, 400);

  // Verify with Paystack API
  const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${c.env.PAYSTACK_SECRET_KEY}`,
    },
  });

  const verifyData = await verifyRes.json();

  if (verifyData.status && verifyData.data.status === 'success') {
    // Payment confirmed! Activate the job listing
    await c.env.DB.prepare("UPDATE jobs SET status = 'active' WHERE id = ?").bind(reference).run();
    return c.json({ ok: true, message: 'Payment confirmed and job posted successfully!' });
  }

  return c.json({ error: 'Payment verification failed or pending.' }, 400);
});

// Admin endpoint to remove jobs
jobs.delete('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare("UPDATE jobs SET status = 'deleted' WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

export default jobs;