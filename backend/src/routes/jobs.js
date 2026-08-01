import { Hono } from 'hono';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { contentFilter } from '../middleware/contentFilter.js';

const jobs = new Hono();

// ── Constants ─────────────────────────────────────────
const CATEGORIES = [
  'Media & Journalism',
  'Tech & Development',
  'Marketing & PR',
  'Finance & Accounting',
  'Healthcare',
  'Education',
  'NGO & Nonprofit',
  'Government',
  'Sales',
  'Design & Creative',
  'Engineering',
  'Hospitality',
];

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'];
const SALARY_CURRENCIES = ['KES', 'USD', 'EUR', 'GBP', 'ZAR', 'NGN', 'TZS', 'UGX'];

const SITE_ORIGIN = 'https://opinionplus.online';

// Package pricing (KES, converted to minor units/cents for Paystack)
const PACKAGE_PRICES = {
  single: 50000,   // KES 500
  multiple: 120000, // KES 1,200
};

// Featured job pricing
const FEATURE_PRICES = {
  '7': { amountCents: 20000, days: 7 },  // KES 200 / 7 days
  '30': { amountCents: 50000, days: 30 }, // KES 500 / 30 days
};

// ── Helpers ───────────────────────────────────────────
function sanitizeText(input, maxLen = 5000) {
  if (typeof input !== 'string') return '';
  // Strip any HTML tags to prevent stored XSS, then trim/clamp length.
  return input.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
}

function isValidApplyLink(link) {
  if (typeof link !== 'string' || !link.trim()) return false;
  const trimmed = link.trim();
  if (trimmed.startsWith('mailto:')) {
    return /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+/.test(trimmed);
  }
  try {
    const url = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
    return !!url.hostname && url.hostname.includes('.');
  } catch (e) {
    return false;
  }
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function escapeXml(str) {
  return String(str || '').replace(/[<>&'"]/g, (ch) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[ch]));
}

function toNullableInt(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

async function getJob(db, id) {
  try {
    return await db.prepare('SELECT * FROM jobs WHERE id = ?').bind(id).first();
  } catch (e) {
    return null;
  }
}

function isOwnerOrAdmin(job, user) {
  if (!job || !user) return false;
  return job.employer_id === user.id || user.role === 'admin' || user.role === 'root';
}

/**
 * Validates that job data contains all fields required by Google Jobs structured data.
 * Returns an array of missing field names (empty array = valid).
 */
function validateGoogleJobsFields(data) {
  const missing = [];
  if (!data.title) missing.push('title');
  if (!data.company) missing.push('company');
  if (!data.description) missing.push('description');
  if (!data.location) missing.push('location');
  if (!data.apply_link && !data.applyLink) missing.push('apply_link');
  // datePosted comes from created_at — always present
  // validThrough comes from deadline or defaults to 60-day window
  return missing;
}

/**
 * Returns an ISO 8601 validThrough date for Google Jobs.
 * Uses deadline if present, otherwise defaults to 60 days from created_at or now.
 */
function getValidThrough(job) {
  if (job.deadline && job.deadline.trim()) {
    try {
      const d = new Date(job.deadline);
      if (!isNaN(d.getTime())) return d.toISOString();
    } catch (e) { /* fall through */ }
  }
  // Default: 60 days from creation or now
  const base = job.created_at ? new Date(job.created_at) : new Date();
  return new Date(base.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();
}

// ═══════════════════════════════════════════════════════
// STATIC / LITERAL ROUTES (must be reachable ahead of any
// dynamic ':id' segments to avoid accidental shadowing)
// ═══════════════════════════════════════════════════════

// List all active media jobs — now with search, filters, sorting & pagination
jobs.get('/', async (c) => {
  try {
    const q = sanitizeText(c.req.query('q') || '', 100);
    const type = c.req.query('type');
    const location = sanitizeText(c.req.query('location') || '', 100);
    const education = c.req.query('education');
    const remote = c.req.query('remote');
    const urgent = c.req.query('urgent');
    const category = c.req.query('category');
    const sort = c.req.query('sort') || 'newest';

    let page = parseInt(c.req.query('page') || '1', 10);
    let limit = parseInt(c.req.query('limit') || '20', 10);
    if (!Number.isFinite(page) || page < 1) page = 1;
    if (!Number.isFinite(limit) || limit < 1) limit = 20;
    if (limit > 50) limit = 50;
    const offset = (page - 1) * limit;

    const conditions = ["j.status = 'active'"];
    const params = [];

    if (q) {
      conditions.push('(j.title LIKE ? OR j.company LIKE ? OR j.description LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (type && EMPLOYMENT_TYPES.includes(type)) {
      conditions.push('j.type = ?');
      params.push(type);
    }
    if (location) {
      conditions.push('j.location LIKE ?');
      params.push(`%${location}%`);
    }
    if (education) {
      conditions.push('j.education = ?');
      params.push(education);
    }
    if (remote === '1' || remote === 'true') {
      conditions.push('j.is_remote = 1');
    }
    if (urgent === '1' || urgent === 'true') {
      conditions.push('j.is_urgent = 1');
    }
    if (category && CATEGORIES.includes(category)) {
      conditions.push('j.category = ?');
      params.push(category);
    }

    const whereClause = conditions.join(' AND ');
    const isFeaturedNowSql = "(j.is_featured = 1 AND (j.featured_until IS NULL OR j.featured_until > datetime('now')))";

    let orderClause = `${isFeaturedNowSql} DESC, j.created_at DESC`;
    if (sort === 'deadline') {
      orderClause = `${isFeaturedNowSql} DESC, (j.deadline IS NULL OR j.deadline = '') ASC, j.deadline ASC`;
    } else if (sort === 'popular') {
      orderClause = `${isFeaturedNowSql} DESC, applicant_count DESC, j.created_at DESC`;
    }

    const sql = `
      SELECT j.*, u.logo_url as employer_logo, u.publisher_name as posted_by,
        (SELECT COUNT(*) FROM job_applications ja WHERE ja.job_id = j.id) as applicant_count
      FROM jobs j
      LEFT JOIN users u ON j.employer_id = u.id
      WHERE ${whereClause}
      ORDER BY ${orderClause}
      LIMIT ? OFFSET ?
    `;
    const { results } = await c.env.DB.prepare(sql).bind(...params, limit, offset).all();

    const countRow = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM jobs j WHERE ${whereClause}`
    ).bind(...params).first();

    const total = countRow?.total || 0;

    return c.json({
      jobs: results || [],
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (e) {
    return c.json({ error: 'Failed to load jobs.', jobs: [] }, 500);
  }
});

// Job categories with live counts
jobs.get('/categories', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT category, COUNT(*) as count FROM jobs WHERE status = 'active' GROUP BY category`
    ).all();
    const counts = {};
    (results || []).forEach((r) => { counts[r.category || 'Media & Journalism'] = r.count; });
    return c.json({ categories: CATEGORIES.map((cat) => ({ name: cat, count: counts[cat] || 0 })) });
  } catch (e) {
    return c.json({ error: 'Failed to load categories.', categories: [] }, 500);
  }
});

// RSS 2.0 feed of active jobs — cached 1 hour at the edge
jobs.get('/feed.xml', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT id, title, company, location, description, apply_link, created_at
       FROM jobs WHERE status = 'active' ORDER BY created_at DESC LIMIT 100`
    ).all();

    const mostRecentDate = results?.length
      ? new Date(results[0].created_at).toUTCString()
      : new Date().toUTCString();

    const items = (results || []).map((job) => {
      const link = `${SITE_ORIGIN}/job?id=${encodeURIComponent(job.id)}`;
      const pubDate = job.created_at ? new Date(job.created_at).toUTCString() : new Date().toUTCString();
      const desc = `${job.company} | ${job.location || 'Remote'} — ${(job.description || '').slice(0, 300)}`;
      return `    <item>
      <title>${escapeXml(job.title)} at ${escapeXml(job.company)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(job.id)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(desc)}</description>
    </item>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>OpinionPlus Jobs Board</title>
    <link>${SITE_ORIGIN}/job</link>
    <description>Latest media and corporate job listings on OpinionPlus</description>
    <language>en-us</language>
    <lastBuildDate>${mostRecentDate}</lastBuildDate>
${items}
  </channel>
</rss>`;

    c.header('Content-Type', 'application/rss+xml; charset=utf-8');
    c.header('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=1800');
    return c.body(xml);
  } catch (e) {
    c.header('Content-Type', 'application/rss+xml; charset=utf-8');
    return c.body(
      '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>OpinionPlus Jobs Board</title><description>Feed temporarily unavailable</description></channel></rss>',
      500
    );
  }
});

// Company profile — all active jobs from one employer
jobs.get('/company', async (c) => {
  try {
    const name = sanitizeText(c.req.query('name') || '', 200);
    if (!name) return c.json({ error: 'Company name is required.' }, 400);

    const { results } = await c.env.DB.prepare(
      `SELECT * FROM jobs WHERE company = ? AND status = 'active' ORDER BY created_at DESC`
    ).bind(name).all();
    const totalRow = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM jobs WHERE company = ? AND status = 'active'`
    ).bind(name).first();

    return c.json({
      company: name,
      jobs: results || [],
      stats: { total_posted: totalRow?.total || 0, active: (results || []).length },
    });
  } catch (e) {
    return c.json({ error: 'Failed to load company jobs.' }, 500);
  }
});

// Saved / bookmarked jobs for the logged-in user
jobs.get('/saved', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const { results } = await c.env.DB.prepare(
      `SELECT j.*, u.logo_url as employer_logo, u.publisher_name as posted_by
       FROM saved_jobs s
       JOIN jobs j ON s.job_id = j.id
       LEFT JOIN users u ON j.employer_id = u.id
       WHERE s.user_id = ? ORDER BY s.created_at DESC`
    ).bind(user.id).all();
    return c.json({ jobs: results || [] });
  } catch (e) {
    return c.json({ error: 'Failed to load saved jobs.', jobs: [] }, 500);
  }
});

// Employer dashboard — the logged-in user's own postings with stats
jobs.get('/dashboard', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const { results } = await c.env.DB.prepare(
      `SELECT j.*, (SELECT COUNT(*) FROM job_applications ja WHERE ja.job_id = j.id) as applicant_count
       FROM jobs j WHERE j.employer_id = ? ORDER BY j.created_at DESC`
    ).bind(user.id).all();

    const now = Date.now();
    const enriched = (results || []).map((job) => {
      const created = job.created_at ? new Date(job.created_at).getTime() : now;
      const expiresAt = created + 60 * 24 * 60 * 60 * 1000;
      const daysLeft = Math.max(0, Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000)));
      return { ...job, days_remaining: daysLeft, is_expired: job.status === 'active' && daysLeft <= 0 };
    });

    return c.json({ jobs: enriched });
  } catch (e) {
    return c.json({ error: 'Failed to load your dashboard.', jobs: [] }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// PAYMENT FLOW — job posting (preserved + enhanced)
// ═══════════════════════════════════════════════════════

// Step 1: Initialize Paystack Transaction for Job Listing
jobs.post('/initialize', requireAuth, async (c) => {
  try {
    const user = c.get('user');

    // Rate limit: 5 job posts per day per user
    const limiter = createRateLimiter(c.env.DB, 86400, 5);
    const allowed = await limiter(user.id, 'job-post');
    if (!allowed) {
      return c.json({ error: 'You have reached the daily limit of 5 job posts. Please try again tomorrow.' }, 429);
    }

    const body = await c.req.json().catch(() => ({}));
    const title = sanitizeText(body.title, 200);
    const company = sanitizeText(body.company, 200);
    const location = sanitizeText(body.location, 200) || 'Remote';
    const type = EMPLOYMENT_TYPES.includes(body.type) ? body.type : 'Full-time';
    const description = sanitizeText(body.description, 5000);
    const apply_link = typeof body.apply_link === 'string' ? body.apply_link.trim().slice(0, 500) : '';
    const additional_info = sanitizeText(body.additional_info, 1000);
    const deadline = typeof body.deadline === 'string' ? body.deadline.slice(0, 20) : null;
    const education = sanitizeText(body.education, 100) || 'No Experience Needed';
    const is_urgent = body.is_urgent ? 1 : 0;

    const category = CATEGORIES.includes(body.category) ? body.category : 'Media & Journalism';
    const is_remote = body.is_remote ? 1 : (location.toLowerCase().includes('remote') ? 1 : 0);
    const salary_min = toNullableInt(body.salary_min);
    const salary_max = toNullableInt(body.salary_max);
    const salary_currency = SALARY_CURRENCIES.includes(body.salary_currency) ? body.salary_currency : 'KES';

    const package_type = body.package_type === 'multiple' ? 'multiple' : 'single';
    const amountCents = PACKAGE_PRICES[package_type];

    if (!title || !company || !apply_link) {
      return c.json({ error: 'Title, company, and application link are required.' }, 400);
    }
    if (!isValidApplyLink(apply_link)) {
      return c.json({ error: 'Application link must be a valid URL or mailto address.' }, 400);
    }
    if (salary_min !== null && salary_max !== null && salary_min > salary_max) {
      return c.json({ error: 'Minimum salary cannot exceed maximum salary.' }, 400);
    }

    // ── Content filtering (profanity/spam) ──────────────
    try {
      const filterResult = await contentFilter.check(
        `${title} ${description} ${additional_info}`
      );
      if (!filterResult.passed) {
        return c.json({
          error: 'Your job posting contains flagged content. Please revise and try again.',
          details: filterResult.reason || 'Content did not pass moderation checks.',
        }, 400);
      }
    } catch (filterErr) {
      // If content filter is unavailable, log and allow through (fail-open)
      console.error('Content filter error (fail-open):', filterErr);
    }

    const jobId = 'job_' + crypto.randomUUID().slice(0, 10);

    // ── Validate Google Jobs required fields ────────────
    const missingGoogleFields = validateGoogleJobsFields({ title, company, description, location, apply_link });
    // We don't block posting, but log a warning so admins can follow up
    if (missingGoogleFields.length) {
      console.warn(`Job ${jobId} missing Google Jobs fields: ${missingGoogleFields.join(', ')}`);
    }

    await c.env.DB.prepare(
      `INSERT INTO jobs (
         id, employer_id, title, company, location, type, description, apply_link,
         amount_paid, status, additional_info, deadline, education, is_urgent,
         category, is_remote, salary_min, salary_max, salary_currency
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      jobId, user.id, title, company, location, type, description, apply_link,
      amountCents, additional_info, deadline, education, is_urgent,
      category, is_remote, salary_min, salary_max, salary_currency
    ).run();

    // Call Paystack API to initialize transaction
    // NOTE: The callback URL passes the jobId as the reference parameter.
    // The frontend callback page (/job?reference=job_xxx) must extract this
    // and POST it to /jobs/verify as { reference: "job_xxx" }.
    const origin = c.req.header('origin') || SITE_ORIGIN;
    const callbackUrl = `${origin}/job?reference=${jobId}`;

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
        metadata: { job_id: jobId, kind: 'job-post', package_type },
      }),
    });

    const paystackData = await paystackRes.json().catch(() => ({}));

    if (!paystackData.status) {
      return c.json({ error: 'Failed to initialize payment gateway with Paystack.' }, 400);
    }

    return c.json({ ok: true, authorization_url: paystackData.data.authorization_url });
  } catch (e) {
    return c.json({ error: 'Failed to initialize job posting. Please try again.' }, 500);
  }
});

// Step 2: Verify Paystack Transaction & Publish/Renew Job
jobs.post('/verify', requireAuth, async (c) => {
  try {
    const { reference } = await c.req.json().catch(() => ({}));
    if (!reference) return c.json({ error: 'Transaction reference required.' }, 400);

    // Verify with Paystack API
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${c.env.PAYSTACK_SECRET_KEY}` },
    });

    const verifyData = await verifyRes.json().catch(() => ({}));

    if (verifyData.status && verifyData.data?.status === 'success') {
      const kind = verifyData.data?.metadata?.kind;

      if (kind === 'renew') {
        // Renewal: reset the 60-day clock and reactivate
        const jobId = verifyData.data?.metadata?.job_id;
        if (!jobId) return c.json({ error: 'Missing job reference for renewal.' }, 400);
        await c.env.DB.prepare(
          "UPDATE jobs SET status = 'active', created_at = datetime('now') WHERE id = ?"
        ).bind(jobId).run();
        return c.json({ ok: true, message: 'Job renewed for another 60 days!' });
      }

      // Default: original job-posting payment confirmation flow (preserved)
      await c.env.DB.prepare("UPDATE jobs SET status = 'active' WHERE id = ?").bind(reference).run();
      return c.json({ ok: true, message: 'Payment confirmed and job posted successfully!' });
    }

    return c.json({ error: 'Payment verification failed or pending.' }, 400);
  } catch (e) {
    return c.json({ error: 'Failed to verify payment. Please try again.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// FEATURED / SPONSORED JOBS
// ═══════════════════════════════════════════════════════

// Admin: manually feature/unfeature any job
jobs.post('/admin/:id/feature', requireAdmin, async (c) => {
  try {
    const jobId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const featured = !!body.featured;
    const days = Number.isFinite(Number(body.days)) && Number(body.days) > 0 ? Math.floor(Number(body.days)) : 30;

    if (featured) {
      const featuredUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      await c.env.DB.prepare('UPDATE jobs SET is_featured = 1, featured_until = ? WHERE id = ?').bind(featuredUntil, jobId).run();
    } else {
      await c.env.DB.prepare('UPDATE jobs SET is_featured = 0, featured_until = NULL WHERE id = ?').bind(jobId).run();
    }
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: 'Failed to update featured status.' }, 500);
  }
});

// Standalone feature verify — used by frontend callback when job_id isn't in the URL
// (Paystack metadata provides the job_id)
jobs.post('/feature-verify', requireAuth, async (c) => {
  try {
    const { reference } = await c.req.json().catch(() => ({}));
    if (!reference) return c.json({ error: 'Transaction reference required.' }, 400);

    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${c.env.PAYSTACK_SECRET_KEY}` },
    });
    const verifyData = await verifyRes.json().catch(() => ({}));

    if (verifyData.status && verifyData.data?.status === 'success') {
      const days = Number(verifyData.data?.metadata?.days) || 7;
      const jobId = verifyData.data?.metadata?.job_id;
      if (!jobId) return c.json({ error: 'Missing job reference in payment metadata.' }, 400);

      const featuredUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      await c.env.DB.prepare(
        'UPDATE jobs SET is_featured = 1, featured_until = ? WHERE id = ?'
      ).bind(featuredUntil, jobId).run();

      return c.json({ ok: true, message: 'Your job is now featured!', featured_until: featuredUntil });
    }

    return c.json({ error: 'Payment verification failed or pending.' }, 400);
  } catch (e) {
    return c.json({ error: 'Failed to verify featured job payment.' }, 500);
  }
});

// Step 1: Initialize Paystack payment to feature a job
jobs.post('/:id/feature-initialize', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const jobId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const plan = body.plan === '30' ? '30' : '7';
    const { amountCents, days } = FEATURE_PRICES[plan];

    const job = await getJob(c.env.DB, jobId);
    if (!job) return c.json({ error: 'Job not found.' }, 404);
    if (!isOwnerOrAdmin(job, user)) {
      return c.json({ error: 'You can only feature your own job listings.' }, 403);
    }

    const reference = 'feat_' + crypto.randomUUID().slice(0, 10);
    const origin = c.req.header('origin') || SITE_ORIGIN;
    const callbackUrl = `${origin}/job?feature_reference=${reference}`;

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email || 'adipotech@gmail.com',
        amount: amountCents,
        reference,
        callback_url: callbackUrl,
        metadata: { job_id: jobId, days, kind: 'feature' },
      }),
    });

    const paystackData = await paystackRes.json().catch(() => ({}));
    if (!paystackData.status) {
      return c.json({ error: 'Failed to initialize payment gateway with Paystack.' }, 400);
    }

    return c.json({ ok: true, authorization_url: paystackData.data.authorization_url });
  } catch (e) {
    return c.json({ error: 'Failed to initialize featured job payment.' }, 500);
  }
});

// Step 2: Verify Paystack payment & activate featured status
jobs.post('/:id/feature-verify', requireAuth, async (c) => {
  try {
    const jobId = c.req.param('id');
    const { reference } = await c.req.json().catch(() => ({}));
    if (!reference) return c.json({ error: 'Transaction reference required.' }, 400);

    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${c.env.PAYSTACK_SECRET_KEY}` },
    });
    const verifyData = await verifyRes.json().catch(() => ({}));

    if (verifyData.status && verifyData.data?.status === 'success') {
      const days = Number(verifyData.data?.metadata?.days) || 7;
      const metaJobId = verifyData.data?.metadata?.job_id || jobId;
      const featuredUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      await c.env.DB.prepare(
        'UPDATE jobs SET is_featured = 1, featured_until = ? WHERE id = ?'
      ).bind(featuredUntil, metaJobId).run();

      return c.json({ ok: true, message: 'Your job is now featured!', featured_until: featuredUntil });
    }

    return c.json({ error: 'Payment verification failed or pending.' }, 400);
  } catch (e) {
    return c.json({ error: 'Failed to verify featured job payment.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// APPLICATION TRACKING
// ═══════════════════════════════════════════════════════

// Record an "Apply" click — public, rate limited, never blocks the redirect
jobs.post('/:id/apply', async (c) => {
  try {
    const jobId = c.req.param('id');
    const ip = c.req.header('CF-Connecting-IP') || 'unknown';
    const limiter = createRateLimiter(c.env.DB, 3600, 30);
    const allowed = await limiter(ip, 'job-apply-click');

    if (allowed) {
      const ua = (c.req.header('User-Agent') || '').slice(0, 300);
      await c.env.DB.prepare(
        'INSERT INTO job_applications (id, job_id, ip_address, user_agent) VALUES (?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), jobId, ip, ua).run();
    }
    return c.json({ ok: true });
  } catch (e) {
    // Never block the apply flow because of a tracking failure
    return c.json({ ok: true });
  }
});

// Get application count for a job — owner or admin only
jobs.get('/:id/applications', requireAuth, async (c) => {
  try {
    const jobId = c.req.param('id');
    const user = c.get('user');
    const job = await getJob(c.env.DB, jobId);
    if (!job) return c.json({ error: 'Job not found.' }, 404);
    if (!isOwnerOrAdmin(job, user)) return c.json({ error: 'Forbidden.' }, 403);

    const countRow = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM job_applications WHERE job_id = ?'
    ).bind(jobId).first();
    const { results } = await c.env.DB.prepare(
      'SELECT created_at FROM job_applications WHERE job_id = ? ORDER BY created_at DESC LIMIT 100'
    ).bind(jobId).all();

    return c.json({ count: countRow?.count || 0, recent: results || [] });
  } catch (e) {
    return c.json({ error: 'Failed to load applications.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// JOB ALERTS (EMAIL)
// ═══════════════════════════════════════════════════════

jobs.post('/alerts/subscribe', async (c) => {
  try {
    const ip = c.req.header('CF-Connecting-IP') || 'unknown';
    const limiter = createRateLimiter(c.env.DB, 3600, 3);
    const allowed = await limiter(ip, 'job-alert-subscribe');
    if (!allowed) return c.json({ error: 'Too many subscription attempts. Please try again later.' }, 429);

    const body = await c.req.json().catch(() => ({}));
    const email = (body.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) return c.json({ error: 'A valid email address is required.' }, 400);

    const allowedTypes = [...EMPLOYMENT_TYPES, 'Remote'];
    const jobTypes = Array.isArray(body.job_types)
      ? body.job_types.filter((t) => allowedTypes.includes(t)).slice(0, 10)
      : [];
    const finalTypes = jobTypes.length ? jobTypes : ['Full-time'];
    const frequency = body.frequency === 'daily' ? 'daily' : 'weekly';

    const existing = await c.env.DB.prepare('SELECT id FROM job_alerts WHERE email = ?').bind(email).first();
    if (existing) {
      await c.env.DB.prepare(
        'UPDATE job_alerts SET job_types = ?, frequency = ?, is_active = 1 WHERE email = ?'
      ).bind(JSON.stringify(finalTypes), frequency, email).run();
    } else {
      await c.env.DB.prepare(
        'INSERT INTO job_alerts (id, email, job_types, frequency, is_active) VALUES (?, ?, ?, ?, 1)'
      ).bind(crypto.randomUUID(), email, JSON.stringify(finalTypes), frequency).run();
    }

    return c.json({ ok: true, message: `Alert set! You'll receive ${frequency} job updates.` });
  } catch (e) {
    return c.json({ error: 'Failed to subscribe to job alerts.' }, 500);
  }
});

jobs.delete('/alerts/unsubscribe', async (c) => {
  try {
    const email = (c.req.query('email') || '').trim().toLowerCase();
    if (!isValidEmail(email)) return c.json({ error: 'A valid email address is required.' }, 400);
    await c.env.DB.prepare('UPDATE job_alerts SET is_active = 0 WHERE email = ?').bind(email).run();
    return c.json({ ok: true, message: 'You have been unsubscribed from job alerts.' });
  } catch (e) {
    return c.json({ error: 'Failed to unsubscribe.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// SAVED JOBS / BOOKMARKS
// ═══════════════════════════════════════════════════════

jobs.post('/:id/save', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const jobId = c.req.param('id');
    const job = await getJob(c.env.DB, jobId);
    if (!job) return c.json({ error: 'Job not found.' }, 404);

    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO saved_jobs (id, user_id, job_id) VALUES (?, ?, ?)'
    ).bind(crypto.randomUUID(), user.id, jobId).run();

    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: 'Failed to save job.' }, 500);
  }
});

jobs.delete('/:id/save', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const jobId = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?').bind(user.id, jobId).run();
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: 'Failed to unsave job.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// EMPLOYER DASHBOARD ACTIONS
// ═══════════════════════════════════════════════════════

// Edit job details — owner or admin only
jobs.patch('/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const jobId = c.req.param('id');
    const job = await getJob(c.env.DB, jobId);
    if (!job) return c.json({ error: 'Job not found.' }, 404);
    if (!isOwnerOrAdmin(job, user)) return c.json({ error: 'Forbidden.' }, 403);

    const body = await c.req.json().catch(() => ({}));
    const updates = [];
    const params = [];

    if (typeof body.title === 'string') { updates.push('title = ?'); params.push(sanitizeText(body.title, 200)); }
    if (typeof body.description === 'string') { updates.push('description = ?'); params.push(sanitizeText(body.description, 5000)); }
    if (typeof body.additional_info === 'string') { updates.push('additional_info = ?'); params.push(sanitizeText(body.additional_info, 1000)); }
    if (typeof body.deadline === 'string') { updates.push('deadline = ?'); params.push(body.deadline.slice(0, 20)); }
    if (typeof body.location === 'string') { updates.push('location = ?'); params.push(sanitizeText(body.location, 200)); }
    if (typeof body.apply_link === 'string' && isValidApplyLink(body.apply_link)) {
      updates.push('apply_link = ?'); params.push(body.apply_link.trim().slice(0, 500));
    }
    if (typeof body.is_urgent === 'boolean') { updates.push('is_urgent = ?'); params.push(body.is_urgent ? 1 : 0); }
    if (typeof body.is_remote === 'boolean') { updates.push('is_remote = ?'); params.push(body.is_remote ? 1 : 0); }
    if (CATEGORIES.includes(body.category)) { updates.push('category = ?'); params.push(body.category); }
    if (body.salary_min !== undefined) { updates.push('salary_min = ?'); params.push(toNullableInt(body.salary_min)); }
    if (body.salary_max !== undefined) { updates.push('salary_max = ?'); params.push(toNullableInt(body.salary_max)); }
    if (SALARY_CURRENCIES.includes(body.salary_currency)) { updates.push('salary_currency = ?'); params.push(body.salary_currency); }

    if (!updates.length) return c.json({ error: 'No valid fields to update.' }, 400);

    // ── Content filtering on edit ─────────────────────
    try {
      const newTitle = body.title !== undefined ? sanitizeText(body.title, 200) : job.title;
      const newDesc = body.description !== undefined ? sanitizeText(body.description, 5000) : job.description;
      const newInfo = body.additional_info !== undefined ? sanitizeText(body.additional_info, 1000) : (job.additional_info || '');
      const filterResult = await contentFilter.check(`${newTitle} ${newDesc} ${newInfo}`);
      if (!filterResult.passed) {
        return c.json({
          error: 'Your edited content contains flagged content. Please revise and try again.',
        }, 400);
      }
    } catch (filterErr) {
      console.error('Content filter error on edit (fail-open):', filterErr);
    }

    params.push(jobId);
    await c.env.DB.prepare(`UPDATE jobs SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: 'Failed to update job.' }, 500);
  }
});

// Renew an expired job — initializes a fresh Paystack payment
jobs.post('/:id/renew', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const jobId = c.req.param('id');
    const job = await getJob(c.env.DB, jobId);
    if (!job) return c.json({ error: 'Job not found.' }, 404);
    if (!isOwnerOrAdmin(job, user)) return c.json({ error: 'Forbidden.' }, 403);

    const renewId = 'renew_' + crypto.randomUUID().slice(0, 10);
    const amountCents = PACKAGE_PRICES.single;
    const origin = c.req.header('origin') || SITE_ORIGIN;
    const callbackUrl = `${origin}/job?renew_reference=${renewId}`;

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email || 'adipotech@gmail.com',
        amount: amountCents,
        reference: renewId,
        callback_url: callbackUrl,
        metadata: { job_id: jobId, kind: 'renew' },
      }),
    });

    const paystackData = await paystackRes.json().catch(() => ({}));
    if (!paystackData.status) return c.json({ error: 'Failed to initialize renewal payment.' }, 400);

    return c.json({ ok: true, authorization_url: paystackData.data.authorization_url });
  } catch (e) {
    return c.json({ error: 'Failed to initialize renewal.' }, 500);
  }
});

// Admin endpoint to remove jobs (preserved)
jobs.delete('/:id', requireAdmin, async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare("UPDATE jobs SET status = 'deleted' WHERE id = ?").bind(id).run();
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: 'Failed to delete job.' }, 500);
  }
});

// ═══════════════════════════════════════════════════════
// CRON: Auto-expire jobs past deadline or 60-day window
// Called by a scheduled worker cron trigger (daily)
// ═══════════════════════════════════════════════════════
jobs.post('/cron/expire', async (c) => {
  try {
    // Only allow cron triggers (check for cron-specific header or secret)
    const cronSecret = c.req.header('X-Cron-Secret');
    if (cronSecret !== c.env.CRON_SECRET) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const result = await expireJobs(c.env);
    return c.json({ ok: true, ...result });
  } catch (e) {
    return c.json({ error: 'Failed to run expiry cron.' }, 500);
  }
});

export default jobs;

// ── Standalone export for cron (used by index.js scheduled handler) ──
export async function expireJobs(env) {
  const now = new Date().toISOString();
  let expiredByDeadline = 0;
  let expiredByAge = 0;

  try {
    const deadlineResult = await env.DB.prepare(
      `UPDATE jobs SET status = 'expired'
       WHERE status = 'active'
         AND deadline IS NOT NULL
         AND deadline != ''
         AND deadline < ?`
    ).bind(now).run();
    expiredByDeadline = deadlineResult?.meta?.changes || 0;
  } catch (e) {
    console.error(JSON.stringify({ kind: 'jobs_expire_deadline_failed', message: e.message }));
  }

  try {
    const ageResult = await env.DB.prepare(
      `UPDATE jobs SET status = 'expired'
       WHERE status = 'active'
         AND (deadline IS NULL OR deadline = '')
         AND created_at < datetime('now', '-60 days')`
    ).run();
    expiredByAge = ageResult?.meta?.changes || 0;
  } catch (e) {
    console.error(JSON.stringify({ kind: 'jobs_expire_age_failed', message: e.message }));
  }

  return { expiredByDeadline, expiredByAge, checkedAt: now };
}