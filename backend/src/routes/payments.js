import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';

const payments = new Hono();

// Credit packages
const PACKAGES = [
  { id: 'sms_10', name: '10 SMS', amount: 1000, credits: 10 },   // KES 10
  { id: 'sms_50', name: '50 SMS', amount: 5000, credits: 50 },   // KES 50
  { id: 'sms_100', name: '100 SMS', amount: 10000, credits: 100 }, // KES 100
  { id: 'sms_500', name: '500 SMS', amount: 50000, credits: 500 }, // KES 500
  { id: 'sms_1000', name: '1000 SMS', amount: 100000, credits: 1000 }, // KES 1000
];

// Get packages
payments.get('/packages', (c) => {
  return c.json({ packages: PACKAGES });
});

// Get payment history
payments.get('/history', requireAuth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM payment_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(user.id).all();
  return c.json({ transactions: results });
});

// Initialize payment
payments.post('/initialize', requireAuth, async (c) => {
  const user = c.get('user');
  const { packageId } = await c.req.json();

  const pkg = PACKAGES.find(p => p.id === packageId);
  if (!pkg) return c.json({ error: 'Invalid package.' }, 400);

  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return c.json({ error: 'Payment gateway not configured.' }, 500);

  const reference = `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Record pending transaction
  const txnId = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO payment_transactions (id, user_id, amount, credits, method, reference, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(txnId, user.id, pkg.amount, pkg.credits, 'paystack', reference, 'pending').run();

  try {
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        amount: pkg.amount,
        reference,
        metadata: {
          user_id: user.id,
          transaction_id: txnId,
          credits: pkg.credits,
          package: pkg.name,
        }
      }),
    });

    const data = await response.json();

    if (!data.status) {
      await c.env.DB.prepare('UPDATE payment_transactions SET status = ? WHERE id = ?')
        .bind('failed', txnId).run();
      return c.json({ error: data.message || 'Payment initialization failed.' }, 502);
    }

    return c.json({ 
      reference,
      authorization_url: data.data.authorization_url,
      access_code: data.data.access_code,
    });

  } catch (e) {
    await c.env.DB.prepare('UPDATE payment_transactions SET status = ? WHERE id = ?')
      .bind('failed', txnId).run();
    return c.json({ error: 'Payment initialization failed.', details: e.message }, 500);
  }
});

// Verify payment
payments.get('/verify/:reference', requireAuth, async (c) => {
  const user = c.get('user');
  const reference = c.req.param('reference');

  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return c.json({ error: 'Payment gateway not configured.' }, 500);

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        'Authorization': `Bearer ${secretKey}`,
      },
    });

    const data = await response.json();

    if (!data.status) {
      return c.json({ verified: false, message: 'Payment not found.' });
    }

    const txn = data.data;
    const isSuccessful = txn.status === 'success';

    if (isSuccessful) {
      // Check if already credited
      const existing = await c.env.DB.prepare(
        'SELECT * FROM payment_transactions WHERE reference = ? AND status = ?'
      ).bind(reference, 'completed').first();

      if (!existing) {
        const credits = txn.metadata?.credits || 0;
        
        // Update transaction
        await c.env.DB.prepare(
          'UPDATE payment_transactions SET status = ? WHERE reference = ? AND status = ?'
        ).bind('completed', reference, 'pending').run();

        // Add credits
        await c.env.DB.prepare(
          'INSERT INTO sms_credits (user_id, balance, total_sent) VALUES (?, ?, 0) ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?'
        ).bind(user.id, credits, credits).run();
      }
    }

    return c.json({
      verified: true,
      status: txn.status,
      amount: txn.amount / 100,
      credits: txn.metadata?.credits || 0,
      reference,
    });

  } catch (e) {
    return c.json({ error: 'Verification failed.', details: e.message }, 500);
  }
});

// Paystack webhook (called by Paystack automatically)
payments.post('/webhook', async (c) => {
  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  const body = await c.req.json();

  // Verify this is from Paystack
  const signature = c.req.header('x-paystack-signature');
  // In production, verify the signature using HMAC SHA512 with your secret key

  if (body.event === 'charge.success') {
    const txn = body.data;
    const reference = txn.reference;
    const credits = txn.metadata?.credits || 0;
    const userId = txn.metadata?.user_id;

    if (userId && credits > 0) {
      // Update transaction
      await c.env.DB.prepare(
        'UPDATE payment_transactions SET status = ? WHERE reference = ?'
      ).bind('completed', reference).run();

      // Add credits
      await c.env.DB.prepare(
        'INSERT INTO sms_credits (user_id, balance, total_sent) VALUES (?, ?, 0) ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?'
      ).bind(userId, credits, credits).run();
    }
  }

  return c.json({ received: true });
});

export default payments;