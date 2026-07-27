'use client';

import Link from 'next/link';
import { GraduationCap } from 'lucide-react';

export default function CampusBadge({ campusId, campusName }) {
  if (!campusId) return null;

  return (
    <Link
      href={`/campuses/${campusId}`}
      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-ink-50 text-ink-600 border border-wire hover:border-ink hover:bg-ink-100 transition-colors whitespace-nowrap"
      onClick={(e) => e.stopPropagation()}
      title={`Published from ${campusName || 'Campus'}`}
    >
      <GraduationCap size={11} />
      {campusName || 'Campus'}
    </Link>
  );
}