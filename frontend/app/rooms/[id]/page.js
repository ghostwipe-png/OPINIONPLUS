'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Mic, Video, Settings, User } from 'lucide-react';
import { useAuth } from '../../../lib/auth';
import { RoomLayout } from '../../../components/AudioRoom';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function RoomJoinPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  
  // Preview
  const previewVideoRef = useRef(null);
  const [previewStream, setPreviewStream] = useState(null);
  const [micLevel, setMicLevel] = useState(0);

  useEffect(() => {
    fetch(`${API_BASE}/rooms/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject('Not found'))
      .then(data => { setRoom(data.room); setLoading(false); })
      .catch(e => { setError('Room unavailable.'); setLoading(false); });
  }, [id]);

  useEffect(() => {
    let audioCtx, analyser, dataArray, source, af;
    if (!hasJoined && !loading && !error) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          setPreviewStream(stream);
          if (previewVideoRef.current) previewVideoRef.current.srcObject = stream;
          
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          analyser = audioCtx.createAnalyser();
          source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);
          dataArray = new Uint8Array(analyser.frequencyBinCount);
          
          const updateMic = () => {
            analyser.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((a,b)=>a+b,0);
            setMicLevel(Math.min(100, (sum / dataArray.length / 128) * 100));
            af = requestAnimationFrame(updateMic);
          };
          updateMic();
        }).catch(e => console.warn('Preview media denied', e));
    }
    return () => {
      if (previewStream) previewStream.getTracks().forEach(t => t.stop());
      if (audioCtx) audioCtx.close();
      if (af) cancelAnimationFrame(af);
    };
  }, [hasJoined, loading, error]);

  if (hasJoined && room) {
    return (
      <RoomLayout 
        roomId={id} 
        roomTitle={room.title} 
        userSettings={{ userId: user?.id, name: user?.publisherName || 'Guest', avatar: user?.logoUrl }}
        onLeave={() => router.push('/')} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center p-4 font-sans text-white">
      {loading ? (
        <div className="w-8 h-8 border-4 border-signal border-t-transparent rounded-full animate-spin" />
      ) : error ? (
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{error}</h1>
          <button onClick={() => router.push('/')} className="bg-signal px-6 py-2 rounded-full font-bold">Return Home</button>
        </div>
      ) : (
        <div className="max-w-4xl w-full grid md:grid-cols-[1fr_300px] gap-8 items-center">
          {/* Left: Video Preview */}
          <div className="flex flex-col gap-4">
            <div className="relative aspect-video bg-[#1a1a2e] rounded-xl overflow-hidden shadow-2xl border border-white/10">
              <video ref={previewVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2">
                <Mic size={14} className={micLevel > 5 ? 'text-emerald-400' : 'text-white/60'} />
                <div className="flex gap-0.5 h-3 items-end">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="w-1 bg-emerald-400 rounded-t-sm transition-all" style={{ height: micLevel > i*20 ? '100%' : '20%' }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-white/60 text-sm justify-center">
              <span className="flex items-center gap-1.5"><Video size={16} /> Camera ready</span>
              <span className="flex items-center gap-1.5"><Mic size={16} /> Mic ready</span>
            </div>
          </div>

          {/* Right: Room Info & Join */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left gap-6">
            <div>
              <h1 className="text-2xl font-bold mb-2">{room.title}</h1>
              <p className="text-white/60 text-sm">Host: {room.host_name}</p>
            </div>
            
            <div className="w-full space-y-3">
              <button 
                onClick={() => setHasJoined(true)} 
                className="w-full bg-signal hover:bg-red-600 text-white font-bold py-3.5 rounded-full transition-colors shadow-lg"
              >
                Join now
              </button>
              <button 
                onClick={() => setHasJoined(true)} 
                className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3.5 rounded-full transition-colors border border-white/10"
              >
                Join with audio only
              </button>
            </div>

            <p className="text-[11px] text-white/40 max-w-[250px]">
              By joining, you agree to the OPINIONPLUS community guidelines.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}