// backend/src/middleware/paystackWebhook.js
export async function verifyPaystackWebhook(request, secretKey) {
  try {
    const bodyText = await request.clone().text();
    const signature = request.headers.get('x-paystack-signature');
    if (!signature) return { valid: false, body: null };

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secretKey),
      { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']
    );
    
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(bodyText));
    const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    const valid = hex === signature;
    return { valid, body: valid ? JSON.parse(bodyText) : null };
  } catch (e) {
    return { valid: false, body: null };
  }
}