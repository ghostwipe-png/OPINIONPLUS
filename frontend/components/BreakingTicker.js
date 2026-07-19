'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function truncate(title, max = 80) {
  if (!title) return '';
  if (title.length <= max) return title;
  return `${title.slice(0, max).trimEnd()}...`;
}

export default function BreakingTicker() {
  const [stories, setStories] = useState([]);
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/stories/trending`)
      .then((r) => (r.ok ? r.json() : { stories: [] }))
      .then((data) => {
        if (!cancelled) setStories(data.stories || []);
      })
      .catch(() => {
        if (!cancelled) setStories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (stories.length < 2) return undefined;
    const interval = setInterval(() => {
      setFade(false);
      const timeout = setTimeout(() => {
        setIndex((i) => (i + 1) % stories.length);
        setFade(true);
      }, 500);
      return () => clearTimeout(timeout);
    }, 5000);
    return () => clearInterval(interval);
  }, [stories]);

  if (!stories || stories.length === 0) return null;

  const current = stories[index % stories.length];
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="bg-ink border-b border-ink-700">
      <div className="max-w-6xl mx-auto px-5 flex items-center h-10 sm:h-11 gap-3">
        <span className="shrink-0 bg-signal text-white text-[10px] sm:text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-sm">
          <span className="hidden sm:inline">Top Stories</span>
          <span className="sm:hidden">Latest</span>
        </span>
        <Link
          href={current ? `/story/${current.id}` : '#'}
          className={`flex-1 min-w-0 text-white text-xs sm:text-sm font-medium truncate transition-opacity duration-500 focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none rounded-sm ${
            fade ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {truncate(current?.title, 80)}
        </Link>
      </div>
      <div className="max-w-6xl mx-auto px-5 pb-1.5">
        <p className="text-[10px] sm:text-[11px] text-white/40">
          📅 {today} · Every voice, a masthead
        </p>
      </div>
    </div>
  );
}
