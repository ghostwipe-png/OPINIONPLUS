'use client';

import { useState } from 'react';
import { Link2, MessageCircle, Facebook, Instagram, Check, Share2 } from 'lucide-react';

export default function ShareButtons({ url, title }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}${url}` : url;
  const encodedTitle = encodeURIComponent(title);
  const encodedUrl = encodeURIComponent(shareUrl);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (e) { /* clipboard unavailable */ }
  };

  const targets = [
    {
      label: 'WhatsApp',
      icon: MessageCircle,
      color: 'hover:bg-[#25D366] hover:border-[#25D366]',
      href: `https://wa.me/?text=${encodedTitle}%0A%0A${encodedUrl}`,
      primary: true,
    },
    {
      label: 'Facebook',
      icon: Facebook,
      color: 'hover:bg-[#1877F2] hover:border-[#1877F2]',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      label: 'X',
      icon: XIcon,
      color: 'hover:bg-[#000000] hover:border-[#000000]',
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* WhatsApp — prominent button */}
      <a
        href={targets[0].href}
        target="_blank"
        rel="noopener noreferrer"
        className="h-9 px-3 rounded-full bg-[#25D366] text-white flex items-center gap-1.5 text-xs font-semibold hover:bg-[#1ebe57] transition-colors"
        aria-label="Share on WhatsApp"
      >
        <MessageCircle size={15} fill="white" /> WhatsApp
      </a>

      {/* Other share icons */}
      <div className="flex items-center gap-1.5">
        {targets.slice(1).map((t) => (
          <a
            key={t.label}
            href={t.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`w-9 h-9 rounded-full border border-wire grid place-items-center hover:text-paper transition-colors ${t.color}`}
            aria-label={`Share to ${t.label}`}
            title={`Share to ${t.label}`}
          >
            <t.icon size={15} />
          </a>
        ))}
        <span
          className="w-9 h-9 rounded-full border border-wire grid place-items-center opacity-50"
          title="Instagram doesn't support direct web share — copy the link instead"
          aria-label="Instagram (copy link to share)"
        >
          <Instagram size={15} />
        </span>
        <button
          onClick={copy}
          className="h-9 px-3 rounded-full border border-wire flex items-center gap-1.5 text-xs font-medium hover:border-ink transition-colors"
        >
          {copied ? <Check size={13} /> : <Link2 size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
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