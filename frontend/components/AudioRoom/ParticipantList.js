'use client';

import { useState } from 'react';
import { X, Search, Mic, MicOff, Hand } from 'lucide-react';

export default function ParticipantList({ participants, hostId, raisedHands, onClose }) {
  const [search, setSearch] = useState('');

  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.connectionId === hostId) return -1;
    if (b.connectionId === hostId) return 1;
    if (a.isHandRaised && !b.isHandRaised) return -1;
    if (!a.isHandRaised && b.isHandRaised) return 1;
    return a.name.localeCompare(b.name);
  });

  const filtered = sortedParticipants.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="w-full sm:w-[280px] h-full bg-[#0d0d1a]/98 backdrop-blur-xl border-l sm:border-l-0 sm:border-r border-white/10 flex flex-col z-40 animate-in slide-in-from-left duration-300 absolute left-0 sm:relative">
      <div className="h-16 px-4 flex items-center justify-between border-b border-white/10 shrink-0">
        <h2 className="text-sm font-bold text-white tracking-wide">People ({participants.length})</h2>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>

      {participants.length > 5 && (
        <div className="p-3 border-b border-white/5 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for people"
              className="w-full bg-white/5 rounded-md pl-9 pr-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-signal"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {filtered.map(p => (
          <div key={p.connectionId} className="h-[52px] px-4 flex items-center justify-between hover:bg-white/5 transition-colors group">
            <div className="flex items-center gap-3">
              {p.avatar ? (
                <img src={p.avatar} alt={p.name} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-signal/20 text-signal flex items-center justify-center text-xs font-bold">
                  {p.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-sm text-white/90 truncate max-w-[120px]">{p.name}</span>
                {p.connectionId === hostId && <span className="text-[9px] text-blue-400 font-bold tracking-wider uppercase">Host</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 text-white/40 group-hover:text-white/80 transition-colors">
              {p.isHandRaised && <Hand size={14} className="text-amber-500" />}
              {p.isMuted ? <MicOff size={14} className="text-red-400" /> : <Mic size={14} className="text-emerald-400" />}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="p-6 text-center text-xs text-white/40 italic">No one found.</div>
        )}
      </div>
    </div>
  );
}