'use client';

import Script from 'next/script';
import { AuthProvider } from '../lib/auth';
import { StoreProvider } from '../lib/store';

const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

export default function Providers({ children }) {
  return (
    <>
      {CLOUDINARY_CLOUD_NAME && (
        <Script src="https://upload-widget.cloudinary.com/global/all.js" strategy="afterInteractive" />
      )}
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      <AuthProvider>
        <StoreProvider>{children}</StoreProvider>
      </AuthProvider>
    </>
  );
}