// backend/src/routes/campuses.js
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';

const campuses = new Hono();

// Helper: Secure Logging
async function logEvent(c, action, payload = {}) {
  try { 
    console.log(JSON.stringify({ kind: 'campus_log', action, timestamp: new Date().toISOString(), ...payload })); 
  } catch (e) {}
}

// List active campus editions
campuses.get('/', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT id, university_name, representative_name, status, created_at, contact_email FROM campus_editions WHERE status = 'active' ORDER BY created_at DESC`
    ).all();
    return c.json({ campuses: results });
  } catch (e) { 
    return c.json({ error: 'Failed to load campuses' }, 500); 
  }
});

// Direct Free Registration (Payments Disabled)
campuses.post('/', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { university_name, representative_name, contact_email } = body;

    if (!university_name || !contact_email) {
      return c.json({ error: 'University name and contact email are required.' }, 400);
    }

    // Check if university already exists to prevent duplicates
    const existing = await c.env.DB.prepare('SELECT id FROM campus_editions WHERE university_name = ?')
      .bind(university_name).first();
      
    if (existing) {
      return c.json({ error: 'This university is already registered.' }, 409);
    }

    const campusId = `campus_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const repName = representative_name || user?.publisherName || user?.publisher_name || 'Campus Admin';

    // We can now safely save the user_id!
    await c.env.DB.prepare(
      `INSERT INTO campus_editions (id, university_name, contact_email, representative_name, status, user_id) 
       VALUES (?, ?, ?, ?, 'active', ?)`
    ).bind(
      campusId, 
      university_name, 
      contact_email, 
      repName,
      user.id
    ).run();

    await logEvent(c, 'campus_activated_free', { university: university_name, campusId });

    return c.json({ ok: true, message: 'Campus registered successfully' }, 201);
    
  } catch (e) {
    console.error("Campus Registration Error:", e);
    return c.json({ error: e.message || 'Failed to register campus.' }, 500);
  }
});

export default campuses;