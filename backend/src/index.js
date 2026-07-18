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

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

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

app.use('*', attachUser);
app.use('*', csrfProtection);

app.use('/auth/*', async (c, next) => {
  if (c.req.path === '/auth/csrf') return await next();
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const limiter = createRateLimiter(c.env.DB, 60, 10);
  const allowed = await limiter(ip, 'auth');
  if (!allowed) return c.json({ error: 'Too many attempts. Try again later.' }, 429);
  await next();
});

app.use('/sms/*', async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const limiter = createRateLimiter(c.env.DB, 60, 10);
  const allowed = await limiter(ip, 'sms');
  if (!allowed) return c.json({ error: 'Rate limit exceeded.' }, 429);
  await next();
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get('/', (c) => c.json({ ok: true, service: 'opinionplus-api' }));

// ---------------------------------------------------------------------------
// Public API feed
// ---------------------------------------------------------------------------

app.get('/api/feed', apiKeyAuth, apiLimit, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM stories WHERE author_id = ? AND deleted = 0 AND privacy = "public" ORDER BY created_at DESC LIMIT 100'
  ).bind(user.id).all();
  return c.json({ publisher: user.publisher_name, stories: results });
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.route('/auth', auth);
app.route('/stories', stories);
app.route('/users', users);
app.route('/uploads', uploads);
app.route('/admin', admin);
app.route('/keys', keys);
app.route('/sms', sms);
app.route('/payments', payments);
app.route('/partner', partner);

// ---------------------------------------------------------------------------
// News Aggregator — fetches RSS feeds from multiple trusted sources
// ---------------------------------------------------------------------------

const NEWS_USER_ID = 'u_newsdesk';
const NEWS_SOURCES = [
  { url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml', name: 'BBC Africa' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', name: 'Al Jazeera' },
  { url: 'https://nation.africa/service/rss/kenya/1954666', name: 'Nation Africa' },
  { url: 'https://www.capitalfm.co.ke/feed/', name: 'Capital FM' },
  { url: 'https://www.tuko.co.ke/feed/', name: 'Tuko' },
];
const MAX_NEWS_PER_DAY = 30;
const MAX_ITEMS_PER_SOURCE = 3;

function parseRSSItems(xmlText) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xmlText)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const description = extractTag(block, 'description');
    if (title && link) {
      items.push({
        title: stripHtml(title).trim(),
        link: link.trim(),
        description: stripHtml(description).trim().slice(0, 300),
      });
    }
  }
  return items;
}

function extractTag(block, tag) {
  const cdata = block.match(new RegExp(`<${tag}><!\\[CDATA\\[(.*?)\\]\\]><\\/${tag}>`, 'i'));
  if (cdata) return cdata[1];
  const plain = block.match(new RegExp(`<${tag}[^>]*>(.*?)<\\/${tag}>`, 'i'));
  return plain ? plain[1] : '';
}

function stripHtml(str) {
  return str.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

async function fetchNews(env) {
  let totalInserted = 0;

  for (const source of NEWS_SOURCES) {
    let items = [];
    let insertedFromSource = 0;

    try {
      const response = await fetch(source.url, {
        headers: { 'User-Agent': 'OPINIONPLUS/1.0 (news aggregator)' },
        cf: { cacheTtl: 300 },
      });

      if (!response.ok) {
        console.error(`News fetch failed (${source.name}): HTTP ${response.status}`);
        continue;
      }

      const text = await response.text();

      if (!text || text.length < 100) {
        console.error(`News fetch failed (${source.name}): Empty or too short response`);
        continue;
      }

      items = parseRSSItems(text);
      console.log(`${source.name}: ${items.length} items parsed`);

    } catch (e) {
      console.error(`News fetch error (${source.name}): ${e.message}`);
      continue;
    }

    for (const item of items.slice(0, MAX_ITEMS_PER_SOURCE)) {
      try {
        const existing = await env.DB.prepare(
          'SELECT id FROM stories WHERE title = ? AND author_id = ?'
        ).bind(item.title, NEWS_USER_ID).first();
        if (existing) continue;

        const today = new Date().toISOString().slice(0, 10);
        const row = await env.DB.prepare(
          "SELECT COUNT(*) as count FROM stories WHERE author_id = ? AND date(created_at) = ?"
        ).bind(NEWS_USER_ID, today).first();

        if (parseInt(row?.count || 0) >= MAX_NEWS_PER_DAY) {
          console.log(`Daily news limit (${MAX_NEWS_PER_DAY}) reached`);
          break;
        }

        const id = crypto.randomUUID();
        const excerpt = item.description ? item.description + '...' : `Read the full article on ${source.name}.`;
        const body = `<p>${item.description || 'Click below to read the full article.'}</p><p><a href="${item.link}" target="_blank" rel="noopener" style="color:#E0492B;font-weight:600;">Read full article on ${source.name} →</a></p>`;

        await env.DB.prepare(
          "INSERT INTO stories (id, author_id, title, excerpt, body, type, privacy, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'story', 'public', datetime('now'), datetime('now'))"
        ).bind(id, NEWS_USER_ID, item.title, excerpt, body).run();

        insertedFromSource++;
        totalInserted++;
      } catch (e) {
        console.error(`News insert error (${source.name}): ${e.message}`);
      }
    }

    console.log(`${source.name}: ${insertedFromSource} inserted out of ${items.length} parsed`);
  }

  console.log(`News fetch complete: ${totalInserted} total inserted`);
  return totalInserted;
}

app.get('/news-fetch', async (c) => {
  try {
    const count = await fetchNews(c.env);
    return c.json({ ok: true, inserted: count });
  } catch (e) {
    console.error('News fetch route error:', e.message);
    return c.json({ ok: false, error: 'News fetch failed' }, 500);
  }
});

// ---------------------------------------------------------------------------
// 404 & Error handler
// ---------------------------------------------------------------------------

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  console.error('Unhandled error:', err.message, err.stack);
  return c.json({ error: 'Something went wrong.' }, 500);
});

// Wrap Hono app to handle cron triggers
const worker = {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    if (event.cron === '*/30 * * * *') {
      console.log('News cron triggered');
      await fetchNews(env);
    }
  },
};

export default worker;