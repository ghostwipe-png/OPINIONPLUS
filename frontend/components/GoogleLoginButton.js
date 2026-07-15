'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, ROOT_ADMIN_EMAIL } from '../lib/auth';
import { useStore } from '../lib/store';
import { useRouter } from 'next/navigation';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const HAS_REAL_CLIENT_ID = !!GOOGLE_CLIENT_ID;

const DEV_PROFILES = [
  {
    googleSub: 'g_root', email: ROOT_ADMIN_EMAIL, name: 'OpinionPlus Root',
    picture: 'https://api.dicebear.com/7.x/initials/svg?seed=Root',
  },
  {
    googleSub: 'g_amara', email: 'amara.okoye@example.com', name: 'Amara Okoye',
    picture: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop',
  },
  {
    googleSub: 'g_new', email: 'new.writer@example.com', name: 'New Writer',
    picture: 'https://api.dicebear.com/7.x/initials/svg?seed=New',
  },
];

export default function GoogleLoginButton() {
  const { login, loginWithGoogle } = useAuth();
  const { upsertUser } = useStore();
  const router = useRouter();
  const btnRef = useRef(null);
  const initialized = useRef(false);
  const [devOpen, setDevOpen] = useState(false);

  const afterLogin = (profile) => {
    upsertUser({
      id: profile.id || profile.googleSub,
      email: profile.email,
      name: profile.name,
      publisherName: profile.publisherName || profile.name,
      logoUrl: profile.logoUrl || profile.picture,
      bio: profile.bio || '',
      socialLink: profile.socialLink || '',
      role: profile.role || (profile.email === ROOT_ADMIN_EMAIL ? 'root' : 'user'),
      suspended: false,
      createdAt: profile.createdAt || new Date().toISOString(),
    });
    router.push('/');
  };

  const handleCallback = useCallback(async (response) => {
    try {
      const profile = await loginWithGoogle(response.credential);
      afterLogin(profile);
    } catch (e) {
      console.error('Sign-in failed:', e);
    }
  }, [loginWithGoogle]);

  useEffect(() => {
    if (!HAS_REAL_CLIENT_ID || !window.google || initialized.current) return;
    initialized.current = true;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCallback,
    });

    if (btnRef.current) {
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: 'outline', size: 'large', text: 'continue_with',
      });
    }
  }, [handleCallback]);

  // Dev mode — no real client ID
  if (!HAS_REAL_CLIENT_ID) {
    return (
      <div>
        <button onClick={() => setDevOpen(o => !o)} className="btn-primary w-full py-3 rounded-sm text-sm">
          Continue with Google (dev mode)
        </button>
        <p className="text-xs text-ink-400 mt-2">
          No <code className="font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> set — using mock accounts.
        </p>
        {devOpen && (
          <div className="mt-3 border border-wire rounded-sm divide-y divide-wire">
            {DEV_PROFILES.map(p => (
              <button
                key={p.email}
                onClick={() => {
                  const profile = login(p);
                  afterLogin(profile);
                }}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-ink-50 transition-colors"
              >
                <img src={p.picture} alt="" className="w-8 h-8 rounded-full" />
                <span className="text-sm">
                  <span className="font-medium">{p.name}</span><br />
                  <span className="text-ink-400 text-xs">{p.email}</span>
                  {p.email === ROOT_ADMIN_EMAIL && (
                    <span className="text-signal text-xs font-semibold"> · Root admin</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return <div ref={btnRef}></div>;
}