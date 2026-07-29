// app/accessibility/page.js
'use client';

import Link from 'next/link';

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-paper py-16 px-5">
      <div className="max-w-3xl mx-auto">
        <div className="mb-12 border-b-2 border-wire pb-6">
          <h1 className="text-3xl sm:text-4xl font-black text-ink uppercase tracking-tight">Accessibility Statement</h1>
          <p className="text-sm text-ink-500 font-medium mt-2">Our commitment to inclusive design</p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed text-ink-700">
          <section>
            <h2 className="text-lg font-black text-ink uppercase tracking-wide mb-3">Our Commitment</h2>
            <p>OPINIONPLUS is committed to ensuring digital accessibility for all users, including those with disabilities. We are continuously improving the user experience and applying relevant accessibility standards.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink uppercase tracking-wide mb-3">Standards We Follow</h2>
            <p>We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA. These guidelines explain how to make web content more accessible to people with a wide range of disabilities.</p>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink uppercase tracking-wide mb-3">Accessibility Features</h2>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li><strong>Keyboard Navigation:</strong> All interactive elements are accessible via keyboard. Use Tab to navigate, Enter/Space to activate.</li>
              <li><strong>Screen Reader Support:</strong> We use semantic HTML, ARIA labels, and alt text on all images to support screen readers.</li>
              <li><strong>Color Contrast:</strong> Text meets minimum contrast ratios against backgrounds for readability.</li>
              <li><strong>Focus Indicators:</strong> All focusable elements have visible focus rings for keyboard users.</li>
              <li><strong>Reduced Motion:</strong> Animations are disabled when your system preferences request reduced motion.</li>
              <li><strong>Responsive Design:</strong> The platform works on all screen sizes from mobile phones to large monitors.</li>
              <li><strong>Text Resizing:</strong> Content remains readable when browser zoom is used up to 200%.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink uppercase tracking-wide mb-3">Known Limitations</h2>
            <p>While we strive for full accessibility, some areas may still need improvement:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Video content may lack full captions on older uploads</li>
              <li>Some third-party integrations (Google sign-in, Paystack) have their own accessibility profiles</li>
              <li>The rich text editor has partial screen reader support — we recommend the plain text mode</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink uppercase tracking-wide mb-3">Feedback & Assistance</h2>
            <p>We welcome your feedback on the accessibility of OPINIONPLUS. If you encounter any barriers or have suggestions for improvement, please contact us:</p>
            <div className="mt-3 space-y-2">
              <p><strong>Email:</strong> <a href="mailto:support@opinionplus.online" className="text-signal font-bold hover:underline">support@opinionplus.online</a></p>
              <p><strong>WhatsApp:</strong> <a href="https://wa.me/254112696334" className="text-signal font-bold hover:underline" target="_blank" rel="noopener noreferrer">+254 112 696 334</a></p>
              <p><strong>Response Time:</strong> We aim to respond to accessibility inquiries within 48 hours.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-black text-ink uppercase tracking-wide mb-3">Technical Specifications</h2>
            <p>OPINIONPLUS is built with:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Semantic HTML5 markup</li>
              <li>ARIA landmarks and labels</li>
              <li>CSS that respects user preferences (prefers-reduced-motion, prefers-color-scheme)</li>
              <li>JavaScript with keyboard event handling</li>
            </ul>
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