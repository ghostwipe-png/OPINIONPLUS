// backend/src/middleware/circuitBreaker.js
// Circuit Breaker Pattern — Prevents cascade failures when external APIs are down.
// After 5 consecutive failures, stops calling that service for 60 seconds.
// After cooldown, allows one test request. Success resets, failure extends cooldown.

const FAILURE_THRESHOLD = 5;
const COOLDOWN_SECONDS = 60;

class CircuitBreakerOpenError extends Error {
  constructor(serviceName) {
    super(`Service temporarily unavailable: ${serviceName}. Please try again later.`);
    this.name = 'CircuitBreakerOpenError';
    this.serviceName = serviceName;
  }
}

// ── Safe DB helpers ──────────────────────────────────────────────────────

async function safeDbFirst(env, sql, ...params) {
  try { return await env.DB.prepare(sql).bind(...params).first(); }
  catch (e) { console.error('CB_DB_ERROR:', e.message); return null; }
}

async function safeDbRun(env, sql, ...params) {
  try { return await env.DB.prepare(sql).bind(...params).run(); }
  catch (e) { console.error('CB_DB_ERROR:', e.message); return null; }
}

// ── Core circuit breaker logic ───────────────────────────────────────────

async function withCircuitBreaker(env, serviceName, fn) {
  if (!env?.DB) {
    // No DB available — call the function directly (degraded mode)
    return await fn();
  }

  // Read current state
  const row = await safeDbFirst(
    env,
    'SELECT * FROM circuit_breaker_state WHERE service_name = ?',
    serviceName
  );

  const state = row?.state || 'closed';
  const failureCount = row?.failure_count || 0;
  const openedAt = row?.opened_at;

  // If circuit is OPEN, check if cooldown has passed
  if (state === 'open' && openedAt) {
    const elapsed = (Date.now() - new Date(openedAt + 'Z').getTime()) / 1000;
    if (elapsed < COOLDOWN_SECONDS) {
      // Still cooling down — reject immediately
      throw new CircuitBreakerOpenError(serviceName);
    }
    // Cooldown passed — allow one test request (half-open)
  }

  try {
    const result = await fn();

    // Success — reset the circuit
    await safeDbRun(
      env,
      `UPDATE circuit_breaker_state 
       SET failure_count = 0, state = 'closed', last_success_at = datetime('now'), updated_at = datetime('now')
       WHERE service_name = ?`,
      serviceName
    );

    return result;
  } catch (e) {
    // Failure — increment counter
    const newCount = failureCount + 1;
    const newState = newCount >= FAILURE_THRESHOLD ? 'open' : 'closed';

    await safeDbRun(
      env,
      `UPDATE circuit_breaker_state 
       SET failure_count = ?, state = ?, last_failure_at = datetime('now'),
           opened_at = CASE WHEN ? >= ? THEN datetime('now') ELSE opened_at END,
           updated_at = datetime('now')
       WHERE service_name = ?`,
      newCount, newState, newCount, FAILURE_THRESHOLD, serviceName
    );

    if (newState === 'open') {
      console.error(JSON.stringify({
        kind: 'circuit_breaker_opened',
        service: serviceName,
        failures: newCount,
        timestamp: new Date().toISOString(),
      }));
    }

    throw e;
  }
}

// ── Admin functions ──────────────────────────────────────────────────────

async function resetCircuitBreaker(env, serviceName) {
  await safeDbRun(
    env,
    `UPDATE circuit_breaker_state 
     SET failure_count = 0, state = 'closed', opened_at = NULL, updated_at = datetime('now')
     WHERE service_name = ?`,
    serviceName
  );
  return { ok: true, service: serviceName, state: 'closed' };
}

async function getCircuitBreakerStatus(env) {
  if (!env?.DB) return [];
  try {
    const { results } = await env.DB.prepare('SELECT * FROM circuit_breaker_state').all();
    return results || [];
  } catch (e) {
    console.error('CB_STATUS_ERROR:', e.message);
    return [];
  }
}

export {
  withCircuitBreaker,
  resetCircuitBreaker,
  getCircuitBreakerStatus,
  CircuitBreakerOpenError,
};