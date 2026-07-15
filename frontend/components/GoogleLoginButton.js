'use client';

import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../lib/auth';
import { useStore } from '../lib/store';
import { useRouter } from 'next/navigation';

const HAS_REAL_CLIENT_ID = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function GoogleLoginButton() {
  const { loginWithGoogle } = useAuth();
  const { upsertUser } = useStore();
  const router = useRouter();

  const afterLogin = (profile) => {
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
  };

  if (!HAS_REAL_CLIENT_ID) {
    return (
      <div className="text-center">
        <p className="text-sm text-ink-600 mb-2">Google Sign-In is not configured.</p>
        <p className="text-xs text-ink-400">
          Add <code className="font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> to your environment variables.
        </p>
      </div>
    );
  }

  return (
    <GoogleLogin
      onSuccess={async (cred) => {
        try {
          const profile = await loginWithGoogle(cred.credential);
          afterLogin(profile);
        } catch (e) {
          console.error('Sign-in failed:', e);
          alert(e.message || 'Sign-in failed. Please try again.');
        }
      }}
      onError={() => console.error('Google sign-in failed')}
      theme="outline"
      size="large"
      text="continue_with"
    />
  );
}