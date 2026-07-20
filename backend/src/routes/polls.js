import { Hono } from 'hono';

const polls = new Hono();

// GET /polls/:id — Get poll details, options, and vote distribution
polls.get('/:id', async (c) => {
  const pollId = c.req.param('id');
  const poll = await c.env.DB.prepare('SELECT * FROM polls WHERE id = ?').bind(pollId).first();
  if (!poll) return c.json({ error: 'Poll not found.' }, 404);

  const votesRes = await c.env.DB.prepare(
    'SELECT option_index, COUNT(*) as count FROM poll_votes WHERE poll_id = ? GROUP BY option_index'
  ).bind(pollId).all();

  const votes = {};
  let total = 0;
  for (const row of votesRes.results) {
    votes[row.option_index] = row.count;
    total += row.count;
  }

  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const userVote = await c.env.DB.prepare(
    'SELECT option_index FROM poll_votes WHERE poll_id = ? AND user_identifier = ?'
  ).bind(pollId, ip).first();

  return c.json({
    poll,
    votes,
    total,
    userVoted: userVote ? userVote.option_index : undefined,
  });
});

// POST /polls/:id/vote — Cast a vote on a poll
polls.post('/:id/vote', async (c) => {
  const pollId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const optionIndex = body.optionIndex;

  if (optionIndex === undefined || typeof optionIndex !== 'number') {
    return c.json({ error: 'Invalid option index.' }, 400);
  }

  const poll = await c.env.DB.prepare('SELECT id, options FROM polls WHERE id = ?').bind(pollId).first();
  if (!poll) return c.json({ error: 'Poll not found.' }, 404);

  const options = JSON.parse(poll.options || '[]');
  if (optionIndex < 0 || optionIndex >= options.length) {
    return c.json({ error: 'Option out of range.' }, 400);
  }

  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const voteId = crypto.randomUUID();

  try {
    await c.env.DB.prepare(
      'INSERT INTO poll_votes (id, poll_id, user_identifier, option_index) VALUES (?, ?, ?, ?)'
    ).bind(voteId, pollId, ip, optionIndex).run();
  } catch (e) {
    return c.json({ error: 'You have already voted on this poll.' }, 400);
  }

  const votesRes = await c.env.DB.prepare(
    'SELECT option_index, COUNT(*) as count FROM poll_votes WHERE poll_id = ? GROUP BY option_index'
  ).bind(pollId).all();

  const votes = {};
  let total = 0;
  for (const row of votesRes.results) {
    votes[row.option_index] = row.count;
    total += row.count;
  }

  return c.json({ ok: true, votes, total });
});

export default polls;