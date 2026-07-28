'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, ROOT_ADMIN_EMAIL } from '../lib/auth';
import { useStore } from '../lib/store';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, WifiOff } from 'lucide-react';

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

/**
 * Props are optional. If onSuccess/onStart/onError aren't provided, this
 * falls back to the original behavior (upsert into the local store + push
 * to '/'), so existing call sites keep working unchanged.
 */
export default function GoogleLoginButton({ onStart, onSuccess, onError, label = 'Continue with Google' }) {
  const { login, loginWithGoogle } = useAuth();
  const { upsertUser } = useStore();
  const router = useRouter();

  const btnRef = useRef(null);
  const initialized = useRef(false);

  const [devOpen, setDevOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(HAS_REAL_CLIENT_ID); // Load state for SDK inject
  const [error, setError] = useState(null);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  const afterLogin = useCallback((profile) => {
    if (onSuccess) {
      onSuccess(profile);
      return;
    }
    try {
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
    } catch (err) {
      const message = 'Failed to construct user session. Please try again.';
      setError(message);
      setIsLoading(false);
      if (onError) onError(message);
    }
  }, [upsertUser, router, onSuccess, onError]);

  const handleCallback = useCallback(async (response) => {
    if (isOffline) {
      setError("You're offline. Connect to the internet to sign in.");
      return;
    }
    setIsLoading(true);
    setError(null);
    if (onStart) onStart();
    try {
      const profile = await loginWithGoogle(response.credential);
      if (!profile) throw new Error('No profile returned from authentication.');
      afterLogin(profile);
    } catch (e) {
      console.error('Sign-in failed:', e);
      const message = mapErrorMessage(e);
      setError(message);
      setIsLoading(false);
      if (onError) onError(message);
    }
  }, [loginWithGoogle, afterLogin, onStart, onError, isOffline]);

  function mapErrorMessage(e) {
    const raw = (e && e.message) || '';
    if (/offline/i.test(raw)) return raw;
    if (/suspended/i.test(raw)) return 'This account has been suspended. Contact support.';
    if (/expired|invalid.*token/i.test(raw)) return 'Session expired. Please try again.';
    if (/network|fetch|failed to fetch/i.test(raw)) return 'Connection failed. Check your internet and try again.';
    return raw || 'Authentication failed. Please try again.';
  }

  useEffect(() => {
    if (!HAS_REAL_CLIENT_ID || initialized.current) return;

    const initializeGoogleSignIn = () => {
      try {
        if (!window.google?.accounts?.id) throw new Error('Google SDK not loaded properly');

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCallback,
          auto_select: false,
          cancel_on_tap_outside: true
        });

        if (btnRef.current) {
          window.google.accounts.id.renderButton(btnRef.current, {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            width: '100%',
            shape: 'rectangular',
            logo_alignment: 'center'
          });
          setIsLoading(false);
        }
        initialized.current = true;
      } catch (err) {
        setError('Failed to initialize secure login. Ensure cookies are enabled.');
        setIsLoading(false);
      }
    };

    if (!window.google) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogleSignIn;
      script.onerror = () => {
        setError('Could not connect to Google servers. Check your connection.');
        setIsLoading(false);
      };
      document.body.appendChild(script);
    } else {
      initializeGoogleSignIn();
    }
  }, [handleCallback]);

  // Offline state takes priority over everything else.
  if (isOffline) {
    return (
      <div className="w-full bg-ink-50 border border-wire text-ink-600 rounded-sm p-4 text-xs font-medium flex items-start gap-2">
        <WifiOff size={16} className="shrink-0 mt-0.5" />
        <div className="flex-1">
          <p>You&apos;re offline. Connect to the internet to sign in.</p>
          <p className="mt-1 text-ink-400">We&apos;ll try again automatically once you&apos;re back online.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full bg-red-50 border border-red-200 text-red-600 rounded-sm p-4 text-xs font-medium flex items-start gap-2">
        <AlertCircle size={16} className="shrink-0 mt-0.5" />
        <div className="flex-1">
          <p>{error}</p>
          <button
            onClick={() => { setError(null); window.location.reload(); }}
            className="mt-2 font-bold uppercase tracking-widest text-[10px] underline hover:text-red-800"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  if (HAS_REAL_CLIENT_ID) {
    return (
      <div className="w-full relative min-h-[44px]">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-paper border border-wire rounded-sm">
            <Loader2 size={18} className="animate-spin text-ink-400" />
          </div>
        )}
        <div ref={btnRef} className={`w-full flex justify-center ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}></div>
      </div>
    );
  }

  // Fallback: Dev Mode Mock Accounts
  return (
    <div className="w-full">
      <button
        onClick={() => setDevOpen(o => !o)}
        disabled={isLoading}
        className="w-full bg-ink text-white font-bold uppercase tracking-widest text-xs py-3.5 rounded-sm hover:bg-signal transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
      >
        {isLoading ? <Loader2 size={16} className="animate-spin" /> : label}
      </button>
      <p className="text-[10px] text-ink-400 mt-3 font-medium text-center uppercase tracking-wider">
        No <code className="font-mono bg-wire/30 px-1 rounded mx-0.5">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>
      </p>

      {devOpen && (
        <div className="mt-4 border-2 border-wire rounded-sm divide-y divide-wire bg-white overflow-hidden animate-in slide-in-from-top-2 duration-200">
          {DEV_PROFILES.map(p => (
            <button
              key={p.email}
              disabled={isLoading}
              onClick={() => {
                setIsLoading(true);
                if (onStart) onStart();
                setTimeout(() => {
                  const profile = login(p);
                  afterLogin(profile);
                }, 400);
              }}
              className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-ink-50 transition-colors disabled:opacity-50"
            >
              <img src={p.picture} alt="" className="w-9 h-9 rounded-full border border-wire shrink-0" />
              <span className="text-sm flex-1 min-w-0">
                <span className="font-bold text-ink truncate block">{p.name}</span>
                <span className="text-ink-400 text-xs truncate block mt-0.5">{p.email}</span>
              </span>
              {p.email === ROOT_ADMIN_EMAIL && (
                <span className="text-white bg-signal text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-sm shrink-0 shadow-sm">
                  Root
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
