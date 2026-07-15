// Verifies a Google Sign-In ID token server-side. Uses Google's tokeninfo
// endpoint for simplicity (fine for launch scale); switch to local JWKS
// verification (google-auth-library equivalent) if request volume grows.
export async function verifyGoogleIdToken(idToken, expectedClientId) {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
  if (!res.ok) return null;
  const payload = await res.json();
  if (payload.aud !== expectedClientId) return null;
  if (!payload.email_verified || payload.email_verified === 'false') return null;
  return {
    googleSub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };
}
