'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, PhoneOff, Users, Radio, Hand, Share, ShieldAlert, Send, MessageSquare } from 'lucide-react';
import { useAuth } from '../../../lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const WS_BASE = API_BASE.replace(/^http/, 'ws');

let cachedCsrfToken = null;
async function fetchCsrfToken() {
  if (cachedCsrfToken) return cachedCsrfToken;
  try {
    const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
    const data = await res.json();
    cachedCsrfToken = data.token;
    return cachedCsrfToken;
  } catch (e) { return ''; }
}

export default function LiveAudioRoom() {
  const { id } = useParams();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Chat & WebSocket States
  const [messages, setMessages] = useState([]);
  const [inputMsg, setInputMsg] = useState('');
  const wsRef = useRef(null);
  const chatBottomRef = useRef(null);

  // Audio UI states
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchRoomData = async () => {
      try {
        const res = await fetch(`${API_BASE}/rooms/${id}`);
        if (!res.ok) {
          if (isMounted) setError('Room not found or has ended.');
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (isMounted) {
          setRoom(data.room);
          setParticipants(data.participants);
          setLoading(false);
        }
      } catch (e) {
        if (isMounted) setError('Failed to connect to room data.');
        setLoading(false);
      }
    };

    fetchRoomData();

    // Connect Durable Object WebSocket for real-time chat & signals
    const wsUrl = `${WS_BASE}/rooms/${id}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'chat') {
          setMessages((prev) => [...prev, payload]);
        }
      } catch (err) {}
    };

    // Join room database record
    if (isAuthenticated) {
      fetchCsrfToken().then((token) => {
        fetch(`${API_BASE}/rooms/${id}/join`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' }
        }).catch(() => {});
      });
    }

    return () => {
      isMounted = false;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [id, isAuthenticated]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendChatMessage = (e) => {
    e.preventDefault();
    if (!inputMsg.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const chatPayload = {
      type: 'chat',
      id: crypto.randomUUID(),
      senderName: user?.publisherName || 'Anonymous Listener',
      text: inputMsg.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    wsRef.current.send(JSON.stringify(chatPayload));
    setInputMsg('');
  };

  const leaveRoom = () => {
    router.push('/rooms');
  };

  const endRoom = async () => {
    if (!window.confirm('End this broadcast for everyone?')) return;
    try {
      const token = await fetchCsrfToken();
      await fetch(`${API_BASE}/rooms/${id}/end`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' }
      });
      router.push('/rooms');
    } catch (e) {
      alert('Failed to end room.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ink flex flex-col items-center justify-center">
        <Radio size={48} className="text-signal animate-pulse mb-4" />
        <p className="text-white font-bold uppercase tracking-widest text-xs">Connecting to Durable Object Mesh...</p>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-ink flex flex-col items-center justify-center p-4 text-center">
        <PhoneOff size={48} className="text-ink-500 mb-4" />
        <p className="text-white text-xl font-black mb-2">Broadcast Ended</p>
        <p className="text-ink-400 text-sm mb-6">{error}</p>
        <button onClick={() => router.push('/rooms')} className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-6 py-3 rounded-sm">
          Return to Directory
        </button>
      </div>
    );
  }

  const isHost = user?.id === room.host_id;
  const speakers = participants.filter(p => p.role === 'host' || p.role === 'speaker');
  const listeners = participants.filter(p => p.role === 'listener');

  return (
    <div className="min-h-screen bg-ink text-white flex flex-col lg:flex-row relative">
      
      {/* LEFT / MAIN STAGE (Audio & Speakers) */}
      <div className="flex-1 flex flex-col min-h-screen pb-32">
        <div className="bg-ink-900 border-b border-white/10 p-4 sm:px-8 py-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-sm bg-signal/20 text-signal flex items-center gap-1.5 border border-signal/30">
                <span className="w-1.5 h-1.5 rounded-full bg-signal animate-ping" /> Live DO Mesh
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-sm bg-white/10 text-white">
                {room.category}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{room.title}</h1>
          </div>
          
          {isHost && (
            <button onClick={endRoom} className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/50 font-bold uppercase text-xs tracking-wider px-4 py-2 rounded-sm transition-colors flex items-center gap-1.5">
              <ShieldAlert size={14} /> End Broadcast
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-6 px-2">Speakers</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-6">
              {speakers.map((p) => (
                <div key={p.id} className="flex flex-col items-center text-center space-y-2">
                  <div className={`relative w-20 h-20 rounded-full p-1 ${p.role === 'host' ? 'bg-gradient-to-tr from-signal to-amber-500' : 'bg-white/10'}`}>
                    <img src={p.logo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb'} alt={p.publisher_name} className="w-full h-full rounded-full object-cover border-4 border-ink" />
                  </div>
                  <p className="text-xs font-bold truncate w-24">{p.publisher_name}</p>
                </div>
              ))}
            </div>
          </div>

          {listeners.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4 px-2 border-t border-white/10 pt-6">Listeners ({listeners.length})</h3>
              <div className="flex flex-wrap gap-3">
                {listeners.map((p) => (
                  <span key={p.id} className="text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-white/80">
                    {p.publisher_name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDEBAR: Real-time Chat via Durable Objects */}
      <div className="w-full lg:w-96 bg-ink-950 border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col h-[400px] lg:h-screen">
        <div className="p-4 border-b border-white/10 flex items-center gap-2">
          <MessageSquare size={16} className="text-signal" />
          <h3 className="text-xs font-black uppercase tracking-widest">Live Room Chat</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <p className="text-center text-xs text-white/30 italic py-10">No messages yet. Say hello to the room!</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="bg-white/5 border border-white/5 rounded-sm p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-signal">{m.senderName}</span>
                  <span className="text-[9px] text-white/40">{m.timestamp}</span>
                </div>
                <p className="text-xs text-white/90 leading-relaxed">{m.text}</p>
              </div>
            ))
          )}
          <div ref={chatBottomRef} />
        </div>

        <form onSubmit={sendChatMessage} className="p-3 border-t border-white/10 bg-ink-900 flex gap-2">
          <input
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-xs text-white focus:outline-none focus:border-signal"
          />
          <button type="submit" className="bg-signal text-white p-2.5 rounded-sm hover:bg-signal/90 transition-colors">
            <Send size={14} />
          </button>
        </form>
      </div>

      {/* Bottom Audio Control Bar */}
      <div className="fixed bottom-0 left-0 lg:left-0 lg:right-96 bg-ink-900 border-t border-white/10 p-4 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-4">
          <button 
            onClick={() => setIsMuted(!isMuted)} 
            className={`flex items-center gap-2 px-8 py-3 rounded-full font-bold uppercase text-xs tracking-wider transition-all shadow-xl ${
              isMuted ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-signal text-white'
            }`}
          >
            {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            {isMuted ? 'Unmute' : 'Muted'}
          </button>
          <button onClick={leaveRoom} className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white p-3 rounded-full transition-colors">
            <PhoneOff size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}