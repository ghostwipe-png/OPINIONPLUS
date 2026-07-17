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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Atomically flips a transaction from 'pending' -> 'completed' and, only if
 * this call is the one that actually performed that flip, credits the user.
 * This makes crediting idempotent even if verify() and the webhook fire for
 * the same reference at the same time (or the webhook fires twice).
 */
async function finalizeTransaction(db, reference, expectedUserId, credits) {
  const update = await db
    .prepare('UPDATE payment_transactions SET status = ? WHERE reference = ? AND status = ?')
    .bind('completed', reference, 'pending')
    .run();

  const flipped = (update?.meta?.changes ?? update?.changes ?? 0) > 0;
  if (!flipped) {
    // Either already completed by another request, or reference/user mismatch.
    return { credited: false };
  }

  if (!expectedUserId || !credits) {
    return { credited: false };
  }

  await db
    .prepare(
      'INSERT INTO sms_credits (user_id, balance, total_sent) VALUES (?, ?, 0) ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?'
    )
    .bind(expectedUserId, credits, credits)
    .run();

  return { credited: true };
}

/**
 * Verifies the `x-paystack-signature` header against the raw request body
 * using HMAC-SHA512 with the Paystack secret key, per Paystack's webhook
 * verification requirements. Must be run against the raw (unparsed) body.
 */
async function verifyPaystackSignature(secretKey, rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secretKey),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );
    const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
    const computedHex = [...new Uint8Array(sigBuffer)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (computedHex.length !== signatureHeader.length) return false;
    // Constant-time-ish comparison
    let diff = 0;
    for (let i = 0; i < computedHex.length; i++) {
      diff |= computedHex.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
    }
    return diff === 0;
  } catch (e) {
    console.error('PAYSTACK - signature verification error:', e.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Get packages (single source of truth the frontend can fetch instead of
// hardcoding prices twice)
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

  let body;
  try {
    body = await c.req.json();
  } catch (e) {
    return c.json({ error: 'Invalid request body.' }, 400);
  }

  const { packageId } = body || {};
  if (typeof packageId !== 'string') {
    return c.json({ error: 'Invalid package.' }, 400);
  }

  const pkg = PACKAGES.find((p) => p.id === packageId);
  if (!pkg) {
    return c.json({ error: 'Invalid package.' }, 400);
  }

  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    console.error('PAYSTACK - No secret key configured');
    return c.json({ error: 'Payment gateway not configured.' }, 500);
  }

  const reference = `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

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
    },
  };

  try {
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(requestBody),
    });

    const rawText = await response.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error('PAYSTACK - failed to parse initialize response');
      await c.env.DB.prepare('UPDATE payment_transactions SET status = ? WHERE id = ?')
        .bind('failed', txnId).run();
      return c.json({ error: 'Invalid response from payment gateway.' }, 502);
    }

    if (!data.status) {
      console.error('PAYSTACK - initialize failed:', data.message);
      await c.env.DB.prepare('UPDATE payment_transactions SET status = ? WHERE id = ?')
        .bind('failed', txnId).run();
      return c.json(
        {
          error: data.message || 'Payment initialization failed.',
          details: data,
        },
        502
      );
    }

    return c.json({
      reference,
      email: user.email,
      authorization_url: data.data.authorization_url,
      access_code: data.data.access_code,
    });
  } catch (e) {
    console.error('PAYSTACK - initialize exception:', e.message);
    await c.env.DB.prepare('UPDATE payment_transactions SET status = ? WHERE id = ?')
      .bind('failed', txnId).run();
    return c.json({ error: 'Payment initialization failed.' }, 500);
  }
});

// Verify payment
payments.get('/verify/:reference', requireAuth, async (c) => {
  const reference = c.req.param('reference');

  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return c.json({ error: 'Payment gateway not configured.' }, 500);

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });

    const data = await response.json();

    if (!data.status) {
      return c.json({ verified: false, message: 'Payment not found.' });
    }

    const txn = data.data;
    const isSuccessful = txn.status === 'success';

    if (isSuccessful) {
      // Credit the account the payment was actually made for (from Paystack's
      // own metadata), not whichever logged-in user happens to be calling
      // /verify — this prevents someone from harvesting another user's
      // reference and crediting themselves.
      const owningUserId = txn.metadata?.user_id;
      const credits = txn.metadata?.credits || 0;
      await finalizeTransaction(c.env.DB, reference, owningUserId, credits);
    }

    return c.json({
      verified: true,
      status: txn.status,
      amount: txn.amount / 100,
      credits: txn.metadata?.credits || 0,
      reference,
    });
  } catch (e) {
    console.error('PAYSTACK - verify exception:', e.message);
    return c.json({ error: 'Verification failed.' }, 500);
  }
});

// Paystack webhook
payments.post('/webhook', async (c) => {
  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  const signature = c.req.header('x-paystack-signature');

  const rawBody = await c.req.text();

  if (!secretKey) {
    console.error('PAYSTACK WEBHOOK - No secret key configured');
    return c.json({ received: true });
  }

  const validSignature = await verifyPaystackSignature(secretKey, rawBody, signature);
  if (!validSignature) {
    console.error('PAYSTACK WEBHOOK - invalid signature, rejecting');
    return c.json({ error: 'Invalid signature.' }, 401);
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch (e) {
    return c.json({ error: 'Invalid payload.' }, 400);
  }

  if (body.event === 'charge.success') {
    const txn = body.data;
    const reference = txn.reference;
    const credits = txn.metadata?.credits || 0;
    const userId = txn.metadata?.user_id;

    if (reference && userId && credits > 0) {
      try {
        await finalizeTransaction(c.env.DB, reference, userId, credits);
      } catch (e) {
        console.error('PAYSTACK WEBHOOK - finalize error:', e.message);
        // Still ack the webhook so Paystack doesn't hammer retries; the
        // pending transaction remains pending and can be reconciled later.
      }
    }
  }

  return c.json({ received: true });
});

export default payments;
