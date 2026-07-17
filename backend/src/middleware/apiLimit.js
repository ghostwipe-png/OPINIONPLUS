export async function apiLimit(c, next) {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Authentication required.' }, 401);

  const usage = await c.env.DB.prepare(
    'SELECT * FROM api_usage WHERE user_id = ?'
  ).bind(user.id).first();

  const today = new Date().toISOString().slice(0, 10);

  if (!usage || usage.date !== today) {
    // Reset or create
    await c.env.DB.prepare(
      'INSERT INTO api_usage (user_id, calls_today, date, tier) VALUES (?, 1, ?, ?) ON CONFLICT(user_id) DO UPDATE SET calls_today = 1, date = ?'
    ).bind(user.id, today, 'free', today).run();
    return await next();
  }

  // Pro users — unlimited
  if (usage.tier === 'pro' && usage.subscription_active) {
    await c.env.DB.prepare(
      'UPDATE api_usage SET calls_today = calls_today + 1 WHERE user_id = ?'
    ).bind(user.id).run();
    return await next();
  }

  // Free users — limit 50/day
  if (usage.calls_today >= 50) {
    return c.json({ 
      error: 'Daily API limit reached (50 calls). Upgrade to Pro for unlimited access.',
      upgrade_url: '/profile'
    }, 429);
  }

  await c.env.DB.prepare(
    'UPDATE api_usage SET calls_today = calls_today + 1 WHERE user_id = ?'
  ).bind(user.id).run();

  await next();
}