// backend/src/routes/sponsored-service.js
// Standalone Sponsored Content / Advertising platform for OPINIONPLUS.
// Extracted from ./services.js (see services.js for the NOTE pointing here).
// Mounted at both /sponsored-service (canonical) and /services/sponsored (backward compat).
//
// Runs FREE by default. All Paystack payment code is written and fully functional
// but commented out — see blocks marked "// PAYMENT: Uncomment when ready to charge".

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';

const sponsoredService = new Hono();

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const VALID_STATUSES = ['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'];

const VALID_TARGET_TYPES = ['category', 'region', 'county'];

const VALID_CATEGORIES = [
  'Business', 'Technology', 'Finance', 'Health', 'Real Estate',
  'Education', 'Lifestyle', 'Politics', 'Sports', 'Entertainment',
];

const VALID_REGIONS = [
  'Nairobi', 'Coast', 'Central', 'Eastern', 'Nyanza',
  'Rift Valley', 'Western', 'North Eastern',
];

const VALID_COUNTIES = [
  'Mombasa', 'Kwale', 'Kilifi', 'Tana River', 'Lamu', 'Taita Taveta',
  'Garissa', 'Wajir', 'Mandera', 'Marsabit', 'Isiolo', 'Meru',
  'Tharaka-Nithi', 'Embu', 'Kitui', 'Machakos', 'Makueni', 'Nyandarua',
  'Nyeri', 'Kirinyaga', 'Murang\'a', 'Kiambu', 'Turkana', 'West Pokot',
  'Samburu', 'Trans Nzoia', 'Uasin Gishu', 'Elgeyo-Marakwet', 'Nandi',
  'Baringo', 'Laikipia', 'Nakuru', 'Narok', 'Kajiado', 'Kericho',
  'Bomet', 'Kakamega', 'Vihiga', 'Bungoma', 'Busia', 'Siaya', 'Kisumu',
  'Homa Bay', 'Migori', 'Kisii', 'Nyamira', 'Nairobi',
];

const MAX_CREATIVES_PER_CAMPAIGN = 5;
const MAX_HEADLINE_LENGTH = 500;
const MAX_BODY_LENGTH = 10000;
const MAX_URL_LENGTH = 2048;
const VALID_BANNER_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const VALID_CONVERSION_TYPES = ['page_view', 'signup', 'purchase', 'custom'];

const DEFAULT_DURATION_DAYS = 7;
const DEFAULT_IMPRESSIONS_GOAL = 0;

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS — sanitation & validation
// ═══════════════════════════════════════════════════════════════════════════

function sanitizeString(str, maxLength = 1000) {
  if (typeof str !== 'string') return '';
  // Strip control characters (except common whitespace) to neutralize injection vectors.
  let s = str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  s = s.trim();
  if (s.length > maxLength) s = s.slice(0, maxLength);
  return s;
}

// Escapes HTML-significant characters so stored ad copy can never break out of
// markup when rendered by a client that doesn't itself escape output.
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUrl(url, maxLength = MAX_URL_LENGTH) {
  if (typeof url !== 'string' || !url || url.length > maxLength) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

function isValidBannerUrl(url) {
  if (!isValidUrl(url)) return false;
  try {
    const u = new URL(url);
    const pathLower = u.pathname.toLowerCase();
    return VALID_BANNER_EXTENSIONS.some((ext) => pathLower.endsWith(ext));
  } catch (e) {
    return false;
  }
}

function isValidCounty(county) {
  return typeof county === 'string' && VALID_COUNTIES.includes(county);
}

function isPositiveInt(n) {
  return Number.isInteger(n) && n >= 0;
}

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS — never-crash database wrappers
// ═══════════════════════════════════════════════════════════════════════════
// All queries use numbered parameters (?1, ?2, ?3, ...) per platform convention,
// which avoids binding-order bugs when a query is edited.

async function safeDbRun(db, sql, params = [], context = 'db_run') {
  try {
    const stmt = params.length ? db.prepare(sql).bind(...params) : db.prepare(sql);
    const result = await stmt.run();
    return { ok: true, changes: result?.meta?.changes ?? result?.changes ?? 0, result };
  } catch (e) {
    console.error(JSON.stringify({ kind: 'sponsored_db_error', context, message: e.message }));
    return { ok: false, changes: 0, error: e.message };
  }
}

async function safeDbFirst(db, sql, params = [], fallback = null, context = 'db_first') {
  try {
    const stmt = params.length ? db.prepare(sql).bind(...params) : db.prepare(sql);
    const row = await stmt.first();
    return row === undefined || row === null ? fallback : row;
  } catch (e) {
    console.error(JSON.stringify({ kind: 'sponsored_db_error', context, message: e.message }));
    return fallback;
  }
}

async function safeDbAll(db, sql, params = [], fallback = [], context = 'db_all') {
  try {
    const stmt = params.length ? db.prepare(sql).bind(...params) : db.prepare(sql);
    const { results } = await stmt.all();
    return results || fallback;
  } catch (e) {
    console.error(JSON.stringify({ kind: 'sponsored_db_error', context, message: e.message }));
    return fallback;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS — rate limiting (in-memory, per worker isolate; matches services.js pattern)
// ═══════════════════════════════════════════════════════════════════════════

function makeRateLimiter(limit, windowMs) {
  const hits = new Map();
  return function check(key) {
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    arr.push(now);
    hits.set(key, arr);
    if (hits.size > 5000) {
      for (const [k, v] of hits) {
        if (!v.some((t) => now - t < windowMs)) hits.delete(k);
      }
    }
    return arr.length <= limit;
  };
}

const checkImpressionRateLimit = makeRateLimiter(100, 60 * 1000); // 100/min per IP
const checkClickRateLimit = makeRateLimiter(30, 60 * 1000); // 30/min per IP
const checkConversionRateLimit = makeRateLimiter(20, 60 * 1000); // 20/min per IP

function getClientIp(c) {
  return c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS — ownership & auth
// ═══════════════════════════════════════════════════════════════════════════

function isAdmin(user) {
  return !!user && (user.role === 'admin' || user.role === 'root');
}

// Loads a campaign and verifies the requesting user owns it (or is admin/root).
async function loadOwnedCampaign(c, campaignId) {
  const user = c.get('user');
  const campaign = await safeDbFirst(
    c.env.DB,
    'SELECT * FROM sponsored_campaigns WHERE id = ?1',
    [campaignId],
    null,
    'load_owned_campaign'
  );
  if (!campaign) return { error: 'Campaign not found.', status: 404 };
  const ownsIt = campaign.user_id === user.id || (user.email && campaign.user_email === user.email);
  if (!ownsIt && !isAdmin(user)) return { error: 'Unauthorized.', status: 403 };
  return { campaign };
}

async function logEvent(action, payload = {}) {
  try {
    console.log(JSON.stringify({ kind: 'sponsored_service_log', action, timestamp: new Date().toISOString(), ...payload }));
  } catch (e) { /* never let logging crash a request */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS — fire-and-forget tracking writers
// ═══════════════════════════════════════════════════════════════════════════

async function logSponsoredImpression(db, { campaignId, creativeId, region, county }) {
  const today = new Date().toISOString().slice(0, 10);

  await safeDbRun(
    db,
    'UPDATE sponsored_campaigns SET impressions_served = impressions_served + 1, updated_at = datetime("now") WHERE id = ?1',
    [campaignId],
    'impression_campaign_increment'
  );

  await safeDbRun(
    db,
    `INSERT INTO sponsored_analytics_daily (id, campaign_id, date, impressions, clicks, ctr)
     VALUES (?1, ?2, ?3, 1, 0, 0)
     ON CONFLICT(campaign_id, date) DO UPDATE SET
       impressions = impressions + 1,
       ctr = CASE WHEN (impressions + 1) > 0 THEN CAST(clicks AS REAL) / (impressions + 1) * 100 ELSE 0 END`,
    [crypto.randomUUID(), campaignId, today],
    'impression_daily_upsert'
  );

  if (region || county) {
    await safeDbRun(
      db,
      `INSERT INTO sponsored_geo_analytics (id, campaign_id, date, region, county, impressions, clicks)
       VALUES (?1, ?2, ?3, ?4, ?5, 1, 0)
       ON CONFLICT(campaign_id, date, region, county) DO UPDATE SET impressions = impressions + 1`,
      [crypto.randomUUID(), campaignId, today, region || null, county || null],
      'impression_geo_upsert'
    );
  }

  if (creativeId) {
    await safeDbRun(
      db,
      'UPDATE sponsored_creatives SET impressions_served = impressions_served + 1 WHERE id = ?1 AND campaign_id = ?2',
      [creativeId, campaignId],
      'impression_creative_increment'
    );
  }
}

async function logSponsoredClick(db, { campaignId, creativeId, region, county }) {
  const today = new Date().toISOString().slice(0, 10);

  await safeDbRun(
    db,
    'UPDATE sponsored_campaigns SET clicks = clicks + 1, updated_at = datetime("now") WHERE id = ?1',
    [campaignId],
    'click_campaign_increment'
  );

  await safeDbRun(
    db,
    `INSERT INTO sponsored_analytics_daily (id, campaign_id, date, impressions, clicks, ctr)
     VALUES (?1, ?2, ?3, 0, 1, 0)
     ON CONFLICT(campaign_id, date) DO UPDATE SET
       clicks = clicks + 1,
       ctr = CASE WHEN impressions > 0 THEN CAST((clicks + 1) AS REAL) / impressions * 100 ELSE 0 END`,
    [crypto.randomUUID(), campaignId, today],
    'click_daily_upsert'
  );

  if (region || county) {
    await safeDbRun(
      db,
      `INSERT INTO sponsored_geo_analytics (id, campaign_id, date, region, county, impressions, clicks)
       VALUES (?1, ?2, ?3, ?4, ?5, 0, 1)
       ON CONFLICT(campaign_id, date, region, county) DO UPDATE SET clicks = clicks + 1`,
      [crypto.randomUUID(), campaignId, today, region || null, county || null],
      'click_geo_upsert'
    );
  }

  if (creativeId) {
    await safeDbRun(
      db,
      'UPDATE sponsored_creatives SET clicks = clicks + 1 WHERE id = ?1 AND campaign_id = ?2',
      [creativeId, campaignId],
      'click_creative_increment'
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLER — belt-and-braces on top of per-route try/catch
// ═══════════════════════════════════════════════════════════════════════════

sponsoredService.onError((err, c) => {
  console.error(JSON.stringify({ kind: 'sponsored_service_unhandled_error', path: c.req.path, message: err?.message }));
  return c.json({ error: 'Something went wrong in the sponsored content service.' }, 500);
});

// ═══════════════════════════════════════════════════════════════════════════
// PACKAGES
// ═══════════════════════════════════════════════════════════════════════════

sponsoredService.get('/packages', async (c) => {
  try {
    const results = await safeDbAll(
      c.env.DB,
      'SELECT * FROM sponsored_packages WHERE is_active = ?1',
      [1],
      [],
      'list_packages'
    );
    const packages = results.map((pkg) => ({
      ...pkg,
      features: pkg.features ? (() => { try { return JSON.parse(pkg.features); } catch (e) { return undefined; } })() : undefined,
    }));
    return c.json({ packages });
  } catch (e) {
    return c.json({ packages: [], error: 'Failed to load packages.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENT — FREE MODE ACTIVE. Paystack code below is complete but commented out.
// ═══════════════════════════════════════════════════════════════════════════

sponsoredService.post('/pay', requireAuth, async (c) => {
  const user = c.get('user');
  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid request body.' }, 400); }

  const packageId = typeof body?.packageId === 'string' ? body.packageId : null;
  if (!packageId) return c.json({ error: 'packageId is required.' }, 400);

  const pkg = await safeDbFirst(
    c.env.DB,
    'SELECT * FROM sponsored_packages WHERE id = ?1 AND is_active = ?2',
    [packageId, 1],
    null,
    'pay_lookup_package'
  );
  if (!pkg) return c.json({ error: 'Invalid or inactive package.' }, 400);

  const reference = `sponsored_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  // FREE MODE: grant the package immediately, no charge, no gateway round-trip.
  await logEvent('sponsored_package_granted_free', { userId: user.id, packageId, reference });
  return c.json({
    free: true,
    status: 'active',
    reference,
    packageId,
    duration_days: pkg.duration_days ?? DEFAULT_DURATION_DAYS,
    impressions_goal: pkg.impressions_goal ?? DEFAULT_IMPRESSIONS_GOAL,
    message: 'Sponsored package granted for free — payment is currently disabled on this platform.',
  });

  // PAYMENT: Uncomment when ready to charge for sponsored packages
  //
  // const secretKey = c.env.PAYSTACK_SECRET_KEY;
  // if (!secretKey) return c.json({ error: 'Payment gateway not configured.' }, 500);
  // const customerEmail = isValidEmail(user.email) ? user.email : 'support@opinionplus.online';
  // const callbackUrl = `${new URL(c.req.url).origin}/sponsored-service/campaigns?payment=success`;
  //
  // try {
  //   const response = await fetch('https://api.paystack.co/transaction/initialize', {
  //     method: 'POST',
  //     headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
  //     body: JSON.stringify({
  //       email: customerEmail,
  //       amount: pkg.price_kes_cents,
  //       reference,
  //       currency: 'KES',
  //       callback_url: callbackUrl,
  //       metadata: { userId: user.id, packageId },
  //     }),
  //   });
  //   const data = await response.json();
  //   if (!data.status) return c.json({ error: data.message || 'Payment initialization failed.' }, 502);
  //   return c.json({ authorization_url: data.data.authorization_url, reference, amount: pkg.price_kes_cents });
  // } catch (e) {
  //   return c.json({ error: 'Internal server error during payment initialization.' }, 500);
  // }
});

sponsoredService.get('/verify/:reference', requireAuth, async (c) => {
  const reference = c.req.param('reference');

  // FREE MODE: nothing to verify — treat every reference issued by /pay as active.
  return c.json({ status: 'active', free: true, reference });

  // PAYMENT: Uncomment when ready to charge for sponsored packages
  //
  // const user = c.get('user');
  // const secretKey = c.env.PAYSTACK_SECRET_KEY;
  // if (!secretKey) return c.json({ error: 'Gateway not configured.' }, 500);
  // try {
  //   const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
  //     headers: { Authorization: `Bearer ${secretKey}` },
  //   });
  //   const data = await response.json();
  //   if (data.status && data.data.status === 'success') {
  //     return c.json({ status: 'active', serviceType: 'sponsored', reference });
  //   }
  //   return c.json({ error: 'Payment not successful yet.', status: data.data?.status }, 400);
  // } catch (e) {
  //   return c.json({ error: 'Verification failed.' }, 500);
  // }
});

// ═══════════════════════════════════════════════════════════════════════════
// CHECK — does the user have any live (active/scheduled/paused) sponsorship?
// ═══════════════════════════════════════════════════════════════════════════

sponsoredService.get('/check', requireAuth, async (c) => {
  const user = c.get('user');
  const campaign = await safeDbFirst(
    c.env.DB,
    `SELECT * FROM sponsored_campaigns
     WHERE (user_id = ?1 OR user_email = ?2) AND status IN ('active', 'scheduled', 'paused')
     ORDER BY created_at DESC LIMIT 1`,
    [user.id, user.email],
    null,
    'check_active_campaign'
  );
  if (!campaign) return c.json({ active: false });
  return c.json({
    active: true,
    campaignId: campaign.id,
    status: campaign.status,
    packageId: campaign.package_id,
    createdAt: campaign.created_at,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CAMPAIGN CRUD
// ═══════════════════════════════════════════════════════════════════════════

sponsoredService.get('/campaigns', requireAuth, async (c) => {
  const user = c.get('user');
  const page = clampInt(c.req.query('page'), 1, 100000, 1);
  const limit = clampInt(c.req.query('limit'), 1, 50, 20);
  const offset = (page - 1) * limit;
  const statusFilter = c.req.query('status');

  try {
    const whereClauses = ['(user_id = ?1 OR user_email = ?2)'];
    const whereValues = [user.id, user.email];
    if (statusFilter && VALID_STATUSES.includes(statusFilter)) {
      whereClauses.push(`status = ?${whereValues.length + 1}`);
      whereValues.push(statusFilter);
    }
    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    const totalRow = await safeDbFirst(
      c.env.DB,
      `SELECT COUNT(*) as count FROM sponsored_campaigns ${whereSql}`,
      whereValues,
      { count: 0 },
      'list_campaigns_count'
    );
    const total = totalRow?.count || 0;

    const limitParamIdx = whereValues.length + 1;
    const offsetParamIdx = whereValues.length + 2;
    const campaigns = await safeDbAll(
      c.env.DB,
      `SELECT * FROM sponsored_campaigns ${whereSql} ORDER BY created_at DESC LIMIT ?${limitParamIdx} OFFSET ?${offsetParamIdx}`,
      [...whereValues, limit, offset],
      [],
      'list_campaigns'
    );

    return c.json({ campaigns, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (e) {
    return c.json({ campaigns: [], total: 0, page: 1, totalPages: 1, error: 'Failed to load campaigns.' }, 500);
  }
});

sponsoredService.post('/campaigns', requireAuth, async (c) => {
  const user = c.get('user');
  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }

  const headlineRaw = body?.headline;
  const bodyRaw = body?.body;
  const ctaUrlRaw = body?.ctaUrl;
  const bannerUrlRaw = body?.bannerUrl;
  const packageId = typeof body?.packageId === 'string' ? body.packageId : null;
  const targeting = body?.targeting && typeof body.targeting === 'object' ? body.targeting : null;
  const scheduledStartAt = body?.scheduledStartAt;

  if (typeof headlineRaw !== 'string' || !headlineRaw.trim()) return c.json({ error: 'headline is required.' }, 400);
  if (typeof bodyRaw !== 'string' || !bodyRaw.trim()) return c.json({ error: 'body is required.' }, 400);
  if (!isValidUrl(ctaUrlRaw, MAX_URL_LENGTH)) return c.json({ error: 'ctaUrl must be a valid http(s) URL.' }, 400);
  if (bannerUrlRaw && !isValidBannerUrl(bannerUrlRaw)) {
    return c.json({ error: `bannerUrl must be a valid image URL (${VALID_BANNER_EXTENSIONS.join(', ')}).` }, 400);
  }
  if (!packageId) return c.json({ error: 'packageId is required.' }, 400);

  let scheduledStartIso = null;
  if (scheduledStartAt) {
    const t = new Date(scheduledStartAt).getTime();
    if (Number.isNaN(t)) return c.json({ error: 'scheduledStartAt must be a valid ISO datetime.' }, 400);
    scheduledStartIso = new Date(t).toISOString();
  }

  const pkg = await safeDbFirst(
    c.env.DB,
    'SELECT * FROM sponsored_packages WHERE id = ?1 AND is_active = ?2',
    [packageId, 1],
    null,
    'create_campaign_lookup_package'
  );
  if (!pkg) return c.json({ error: 'Invalid or inactive package.' }, 400);

  const durationDays = Number.isInteger(pkg.duration_days) && pkg.duration_days > 0 ? pkg.duration_days : DEFAULT_DURATION_DAYS;
  const impressionsGoal = Number.isInteger(pkg.impressions_goal) ? pkg.impressions_goal : DEFAULT_IMPRESSIONS_GOAL;

  const headline = escapeHtml(sanitizeString(headlineRaw, MAX_HEADLINE_LENGTH));
  const contentBody = escapeHtml(sanitizeString(bodyRaw, MAX_BODY_LENGTH));
  const ctaUrl = sanitizeString(ctaUrlRaw, MAX_URL_LENGTH);
  const bannerUrl = bannerUrlRaw ? sanitizeString(bannerUrlRaw, MAX_URL_LENGTH) : null;

  const now = Date.now();
  const isFuture = scheduledStartIso && new Date(scheduledStartIso).getTime() > now;
  const startMs = isFuture ? new Date(scheduledStartIso).getTime() : now;
  const status = isFuture ? 'scheduled' : 'active';
  const startedAt = isFuture ? null : new Date(now).toISOString();
  const endsAt = new Date(startMs + durationDays * 24 * 60 * 60 * 1000).toISOString();

  const campaignId = crypto.randomUUID();

  const insert = await safeDbRun(
    c.env.DB,
    `INSERT INTO sponsored_campaigns (
      id, order_id, user_id, user_email, package_id, headline, body, cta_url, banner_url,
      status, scheduled_start_at, started_at, ends_at, duration_days, impressions_goal,
      impressions_served, clicks, budget_kes_cents
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, 0, 0, 0)`,
    [
      campaignId, null, user.id, user.email || null, packageId, headline, contentBody, ctaUrl, bannerUrl,
      status, scheduledStartIso, startedAt, endsAt, durationDays, impressionsGoal,
    ],
    'create_campaign'
  );
  if (!insert.ok) return c.json({ error: 'Failed to create campaign.' }, 500);

  if (targeting) {
    await writeTargeting(c.env.DB, campaignId, targeting);
  }

  await logEvent('sponsored_campaign_created', { campaignId, userId: user.id });
  return c.json({
    campaign: {
      id: campaignId, status, headline, body: contentBody, cta_url: ctaUrl, banner_url: bannerUrl,
      scheduled_start_at: scheduledStartIso, started_at: startedAt, ends_at: endsAt,
      duration_days: durationDays, impressions_goal: impressionsGoal,
    },
  });
});

sponsoredService.get('/campaigns/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  const { campaign, error, status } = await loadOwnedCampaign(c, id);
  if (error) return c.json({ error }, status);

  const [creatives, targeting] = await Promise.all([
    safeDbAll(c.env.DB, 'SELECT * FROM sponsored_creatives WHERE campaign_id = ?1 ORDER BY created_at ASC', [id], [], 'get_campaign_creatives'),
    safeDbAll(c.env.DB, 'SELECT * FROM sponsored_targeting WHERE campaign_id = ?1', [id], [], 'get_campaign_targeting'),
  ]);

  return c.json({ campaign: { ...campaign, creatives, targeting } });
});

sponsoredService.patch('/campaigns/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  const { error, status } = await loadOwnedCampaign(c, id);
  if (error) return c.json({ error }, status);

  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }

  const updates = [];
  const values = [];
  let paramIdx = 1;

  if (Object.prototype.hasOwnProperty.call(body, 'headline')) {
    if (typeof body.headline !== 'string' || !body.headline.trim()) return c.json({ error: 'headline cannot be empty.' }, 400);
    updates.push(`headline = ?${paramIdx++}`);
    values.push(escapeHtml(sanitizeString(body.headline, MAX_HEADLINE_LENGTH)));
  }
  if (Object.prototype.hasOwnProperty.call(body, 'body')) {
    if (typeof body.body !== 'string' || !body.body.trim()) return c.json({ error: 'body cannot be empty.' }, 400);
    updates.push(`body = ?${paramIdx++}`);
    values.push(escapeHtml(sanitizeString(body.body, MAX_BODY_LENGTH)));
  }
  if (Object.prototype.hasOwnProperty.call(body, 'ctaUrl')) {
    if (!isValidUrl(body.ctaUrl, MAX_URL_LENGTH)) return c.json({ error: 'ctaUrl must be a valid http(s) URL.' }, 400);
    updates.push(`cta_url = ?${paramIdx++}`);
    values.push(sanitizeString(body.ctaUrl, MAX_URL_LENGTH));
  }
  if (Object.prototype.hasOwnProperty.call(body, 'bannerUrl')) {
    if (body.bannerUrl && !isValidBannerUrl(body.bannerUrl)) {
      return c.json({ error: `bannerUrl must be a valid image URL (${VALID_BANNER_EXTENSIONS.join(', ')}).` }, 400);
    }
    updates.push(`banner_url = ?${paramIdx++}`);
    values.push(body.bannerUrl ? sanitizeString(body.bannerUrl, MAX_URL_LENGTH) : null);
  }
  if (updates.length === 0 && !body.targeting) {
    return c.json({ error: 'No valid fields to update.' }, 400);
  }

  if (updates.length > 0) {
    values.push(id);
    const update = await safeDbRun(
      c.env.DB,
      `UPDATE sponsored_campaigns SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?${paramIdx}`,
      values,
      'update_campaign'
    );
    if (!update.ok) return c.json({ error: 'Failed to update campaign.' }, 500);
  }

  if (body.targeting && typeof body.targeting === 'object') {
    await writeTargeting(c.env.DB, id, body.targeting);
  }

  return c.json({ ok: true });
});

sponsoredService.delete('/campaigns/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  const { error, status } = await loadOwnedCampaign(c, id);
  if (error) return c.json({ error }, status);

  const result = await safeDbRun(
    c.env.DB,
    "UPDATE sponsored_campaigns SET status = 'cancelled', ends_at = datetime('now'), updated_at = datetime('now') WHERE id = ?1",
    [id],
    'cancel_campaign'
  );
  if (!result.ok) return c.json({ error: 'Failed to cancel campaign.' }, 500);
  return c.json({ ok: true });
});

// Helper shared by POST /campaigns and PATCH /campaigns/:id and PUT targeting.
async function writeTargeting(db, campaignId, targeting) {
  const rows = [];
  const categories = Array.isArray(targeting.categories) ? targeting.categories : [];
  const regions = Array.isArray(targeting.regions) ? targeting.regions : [];
  const counties = Array.isArray(targeting.counties) ? targeting.counties : [];

  for (const cat of categories) {
    if (VALID_CATEGORIES.includes(cat)) rows.push(['category', cat]);
  }
  for (const region of regions) {
    if (VALID_REGIONS.includes(region)) rows.push(['region', region]);
  }
  for (const county of counties) {
    if (isValidCounty(county)) rows.push(['county', county]);
  }

  await safeDbRun(db, 'DELETE FROM sponsored_targeting WHERE campaign_id = ?1', [campaignId], 'targeting_delete_existing');

  for (const [targetType, targetValue] of rows) {
    await safeDbRun(
      db,
      'INSERT INTO sponsored_targeting (id, campaign_id, target_type, target_value) VALUES (?1, ?2, ?3, ?4)',
      [crypto.randomUUID(), campaignId, targetType, targetValue],
      'targeting_insert'
    );
  }
  return rows.length;
}

// ═══════════════════════════════════════════════════════════════════════════
// CAMPAIGN CONTROL
// ═══════════════════════════════════════════════════════════════════════════

sponsoredService.post('/campaigns/:id/pause', requireAuth, async (c) => {
  const id = c.req.param('id');
  const { campaign, error, status } = await loadOwnedCampaign(c, id);
  if (error) return c.json({ error }, status);
  if (campaign.status !== 'active') return c.json({ error: `Cannot pause a campaign with status '${campaign.status}'.` }, 400);

  const result = await safeDbRun(
    c.env.DB,
    "UPDATE sponsored_campaigns SET status = 'paused', paused_at = datetime('now'), updated_at = datetime('now') WHERE id = ?1",
    [id],
    'pause_campaign'
  );
  if (!result.ok) return c.json({ error: 'Failed to pause campaign.' }, 500);
  return c.json({ ok: true, status: 'paused' });
});

sponsoredService.post('/campaigns/:id/resume', requireAuth, async (c) => {
  const id = c.req.param('id');
  const { campaign, error, status } = await loadOwnedCampaign(c, id);
  if (error) return c.json({ error }, status);
  if (campaign.status !== 'paused') return c.json({ error: `Cannot resume a campaign with status '${campaign.status}'.` }, 400);

  // Extend ends_at by however long the campaign was paused, so the sponsor
  // doesn't lose paid-for runtime while paused.
  let newEndsAt = campaign.ends_at;
  try {
    if (campaign.paused_at && campaign.ends_at) {
      const pausedMs = Date.now() - new Date(campaign.paused_at).getTime();
      newEndsAt = new Date(new Date(campaign.ends_at).getTime() + Math.max(0, pausedMs)).toISOString();
    }
  } catch (e) { /* fall back to existing ends_at */ }

  const result = await safeDbRun(
    c.env.DB,
    "UPDATE sponsored_campaigns SET status = 'active', paused_at = NULL, ends_at = ?1, updated_at = datetime('now') WHERE id = ?2",
    [newEndsAt, id],
    'resume_campaign'
  );
  if (!result.ok) return c.json({ error: 'Failed to resume campaign.' }, 500);
  return c.json({ ok: true, status: 'active', ends_at: newEndsAt });
});

sponsoredService.post('/campaigns/:id/start', requireAuth, async (c) => {
  const user = c.get('user');
  if (!isAdmin(user)) return c.json({ error: 'Admin access required.' }, 403);

  const id = c.req.param('id');
  const campaign = await safeDbFirst(c.env.DB, 'SELECT * FROM sponsored_campaigns WHERE id = ?1', [id], null, 'admin_start_lookup');
  if (!campaign) return c.json({ error: 'Campaign not found.' }, 404);
  if (!['draft', 'scheduled'].includes(campaign.status)) {
    return c.json({ error: `Cannot manually start a campaign with status '${campaign.status}'.` }, 400);
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + (campaign.duration_days || DEFAULT_DURATION_DAYS) * 24 * 60 * 60 * 1000).toISOString();

  const result = await safeDbRun(
    c.env.DB,
    "UPDATE sponsored_campaigns SET status = 'active', started_at = ?1, ends_at = ?2, updated_at = datetime('now') WHERE id = ?3",
    [now.toISOString(), endsAt, id],
    'admin_start_campaign'
  );
  if (!result.ok) return c.json({ error: 'Failed to start campaign.' }, 500);
  await logEvent('sponsored_campaign_admin_started', { campaignId: id, adminId: user.id });
  return c.json({ ok: true, status: 'active', started_at: now.toISOString(), ends_at: endsAt });
});

// ═══════════════════════════════════════════════════════════════════════════
// CAMPAIGN ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

sponsoredService.get('/campaigns/:id/stats', requireAuth, async (c) => {
  const id = c.req.param('id');
  const { campaign, error, status } = await loadOwnedCampaign(c, id);
  if (error) return c.json({ error }, status);

  const [daily, geo] = await Promise.all([
    safeDbAll(c.env.DB, 'SELECT date, impressions, clicks, ctr FROM sponsored_analytics_daily WHERE campaign_id = ?1 ORDER BY date DESC LIMIT 30', [id], [], 'stats_daily'),
    safeDbAll(c.env.DB, 'SELECT region, county, SUM(impressions) as impressions, SUM(clicks) as clicks FROM sponsored_geo_analytics WHERE campaign_id = ?1 GROUP BY region, county', [id], [], 'stats_geo'),
  ]);

  const impressionsServed = campaign.impressions_served || 0;
  const clicks = campaign.clicks || 0;
  const ctr = impressionsServed > 0 ? Number(((clicks / impressionsServed) * 100).toFixed(2)) : 0;

  let daysRemaining = 0;
  let daysTotal = campaign.duration_days || 0;
  try {
    if (campaign.ends_at) {
      daysRemaining = Math.max(0, Math.ceil((new Date(campaign.ends_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
    }
  } catch (e) { /* leave daysRemaining at 0 */ }

  const progressPercent = campaign.impressions_goal > 0
    ? Number(Math.min(100, (impressionsServed / campaign.impressions_goal) * 100).toFixed(1))
    : 0;

  return c.json({
    impressions_served: impressionsServed,
    clicks,
    ctr,
    days_remaining: daysRemaining,
    days_total: daysTotal,
    impressions_goal: campaign.impressions_goal || 0,
    progress_percent: progressPercent,
    daily,
    geo,
  });
});

sponsoredService.get('/campaigns/:id/stats/daily', requireAuth, async (c) => {
  const id = c.req.param('id');
  const { error, status } = await loadOwnedCampaign(c, id);
  if (error) return c.json({ error }, status);
  const daily = await safeDbAll(
    c.env.DB,
    'SELECT date, impressions, clicks, ctr FROM sponsored_analytics_daily WHERE campaign_id = ?1 ORDER BY date DESC LIMIT 30',
    [id], [], 'stats_daily_only'
  );
  return c.json({ daily });
});

sponsoredService.get('/campaigns/:id/stats/geo', requireAuth, async (c) => {
  const id = c.req.param('id');
  const { error, status } = await loadOwnedCampaign(c, id);
  if (error) return c.json({ error }, status);
  const geo = await safeDbAll(
    c.env.DB,
    'SELECT region, county, SUM(impressions) as impressions, SUM(clicks) as clicks FROM sponsored_geo_analytics WHERE campaign_id = ?1 GROUP BY region, county',
    [id], [], 'stats_geo_only'
  );
  return c.json({ geo });
});

// ═══════════════════════════════════════════════════════════════════════════
// CREATIVES (A/B TESTING)
// ═══════════════════════════════════════════════════════════════════════════

sponsoredService.get('/campaigns/:id/creatives', requireAuth, async (c) => {
  const id = c.req.param('id');
  const { error, status } = await loadOwnedCampaign(c, id);
  if (error) return c.json({ error }, status);
  const creatives = await safeDbAll(
    c.env.DB, 'SELECT * FROM sponsored_creatives WHERE campaign_id = ?1 ORDER BY created_at ASC', [id], [], 'list_creatives'
  );
  return c.json({ creatives });
});

sponsoredService.post('/campaigns/:id/creatives', requireAuth, async (c) => {
  const id = c.req.param('id');
  const { error, status } = await loadOwnedCampaign(c, id);
  if (error) return c.json({ error }, status);

  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }
  const { headline, body: creativeBody, ctaUrl, bannerUrl, isControl } = body || {};

  if (typeof headline !== 'string' || !headline.trim()) return c.json({ error: 'headline is required.' }, 400);
  if (ctaUrl && !isValidUrl(ctaUrl, MAX_URL_LENGTH)) return c.json({ error: 'ctaUrl must be a valid http(s) URL.' }, 400);
  if (bannerUrl && !isValidBannerUrl(bannerUrl)) {
    return c.json({ error: `bannerUrl must be a valid image URL (${VALID_BANNER_EXTENSIONS.join(', ')}).` }, 400);
  }

  const countRow = await safeDbFirst(
    c.env.DB, 'SELECT COUNT(*) as count FROM sponsored_creatives WHERE campaign_id = ?1', [id], { count: 0 }, 'creatives_count'
  );
  if ((countRow?.count || 0) >= MAX_CREATIVES_PER_CAMPAIGN) {
    return c.json({ error: `A campaign can have at most ${MAX_CREATIVES_PER_CAMPAIGN} creatives.` }, 400);
  }

  const creativeId = crypto.randomUUID();
  const willBeControl = isControl ? 1 : 0;

  if (willBeControl) {
    await safeDbRun(c.env.DB, 'UPDATE sponsored_creatives SET is_control = 0 WHERE campaign_id = ?1', [id], 'unset_prior_control');
  }

  const insert = await safeDbRun(
    c.env.DB,
    `INSERT INTO sponsored_creatives (id, campaign_id, headline, body, cta_url, banner_url, is_control, impressions_served, clicks)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, 0)`,
    [
      creativeId, id,
      escapeHtml(sanitizeString(headline, MAX_HEADLINE_LENGTH)),
      creativeBody ? escapeHtml(sanitizeString(creativeBody, MAX_BODY_LENGTH)) : null,
      ctaUrl ? sanitizeString(ctaUrl, MAX_URL_LENGTH) : null,
      bannerUrl ? sanitizeString(bannerUrl, MAX_URL_LENGTH) : null,
      willBeControl,
    ],
    'insert_creative'
  );
  if (!insert.ok) return c.json({ error: 'Failed to add creative.' }, 500);

  return c.json({ creative: { id: creativeId, headline, body: creativeBody, cta_url: ctaUrl, banner_url: bannerUrl, is_control: willBeControl } });
});

sponsoredService.delete('/campaigns/:id/creatives/:creativeId', requireAuth, async (c) => {
  const id = c.req.param('id');
  const creativeId = c.req.param('creativeId');
  const { error, status } = await loadOwnedCampaign(c, id);
  if (error) return c.json({ error }, status);

  const result = await safeDbRun(
    c.env.DB, 'DELETE FROM sponsored_creatives WHERE id = ?1 AND campaign_id = ?2', [creativeId, id], 'delete_creative'
  );
  if (!result.ok) return c.json({ error: 'Failed to remove creative.' }, 500);
  return c.json({ ok: true });
});

sponsoredService.post('/campaigns/:id/creatives/:creativeId/set-control', requireAuth, async (c) => {
  const id = c.req.param('id');
  const creativeId = c.req.param('creativeId');
  const { error, status } = await loadOwnedCampaign(c, id);
  if (error) return c.json({ error }, status);

  const creative = await safeDbFirst(
    c.env.DB, 'SELECT * FROM sponsored_creatives WHERE id = ?1 AND campaign_id = ?2', [creativeId, id], null, 'set_control_lookup'
  );
  if (!creative) return c.json({ error: 'Creative not found.' }, 404);

  await safeDbRun(c.env.DB, 'UPDATE sponsored_creatives SET is_control = 0 WHERE campaign_id = ?1', [id], 'set_control_unset_others');
  const result = await safeDbRun(
    c.env.DB, 'UPDATE sponsored_creatives SET is_control = 1 WHERE id = ?1 AND campaign_id = ?2', [creativeId, id], 'set_control_apply'
  );
  if (!result.ok) return c.json({ error: 'Failed to set control creative.' }, 500);
  return c.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSION TRACKING
// ═══════════════════════════════════════════════════════════════════════════

sponsoredService.post('/track/conversion', async (c) => {
  const ip = getClientIp(c);
  if (!checkConversionRateLimit(ip)) return c.json({ error: 'Too many requests.' }, 429);

  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ ok: true }); } // pixel calls may send no body

  const campaignId = typeof body?.campaign_id === 'string' ? body.campaign_id : null;
  if (!campaignId) return c.json({ error: 'campaign_id is required.' }, 400);

  const conversionType = VALID_CONVERSION_TYPES.includes(body?.conversion_type) ? body.conversion_type : 'page_view';
  const valueKesCents = isPositiveInt(parseInt(body?.value_kes_cents, 10)) ? parseInt(body.value_kes_cents, 10) : 0;
  const userAgent = sanitizeString(c.req.header('User-Agent') || '', 500);
  const referrer = sanitizeString(c.req.header('Referer') || '', 2048);

  const record = async () => {
    await safeDbRun(
      c.env.DB,
      `INSERT INTO sponsored_conversions (id, campaign_id, conversion_type, value_kes_cents, ip_address, user_agent, referrer)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      [crypto.randomUUID(), campaignId, conversionType, valueKesCents, ip, userAgent, referrer],
      'record_conversion'
    );
  };

  if (c.executionCtx?.waitUntil) {
    c.executionCtx.waitUntil(record());
  } else {
    await record();
  }

  return c.json({ ok: true });
});

sponsoredService.get('/campaigns/:id/conversions', requireAuth, async (c) => {
  const id = c.req.param('id');
  const { error, status } = await loadOwnedCampaign(c, id);
  if (error) return c.json({ error }, status);

  const page = clampInt(c.req.query('page'), 1, 100000, 1);
  const limit = clampInt(c.req.query('limit'), 1, 100, 50);
  const offset = (page - 1) * limit;

  const conversions = await safeDbAll(
    c.env.DB,
    'SELECT id, conversion_type, value_kes_cents, created_at FROM sponsored_conversions WHERE campaign_id = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3',
    [id, limit, offset], [], 'list_conversions'
  );
  return c.json({ conversions, page });
});

// ═══════════════════════════════════════════════════════════════════════════
// IMPRESSION / CLICK TRACKING — public, no auth, rate limited
// ═══════════════════════════════════════════════════════════════════════════

sponsoredService.post('/track/impression', async (c) => {
  const ip = getClientIp(c);
  if (!checkImpressionRateLimit(ip)) return c.json({ error: 'Too many requests.' }, 429);

  let body;
  try { body = await c.req.json(); } catch (e) { body = {}; }

  const campaignId = typeof body?.campaign_id === 'string' ? body.campaign_id : null;
  if (!campaignId) return c.json({ error: 'campaign_id is required.' }, 400);

  const creativeId = typeof body?.creative_id === 'string' ? body.creative_id : null;
  const region = VALID_REGIONS.includes(body?.region) ? body.region : null;
  const county = isValidCounty(body?.county) ? body.county : null;

  const task = logSponsoredImpression(c.env.DB, { campaignId, creativeId, region, county });
  if (c.executionCtx?.waitUntil) {
    c.executionCtx.waitUntil(task);
  } else {
    await task;
  }

  return c.json({ ok: true });
});

sponsoredService.post('/track/click', async (c) => {
  const ip = getClientIp(c);
  if (!checkClickRateLimit(ip)) return c.json({ error: 'Too many requests.' }, 429);

  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }

  const campaignId = typeof body?.campaign_id === 'string' ? body.campaign_id : null;
  if (!campaignId) return c.json({ error: 'campaign_id is required.' }, 400);

  const creativeId = typeof body?.creative_id === 'string' ? body.creative_id : null;
  const region = VALID_REGIONS.includes(body?.region) ? body.region : null;
  const county = isValidCounty(body?.county) ? body.county : null;

  // Resolve the redirect target: prefer an explicitly supplied (and validated)
  // URL, otherwise fall back to the campaign's own cta_url so a click never dead-ends.
  let redirectUrl = null;
  if (isValidUrl(body?.redirect_url, MAX_URL_LENGTH)) {
    redirectUrl = body.redirect_url;
  } else {
    const campaign = await safeDbFirst(c.env.DB, 'SELECT cta_url FROM sponsored_campaigns WHERE id = ?1', [campaignId], null, 'click_lookup_cta');
    redirectUrl = campaign?.cta_url || null;
  }

  const task = logSponsoredClick(c.env.DB, { campaignId, creativeId, region, county });
  if (c.executionCtx?.waitUntil) {
    c.executionCtx.waitUntil(task);
  } else {
    await task;
  }

  if (!redirectUrl) return c.json({ error: 'No redirect target available.' }, 404);
  return c.json({ redirect: redirectUrl });
});

// ═══════════════════════════════════════════════════════════════════════════
// TARGETING
// ═══════════════════════════════════════════════════════════════════════════

sponsoredService.get('/campaigns/:id/targeting', requireAuth, async (c) => {
  const id = c.req.param('id');
  const { error, status } = await loadOwnedCampaign(c, id);
  if (error) return c.json({ error }, status);
  const targeting = await safeDbAll(
    c.env.DB, 'SELECT target_type, target_value FROM sponsored_targeting WHERE campaign_id = ?1', [id], [], 'get_targeting'
  );
  return c.json({ targeting });
});

sponsoredService.put('/campaigns/:id/targeting', requireAuth, async (c) => {
  const id = c.req.param('id');
  const { error, status } = await loadOwnedCampaign(c, id);
  if (error) return c.json({ error }, status);

  let body;
  try { body = await c.req.json(); } catch (e) { return c.json({ error: 'Invalid JSON body.' }, 400); }

  const written = await writeTargeting(c.env.DB, id, body || {});
  return c.json({ ok: true, rulesWritten: written });
});

// ═══════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════

sponsoredService.get('/campaigns/:id/report', requireAuth, async (c) => {
  const id = c.req.param('id');
  const { campaign, error, status } = await loadOwnedCampaign(c, id);
  if (error) return c.json({ error }, status);

  const [daily, geo, conversions, creatives] = await Promise.all([
    safeDbAll(c.env.DB, 'SELECT date, impressions, clicks, ctr FROM sponsored_analytics_daily WHERE campaign_id = ?1 ORDER BY date ASC', [id], [], 'report_daily'),
    safeDbAll(c.env.DB, 'SELECT region, county, SUM(impressions) as impressions, SUM(clicks) as clicks FROM sponsored_geo_analytics WHERE campaign_id = ?1 GROUP BY region, county', [id], [], 'report_geo'),
    safeDbFirst(c.env.DB, 'SELECT COUNT(*) as count, COALESCE(SUM(value_kes_cents), 0) as total_value FROM sponsored_conversions WHERE campaign_id = ?1', [id], { count: 0, total_value: 0 }, 'report_conversions'),
    safeDbAll(c.env.DB, 'SELECT id, headline, is_control, impressions_served, clicks FROM sponsored_creatives WHERE campaign_id = ?1', [id], [], 'report_creatives'),
  ]);

  const impressionsServed = campaign.impressions_served || 0;
  const clicks = campaign.clicks || 0;
  const ctr = impressionsServed > 0 ? Number(((clicks / impressionsServed) * 100).toFixed(2)) : 0;

  return c.json({
    report: {
      campaign_id: id,
      headline: campaign.headline,
      status: campaign.status,
      duration_days: campaign.duration_days,
      started_at: campaign.started_at,
      ends_at: campaign.ends_at,
      impressions_served: impressionsServed,
      clicks,
      ctr,
      impressions_goal: campaign.impressions_goal || 0,
      conversions: { count: conversions?.count || 0, total_value_kes_cents: conversions?.total_value || 0 },
      daily,
      geo,
      creatives,
      generated_at: new Date().toISOString(),
    },
  });
});

sponsoredService.get('/campaigns/:id/report/pdf', requireAuth, async (c) => {
  const id = c.req.param('id');
  const { error, status } = await loadOwnedCampaign(c, id);
  if (error) return c.json({ error }, status);

  // Placeholder: PDF rendering pipeline not wired up yet — return JSON so the
  // frontend can display a "coming soon" state without breaking.
  return c.json({
    ok: false,
    message: 'PDF report export is not yet implemented. Use /report or /report/export in the meantime.',
    reportUrl: null,
  });
});

sponsoredService.get('/campaigns/:id/report/export', requireAuth, async (c) => {
  const id = c.req.param('id');
  const { error, status } = await loadOwnedCampaign(c, id);
  if (error) return c.json({ error }, status);

  const daily = await safeDbAll(
    c.env.DB, 'SELECT date, impressions, clicks, ctr, spend_kes_cents FROM sponsored_analytics_daily WHERE campaign_id = ?1 ORDER BY date ASC',
    [id], [], 'export_daily'
  );

  const header = 'date,impressions,clicks,ctr,spend_kes_cents';
  const rows = daily.map((r) => [r.date, r.impressions ?? 0, r.clicks ?? 0, r.ctr ?? 0, r.spend_kes_cents ?? 0].join(','));
  const csv = [header, ...rows].join('\n');

  c.header('Content-Type', 'text/csv');
  c.header('Content-Disposition', `attachment; filename="sponsored-campaign-${id}-daily.csv"`);
  return c.body(csv);
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════════

sponsoredService.get('/admin/campaigns', requireAuth, async (c) => {
  const user = c.get('user');
  if (!isAdmin(user)) return c.json({ error: 'Admin access required.' }, 403);

  const page = clampInt(c.req.query('page'), 1, 100000, 1);
  const limit = clampInt(c.req.query('limit'), 1, 50, 20);
  const offset = (page - 1) * limit;
  const statusFilter = c.req.query('status');
  const q = (c.req.query('q') || '').trim();

  const whereClauses = [];
  const whereValues = [];
  let idx = 1;
  if (statusFilter && VALID_STATUSES.includes(statusFilter)) {
    whereClauses.push(`status = ?${idx++}`);
    whereValues.push(statusFilter);
  }
  if (q) {
    whereClauses.push(`(headline LIKE ?${idx++} OR user_email LIKE ?${idx++})`);
    whereValues.push(`%${q}%`, `%${q}%`);
  }
  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const totalRow = await safeDbFirst(
    c.env.DB, `SELECT COUNT(*) as count FROM sponsored_campaigns ${whereSql}`, whereValues, { count: 0 }, 'admin_list_count'
  );
  const total = totalRow?.count || 0;

  const campaigns = await safeDbAll(
    c.env.DB,
    `SELECT * FROM sponsored_campaigns ${whereSql} ORDER BY created_at DESC LIMIT ?${idx} OFFSET ?${idx + 1}`,
    [...whereValues, limit, offset], [], 'admin_list_campaigns'
  );

  return c.json({ campaigns, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

sponsoredService.post('/admin/campaigns/:id/force-stop', requireAuth, async (c) => {
  const user = c.get('user');
  if (!isAdmin(user)) return c.json({ error: 'Admin access required.' }, 403);

  const id = c.req.param('id');
  const result = await safeDbRun(
    c.env.DB,
    "UPDATE sponsored_campaigns SET status = 'cancelled', ends_at = datetime('now'), updated_at = datetime('now') WHERE id = ?1",
    [id], 'admin_force_stop'
  );
  if (!result.ok) return c.json({ error: 'Failed to force-stop campaign.' }, 500);
  await logEvent('sponsored_campaign_force_stopped', { campaignId: id, adminId: user.id });
  return c.json({ ok: true });
});

sponsoredService.post('/admin/campaigns/:id/approve', requireAuth, async (c) => {
  const user = c.get('user');
  if (!isAdmin(user)) return c.json({ error: 'Admin access required.' }, 403);

  const id = c.req.param('id');
  const result = await safeDbRun(
    c.env.DB, 'UPDATE sponsored_campaigns SET approved = 1, updated_at = datetime(\'now\') WHERE id = ?1', [id], 'admin_approve'
  );
  if (!result.ok) return c.json({ error: 'Failed to approve campaign.' }, 500);
  await logEvent('sponsored_campaign_approved', { campaignId: id, adminId: user.id });
  return c.json({ ok: true });
});

sponsoredService.get('/admin/stats', requireAuth, async (c) => {
  const user = c.get('user');
  if (!isAdmin(user)) return c.json({ error: 'Admin access required.' }, 403);

  const [totals, activeCount, impressionsSum, clicksSum, conversionsCount] = await Promise.all([
    safeDbFirst(c.env.DB, 'SELECT COUNT(*) as count FROM sponsored_campaigns', [], { count: 0 }, 'admin_stats_total'),
    safeDbFirst(c.env.DB, "SELECT COUNT(*) as count FROM sponsored_campaigns WHERE status = 'active'", [], { count: 0 }, 'admin_stats_active'),
    safeDbFirst(c.env.DB, 'SELECT COALESCE(SUM(impressions_served), 0) as total FROM sponsored_campaigns', [], { total: 0 }, 'admin_stats_impressions'),
    safeDbFirst(c.env.DB, 'SELECT COALESCE(SUM(clicks), 0) as total FROM sponsored_campaigns', [], { total: 0 }, 'admin_stats_clicks'),
    safeDbFirst(c.env.DB, 'SELECT COUNT(*) as count FROM sponsored_conversions', [], { count: 0 }, 'admin_stats_conversions'),
  ]);

  const topCampaigns = await safeDbAll(
    c.env.DB,
    'SELECT id, headline, user_email, impressions_served, clicks FROM sponsored_campaigns ORDER BY impressions_served DESC LIMIT 10',
    [], [], 'admin_stats_top'
  );

  return c.json({
    total_campaigns: totals?.count || 0,
    active_campaigns: activeCount?.count || 0,
    total_impressions: impressionsSum?.total || 0,
    total_clicks: clicksSum?.total || 0,
    total_conversions: conversionsCount?.count || 0,
    top_campaigns: topCampaigns,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CRON HELPERS (exported for mounting in index.js's scheduled() handler)
// ═══════════════════════════════════════════════════════════════════════════

// Auto-starts scheduled campaigns whose start time has arrived, auto-completes
// active campaigns past their end date, and logs a one-time 24h-before-expiry
// notice (console.log for now — swap in real email/SMS dispatch later).
async function processSponsoredCampaigns(env) {
  const summary = { started: 0, completed: 0, notified: 0 };
  try {
    const startResult = await env.DB.prepare(
      "UPDATE sponsored_campaigns SET status = 'active', started_at = datetime('now'), updated_at = datetime('now') WHERE status = 'scheduled' AND scheduled_start_at <= datetime('now')"
    ).run();
    summary.started = startResult?.meta?.changes ?? startResult?.changes ?? 0;
  } catch (e) {
    console.error(JSON.stringify({ kind: 'sponsored_cron_error', job: 'auto_start', message: e.message }));
  }

  try {
    const completeResult = await env.DB.prepare(
      "UPDATE sponsored_campaigns SET status = 'completed', updated_at = datetime('now') WHERE status = 'active' AND ends_at IS NOT NULL AND ends_at <= datetime('now')"
    ).run();
    summary.completed = completeResult?.meta?.changes ?? completeResult?.changes ?? 0;
  } catch (e) {
    console.error(JSON.stringify({ kind: 'sponsored_cron_error', job: 'auto_complete', message: e.message }));
  }

  try {
    const { results: expiringSoon } = await env.DB.prepare(
      `SELECT id, user_email, headline, ends_at FROM sponsored_campaigns
       WHERE status = 'active' AND expiry_notified = 0
         AND ends_at IS NOT NULL
         AND ends_at <= datetime('now', '+24 hours')
         AND ends_at > datetime('now')`
    ).all();

    for (const campaign of expiringSoon || []) {
      try {
        console.log(JSON.stringify({
          kind: 'sponsored_campaign_expiry_notice',
          campaignId: campaign.id,
          userEmail: campaign.user_email,
          headline: campaign.headline,
          endsAt: campaign.ends_at,
        }));
        await env.DB.prepare('UPDATE sponsored_campaigns SET expiry_notified = 1 WHERE id = ?1').bind(campaign.id).run();
        summary.notified += 1;
      } catch (innerErr) {
        console.error(JSON.stringify({ kind: 'sponsored_cron_error', job: 'expiry_notify_row', campaignId: campaign.id, message: innerErr.message }));
      }
    }
  } catch (e) {
    console.error(JSON.stringify({ kind: 'sponsored_cron_error', job: 'expiry_notify', message: e.message }));
  }

  return summary;
}

// Recomputes CTR on today's (and any stale) daily analytics rows from the
// authoritative running counters on sponsored_campaigns. Impression/click
// counters are already incremented in real time by the public tracking
// endpoints; this job exists as a reconciliation pass in case any daily rows
// were created without a CTR value, or counts drifted due to a partial write.
async function countSponsoredImpressions(env) {
  const summary = { rowsReconciled: 0 };
  try {
    const { results: rows } = await env.DB.prepare(
      `SELECT id, impressions, clicks FROM sponsored_analytics_daily WHERE date = date('now')`
    ).all();

    for (const row of rows || []) {
      try {
        const ctr = row.impressions > 0 ? Number(((row.clicks / row.impressions) * 100).toFixed(4)) : 0;
        await env.DB.prepare('UPDATE sponsored_analytics_daily SET ctr = ?1 WHERE id = ?2').bind(ctr, row.id).run();
        summary.rowsReconciled += 1;
      } catch (innerErr) {
        console.error(JSON.stringify({ kind: 'sponsored_cron_error', job: 'ctr_reconcile_row', rowId: row.id, message: innerErr.message }));
      }
    }
  } catch (e) {
    console.error(JSON.stringify({ kind: 'sponsored_cron_error', job: 'ctr_reconcile', message: e.message }));
  }
  return summary;
}

export default sponsoredService;
export { processSponsoredCampaigns, countSponsoredImpressions };
