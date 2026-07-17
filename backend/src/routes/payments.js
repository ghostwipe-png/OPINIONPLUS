import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';

const payments = new Hono();

// Credit packages
const PACKAGES = [
  { id: 'sms_10', name: '10 SMS', amount: 1000, credits: 10 },
  { id: 'sms_50', name: '50 SMS', amount: 5000, credits: 50 },
  { id: 'sms_100', name: '100 SMS', amount: 10000, credits: 100 },
  { id: 'sms_500', name: '500 SMS', amount: 50000, credits: 500 },
  { id: 'sms_1000', name: '1000 SMS', amount: 100000, credits: 1000 },
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

  console.log('PAYSTACK INIT - User:', user.email, 'Package:', packageId);

  const pkg = PACKAGES.find(p => p.id === packageId);
  if (!pkg) {
    console.log('PAYSTACK - Invalid package:', packageId);
    return c.json({ error: 'Invalid package.' }, 400);
  }

  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    console.log('PAYSTACK - No secret key configured');
    return c.json({ error: 'Payment gateway not configured.' }, 500);
  }

  const reference = `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  console.log('PAYSTACK - Reference:', reference, 'Amount:', pkg.amount, 'Credits:', pkg.credits);

  const txnId = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO payment_transactions (id, user_id, amount, credits, method, reference, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(txnId, user.id, pkg.amount, pkg.credits, 'paystack', reference, 'pending').run();

  const requestBody = {
    email: user.email,
    amount: pkg.amount,
    reference,
    currency: 'KES',
    channels: ['card', 'mobile_money'],
    metadata: {
      user_id: user.id,
      transaction_id: txnId,
      credits: pkg.credits,
      package: pkg.name,
    }
  };

  console.log('PAYSTACK REQUEST:', JSON.stringify({ ...requestBody, email: user.email ? '***' : 'MISSING' }));

  try {
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(requestBody),
    });

    const rawText = await response.text();
    console.log('PAYSTACK HTTP:', response.status);
    console.log('PAYSTACK RAW:', rawText);

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error('PAYSTACK PARSE ERROR:', e.message);
      await c.env.DB.prepare('UPDATE payment_transactions SET status = ? WHERE id = ?')
        .bind('failed', txnId).run();
      return c.json({ error: 'Invalid response from payment gateway.' }, 502);
    }

    console.log('PAYSTACK STATUS:', data.status, 'Message:', data.message);

    if (!data.status) {
      console.error('PAYSTACK FAILED:', JSON.stringify(data));
      await c.env.DB.prepare('UPDATE payment_transactions SET status = ? WHERE id = ?')
        .bind('failed', txnId).run();
      return c.json({ 
        error: data.message || 'Payment initialization failed.',
        details: data
      }, 502);
    }

    console.log('PAYSTACK SUCCESS - URL:', data.data?.authorization_url);

    return c.json({ 
      reference,
      authorization_url: data.data.authorization_url,
      access_code: data.data.access_code,
    });

  } catch (e) {
    console.error('PAYSTACK EXCEPTION:', e.message, e.stack);
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
      const existing = await c.env.DB.prepare(
        'SELECT * FROM payment_transactions WHERE reference = ? AND status = ?'
      ).bind(reference, 'completed').first();

      if (!existing) {
        const credits = txn.metadata?.credits || 0;
        
        await c.env.DB.prepare(
          'UPDATE payment_transactions SET status = ? WHERE reference = ? AND status = ?'
        ).bind('completed', reference, 'pending').run();

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

// Paystack webhook
payments.post('/webhook', async (c) => {
  const body = await c.req.json();

  if (body.event === 'charge.success') {
    const txn = body.data;
    const reference = txn.reference;
    const credits = txn.metadata?.credits || 0;
    const userId = txn.metadata?.user_id;

    if (userId && credits > 0) {
      await c.env.DB.prepare(
        'UPDATE payment_transactions SET status = ? WHERE reference = ?'
      ).bind('completed', reference).run();

      await c.env.DB.prepare(
        'INSERT INTO sms_credits (user_id, balance, total_sent) VALUES (?, ?, 0) ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?'
      ).bind(userId, credits, credits).run();
    }
  }

  return c.json({ received: true });
});

export default payments;