'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trophy, Medal, Eye, Heart, TrendingUp, ChevronRight, Newspaper, Loader2, Award } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await fetch(`${API_BASE}/users/leaderboard`);
        if (res.ok) {
          const data = await res.json();
          setLeaders(data.leaderboard || []);
        }
      } catch (e) {
        console.error('Failed to fetch leaderboard');
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, []);

  const getRankBadge = (index) => {
    if (index === 0) return <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center shadow-inner"><Trophy size={16} /></div>;
    if (index === 1) return <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center shadow-inner"><Medal size={16} /></div>;
    if (index === 2) return <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center shadow-inner"><Medal size={16} /></div>;
    return <div className="w-8 h-8 rounded-full bg-ink-50 text-ink-400 flex items-center justify-center font-bold text-xs">{index + 1}</div>;
  };

  const getRankStyle = (index) => {
    if (index === 0) return 'border-yellow-200 bg-gradient-to-r from-yellow-50/50 to-transparent hover:border-yellow-400';
    if (index === 1) return 'border-gray-200 bg-gradient-to-r from-gray-50/50 to-transparent hover:border-gray-400';
    if (index === 2) return 'border-orange-200 bg-gradient-to-r from-orange-50/50 to-transparent hover:border-orange-400';
    return 'border-wire bg-white hover:border-ink hover:shadow-md';
  };

  return (
    <div className="min-h-screen bg-paper pb-24 selection:bg-signal selection:text-white">
      {/* Hero Section */}
      <div className="bg-ink text-white pt-20 pb-16 border-b-4 border-signal relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-ink/90"></div>
        
        <div className="max-w-4xl mx-auto px-5 relative z-10 text-center">
          <div className="w-16 h-16 bg-signal text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-signal/20">
            <TrendingUp size={32} />
          </div>
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
            Top Publishers
          </h1>
          <p className="text-white/60 font-medium text-sm md:text-base max-w-xl mx-auto">
            Discover the most influential voices on OpinionPlus. Rankings are calculated in real-time based on total readership, engagement, and publishing consistency.
          </p>
        </div>
      </div>

      {/* Leaderboard List */}
      <div className="max-w-4xl mx-auto px-5 -mt-8 relative z-20">
        <div className="bg-white rounded-md shadow-2xl border border-wire p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          <div className="flex items-center justify-between border-b border-wire pb-4 mb-6 px-2">
            <h2 className="text-sm font-black text-ink uppercase tracking-widest flex items-center gap-2">
              <Award size={16} className="text-signal" /> Global Ranking
            </h2>
            <span className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">Updated Hourly</span>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 size={32} className="animate-spin text-signal" />
              <p className="text-xs font-bold text-ink-400 uppercase tracking-widest">Calculating ranks...</p>
            </div>
          ) : leaders.length === 0 ? (
            <div className="py-20 text-center text-ink-400">
              <p className="font-bold">No data available yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leaders.map((publisher, index) => (
                <Link 
                  key={publisher.id} 
                  href={`/profile/${publisher.id}`}
                  className={`group flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-sm border transition-all duration-300 ${getRankStyle(index)}`}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="shrink-0 transition-transform group-hover:scale-110 duration-300">
                      {getRankBadge(index)}
                    </div>
                    
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-wire bg-ink-50 shrink-0">
                      <img 
                        src={publisher.logo_url || `https://api.dicebear.com/7.x/initials/svg?seed=${publisher.publisher_name}`} 
                        alt={publisher.publisher_name} 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    
                    <div className="min-w-0">
                      <h3 className="text-base font-black text-ink uppercase tracking-tight truncate group-hover:text-signal transition-colors">
                        {publisher.publisher_name}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-[11px] font-bold text-ink-400 uppercase tracking-widest">
                        <span className="flex items-center gap-1"><Newspaper size={12} /> {publisher.story_count} Stories</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 pl-16 md:pl-0 shrink-0">
                    <div className="text-right">
                      <p className="text-xs font-medium text-ink-400 uppercase tracking-wider mb-0.5">Impact Score</p>
                      <p className="text-lg font-black text-ink">{publisher.impact_score?.toLocaleString() || 0}</p>
                    </div>
                    
                    <div className="hidden sm:flex items-center gap-4 border-l border-wire pl-6">
                      <div className="flex flex-col items-center">
                        <Eye size={14} className="text-ink-300 mb-1" />
                        <span className="text-[10px] font-bold text-ink-500">{publisher.total_views?.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <Heart size={14} className="text-ink-300 mb-1" />
                        <span className="text-[10px] font-bold text-ink-500">{publisher.total_likes?.toLocaleString() || 0}</span>
                      </div>
                    </div>

                    <ChevronRight size={18} className="text-ink-300 group-hover:text-signal group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}