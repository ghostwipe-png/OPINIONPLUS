// backend/src/routes/services.js
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { verifyPaystackWebhook } from '../middleware/paystackWebhook.js';

const services = new Hono();

const SERVICE_TABLES = {
  sms: 'sms_packages',
  press_release: 'press_release_packages',
  sponsored: 'sponsored_packages',
  api: 'api_packages'
};

async function logEvent(c, action, payload = {}) {
  try {
    console.log(JSON.stringify({ kind: 'service_log', action, timestamp: new Date().toISOString(), ...payload }));
  } catch (e) { /* ignore log errors */ }
}

async function provisionService(db, order) {
  const { user_id, user_email, service_type, package_id } = order;
  
  if (service_type === 'sms') {
    const pkg = await db.prepare(`SELECT sms_count FROM sms_packages WHERE id = ?`).bind(package_id).first();
    const count = pkg ? pkg.sms_count : 100; // fallback if package record missing but granted
    await db.prepare('INSERT INTO sms_credits (user_id, balance, total_sent) VALUES (?, ?, 0) ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?')
      .bind(user_id, count, count).run();
    console.log(`SMS credits added: ${count} for user ${user_email}`);
  } else if (service_type === 'press_release') {
    console.log(`Press release package activated: ${package_id} for user ${user_email}`);
  } else if (service_type === 'sponsored') {
    const pkg = await db.prepare(`SELECT duration_days, impressions_goal FROM sponsored_packages WHERE id = ?`).bind(package_id).first();
    if (pkg) {
      await db.prepare('UPDATE service_orders SET metadata = json_insert(metadata, "$.duration_days", ?, "$.impressions_goal", ?) WHERE id = ?')
        .bind(pkg.duration_days, pkg.impressions_goal, order.id).run();
      console.log(`Sponsored content package activated for ${pkg.duration_days} days for user ${user_email}`);
    }
  } else if (service_type === 'api') {
    const pkg = await db.prepare(`SELECT requests_per_day FROM api_packages WHERE id = ?`).bind(package_id).first();
    const tier = package_id || (pkg ? package_id : 'pro');
    const existingKey = await db.prepare('SELECT id FROM api_keys WHERE user_id = ?').bind(user_id).first();
    if (!existingKey) {
      const newKey = `op_${crypto.randomUUID().replace(/-/g, '')}`;
      await db.prepare('INSERT INTO api_keys (id, user_id, key, name, tier, requests_today) VALUES (?, ?, ?, ?, ?, 0)')
        .bind(crypto.randomUUID(), user_id, newKey, 'Default Production Key', tier).run();
    } else {
      await db.prepare('UPDATE api_keys SET tier = ?, requests_today = 0 WHERE user_id = ?').bind(tier, user_id).run();
    }
    console.log(`API access upgraded to ${tier} for user ${user_email}`);
  }
}

// Get available packages
services.get('/packages/:serviceType', async (c) => {
  const serviceType = c.req.param('serviceType');
  const table = SERVICE_TABLES[serviceType];
  if (!table) return c.json({ error: 'Invalid service type.' }, 400);

  try {
    const { results } = await c.env.DB.prepare(`SELECT * FROM ${table} WHERE is_active = 1`).all();
    const packages = results.map(pkg => ({
      ...pkg,
      features: pkg.features ? JSON.parse(pkg.features) : undefined
    }));
    return c.json({ packages });
  } catch (e) {
    return c.json({ error: 'Failed to load packages.' }, 500);
  }
});

// Initialize payment (Strict Server-Side Price Calculation)
services.post('/pay', requireAuth, async (c) => {
  const user = c.get('user');
  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid request body.' }, 400); }
  
  const { serviceType, packageId, metadata = {}, idempotency_key: idempotencyKey } = body;
  const table = SERVICE_TABLES[serviceType];
  if (!table) return c.json({ error: 'Invalid service type.' }, 400);

  // SERVER-SIDE DATA FETCH (Never trust client prices)
  const pkg = await c.env.DB.prepare(`SELECT * FROM ${table} WHERE id = ? AND is_active = 1`).bind(packageId).first();
  if (!pkg) return c.json({ error: 'Invalid or inactive package.' }, 400);

  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return c.json({ error: 'Payment gateway not configured.' }, 500);

  const customerEmail = user.email || 'support@opinionplus.online';

  // IDEMPOTENCY CHECK
  if (idempotencyKey) {
    const existing = await c.env.DB.prepare('SELECT * FROM service_orders WHERE metadata LIKE ? AND user_id = ?').bind(`%"idempotency_key":"${idempotencyKey}"%`, user.id).first();
    if (existing) {
       if (existing.paystack_status === 'success') return c.json({ reference: existing.paystack_reference, status: 'completed', idempotent: true });
       if (existing.paystack_status === 'pending') return c.json({ reference: existing.paystack_reference, idempotent: true }); // Cannot return direct auth URL without caching, but stops double-init
    }
  }

  const reference = `srv_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const orderId = crypto.randomUUID();
  const finalMetadata = { ...metadata, idempotency_key: idempotencyKey };

  try {
    await c.env.DB.prepare(
      'INSERT INTO service_orders (id, user_id, user_email, service_type, package_id, amount_paid, paystack_reference, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(orderId, user.id, customerEmail, serviceType, packageId, pkg.price_kes_cents, reference, JSON.stringify(finalMetadata)).run();

    const callbackUrl = `${new URL(c.req.url).origin}/services/${serviceType.replace('_', '-')}?payment=success`;
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: customerEmail,
        amount: pkg.price_kes_cents,
        reference,
        currency: 'KES',
        callback_url: callbackUrl,
        metadata: { userId: user.id, serviceType, packageId, orderId, ...finalMetadata }
      }),
    });

    const data = await response.json();
    if (!data.status) {
      await c.env.DB.prepare('UPDATE service_orders SET paystack_status = ? WHERE id = ?').bind('failed', orderId).run();
      return c.json({ error: data.message || 'Payment initialization failed.' }, 502);
    }

    return c.json({ authorization_url: data.data.authorization_url, reference, amount: pkg.price_kes_cents });
  } catch (e) {
    await logEvent(c, 'pay_init_error', { message: e.message });
    return c.json({ error: 'Internal server error during payment initialization.' }, 500);
  }
});

// Verify payment synchronously (Updated to support admin grants & active statuses)
services.get('/verify/:reference', requireAuth, async (c) => {
  const reference = c.req.param('reference');
  const user = c.get('user');
  
  const order = await c.env.DB.prepare('SELECT * FROM service_orders WHERE paystack_reference = ?').bind(reference).first();
  if (!order) return c.json({ error: 'Order not found.' }, 404);
  if (order.user_id !== user.id && user.role !== 'admin' && user.role !== 'root') {
    return c.json({ error: 'Unauthorized access to order.' }, 403);
  }

  // If already verified or admin granted/active
  if (order.paystack_status === 'success' || order.paystack_status === 'admin_grant' || order.status === 'active') {
    return c.json({ status: order.status, serviceType: order.service_type, packageId: order.package_id });
  }

  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return c.json({ error: 'Gateway not configured.' }, 500);

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` }
    });
    const data = await response.json();

    if (data.status && data.data.status === 'success') {
      // Transaction Integrity check
      if (data.data.amount !== order.amount_paid) {
        logEvent(c, 'security_alert_amount_mismatch', { reference, expected: order.amount_paid, got: data.data.amount });
        return c.json({ error: 'Transaction integrity compromised.' }, 400);
      }

      // Optimistic lock check
      const update = await c.env.DB.prepare('UPDATE service_orders SET paystack_status = ?, status = ? WHERE paystack_reference = ? AND paystack_status = ?')
        .bind('success', 'active', reference, 'pending').run();
      
      const flipped = (update?.meta?.changes ?? update?.changes ?? 0) > 0;
      if (flipped) {
        await provisionService(c.env.DB, order);
      }
      return c.json({ status: 'active', serviceType: order.service_type, packageId: order.package_id });
    }
    
    return c.json({ error: 'Payment not successful yet.', status: data.data?.status }, 400);
  } catch (e) {
    return c.json({ error: 'Verification failed.' }, 500);
  }
});

// Check active status by service type directly for the logged-in user
services.get('/check/:serviceType', requireAuth, async (c) => {
  const user = c.get('user');
  const serviceType = c.req.param('serviceType');

  try {
    const activeOrder = await c.env.DB.prepare(
      "SELECT * FROM service_orders WHERE user_id = ? AND service_type = ? AND (paystack_status = 'success' OR paystack_status = 'admin_grant') AND status = 'active' ORDER BY created_at DESC LIMIT 1"
    ).bind(user.id, serviceType).first();

    if (!activeOrder) {
      return c.json({ active: false });
    }

    return c.json({
      active: true,
      serviceType: activeOrder.service_type,
      packageId: activeOrder.package_id,
      createdAt: activeOrder.created_at
    });
  } catch (e) {
    return c.json({ active: false, error: 'Failed to verify active service.' }, 500);
  }
});

// Paystack Webhook (No Auth - Secured by HMAC)
services.post('/webhook', async (c) => {
  const secretKey = c.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return c.json({ error: 'Not configured.' }, 500);

  const { valid, body } = await verifyPaystackWebhook(c.req.raw, secretKey);
  if (!valid) return c.json({ error: 'SECURITY ALERT: Invalid Signature.' }, 401);

  if (body && body.event === 'charge.success') {
    const reference = body.data?.reference;
    try {
      const order = await c.env.DB.prepare('SELECT * FROM service_orders WHERE paystack_reference = ?').bind(reference).first();
      // Optimistic Locking to prevent double provisions
      if (order && order.paystack_status === 'pending') {
        const update = await c.env.DB.prepare('UPDATE service_orders SET paystack_status = ?, status = ? WHERE paystack_reference = ? AND paystack_status = ?')
          .bind('success', 'active', reference, 'pending').run();
        
        if ((update?.meta?.changes ?? update?.changes ?? 0) > 0) {
          await provisionService(c.env.DB, order);
        }
      }
    } catch (e) {
      await logEvent(c, 'webhook_provision_error', { reference, message: e.message });
    }
  }

  return c.json({ received: true }, 200);
});

services.get('/orders', requireAuth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare('SELECT * FROM service_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').bind(user.id).all();
  return c.json({ orders: results.map(r => ({ ...r, metadata: JSON.parse(r.metadata || '{}') })) });
});

services.get('/orders/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const order = await c.env.DB.prepare('SELECT * FROM service_orders WHERE id = ?').bind(id).first();
  
  if (!order) return c.json({ error: 'Not found' }, 404);
  if (order.user_id !== user.id && user.role !== 'admin' && user.role !== 'root') {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  
  return c.json({ order: { ...order, metadata: JSON.parse(order.metadata || '{}') } });
});

export default services;