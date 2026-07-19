import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { XMLParser } from 'fast-xml-parser';
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
import notifications from './routes/notifications.js';
import subscriptions from './routes/subscriptions.js';
import archive from './routes/archive.js';

const app = new Hono();

const ALLOWED_ORIGINS = [
  'https://www.opinionplus.online',
  'https://opinionplus.online',
  'https://opinionplus.opinionplus.workers.dev',
];

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use('*', cors({
  origin: (origin) => ALLOWED_ORIGINS.includes(origin) ? origin : null,
  credentials: true,
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Pin', 'X-CSRF-Token'],
}));

app.use('*', attachUser);
app.use('*', async (c, next) => {
  if (c.req.path === '/subscriptions/subscribe') return await next();
  if (c.req.path.startsWith('/archive/')) return await next();
  return csrfProtection(c, next);
});

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
app.route('/notifications', notifications);
app.route('/subscriptions', subscriptions);
app.route('/archive', archive);

// ---------------------------------------------------------------------------
// News Aggregator — Archives to private repository
// ---------------------------------------------------------------------------

const NEWS_USER_ID = 'u_newsdesk';
const NEWS_SOURCES = [
  { url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml', name: 'BBC Africa' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', name: 'Al Jazeera' },
  { url: 'https://nation.africa/service/rss/kenya/1954666', name: 'Nation Africa' },
  { url: 'https://www.capitalfm.co.ke/news/feed/', name: 'Capital FM' },
  { url: 'https://www.tuko.co.ke/feed/', name: 'Tuko' },
];
const MAX_ARCHIVE_PER_DAY = 350;
const MAX_ITEMS_PER_SOURCE = 20;

const AFFILIATE_PROGRAMS = {
  jumia: 'https://www.jumia.co.ke/?utm_source=opinionplus&utm_medium=referral',
  kilimall: 'https://www.kilimall.co.ke/?utm_source=opinionplus&utm_medium=referral',
};

const COVER_IMAGES = {
  'BBC Africa': 'https://images.unsplash.com/photo-1523995462485-3d171b5c8fa9?w=800&h=400&fit=crop',
  'Al Jazeera': 'https://images.unsplash.com/photo-1495020689067-958852a7765e?w=800&h=400&fit=crop',
  'Nation Africa': 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800&h=400&fit=crop',
  'Capital FM': 'https://images.unsplash.com/photo-1504711434969-e33886168d6c?w=800&h=400&fit=crop',
  'Tuko': 'https://images.unsplash.com/photo-1503694978374-8a2fa686963a?w=800&h=400&fit=crop',
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) => ['item', 'entry'].includes(name),
});

function parseRSSWithFastXml(text) {
  const items = [];
  try {
    const parsed = xmlParser.parse(text);
    const channel = parsed?.rss?.channel || parsed?.feed || {};
    const rawItems = channel.item || channel.entry || [];
    for (const raw of rawItems) {
      const title = extractText(raw.title);
      const link = extractLink(raw.link);
      const description = extractText(raw.description || raw.summary || raw.content || '');
      const contentEncoded = extractText(raw['content:encoded']) || '';
      const fullContent = contentEncoded || description;
      const image = extractImage(raw, fullContent);
      if (title && link) {
        items.push({ title: cleanText(title), link: link, description: cleanText(fullContent).slice(0, 500), image });
      }
    }
  } catch (e) { console.error('XML parse error:', e.message); }
  return items;
}

function extractText(field) {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (field['#text']) return field['#text'];
  if (Array.isArray(field) && field[0]?.['#text']) return field[0]['#text'];
  return '';
}

function extractLink(field) {
  if (!field) return '';
  if (typeof field === 'string') return field.trim();
  if (field['@_href']) return field['@_href'].trim();
  if (Array.isArray(field) && field[0]?.['@_href']) return field[0]['@_href'].trim();
  return '';
}

function extractImage(raw, fullContent = '') {
  const mediaContent = raw['media:content'];
  if (mediaContent) {
    if (Array.isArray(mediaContent)) { for (const m of mediaContent) { if (m['@_url'] && (!m['@_medium'] || m['@_medium'] === 'image')) return m['@_url']; } }
    else if (mediaContent['@_url']) return mediaContent['@_url'];
  }
  const mediaThumb = raw['media:thumbnail'];
  if (mediaThumb) { if (Array.isArray(mediaThumb) && mediaThumb[0]?.['@_url']) return mediaThumb[0]['@_url']; if (mediaThumb['@_url']) return mediaThumb['@_url']; }
  const enclosure = raw.enclosure;
  if (enclosure) { const enc = Array.isArray(enclosure) ? enclosure[0] : enclosure; if (enc['@_url'] && (!enc['@_type'] || enc['@_type'].startsWith('image/'))) return enc['@_url']; }
  if (fullContent) { const imgMatch = fullContent.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i); if (imgMatch) return imgMatch[1]; }
  const desc = raw.description;
  if (desc) { const text = typeof desc === 'string' ? desc : (desc['#text'] || ''); const imgMatch = text.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i); if (imgMatch) return imgMatch[1]; }
  return null;
}

function cleanText(str) {
  return str.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();
}

function injectAffiliateLinks(html) {
  return html + `<div style="margin-top:16px;padding:12px;background:#f9f7f3;border:1px solid #e5e0d5;border-radius:4px;font-size:13px;"><p style="margin:0 0 8px;color:#6b7180;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Sponsored</p><p style="margin:0 0 8px;"><a href="${AFFILIATE_PROGRAMS.jumia}" target="_blank" rel="nofollow sponsored" style="color:#E0492B;font-weight:600;">🛍️ Shop on Jumia Kenya</a> — best deals online</p><p style="margin:0;"><a href="${AFFILIATE_PROGRAMS.kilimall}" target="_blank" rel="nofollow sponsored" style="color:#E0492B;font-weight:600;">📱 Kilimall</a> — affordable electronics & more</p></div>`;
}

// ---------------------------------------------------------------------------
// AI Summarizer — Gemini Flash (free tier)
// ---------------------------------------------------------------------------
async function summarizeWithAI(title, description, sourceName, apiKey) {
  if (!apiKey) return null;
  
  try {
    const prompt = `Write a 2-3 sentence news summary for this headline. Make it original, journalistic, and engaging. Do NOT copy the original text. Write in your own words as a news reporter for OPINIONPLUS.\n\nHeadline: ${title}\nSource: ${sourceName}\n\nSummary:`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 150, temperature: 0.7 },
        }),
      }
    );

    const data = await response.json();
    const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return summary?.trim() || null;
  } catch (e) {
    console.error('AI summarization error:', e.message);
    return null;
  }
}

async function fetchNews(env) {
  let totalInserted = 0;
  for (const source of NEWS_SOURCES) {
    let items = []; let insertedFromSource = 0;
    try {
      const response = await fetch(source.url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8', 'Accept-Language': 'en-US,en;q=0.5' }, cf: { cacheTtl: 300 } });
      if (!response.ok) { console.error(`News fetch failed (${source.name}): HTTP ${response.status}`); continue; }
      const text = await response.text();
      if (!text || text.length < 100) { console.error(`News fetch failed (${source.name}): Empty response`); continue; }
      items = parseRSSWithFastXml(text);
      console.log(`${source.name}: ${items.length} items parsed`);
    } catch (e) { console.error(`News fetch error (${source.name}): ${e.message}`); continue; }

    for (const item of items.slice(0, MAX_ITEMS_PER_SOURCE)) {
      try {
        const existing = await env.DB.prepare('SELECT id FROM archive WHERE title = ? AND source_name = ?').bind(item.title, source.name).first();
        if (existing) continue;
        const today = new Date().toISOString().slice(0, 10);
        const row = await env.DB.prepare("SELECT COUNT(*) as count FROM archive WHERE date(created_at) = ?").bind(today).first();
        if (parseInt(row?.count || 0) >= MAX_ARCHIVE_PER_DAY) break;

        const id = crypto.randomUUID();
        const aiSummary = await summarizeWithAI(item.title, item.description, source.name, env.GEMINI_API_KEY);
        const excerpt = aiSummary ? aiSummary.slice(0, 250) + '...' : (item.description ? cleanText(item.description).slice(0, 250) + '...' : `Read the full article on ${source.name}.`);
        const coverImage = item.image || COVER_IMAGES[source.name] || null;
        let body = '';
        if (coverImage) body += `<img src="${coverImage}" alt="" style="max-width:100%;border-radius:4px;margin-bottom:12px;" />`;
        body += `<p>${aiSummary || cleanText(item.description) || 'Read the full article below.'}</p>`;
        body += `<p style="font-size:12px;color:#6b7180;">📰 Original source: <a href="${item.link}" target="_blank" rel="noopener" style="color:#E0492B;">${source.name}</a></p>`;
        body = injectAffiliateLinks(body);

        await env.DB.prepare("INSERT INTO archive (id, source_name, source_url, title, excerpt, body, cover_image, type, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'news', 'pending')").bind(id, source.name, item.link, item.title, excerpt, body, coverImage).run();
        insertedFromSource++; totalInserted++;
      } catch (e) { console.error(`News insert error (${source.name}): ${e.message}`); }
    }
    console.log(`${source.name}: ${insertedFromSource} inserted out of ${items.length} parsed`);
  }
  console.log(`News fetch complete: ${totalInserted} total inserted into archive`);
  return totalInserted;
}

app.get('/news-fetch', async (c) => {
  const token = c.req.query('token');
  if (token !== c.env.CRON_SECRET) return c.json({ error: 'Unauthorized' }, 401);
  try { const count = await fetchNews(c.env); return c.json({ ok: true, inserted: count }); }
  catch (e) { return c.json({ ok: false, error: 'News fetch failed' }, 500); }
});

// ---------------------------------------------------------------------------
// 404 & Error handler
// ---------------------------------------------------------------------------

app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => { console.error('Unhandled error:', err.message, err.stack); return c.json({ error: 'Something went wrong.' }, 500); });

const worker = {
  fetch: app.fetch,
  async scheduled(event, env, ctx) { if (event.cron === '*/30 * * * *') { console.log('News cron triggered'); await fetchNews(env); } },
};
export default worker;