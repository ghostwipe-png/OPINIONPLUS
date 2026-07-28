'use client';

import { useEffect } from 'react';
import GoogleLoginButton from '../../components/GoogleLoginButton';
import { useAuth } from '../../lib/auth';

function timeAgo(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso.replace(' ', 'T') + 'Z').getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function SkeletonCard() {
  return (
    <div className="max-w-md mx-auto px-5 py-20">
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-24 bg-wire/40 rounded-sm" />
        <div className="h-8 w-64 bg-wire/40 rounded-sm" />
        <div className="h-4 w-full bg-wire/30 rounded-sm" />
        <div className="h-14 bg-wire/40 rounded-sm mt-6" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { ready, isAuthenticated, sessionMeta } = useAuth();

  useEffect(() => {
    if (ready && isAuthenticated) {
      window.location.href = '/';
    }
  }, [ready, isAuthenticated]);

  if (!ready || isAuthenticated) {
    return <SkeletonCard />;
  }

  const lastLogin = sessionMeta?.loginHistory?.find((h) => h.success);

  return (
    <div className="max-w-md mx-auto px-5 py-20 animate-in fade-in duration-300">
      <p className="wire-tag mb-3">Sign in</p>
      <h1 className="editorial-h text-3xl font-bold mb-2">Bring your name to the top of the page.</h1>
      <p className="text-sm text-ink-600 mb-8">
        OpinionPlus uses Google sign-in only — no passwords to lose, no forms to fill in twice.
      </p>
      <div className="border border-wire rounded-sm p-6">
        <GoogleLoginButton />
      </div>

      {lastLogin && (
        <p className="text-xs text-ink-400 mt-4">
          Last sign-in: {timeAgo(lastLogin.created_at)}
          {sessionMeta?.trustedDeviceCount ? ` · ${sessionMeta.trustedDeviceCount} trusted device${sessionMeta.trustedDeviceCount === 1 ? '' : 's'}` : ''}
        </p>
      )}

      <p className="text-xs text-ink-400 mt-6">
        By continuing you agree to publish under your own name or a clearly attributed publisher
        name, and to our{' '}
        <a href="/privacy" className="underline">
          privacy policy
        </a>
        .
      </p>
    </div>
  );
}
