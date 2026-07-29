'use client';

import { useState } from 'react';
import { ShieldCheck, Award, Star, Sparkles, Crown, BadgeCheck } from 'lucide-react';

const ICONS = {
  top_writer: Star,
  milestone_stories: Award,
  verified_publisher: BadgeCheck,
  early_adopter: Sparkles,
  partner_tier: Crown,
};

const STYLES = {
  top_writer: 'bg-purple-50 text-purple-700 border-purple-200',
  milestone_stories: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  verified_publisher: 'bg-blue-50 text-blue-700 border-blue-200',
  early_adopter: 'bg-amber-50 text-amber-700 border-amber-200',
  partner_tier: 'bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-200 text-amber-900 border-amber-300',
};

function Badge({ badge }) {
  const [showTip, setShowTip] = useState(false);
  const Icon = ICONS[badge.badge_type] || ShieldCheck;
  const style = STYLES[badge.badge_type] || 'bg-ink-50 text-ink-600 border-wire';

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <div
        className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide shadow-sm ${style}`}
      >
        <Icon size={13} />
        <span>{badge.badge_label}</span>
      </div>
      {showTip && (
        <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[220px] bg-ink text-white text-[11px] font-medium px-3 py-2 rounded-sm shadow-xl animate-in fade-in duration-150">
          {badge.badge_label}
          {badge.category ? ` — ${badge.category}` : ''}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-ink" />
        </div>
      )}
    </div>
  );
}

export default function PublisherBadges({ badges }) {
  if (!badges || badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 justify-center md:justify-start">
      {badges.map((badge) => (
        <Badge key={badge.id || `${badge.badge_type}-${badge.category || ''}`} badge={badge} />
      ))}
    </div>
  );
}
