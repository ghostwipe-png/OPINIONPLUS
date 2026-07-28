'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import GoogleLoginButton from '../../components/GoogleLoginButton';
import { useAuth } from '../../lib/auth';

// Strip anything that isn't alphanumeric/dash/underscore and cap length,
// so an arbitrary query param never lands in storage or a request body untouched.
function sanitizeReferralCode(raw) {
  if (!raw) return '';
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);
}

function SkeletonCard() {
  return (
    <div className="max-w-md mx-auto px-5 py-24 text-center">
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-24 bg-wire/40 rounded-sm mx-auto" />
        <div className="h-8 w-64 bg-wire/40 rounded-sm mx-auto" />
        <div className="h-14 bg-wire/40 rounded-sm mt-6" />
      </div>
    </div>
  );
}

function SignupContent() {
  const searchParams = useSearchParams();
  const { ready, isAuthenticated } = useAuth();
  const rawRef = searchParams.get('ref');
  const [referralCode, setReferralCode] = useState('');

  useEffect(() => {
    const clean = sanitizeReferralCode(rawRef);
    if (clean) {
      setReferralCode(clean);
      try {
        localStorage.setItem('op_referral', clean);
      } catch (e) { /* ignore */ }
    }
  }, [rawRef]);

  useEffect(() => {
    if (ready && isAuthenticated) {
      window.location.href = '/';
    }
  }, [ready, isAuthenticated]);

  if (!ready || isAuthenticated) {
    return <SkeletonCard />;
  }

  return (
    <div className="max-w-md mx-auto px-5 py-24 text-center animate-in fade-in duration-300">
      <p className="wire-tag mb-3">Join OPINIONPLUS</p>
      <h1 className="editorial-h text-3xl font-bold mb-4">Create your account</h1>

      {referralCode ? (
        <div className="border border-wire bg-ink-50 rounded-sm p-3 mb-6 text-xs text-ink-600">
          You were referred by a partner. After signing up, subscribe to the Partner Program to start earning.
        </div>
      ) : (
        <p className="text-sm text-ink-400 mb-8">
          Sign up with Google to start publishing your stories.
        </p>
      )}

      <GoogleLoginButton label="Sign up with Google" />

      <p className="text-xs text-ink-400 mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-signal font-medium">Sign in</Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SkeletonCard />}>
      <SignupContent />
    </Suspense>
  );
}
