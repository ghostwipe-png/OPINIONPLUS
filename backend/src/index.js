import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { XMLParser } from 'fast-xml-parser';
import { attachUser, csrfProtection } from './middleware/auth.js';
import { apiKeyAuth } from './middleware/apiKey.js';
import { apiLimit } from './middleware/apiLimit.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { createDB } from './utils/db.js';
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
import polls from './routes/polls.js';

const app = new Hono();

const ALLOWED_ORIGINS = [
  'https://www.opinionplus.online',
  'https://opinionplus.online',
  'https://opinionplus.opinionplus.workers.dev',
];

function log(level, message, meta = {}) {
  const entry = { level, message, ts: new Date().toISOString(), ...meta };
  if (level === 'error') console.error(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

app.use('*', async (c, next) => {
  const requestId = c.req.header('X-Request-ID') || crypto.randomUUID();
  c.set('requestId', requestId);
  const start = Date.now();
  await next();
  c.res.headers.set('X-Request-ID', requestId);
  log('info', 'request', {
    requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: Date.now() - start,
  });
});

app.use('*', async (c, next) => {
  await next();
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('X-Frame-Options', 'DENY');
  c.res.headers.set('X-XSS-Protection', '1; mode=block');
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.res.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );
  c.res.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "media-src 'self' https:",
      "frame-src 'self' https://accounts.google.com https://www.youtube.com https://player.vimeo.com",
      "connect-src 'self' https://generativelanguage.googleapis.com https://accounts.google.com",
      "frame-ancestors 'none'",
    ].join('; ')
  );
  try {
    if (new URL(c.req.url).protocol === 'https:') {
      c.res.headers.set(
        'Strict-Transport-Security',
        'max-age=63072000; includeSubDomains; preload'
      );
    }
  } catch (e) { /* skip HSTS */ }
});

app.use('*', cors({
  origin: (origin) => ALLOWED_ORIGINS.includes(origin) ? origin : null,
  credentials: true,
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Pin', 'X-CSRF-Token', 'X-Request-ID'],
}));

// Enhanced Edge Caching Middleware for public read endpoints
app.use('*', async (c, next) => {
  await next();
  const contentType = c.res.headers.get('Content-Type') || '';
  const path = c.req.path;
  
  if (/application\/json/.test(contentType) && (path.includes('/trending') || path.includes('/feed'))) {
    c.res.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    c.res.headers.set('CDN-Cache-Control', 'max-age=300');
  } else if (/text\/html|application\/json|application\/javascript/.test(contentType)) {
    if (!c.res.headers.get('CDN-Cache-Control')) {
      c.res.headers.set('CDN-Cache-Control', 'max-age=0, must-revalidate');
    }
  }
});

app.use('*', async (c, next) => {
  try {
    if (c.env?.DB) {
      c.set('db', createDB(c.env.DB, log));
    }
  } catch (e) {
    log('warn', 'db wrapper attach failed', { error: e.message });
  }
  await next();
});

app.use('*', async (c, next) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('__REQUEST_TIMEOUT__')), 25000);
  });
  try {
    await Promise.race([next(), timeout]);
  } catch (e) {
    if (e && e.message === '__REQUEST_TIMEOUT__') {
      log('error', 'request timeout', {
        path: c.req.path,
        method: c.req.method,
        requestId: c.get('requestId'),
      });
      if (!c.finalized) {
        c.res = c.json({ error: 'Request timeout', requestId: c.get('requestId') }, 504);
      }
      return;
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
});

app.use('*', attachUser);
app.use('*', async (c, next) => {
  if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') return await next();
  if (c.req.path === '/subscriptions/subscribe') return await next();
  if (c.req.path.startsWith('/archive/')) return await next();
  if (c.req.path.startsWith('/admin/')) return await next();
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

app.get('/', async (c) => {
  let dbStatus = 'unknown';
  const dbStart = Date.now();
  try {
    await c.env.DB.prepare('SELECT 1').first();
    dbStatus = 'ok';
  } catch (e) {
    dbStatus = 'error';
    log('error', 'health check db failure', { error: e.message });
  }
  return c.json({
    ok: dbStatus === 'ok',
    service: 'opinionplus-api',
    db: dbStatus,
    dbLatencyMs: Date.now() - dbStart,
    requestId: c.get('requestId'),
  });
});

async function safeFirst(env, sql) {
  try {
    return await env.DB.prepare(sql).first();
  } catch (e) {
    return null;
  }
}

app.get('/metrics', async (c) => {
  const user = c.get('user');
  if (!user || (user.role !== 'admin' && user.role !== 'root')) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  try {
    const [usersRow, storiesRow, engagementRow, last24hRow] = await Promise.all([
      safeFirst(c.env, 'SELECT COUNT(*) as count FROM users'),
      safeFirst(c.env, 'SELECT COUNT(*) as count FROM stories WHERE deleted = 0'),
      safeFirst(
        c.env,
        `SELECT
           COALESCE(SUM(json_array_length(likes)), 0) as totalLikes,
           COALESCE(SUM(json_array_length(comments)), 0) as totalComments
         FROM stories WHERE deleted = 0`
      ),
      safeFirst(
        c.env,
        "SELECT COUNT(*) as count FROM stories WHERE deleted = 0 AND created_at >= datetime('now', '-1 day')"
      ),
    ]);

    return c.json({
      totalUsers: usersRow?.count ?? null,
      totalStories: storiesRow?.count ?? null,
      totalComments: engagementRow?.totalComments ?? null,
      totalLikes: engagementRow?.totalLikes ?? null,
      storiesLast24h: last24hRow?.count ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    log('error', 'metrics endpoint failed', { error: e.message, requestId: c.get('requestId') });
    return c.json({ error: 'Failed to load metrics' }, 500);
  }
});

app.get('/api/feed', apiKeyAuth, apiLimit, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM stories WHERE author_id = ? AND deleted = 0 AND privacy = "public" ORDER BY created_at DESC LIMIT 100'
  ).bind(user.id).all();
  return c.json({ publisher: user.publisher_name, stories: results });
});


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
app.route('/polls', polls);

// ⚡ ADVANCED RSS CONFIGURATION & PARSING
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

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

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
      const pubDate = extractText(raw.pubDate || raw.published || raw.updated || '');

      if (title && link) {
        items.push({ 
          title: cleanText(title), 
          link: link, 
          description: cleanText(fullContent).slice(0, 500), 
          image,
          pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString()
        });
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

async function summarizeWithAI(title, description, sourceName, apiKey) {
  if (!apiKey) return null;
  try {
    const prompt = `Write a 2-3 sentence news summary for this headline. Make it original, journalistic, and engaging. Do NOT copy the original text. Write in your own words as a news reporter for OPINIONPLUS.\n\nHeadline: ${title}\nSource: ${sourceName}\n\nSummary:`;
    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 150, temperature: 0.7 },
        }),
      },
      10000
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
      const response = await fetchWithTimeout(source.url, { 
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 
          'Accept': 'application/rss+xml, application/xml, text/xml' 
        }, 
        cf: { cacheTtl: 300 } 
      }, 15000);
      
      if (!response.ok) { console.error(`News fetch failed (${source.name}): HTTP ${response.status}`); continue; }
      const text = await response.text();
      if (!text || text.length < 100) { console.error(`News fetch failed (${source.name}): Empty response`); continue; }
      items = parseRSSWithFastXml(text);
      console.log(`${source.name}: ${items.length} items parsed`);
    } catch (e) { console.error(`News fetch error (${source.name}): ${e.message}`); continue; }

    for (const item of items.slice(0, MAX_ITEMS_PER_SOURCE)) {
      try {
        const existing = await env.DB.prepare(
          'SELECT id FROM archive WHERE source_url = ? OR (title = ? AND source_name = ?)'
        ).bind(item.link, item.title, source.name).first();
        if (existing) continue;

        const today = new Date().toISOString().slice(0, 10);
        const row = await env.DB.prepare("SELECT COUNT(*) as count FROM archive WHERE date(created_at) = ?").bind(today).first();
        if (parseInt(row?.count || 0) >= MAX_ARCHIVE_PER_DAY) break;
        
        const id = crypto.randomUUID();
        const aiSummary = await summarizeWithAI(item.title, item.description, source.name, env.GEMINI_API_KEY);
        const excerpt = aiSummary ? aiSummary.slice(0, 250) + '...' : (item.description ? cleanText(item.description).slice(0, 250) + '...' : `Read the full article on ${source.name}.`);
        
        const coverImage = item.image || COVER_IMAGES[source.name] || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&h=400&fit=crop';
        
        let body = '';
        if (coverImage) {
          body += `<img src="${coverImage}" alt="${item.title}" style="width:100%;max-height:400px;object-fit:cover;border-radius:4px;margin-bottom:16px;" />`;
        }
        
        body += `<p style="font-size:16px;line-height:1.6;margin-bottom:20px;">${aiSummary || cleanText(item.description) || 'Read the full coverage below.'}</p>`;
        body += `<div style="margin:24px 0;padding:16px;background:#f9f7f3;border-left:4px solid #E0492B;border-radius:2px;">`;
        body += `<p style="margin:0 0 8px;font-size:12px;font-weight:bold;text-transform:uppercase;color:#6b7180;">External Publication</p>`;
        body += `<a href="${item.link}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#1C1917;color:#fff;padding:12px 20px;border-radius:2px;font-size:13px;font-weight:bold;text-decoration:none;box-shadow:0 1px 3px rgba(0,0,0,0.1);">Read Full Article on ${source.name} →</a>`;
        body += `</div>`;

        body += injectAffiliateLinks(body);

        await env.DB.prepare("INSERT INTO archive (id, source_name, source_url, title, excerpt, body, cover_image, type, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'news', 'pending', ?)")
          .bind(id, source.name, item.link, item.title, excerpt, body, coverImage, item.pubDate)
          .run();
          
        insertedFromSource++; 
        totalInserted++;
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

async function runRetentionCleanup(env) {
  const results = { archiveApproved: 0, archiveRejected: 0, searchHistory: 0, rateLimits: 0 };
  try {
    const r = await env.DB.prepare("DELETE FROM archive WHERE status = 'approved' AND reviewed_at < datetime('now', '-30 days')").run();
    results.archiveApproved = r.meta?.changes || 0;
  } catch (e) { log('error', 'cleanup: archive approved failed', { error: e.message }); }
  try {
    const r = await env.DB.prepare("DELETE FROM archive WHERE status = 'rejected' AND reviewed_at < datetime('now', '-7 days')").run();
    results.archiveRejected = r.meta?.changes || 0;
  } catch (e) { log('error', 'cleanup: archive rejected failed', { error: e.message }); }
  try {
    const r = await env.DB.prepare("DELETE FROM search_history WHERE created_at < datetime('now', '-90 days')").run();
    results.searchHistory = r.meta?.changes || 0;
  } catch (e) { /* optional table */ }
  try {
    const r = await env.DB.prepare("DELETE FROM rate_limits WHERE created_at < datetime('now', '-1 days')").run();
    results.rateLimits = r.meta?.changes || 0;
  } catch (e) { /* optional table */ }
  log('info', 'retention cleanup complete', results);
  return results;
}

app.get('/admin-cleanup', async (c) => {
  const token = c.req.query('token');
  if (token !== c.env.CRON_SECRET) return c.json({ error: 'Unauthorized' }, 401);
  try {
    const results = await runRetentionCleanup(c.env);
    return c.json({ ok: true, ...results });
  } catch (e) {
    return c.json({ ok: false, error: 'Cleanup failed' }, 500);
  }
});

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  const status = err.status || err.statusCode || 500;
  const requestId = c.get('requestId');
  const meta = { error: err.message, status, path: c.req.path, method: c.req.method, requestId };
  
  if (status >= 400 && status < 500) {
    log('warn', 'client error', meta);
    return c.json({ error: err.message || 'Request error.', requestId }, status);
  }
  
  log('error', 'unhandled error', { ...meta, stack: (err.stack || '').slice(0, 500) });
  return c.json({ error: 'Something went wrong.', requestId }, status);
});

async function runCronJob(name, fn) {
  try {
    const result = await fn();
    log('info', 'cron job complete', { job: name, result: result ?? null });
  } catch (e) {
    log('error', 'cron job failed', { job: name, error: e.message });
  }
}

const worker = {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    const jobs = [];

    if (event.cron === '*/30 * * * *') {
      jobs.push(runCronJob('news-aggregation', async () => {
        try {
          const row = await env.DB.prepare(
            "SELECT value FROM platform_settings WHERE key = 'news_enabled'"
          ).first();
          if (row && row.value === 'false') {
            log('info', 'news aggregation skipped', { reason: 'disabled by admin toggle' });
            return { skipped: true };
          }
        } catch (e) {}
        return fetchNews(env);
      }));
    }

    if (event.cron === '*/5 * * * *') {
      jobs.push(runCronJob('publish-scheduled-stories', async () => {
        const storiesModule = await import('./routes/stories.js');
        if (typeof storiesModule.publishScheduledStories === 'function') {
          return await storiesModule.publishScheduledStories(env);
        }
        return null;
      }));
    }

    if (event.cron === '0 3 * * *') {
      jobs.push(runCronJob('retention-cleanup', () => runRetentionCleanup(env)));
    }

    await Promise.allSettled(jobs);
  },
};

export default worker;