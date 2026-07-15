export const metadata = { title: 'Privacy Policy — OPINIONPLUS' };

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-16">
      <p className="wire-tag mb-3">Legal</p>
      <h1 className="editorial-h text-4xl font-bold mb-8">Privacy Policy</h1>
      <p className="text-xs text-ink-400 mb-10">Last updated: July 2026</p>

      <div className="prose-story text-ink-700">
        <h2 className="editorial-h text-xl font-bold mt-8 mb-2">What we collect</h2>
        <p>
          When you sign in with Google, we receive your name, email address, and profile photo.
          When you publish, we store the content you write and any media or files you attach.
          When you engage with a story — a like, a comment, a rating, a follow — we store that
          action against your account so it can be shown to other readers.
        </p>

        <h2 className="editorial-h text-xl font-bold mt-8 mb-2">What we don&apos;t collect</h2>
        <p>
          We don&apos;t require a password, and we don&apos;t ask for information beyond what
          publishing and engaging with the platform requires. Unregistered visitors can read and
          share without an account.
        </p>

        <h2 className="editorial-h text-xl font-bold mt-8 mb-2">Your rights (GDPR &amp; equivalent)</h2>
        <p>
          If you&apos;re in the EU, UK, or a jurisdiction with equivalent protections, you have
          the right to access, correct, export, or delete your personal data. You can edit your
          profile directly, or contact us to request a full export or deletion of your account
          and content.
        </p>

        <h2 className="editorial-h text-xl font-bold mt-8 mb-2">How long we keep it</h2>
        <p>
          Your content stays published until you delete it or your account is removed. Admin
          action logs (moderation actions, IP address at time of action) are retained for
          platform integrity and are not visible to the public.
        </p>

        <h2 className="editorial-h text-xl font-bold mt-8 mb-2">Third parties</h2>
        <p>
          Images and video are processed and delivered by Cloudinary. Documents are stored on
          Cloudflare R2. Authentication is handled by Google. None of these providers see the
          content of your stories beyond what&apos;s necessary to host or display them.
        </p>

        <h2 className="editorial-h text-xl font-bold mt-8 mb-2">Contact</h2>
        <p>
          Questions about this policy or a data request can be sent through our{' '}
          <a href="/contact" className="text-signal underline">
            contact page
          </a>
          .
        </p>
      </div>
    </div>
  );
}