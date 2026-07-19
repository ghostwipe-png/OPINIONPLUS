// backend/src/utils/db.js
//
// Lightweight retry wrapper around a D1 database binding.
//
// Exposes the same surface D1 gives you (prepare/bind/first/all/run/raw/exec)
// so it is a drop-in replacement anywhere c.env.DB is used today. Nothing
// about existing code changes: routes that keep using c.env.DB directly are
// completely unaffected. This wrapper is opt-in, attached separately to the
// request context as c.get('db') by the DB wrapper middleware in index.js.
//
// Behavior:
//  - Retries transient SQLite contention errors (SQLITE_BUSY, SQLITE_LOCKED)
//    up to 3 times with exponential backoff: 100ms, 300ms, 700ms.
//  - Logs any query that takes longer than 500ms, successful or not.
//  - Never retries non-transient errors — those are logged and re-thrown
//    immediately so calling code sees the same error shape it always has.

const MAX_RETRIES = 3;
const BACKOFFS_MS = [100, 300, 700];
const SLOW_QUERY_MS = 500;

function defaultLogger(level, message, meta = {}) {
  const entry = { level, message, ts: new Date().toISOString(), ...meta };
  if (level === 'error' || level === 'warn') console.error(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

function isTransientError(err) {
  const msg = (err && err.message) || String(err);
  return msg.includes('SQLITE_BUSY') || msg.includes('SQLITE_LOCKED');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, { sql, op, logger }) {
  let attempt = 0;
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const result = await fn();
      const durationMs = Date.now() - start;
      if (durationMs > SLOW_QUERY_MS) {
        logger('warn', 'slow query', { op, sql, durationMs, attempt });
      }
      return result;
    } catch (err) {
      if (attempt < MAX_RETRIES && isTransientError(err)) {
        const delay = BACKOFFS_MS[attempt] ?? BACKOFFS_MS[BACKOFFS_MS.length - 1];
        logger('warn', 'transient db error, retrying', {
          op, sql, attempt: attempt + 1, delayMs: delay, error: err.message,
        });
        await sleep(delay);
        attempt++;
        continue;
      }
      logger('error', 'db operation failed', {
        op, sql, attempt, durationMs: Date.now() - start, error: err.message,
      });
      throw err;
    }
  }
}

function wrapStatement(stmt, sql, logger) {
  return {
    bind(...args) {
      return wrapStatement(stmt.bind(...args), sql, logger);
    },
    first(colName) {
      return withRetry(() => stmt.first(colName), { sql, op: 'first', logger });
    },
    all() {
      return withRetry(() => stmt.all(), { sql, op: 'all', logger });
    },
    run() {
      return withRetry(() => stmt.run(), { sql, op: 'run', logger });
    },
    raw() {
      return withRetry(() => stmt.raw(), { sql, op: 'raw', logger });
    },
  };
}

// createDB(d1, logger?) -> wrapped DB with the same interface as a raw D1
// binding. `logger` may be any function matching (level, message, meta).
// Falls back silently to the raw binding if none is provided (e.g. undefined
// env.DB in a route that doesn't need it) so it never introduces a new
// failure mode.
export function createDB(d1, logger = defaultLogger) {
  if (!d1) return d1;
  return {
    prepare(sql) {
      const stmt = d1.prepare(sql);
      return wrapStatement(stmt, sql, logger);
    },
    exec(sql) {
      return withRetry(() => d1.exec(sql), { sql, op: 'exec', logger });
    },
    batch(statements) {
      return withRetry(() => d1.batch(statements), { sql: 'batch', op: 'batch', logger });
    },
    dump() {
      return d1.dump ? d1.dump() : Promise.reject(new Error('dump() not supported by this binding'));
    },
  };
}
