import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { attachUser } from './middleware/auth.js';
import auth from './routes/auth.js';
import stories from './routes/stories.js';
import users from './routes/users.js';
import uploads from './routes/uploads.js';
import admin from './routes/admin.js';

const app = new Hono();

app.use('*', async (c, next) => {
  const middleware = cors({
    origin: c.env.ALLOWED_ORIGIN,
    credentials: true,
  });
  return middleware(c, next);
});

app.use('*', attachUser);

app.get('/', (c) => c.json({ ok: true, service: 'opinionplus-api' }));

app.route('/auth', auth);
app.route('/stories', stories);
app.route('/users', users);
app.route('/uploads', uploads);
app.route('/admin', admin);

app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Something went wrong.' }, 500);
});

export default app;
