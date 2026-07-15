'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { useStore } from '../lib/store';
import { useRouter } from 'next/navigation';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function GoogleLoginButton() {
  const { loginWithGoogle } = useAuth();
  const { upsertUser } = useStore();
  const router = useRouter();
  const btnRef = useRef(null);
  const initialized = useRef(false);

  const handleCallback = useCallback(async (response) => {
    try {
      const profile = await loginWithGoogle(response.credential);
      upsertUser({
        id: profile.id,
        email: profile.email,
        name: profile.name,
        publisherName: profile.publisherName || profile.name,
        logoUrl: profile.logoUrl || profile.picture,
        bio: profile.bio || '',
        socialLink: profile.socialLink || '',
        role: profile.role || 'user',
        suspended: false,
        createdAt: profile.createdAt || new Date().toISOString(),
      });
      router.push('/');
    } catch (e) {
      console.error('Sign-in failed:', e);
    }
  }, [loginWithGoogle, upsertUser, router]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !window.google || initialized.current) return;
    initialized.current = true;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCallback,
    });

    if (btnRef.current) {
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
      });
    }
  }, [handleCallback]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="text-center">
        <p className="text-sm text-ink-600 mb-2">Google Sign-In is not configured.</p>
        <p className="text-xs text-ink-400">
          Add <code className="font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> to your environment variables.
        </p>
      </div>
    );
  }

  return <div ref={btnRef}></div>;
}