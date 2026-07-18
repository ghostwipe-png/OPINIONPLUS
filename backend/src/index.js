import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { attachUser, csrfProtection } from './middleware/auth.js';
import { apiKeyAuth } from './middleware/apiKey.js';
import { apiLimit } from './middleware/apiLimit.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import auth from './routes/auth.js';
import stories from './routes/stories.js';
import users from './routes/users.js';
import uploads from './routes/uploads.js';
import admin from './routes/admin.js';
import keys from './routes/keys.js';
import sms from './routes/sms.js';
import payments from './routes/payments.js';
import partner from './routes/partner.js';

const app = new Hono();

const ALLOWED_ORIGINS = [
  'https://www.opinionplus.online',
  'https://opinionplus.online',
  'https://opinionplus.opinionplus.workers.dev',
];

// CORS
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  const middleware = cors({
    origin: allowed,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Pin', 'X-CSRF-Token'],
  });
  return middleware(c, next);
});

// Attach user from session
app.use('*', attachUser);

// CSRF protection on state-changing requests
app.use('*', csrfProtection);

// Rate limiting on auth endpoints
app.use('/auth/*', async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const limiter = createRateLimiter(c.env.DB, 60, 5);
  const allowed = await limiter(ip, 'auth');
  if (!allowed) return c.json({ error: 'Too many attempts. Try again later.' }, 429);
  await next();
});

// Rate limiting on SMS endpoints
app.use('/sms/*', async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const limiter = createRateLimiter(c.env.DB, 60, 10);
  const allowed = await limiter(ip, 'sms');
  if (!allowed) return c.json({ error: 'Rate limit exceeded.' }, 429);
  await next();
});

// Health check
app.get('/', (c) => c.json({ ok: true, service: 'opinionplus-api' }));

// Public API feed (API key auth + rate limited)
app.get('/api/feed', apiKeyAuth, apiLimit, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM stories WHERE author_id = ? AND deleted = 0 AND privacy = "public" ORDER BY created_at DESC LIMIT 100'
  ).bind(user.id).all();
  return c.json({ publisher: user.publisher_name, stories: results });
});

// Routes
app.route('/auth', auth);
app.route('/stories', stories);
app.route('/users', users);
app.route('/uploads', uploads);
app.route('/admin', admin);
app.route('/keys', keys);
app.route('/sms', sms);
app.route('/payments', payments);
app.route('/partner', partner);

// 404
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Something went wrong.' }, 500);
});

export default app;