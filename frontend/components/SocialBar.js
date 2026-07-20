import { Facebook, Twitter, Rss } from 'lucide-react';

const CHANNELS = [
  { Icon: Facebook, label: 'Facebook', count: '12K Fans' },
  { Icon: Twitter, label: 'Twitter', count: '8K Followers' },
  { Icon: Rss, label: 'RSS', count: '5K Readers' },
];

export default function SocialBar() {
  return (
    <div className="bg-ink rounded-sm p-3 hidden sm:block">
      <p className="text-white text-xs font-semibold uppercase tracking-wide mb-2">Stay Connected</p>
      <div className="flex items-center gap-2 mb-2">
        {CHANNELS.map(({ Icon, label }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            title={label}
            className="w-8 h-8 rounded-full border border-ink-700 text-white/60 hover:text-white hover:border-white/40 transition-colors flex items-center justify-center focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none"
          >
            <Icon size={14} />
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-white/40">
        {CHANNELS.map(({ label, count }) => (
          <span key={label}>{count}</span>
        ))}
      </div>
    </div>
  );
}
