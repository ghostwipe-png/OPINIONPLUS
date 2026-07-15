import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';

const uploads = new Hono();

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const MAX_BYTES = 25 * 1024 * 1024; // 25MB

uploads.post('/document', requireAuth, async (c) => {
  const form = await c.req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') return c.json({ error: 'file is required' }, 400);
  if (!ALLOWED_TYPES.has(file.type)) return c.json({ error: 'Unsupported file type.' }, 400);
  if (file.size > MAX_BYTES) return c.json({ error: 'File is too large (25MB max).' }, 400);

  const user = c.get('user');
  const key = `${user.id}/${crypto.randomUUID()}-${file.name}`;
  await c.env.FILES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  // Serve via a public R2 bucket URL or a custom domain bound to the bucket.
  // See README "Cloudflare R2 setup" for connecting a public bucket domain.
  const url = `${c.env.R2_PUBLIC_BASE || ''}/${key}`;
  return c.json({ url, name: file.name });
});

export default uploads;
