'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Mic, Radio, Plus, Users, ShieldAlert, Lock, Play } from 'lucide-react';
import { useAuth } from '../../lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

// Add CSRF Token fetching logic
let cachedCsrfToken = null;
async function fetchCsrfToken() {
  if (cachedCsrfToken) return cachedCsrfToken;
  try {
    const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
    const data = await res.json();
    cachedCsrfToken = data.token;
    return cachedCsrfToken;
  } catch (e) {
    return '';
  }
}

export default function AudioRoomsPage() {
  const { user, isAuthenticated } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Breaking News');
  const [isPremium, setIsPremium] = useState(false);
  const [priceCents, setPriceCents] = useState(10000); // KES 100 default

  const fetchRooms = async () => {
    try {
      const res = await fetch(`${API_BASE}/rooms`);
      if (!res.ok) return;
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 10000); // Poll for live rooms
    return () => clearInterval(interval);
  }, []);

  const createRoom = async (e) => {
    e.preventDefault();
    if (!title) return;
    
    try {
      // Fetch the CSRF token right before the POST request
      const token = await fetchCsrfToken();
      
      const res = await fetch(`${API_BASE}/rooms`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': token || '' 
        },
        credentials: 'include',
        body: JSON.stringify({
          title,
          description,
          category,
          is_premium: isPremium,
          price_cents: isPremium ? priceCents : 0,
        }),
      });
      
      if (res.ok) {
        setTitle('');
        setDescription('');
        setShowCreateModal(false);
        fetchRooms();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create audio room.');
      }
    } catch (e) {
      alert('Failed to create audio room due to a network error.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
      {/* Header Banner */}
      <div className="flex items-center justify-between border-b-2 border-ink pb-6 mb-8 flex-wrap gap-4">
        <div>
          <div className="bg-signal text-white font-bold uppercase text-xs px-3 py-1.5 inline-flex items-center gap-2 rounded-sm mb-2 shadow-sm">
            <Radio size={14} className="animate-pulse" /> Live Audio Spaces
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-ink">Breaking News Discussions</h1>
          <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mt-1">
            Listen in real-time as journalists and publishers break live stories.
          </p>
        </div>
        {isAuthenticated && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-ink text-white font-bold uppercase text-xs tracking-wider px-6 py-3 rounded-sm hover:bg-signal transition-colors flex items-center gap-2 shadow-sm"
          >
            <Mic size={16} /> Host Audio Room
          </button>
        )}
      </div>

      {/* Rooms Grid */}
      {loading ? (
        <p className="text-xs font-bold uppercase text-ink-400 py-12 text-center">Loading live audio sessions...</p>
      ) : rooms.length === 0 ? (
        <div className="p-16 text-center bg-paper border border-wire rounded-sm">
          <Radio size={32} className="mx-auto text-ink-300 mb-3" />
          <p className="text-sm font-bold text-ink">No live audio rooms right now.</p>
          <p className="text-xs text-ink-500 mt-1">Start a room to host a live news briefing.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <div key={room.id} className="border-2 border-ink bg-paper p-6 rounded-sm shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-signal text-white">
                    {room.category}
                  </span>
                  {room.is_premium ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-amber-100 text-amber-800 flex items-center gap-1">
                      <Lock size={10} /> KES {(room.price_cents / 100).toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-emerald-100 text-emerald-800">
                      Free Access
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-black text-ink leading-snug">{room.title}</h3>
                <p className="text-xs text-ink-600 line-clamp-2 font-medium">{room.description || 'Live news audio discussion.'}</p>
              </div>

              <div className="pt-4 border-t border-wire flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img src={room.host_logo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb'} alt="" className="w-8 h-8 rounded-full border border-wire object-cover" />
                  <div>
                    <p className="text-xs font-bold text-ink">{room.host_name}</p>
                    <p className="text-[10px] text-ink-400 uppercase tracking-wider">Host</p>
                  </div>
                </div>
                <Link
                  href={`/rooms/${room.id}`}
                  className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-4 py-2.5 rounded-sm hover:bg-signal/90 transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <Play size={13} fill="currentColor" /> Join
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-ink/70 backdrop-blur-sm z-50 grid place-items-center p-4">
          <div className="bg-paper rounded-sm border-2 border-ink w-full max-w-lg p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-wire pb-4">
              <h3 className="text-base font-black uppercase tracking-wide text-ink flex items-center gap-2">
                <Mic size={18} className="text-signal" /> Create Audio Discussion
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-ink-400 hover:text-ink font-bold">✕</button>
            </div>
            <form onSubmit={createRoom} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Room Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Breaking: Election Update & Expert Analysis"
                  required
                  className="w-full border border-wire rounded-sm px-3.5 py-2.5 text-xs font-semibold bg-paper focus:outline-none focus:border-ink"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What will be discussed in this live session?"
                  rows={3}
                  className="w-full border border-wire rounded-sm px-3.5 py-2.5 text-xs font-medium bg-paper focus:outline-none focus:border-ink resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-wire rounded-sm px-3 py-2 text-xs font-bold uppercase tracking-wider bg-paper"
                >
                  <option value="Breaking News">Breaking News</option>
                  <option value="Politics">Politics</option>
                  <option value="Business & Economy">Business & Economy</option>
                  <option value="Tech & Innovation">Tech & Innovation</option>
                  <option value="Culture">Culture</option>
                </select>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="is_premium"
                  checked={isPremium}
                  onChange={(e) => setIsPremium(e.target.checked)}
                  className="h-4 w-4 rounded border-wire text-ink focus:ring-0 cursor-pointer"
                />
                <label htmlFor="is_premium" className="text-xs font-bold uppercase tracking-wider text-ink cursor-pointer">
                  Require Ticket / Premium Access Fee
                </label>
              </div>
              {isPremium && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Price (in Cents / KES)</label>
                  <input
                    type="number"
                    value={priceCents}
                    onChange={(e) => setPriceCents(Number(e.target.value))}
                    className="w-full border border-wire rounded-sm px-3.5 py-2.5 text-xs font-semibold bg-paper"
                  />
                  <p className="text-[10px] text-ink-400 mt-1">Listeners pay this amount via M-Pesa / Card to enter the room.</p>
                </div>
              )}
              <div className="flex gap-3 pt-4 border-t border-wire">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="border border-wire bg-paper hover:bg-ink-50 text-ink font-bold uppercase text-xs tracking-wider flex-1 py-3 rounded-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-signal text-white font-bold uppercase text-xs tracking-wider flex-1 py-3 rounded-sm hover:bg-signal/95 transition-colors shadow-sm"
                >
                  Launch Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}