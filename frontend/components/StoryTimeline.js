'use client';

import { useEffect, useState } from 'react';
import { Calendar, TrendingUp } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function StoryTimeline({ userId }) {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/stories/timeline/${userId}`);
        const data = await res.json();
        setTimeline(data.timeline || []);
      } catch (e) { /* ignore */ }
      setLoading(false);
    })();
  }, [userId]);

  if (loading) return <p className="text-xs text-ink-400">Loading timeline...</p>;
  if (!timeline.length) return <p className="text-xs text-ink-400">No stories published yet.</p>;

  // Group by month
  const grouped = {};
  timeline.forEach(t => {
    const month = t.date.slice(0, 7);
    if (!grouped[month]) grouped[month] = { total: 0, stories: 0, documentaries: 0, days: new Set() };
    grouped[month].total += t.count;
    grouped[month].days.add(t.date);
    if (t.type === 'documentary') grouped[month].documentaries += t.count;
    else grouped[month].stories += t.count;
  });

  const months = Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
  const maxCount = Math.max(...months.map(([, v]) => v.total), 1);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={14} className="text-ink-400" />
        <span className="wire-tag">Publishing History</span>
      </div>
      <div className="space-y-2">
        {months.map(([month, data]) => (
          <div key={month} className="flex items-center gap-3">
            <span className="text-xs text-ink-400 w-16 shrink-0">
              {new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
            <div className="flex-1 h-5 bg-ink-50 rounded-sm overflow-hidden flex">
              <div
                className="h-full bg-ink transition-all"
                style={{ width: `${(data.total / maxCount) * 100}%`, minWidth: data.total > 0 ? '4px' : '0' }}
              />
            </div>
            <span className="text-xs text-ink-400 w-16 text-right shrink-0">
              {data.total} post{data.total !== 1 ? 's' : ''}
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-3 text-xs text-ink-400">
        <span className="flex items-center gap-1"><TrendingUp size={12} /> Best streak: coming soon</span>
      </div>
    </div>
  );
}