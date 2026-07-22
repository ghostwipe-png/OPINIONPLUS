'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Radio, Users, Play, Loader2, AlertCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function RoomsDirectoryPage() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await fetch(`${API_BASE}/rooms`);
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
      } else {
        setError('Failed to load active rooms.');
      }
    } catch (err) {
      setError('Network error. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink text-white pt-24 pb-20 px-6">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Section - No Create Button here for security */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b border-white/10 pb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Radio className="text-signal animate-pulse" size={28} />
              <h1 className="editorial-h text-4xl font-black tracking-tight">Live Spaces</h1>
            </div>
            <p className="text-white/60 text-sm max-w-xl">
              Join secure real-time audio and video broadcasts hosted by verified speakers.
            </p>
          </div>
        </div>

        {/* Rooms Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/40">
            <Loader2 className="animate-spin mb-4 text-signal" size={32} />
            <p className="text-xs uppercase tracking-widest font-bold">Scanning for live rooms...</p>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-6 rounded-sm text-center">
            <AlertCircle size={32} className="mx-auto mb-3 opacity-80" />
            <p className="font-bold">{error}</p>
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-white/10 rounded-xl bg-white/5">
            <Radio size={48} className="mx-auto text-white/20 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">No live spaces right now</h3>
            <p className="text-white/50 text-sm">Check back later when hosts start a broadcast.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <Link key={room.id} href={`/rooms/${room.id}`} className="block group">
                <div className="bg-ink-900 border border-white/10 hover:border-signal/50 rounded-xl p-5 transition-all duration-300 hover:shadow-2xl hover:shadow-signal/10 h-full flex flex-col relative overflow-hidden">
                  
                  <div className="absolute top-0 right-0 bg-signal text-white text-[9px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-lg flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Live
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-signal transition-colors pr-12 line-clamp-2">
                    {room.title}
                  </h3>
                  
                  <p className="text-xs text-white/50 mb-6 flex-1">
                    Hosted by <span className="text-white/80 font-semibold">{room.host_name}</span>
                  </p>

                  <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-auto">
                    <div className="flex items-center gap-1.5 text-xs text-white/60 font-medium">
                      <Users size={14} /> {room.participant_count || 1}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-signal uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                      Join <Play size={12} className="fill-signal" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}