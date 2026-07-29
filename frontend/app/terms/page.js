// app/terms/page.js
'use client';

import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-paper py-16 px-5">
      <div className="max-w-3xl mx-auto">
        <div className="mb-12 border-b-2 border-wire pb-6">
          <h1 className="text-3xl sm:text-4xl font-black text-ink uppercase tracking-tight">Terms of Service</h1>
          <p className="text-sm text-ink-500 font-medium mt-2">Last updated: July 2026</p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed text-ink-700">
          <section>
            <h2 className="text-lg font-black text-ink uppercase tracking-wide mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using OPINIONPLUS (&quot;the Platform&quot;), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink uppercase tracking-wide mb-3">2. User Accounts</h2>
            <p>You must sign in using Google OAuth to publish content. You are responsible for maintaining the confidentiality of your account and for all activities under your account. You must provide accurate, current, and complete information during registration.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink uppercase tracking-wide mb-3">3. Content Ownership</h2>
            <p>You retain full ownership of all content you publish on OPINIONPLUS. By publishing, you grant OPINIONPLUS a non-exclusive, royalty-free, worldwide license to display, distribute, and promote your content on the Platform. You may delete your content at any time.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink uppercase tracking-wide mb-3">4. Prohibited Content</h2>
            <p>You may not publish content that:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Violates any applicable law or regulation</li>
              <li>Infringes on intellectual property rights</li>
              <li>Contains hate speech, harassment, or threats</li>
              <li>Contains spam, malware, or malicious code</li>
              <li>Impersonates another person or entity</li>
              <li>Contains sexually explicit material without proper labeling</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink uppercase tracking-wide mb-3">5. Services & Payments</h2>
            <p>OPINIONPLUS offers paid services including SMS broadcasting, press release distribution, sponsored content placement, and API access. All payments are processed through Paystack. Fees are non-refundable unless otherwise stated.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink uppercase tracking-wide mb-3">6. Partner Program</h2>
            <p>Partners earn commissions through referrals and content engagement. OPINIONPLUS reserves the right to adjust earnings, freeze accounts suspected of fraud, and modify program terms with 30 days notice. Withdrawals are processed via M-Pesa.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink uppercase tracking-wide mb-3">7. Privacy</h2>
            <p>Your use of the Platform is also governed by our Privacy Policy. We collect minimal data necessary to provide the service. We never sell your personal information.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink uppercase tracking-wide mb-3">8. Termination</h2>
            <p>OPINIONPLUS reserves the right to suspend or terminate accounts that violate these terms. You may delete your account at any time by contacting support.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink uppercase tracking-wide mb-3">9. Limitation of Liability</h2>
            <p>OPINIONPLUS is provided &quot;as is&quot; without warranties of any kind. We are not liable for any damages arising from your use of the Platform.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink uppercase tracking-wide mb-3">10. Contact</h2>
            <p>For questions about these terms, contact us at <a href="mailto:support@opinionplus.online" className="text-signal font-bold hover:underline">support@opinionplus.online</a> or via WhatsApp at +254 112 696 334.</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-wire">
          <Link href="/" className="text-xs font-bold uppercase tracking-wider text-ink hover:text-signal transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}