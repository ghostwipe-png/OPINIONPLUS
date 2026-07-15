// Minimal signed-cookie session, so we don't need a JWT dependency in a
// Worker. Not a full JWT — just an HMAC over a JSON payload. Good enough for
// a first-party session cookie; swap for proper JWT/OAuth session handling
// before scaling this up.

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function createSessionToken(secret, payload) {
  const body = btoa(JSON.stringify(payload));
  const sig = await hmac(secret, body);
  return `${body}.${sig}`;
}

export async function verifySessionToken(secret, token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = await hmac(secret, body);
  if (expected !== sig) return null;
  try {
    return JSON.parse(atob(body));
  } catch (e) {
    return null;
  }
}

export function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function sessionCookieHeader(token, { maxAgeSeconds = 60 * 60 * 24 * 30 } = {}) {
  return `op_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

export const clearSessionCookieHeader =
  'op_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
