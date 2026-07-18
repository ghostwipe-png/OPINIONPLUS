'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import GoogleLoginButton from '../../components/GoogleLoginButton';

function SignupContent() {
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref');
  const [referralCode, setReferralCode] = useState('');

  useEffect(() => {
    if (ref) {
      setReferralCode(ref);
      localStorage.setItem('op_referral', ref);
    }
  }, [ref]);

  return (
    <div className="max-w-md mx-auto px-5 py-24 text-center">
      <p className="wire-tag mb-3">Join OPINIONPLUS</p>
      <h1 className="editorial-h text-3xl font-bold mb-4">Create your account</h1>
      <p className="text-sm text-ink-400 mb-8">
        {referralCode
          ? 'You were referred by a partner. After signing up, subscribe to the Partner Program to start earning.'
          : 'Sign up with Google to start publishing your stories.'}
      </p>

      <GoogleLoginButton />

      <p className="text-xs text-ink-400 mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-signal font-medium">Sign in</Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto px-5 py-24 text-center"><p className="text-sm text-ink-400">Loading...</p></div>}>
      <SignupContent />
    </Suspense>
  );
}