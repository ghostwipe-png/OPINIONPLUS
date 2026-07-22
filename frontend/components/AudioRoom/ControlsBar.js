'use client';

import { useState, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, MonitorUp, Hand, MessageCircle, Users, Smile, MoreVertical, PhoneOff } from 'lucide-react';
import ReactionPicker from './ReactionPicker';

export default function ControlsBar(props) {
  const {
    isMuted, isCameraOff, isHandRaised, isScreenSharing,
    participantCount, showChat, showParticipants,
    visible, onToggleMute, onToggleCamera, onToggleHandRaise,
    onToggleScreenShare, onToggleChat, onToggleParticipants,
    onEmojiReaction, onLeave
  } = props;

  const [showReactions, setShowReactions] = useState(false);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.ctrlKey && e.key.toLowerCase() === 'd') { e.preventDefault(); onToggleMute(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'e') { e.preventDefault(); onToggleCamera(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'h') { e.preventDefault(); onToggleHandRaise(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'c') { e.preventDefault(); onToggleChat(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'p') { e.preventDefault(); onToggleParticipants(); }
      if (e.key === 'Escape' && !showConfirmLeave) setShowConfirmLeave(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleMute, onToggleCamera, onToggleHandRaise, onToggleChat, onToggleParticipants, showConfirmLeave]);

  return (
    <>
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${visible ? 'translate-y-0' : 'translate-y-[150%]'}`}>
        <div className="flex items-center gap-2 bg-[#1a1a2e]/95 backdrop-blur-md border border-white/10 px-3 py-2 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
          
          <button onClick={onToggleMute} className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-signal text-white hover:bg-red-600' : 'bg-white/10 text-white hover:bg-white/20'}`} title={`Turn ${isMuted ? 'on' : 'off'} microphone (Ctrl+D)`}>
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <button onClick={onToggleCamera} className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-colors ${isCameraOff ? 'bg-signal text-white hover:bg-red-600' : 'bg-white/10 text-white hover:bg-white/20'}`} title={`Turn ${isCameraOff ? 'on' : 'off'} camera (Ctrl+E)`}>
            {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>

          <button onClick={onToggleScreenShare} className={`hidden sm:flex w-12 h-12 rounded-full items-center justify-center transition-colors ${isScreenSharing ? 'bg-blue-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`} title="Present now">
            <MonitorUp size={20} />
          </button>

          <button onClick={onToggleHandRaise} className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-colors ${isHandRaised ? 'bg-amber-500 text-ink' : 'bg-white/10 text-white hover:bg-white/20'}`} title="Raise hand (Ctrl+H)">
            <Hand size={20} />
          </button>

          <div className="w-[1px] h-8 bg-white/10 mx-1 hidden sm:block" />

          <button onClick={onToggleChat} className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-colors relative ${showChat ? 'bg-white/20 text-white' : 'bg-transparent text-white hover:bg-white/10'}`} title="Chat (Ctrl+C)">
            <MessageCircle size={20} />
          </button>

          <button onClick={onToggleParticipants} className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-colors relative ${showParticipants ? 'bg-white/20 text-white' : 'bg-transparent text-white hover:bg-white/10'}`} title="People (Ctrl+P)">
            <Users size={20} />
            <span className="absolute top-1 right-0 sm:top-2 sm:right-1 bg-[#1a1a2e] text-white text-[9px] font-bold px-1 rounded-full border border-white/20">{participantCount}</span>
          </button>

          <div className="relative">
            <button onClick={() => setShowReactions(!showReactions)} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center bg-transparent text-white hover:bg-white/10 transition-colors" title="Send a reaction">
              <Smile size={20} />
            </button>
            {showReactions && (
              <ReactionPicker onSelect={(emoji) => { onEmojiReaction(emoji); setShowReactions(false); }} onClose={() => setShowReactions(false)} />
            )}
          </div>

          <div className="w-[1px] h-8 bg-white/10 mx-1" />

          <button onClick={() => setShowConfirmLeave(true)} className="w-14 h-10 sm:w-16 sm:h-12 rounded-full flex items-center justify-center bg-signal text-white hover:bg-red-600 transition-colors px-4" title="Leave room (Esc)">
            <PhoneOff size={20} />
          </button>
        </div>
      </div>

      {showConfirmLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[#1a1a2e] border border-white/10 p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white mb-2">Leave this room?</h3>
            <p className="text-white/60 text-sm mb-6">You'll be disconnected from the call.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowConfirmLeave(false)} className="px-5 py-2.5 rounded-full text-sm font-bold text-white hover:bg-white/10 transition-colors border border-transparent">Cancel</button>
              <button onClick={onLeave} className="px-5 py-2.5 rounded-full text-sm font-bold bg-signal text-white hover:bg-red-600 transition-colors">Leave</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}