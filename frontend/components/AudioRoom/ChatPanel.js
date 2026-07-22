'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';

export default function ChatPanel({ messages, onSend, onClose }) {
  const [inputMsg, setInputMsg] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;
    onSend(inputMsg.trim());
    setInputMsg('');
  };

  return (
    <div className="w-full sm:w-[320px] h-full bg-[#0d0d1a]/98 backdrop-blur-xl border-l border-white/10 flex flex-col z-40 animate-in slide-in-from-right duration-300 absolute right-0 sm:relative">
      <div className="h-16 px-4 flex items-center justify-between border-b border-white/10 shrink-0">
        <h2 className="text-sm font-bold text-white tracking-wide">In-call messages</h2>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-white/40 italic">
            No messages yet. Say hello!
          </div>
        ) : (
          messages.map((m, i) => {
            const isSelf = m.senderName === 'Guest' || m.senderName === 'You'; // simplified self check
            return (
              <div key={m.id || i} className={`flex flex-col max-w-[85%] ${isSelf ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                {!isSelf && <span className="text-[10px] text-white/50 mb-1 ml-1">{m.senderName}</span>}
                <div className={`px-4 py-2.5 text-sm ${isSelf ? 'bg-signal text-white rounded-l-2xl rounded-tr-2xl' : 'bg-white/10 text-white/90 rounded-r-2xl rounded-tl-2xl'}`}>
                  {m.text}
                </div>
                <span className="text-[9px] text-white/30 mt-1">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-white/10 bg-[#0d0d1a] shrink-0">
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            placeholder="Send a message..."
            className="w-full bg-white/5 border border-white/10 rounded-full pl-4 pr-12 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-signal/50 focus:ring-1 focus:ring-signal/50 transition-all"
          />
          <button type="submit" disabled={!inputMsg.trim()} className="absolute right-1.5 p-1.5 rounded-full bg-signal text-white disabled:opacity-50 disabled:bg-white/10 hover:bg-red-600 transition-colors">
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}