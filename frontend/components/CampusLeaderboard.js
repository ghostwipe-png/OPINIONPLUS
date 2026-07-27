'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Star, Loader2, BookOpen, Users, Eye } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function CampusLeaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [sortBy, setSortBy] = useState('stories');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/campuses/leaderboard?sortBy=${sortBy}&limit=10`)
      .then(r => r.ok ? r.json() : { leaderboard: [] })
      .then(d => setLeaderboard(d.leaderboard || []))
      .catch(() => setLeaderboard([]))
      .finally(() => setLoading(false));
  }, [sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className="animate-spin text-signal" />
      </div>
    );
  }

  if (leaderboard.length === 0) return null;

  return (
    <div className="border border-wire rounded-sm bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-2">
          <Star size={14} className="text-signal" /> Top Campuses
        </h3>
        <div className="flex gap-1">
          {[
            { key: 'stories', label: 'Stories', icon: BookOpen },
            { key: 'subscribers', label: 'Subs', icon: Users },
            { key: 'views', label: 'Views', icon: Eye },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setSortBy(s.key)}
              className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-sm transition-colors flex items-center gap-1 ${
                sortBy === s.key ? 'bg-ink text-white' : 'bg-ink-50 text-ink-500 hover:bg-ink-100'
              }`}
            >
              <s.icon size={11} />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        {leaderboard.map((campus, i) => {
          const rankColors = {
            0: 'bg-amber-100 text-amber-800',
            1: 'bg-slate-100 text-slate-700',
            2: 'bg-orange-100 text-orange-800',
          };

          return (
            <Link
              key={campus.id}
              href={`/campuses/${campus.id}`}
              className="flex items-center gap-3 p-2.5 rounded-sm hover:bg-ink-50 transition-colors group"
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${rankColors[i] || 'bg-ink-50 text-ink-500'}`}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-ink group-hover:text-signal transition-colors truncate">
                  {campus.university_name}
                </p>
              </div>
              <span className="text-[10px] font-bold text-ink-400 whitespace-nowrap">
                {sortBy === 'stories' && `${campus.total_stories || 0} stories`}
                {sortBy === 'subscribers' && `${campus.total_subscribers || 0} subs`}
                {sortBy === 'views' && `${campus.total_views || 0} views`}
              </span>
            </Link>
          );
        })}
      </div>

      <Link
        href="/campuses"
        className="block text-center text-[10px] font-bold uppercase tracking-wider text-ink-400 hover:text-signal transition-colors mt-3 pt-3 border-t border-wire"
      >
        View all campuses →
      </Link>
    </div>
  );
}