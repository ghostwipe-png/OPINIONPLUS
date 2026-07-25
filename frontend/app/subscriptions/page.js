'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Tv, Loader2, Film, Users } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import VideoCard from '../../components/VideoCard';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function SubscriptionsPage() {
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSubscriptions = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/subs/videos`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setVideos(Array.isArray(data.videos) ? data.videos : []);
    } catch (e) {
      setError('Failed to load subscriptions feed');
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  if (!user) {
    return (
      <div className="bg-paper min-h-screen flex flex-col items-center justify-center px-5 py-24">
        <Tv size={48} className="text-ink-300 mb-4" />
        <h1 className="text-2xl font-black text-ink uppercase mb-2">Subscriptions</h1>
        <p className="text-xs text-ink-500 mb-6 text-center max-w-sm">
          Sign in to see the latest videos from your subscribed channels.
        </p>
        <Link href="/login" className="bg-ink text-white font-bold uppercase text-xs px-6 py-3 rounded-sm">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-paper min-h-screen pb-24">
      {/* Header */}
      <div className="border-b border-wire bg-white">
        <div className="max-w-7xl mx-auto px-5 py-8">
          <div className="flex items-center gap-3">
            <Tv size={24} className="text-signal" />
            <div>
              <h1 className="text-2xl font-black text-ink uppercase tracking-tight">Subscriptions</h1>
              <p className="text-xs text-ink-500 mt-1">Latest videos from channels you follow</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-5 pt-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-signal" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-sm text-signal font-bold">{error}</p>
            <button onClick={fetchSubscriptions} className="mt-4 text-xs font-bold uppercase text-ink underline">
              Retry
            </button>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-ink-50 flex items-center justify-center mx-auto mb-4">
              <Users size={28} className="text-ink-300" />
            </div>
            <h2 className="text-lg font-bold text-ink uppercase mb-2">No subscriptions yet</h2>
            <p className="text-xs text-ink-500 mb-6 max-w-md mx-auto">
              Subscribe to channels to see their latest videos here. Explore videos and follow creators you like.
            </p>
            <Link href="/videos" className="bg-ink text-white font-bold uppercase text-xs px-6 py-3 rounded-sm hover:bg-signal transition-colors inline-flex items-center gap-2">
              <Film size={14} /> Browse Videos
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} showPublisher={true} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}