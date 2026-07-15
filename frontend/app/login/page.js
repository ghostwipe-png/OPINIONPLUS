import GoogleLoginButton from '../../components/GoogleLoginButton';

export const metadata = { title: 'Sign in — OPINIONPLUS' };

export default function LoginPage() {
  return (
    <div className="max-w-md mx-auto px-5 py-20">
      <p className="wire-tag mb-3">Sign in</p>
      <h1 className="editorial-h text-3xl font-bold mb-2">Bring your name to the top of the page.</h1>
      <p className="text-sm text-ink-600 mb-8">
        OpinionPlus uses Google sign-in only — no passwords to lose, no forms to fill in twice.
      </p>
      <div className="border border-wire rounded-sm p-6">
        <GoogleLoginButton />
      </div>
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
