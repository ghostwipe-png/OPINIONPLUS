'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const CYCLE_MS = 5000;
const FADE_MS = 500;

function truncate(str, max = 80) {
  if (!str) return '';
  return str.length > max ? `${str.slice(0, max - 1).trimEnd()}…` : str;
}

export default function BreakingTicker() {
  const [stories, setStories] = useState([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [dateStr, setDateStr] = useState('');

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
    setDateStr(
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    );
  }, []);

  useEffect(() => {
    if (stories.length < 2) return undefined;
    const interval = setInterval(() => {
      setVisible(false);
      const timeout = setTimeout(() => {
        setIndex((i) => (i + 1) % stories.length);
        setVisible(true);
      }, FADE_MS);
      return () => clearTimeout(timeout);
    }, CYCLE_MS);
    return () => clearInterval(interval);
  }, [stories]);

  if (!stories || stories.length === 0) return null;

  const current = stories[index % stories.length];

  return (
    <div className="bg-ink border-b border-ink-700">
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex items-center gap-3 h-10">
          <span className="shrink-0 bg-signal text-white text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-sm">
            <span className="hidden sm:inline">Top Stories</span>
            <span className="sm:hidden">Latest</span>
          </span>
          <Link
            href={`/story/${current.id}`}
            className={`flex-1 min-w-0 truncate text-sm text-white/90 hover:text-signal transition-opacity focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none rounded-sm ${
              visible ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ transitionDuration: `${FADE_MS}ms` }}
          >
            {truncate(current.title, 80)}
          </Link>
        </div>
        <div className="hidden sm:flex items-center justify-between text-[11px] text-white/40 pb-1.5">
          <span>{dateStr}</span>
          <span className="wire-tag text-white/40">every voice, a masthead</span>
        </div>
      </div>
    </div>
  );
}
