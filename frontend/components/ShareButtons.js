'use client';

import { useState } from 'react';
import { Link2, MessageCircle, Facebook, Instagram, Check } from 'lucide-react';

export default function ShareButtons({ url, title }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}${url}` : url;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      /* clipboard unavailable */
    }
  };

  const targets = [
    {
      label: 'WhatsApp',
      icon: MessageCircle,
      href: `https://wa.me/?text=${encodeURIComponent(`${title} — ${shareUrl}`)}`,
    },
    {
      label: 'Facebook',
      icon: Facebook,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      label: 'X',
      icon: XIcon,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(shareUrl)}`,
    },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {targets.map((t) => (
        <a
          key={t.label}
          href={t.href}
          target="_blank"
          rel="noopener noreferrer"
          className="w-9 h-9 rounded-full border border-wire grid place-items-center hover:border-ink hover:bg-ink hover:text-paper transition-colors"
          aria-label={`Share to ${t.label}`}
          title={`Share to ${t.label}`}
        >
          <t.icon size={16} />
        </a>
      ))}
      <span
        className="w-9 h-9 rounded-full border border-wire grid place-items-center opacity-50"
        title="Instagram doesn't support direct web share — copy the link instead"
        aria-label="Instagram (copy link to share)"
      >
        <Instagram size={16} />
      </span>
      <button
        onClick={copy}
        className="h-9 px-3 rounded-full border border-wire flex items-center gap-1.5 text-xs font-medium hover:border-ink transition-colors"
      >
        {copied ? <Check size={14} /> : <Link2 size={14} />}
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  );
}

function XIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.9 2H22l-7.6 8.7L23 22h-6.9l-5.4-7-6.2 7H1.3l8.1-9.3L1 2h7l4.9 6.5L18.9 2Zm-1.2 18h1.9L7.4 3.9H5.4L17.7 20Z" />
    </svg>
  );
}
