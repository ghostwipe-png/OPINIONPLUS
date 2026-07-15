'use client';

import Script from 'next/script';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from '../lib/auth';
import { StoreProvider } from '../lib/store';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

function InnerProviders({ children }) {
  return (
    <AuthProvider>
      <StoreProvider>{children}</StoreProvider>
    </AuthProvider>
  );
}

export default function Providers({ children }) {
  return (
    <>
      {/* Only loaded when real Cloudinary credentials are configured — see
          lib/mediaUpload.js, which falls back to local file previews
          otherwise. */}
      {CLOUDINARY_CLOUD_NAME && (
        <Script src="https://upload-widget.cloudinary.com/global/all.js" strategy="afterInteractive" />
      )}

      {GOOGLE_CLIENT_ID ? (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          <InnerProviders>{children}</InnerProviders>
        </GoogleOAuthProvider>
      ) : (
        <InnerProviders>{children}</InnerProviders>
      )}
    </>
  );
}
