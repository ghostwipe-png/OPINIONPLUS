'use client';

import { useEffect, useRef, useState } from 'react';
import { MicOff, VideoOff, Hand, Pin, PinOff, MonitorUp } from 'lucide-react';

export default function VideoTile({ participant, isLarge, onPin }) {
  const videoRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      if (videoRef.current.srcObject !== participant.stream) {
        videoRef.current.srcObject = participant.stream;
      }
    }
  }, [participant.stream]);

  const initials = participant.name ? participant.name.charAt(0).toUpperCase() : '?';

  return (
    <div 
      className={`relative w-full h-full bg-[#1a1a2e] rounded-xl overflow-hidden transition-all duration-300 group ${participant.isDominant ? 'ring-2 ring-white shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'ring-1 ring-white/10 shadow-lg'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={!participant.isSelf ? onPin : undefined}
    >
      {/* Video or Placeholder */}
      {!participant.isCameraOff && participant.stream ? (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted={participant.isSelf} 
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a2e]">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-signal to-amber-500 p-1 flex items-center justify-center shadow-lg relative">
            {participant.avatar ? (
              <img src={participant.avatar} alt={participant.name} className="w-full h-full rounded-full object-cover border-4 border-[#1a1a2e]" />
            ) : (
              <div className="w-full h-full rounded-full bg-[#1a1a2e] flex items-center justify-center text-3xl font-bold text-white">
                {initials}
              </div>
            )}
            {/* Audio pulse ring for placeholder */}
            <div 
              className="absolute inset-0 rounded-full border-2 border-signal transition-all duration-100 ease-out" 
              style={{ transform: `scale(${1 + (participant.audioLevel / 100) * 0.4})`, opacity: participant.isSpeaking ? 0.8 : 0 }} 
            />
          </div>
        </div>
      )}

      {/* Screen Share Badge */}
      {participant.isScreenSharing && (
        <div className="absolute top-3 left-3 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded shadow-md flex items-center gap-1.5 backdrop-blur-sm">
          <MonitorUp size={12} /> Presenting
        </div>
      )}

      {/* Pin Button */}
      {!participant.isSelf && isHovered && (
        <button 
          onClick={(e) => { e.stopPropagation(); onPin(); }}
          className="absolute top-3 left-3 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
          title={participant.isPinned ? "Unpin" : "Pin to screen"}
        >
          {participant.isPinned ? <PinOff size={16} /> : <Pin size={16} />}
        </button>
      )}

      {/* Status Icons (Top Right) */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        {participant.isHandRaised && (
          <div className="bg-amber-500 text-ink p-1.5 rounded-full shadow-lg animate-bounce" title="Hand Raised">
            <Hand size={14} />
          </div>
        )}
        {/* Network indicator dot */}
        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" title="Good connection" />
      </div>

      {/* Name Badge (Bottom Left) */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/5 shadow-lg max-w-[80%]">
        <span className="text-xs font-semibold text-white truncate">
          {participant.name} {participant.isSelf && '(You)'}
        </span>
        {participant.isMuted ? (
          <MicOff size={14} className="text-red-400 shrink-0" />
        ) : (
          <div className="flex gap-0.5 items-center shrink-0 h-3">
            {/* Tiny visual eq */}
            <div className="w-1 bg-emerald-400 rounded-full transition-all duration-75" style={{ height: participant.isSpeaking ? '100%' : '20%' }} />
            <div className="w-1 bg-emerald-400 rounded-full transition-all duration-75 delay-75" style={{ height: participant.isSpeaking ? '80%' : '20%' }} />
            <div className="w-1 bg-emerald-400 rounded-full transition-all duration-75 delay-150" style={{ height: participant.isSpeaking ? '60%' : '20%' }} />
          </div>
        )}
      </div>
    </div>
  );
}