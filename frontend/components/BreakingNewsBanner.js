// components/BreakingNewsBanner.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, X, Bell, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function BreakingNewsBanner() {
  const [breakingStories, setBreakingStories] = useState([]);
  const [visible, setVisible] = useState(true);
  const [dismissed, setDismissed] = useState([]);

  const fetchBreaking = useCallback(async () => {
    try {
      // Get stories published in the last hour with high engagement
      const res = await fetch(`${API_BASE}/stories?limit=10`);
      const data = await res.json();
      
      if (data.stories) {
        const recent = data.stories.filter(s => {
          const created = new Date(s.created_at || s.createdAt);
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          return created > oneHourAgo;
        });
        setBreakingStories(recent.slice(0, 3));
        setVisible(recent.length > 0);
      }
    } catch (e) {
      // Silent fail — banner is non-critical
    }
  }, []);

  useEffect(() => {
    fetchBreaking();
    const id = setInterval(fetchBreaking, 5 * 60 * 1000); // Refresh every 5 min
    return () => clearInterval(id);
  }, [fetchBreaking]);

  const handleDismiss = (storyId) => {
    setDismissed(prev => [...prev, storyId]);
    const remaining = breakingStories.filter(s => !dismissed.includes(s.id) && s.id !== storyId);
    if (remaining.length === 0) {
      setVisible(false);
    }
  };

  const handleDismissAll = () => {
    setVisible(false);
    try {
      sessionStorage.setItem('breaking_dismissed_all', Date.now().toString());
    } catch (e) {}
  };

  // Check if all breaking was dismissed recently
  useEffect(() => {
    try {
      const dismissedAt = sessionStorage.getItem('breaking_dismissed_all');
      if (dismissedAt && Date.now() - parseInt(dismissedAt) < 30 * 60 * 1000) {
        setVisible(false);
      }
    } catch (e) {}
  }, []);

  if (!visible || breakingStories.length === 0) return null;

  return (
    <div className="bg-amber-500 text-ink border-b-2 border-amber-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Icon + Label */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-600 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
            </span>
            <Bell size={16} className="text-ink" />
            <span className="text-[11px] font-black uppercase tracking-widest">Breaking</span>
          </div>

          {/* Center: Scrolling Stories */}
          <div className="flex-1 overflow-hidden relative h-6">
            <div className="flex items-center gap-8 animate-marquee whitespace-nowrap">
              {breakingStories.filter(s => !dismissed.includes(s.id)).map((story, i) => (
                <Link
                  key={story.id}
                  href={`/story/${story.id}`}
                  className="flex items-center gap-2 text-sm font-bold text-ink hover:text-white transition-colors shrink-0"
                >
                  <span className="text-[10px] font-black uppercase tracking-wider bg-red-600 text-white px-1.5 py-0.5 rounded-sm">
                    {story.type?.replace('_', ' ') || 'News'}
                  </span>
                  {story.title}
                  <ArrowRight size={14} />
                </Link>
              ))}
            </div>
          </div>

          {/* Right: Dismiss */}
          <button
            onClick={handleDismissAll}
            className="shrink-0 p-1 rounded-sm hover:bg-amber-600/30 transition-colors"
            title="Dismiss breaking news"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 25s linear infinite;
          width: max-content;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}