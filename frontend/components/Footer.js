import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-wire mt-24">
      <div className="max-w-6xl mx-auto px-5 py-12 grid gap-10 sm:grid-cols-3">
        <div>
          <p className="editorial-h text-xl font-extrabold">
            OPINION<span className="text-signal">PLUS</span>
          </p>
          <p className="text-sm text-ink-400 mt-2 max-w-xs">
            A platform where every person gets a masthead — their name, their logo, their truth,
            at the top of the page.
          </p>
        </div>
        <div>
          <p className="wire-tag mb-3">Read</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/" className="hover:text-signal">Feed</Link></li>
            <li><Link href="/about" className="hover:text-signal">About OpinionPlus</Link></li>
          </ul>
        </div>
        <div>
          <p className="wire-tag mb-3">Legal &amp; support</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/privacy" className="hover:text-signal">Privacy policy</Link></li>
            <li><Link href="/contact" className="hover:text-signal">Contact us</Link></li>
          </ul>
        </div>
      </div>
      <div className="rule">
        <p className="max-w-6xl mx-auto px-5 py-5 text-xs text-ink-400">
          © {new Date().getFullYear()} OpinionPlus. Every byline belongs to the person who wrote it.
        </p>
      </div>
    </footer>
  );
}
