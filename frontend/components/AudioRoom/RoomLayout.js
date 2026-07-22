'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import useWebSocket from './useWebSocket';
import useWebRTC from './useWebRTC';
import VideoTile from './VideoTile';
import ControlsBar from './ControlsBar';
import ChatPanel from './ChatPanel';
import ParticipantList from './ParticipantList';
import EmojiOverlay from './EmojiOverlay';

export default function RoomLayout({ roomId, roomTitle, userSettings, onLeave }) {
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [pinnedParticipantId, setPinnedParticipantId] = useState(null);
  const [isAutoHideControls, setIsAutoHideControls] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [toasts, setToasts] = useState([]);
  
  const hideTimerRef = useRef(null);
  const { send, lastMessage, connectionState, isConnected } = useWebSocket(roomId, userSettings);
  
  const {
    localStream,
    screenStream,
    peerConnections,
    remoteStreams,
    audioLevel,
    isMuted,
    isCameraOff,
    toggleMute,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    participants,
    chatMessages,
    raisedHands,
    dominantSpeakerId,
    selfConnectionId,
    isScreenSharing,
  } = useWebRTC({ send, lastMessage, userSettings });

  // Play synthetic sounds
  const playSound = useCallback((type) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'join') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
        osc.start(); osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'leave') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
        osc.start(); osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'chat' || type === 'hand') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.02);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
        osc.start(); osc.stop(ctx.currentTime + 0.1);
      }
    } catch(e) {}
  }, []);

  const addToast = useCallback((msg) => {
    const id = crypto.randomUUID();
    setToasts(p => [...p, { id, msg }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  }, []);

  useEffect(() => {
    if (!lastMessage) return;
    const { type, payload } = lastMessage;
    if (type === 'participant-joined' && payload.id !== userSettings.userId) {
      playSound('join');
      addToast(`${payload.name} joined the room`);
    } else if (type === 'participant-left') {
      playSound('leave');
      addToast(`${payload.name} left the room`);
    } else if (type === 'hand-raised') {
      playSound('hand');
      addToast(`${payload.name} raised their hand`);
    } else if (type === 'chat-message' && payload.senderId !== selfConnectionId && !showChat) {
      playSound('chat');
    } else if (type === 'emoji-reaction') {
      setReactions(prev => [...prev, { id: crypto.randomUUID(), emoji: payload.emoji, senderName: payload.senderName }]);
    }
  }, [lastMessage, playSound, addToast, showChat, selfConnectionId, userSettings.userId]);

  const handleActivity = () => {
    setIsAutoHideControls(false);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setIsAutoHideControls(true), 5000);
  };

  useEffect(() => {
    handleActivity();
    return () => clearTimeout(hideTimerRef.current);
  }, []);

  const toggleHandRaise = () => send('raise-hand', {});
  const sendChatMessage = (text) => send('chat-message', { text });
  const sendEmojiReaction = (emoji) => send('emoji-reaction', { emoji });

  const renderVideoGrid = () => {
    if (!selfConnectionId) return null;
    
    const allTiles = participants.map(p => {
      const isSelf = p.connectionId === selfConnectionId;
      return {
        ...p,
        isSelf,
        stream: isSelf ? (isScreenSharing ? screenStream : localStream) : remoteStreams[p.connectionId],
        isDominant: dominantSpeakerId === p.connectionId,
        isPinned: pinnedParticipantId === p.connectionId
      };
    });

    // Determine layout classes based on count
    let gridClass = "grid gap-4 w-full h-full p-4 ";
    const len = allTiles.length;
    
    if (len === 1) gridClass += "grid-cols-1 grid-rows-1";
    else if (len === 2) gridClass += "grid-cols-1 sm:grid-cols-2 grid-rows-2 sm:grid-rows-1";
    else if (len <= 4) gridClass += "grid-cols-2 grid-rows-2";
    else gridClass += "grid-cols-1 flex-col";

    if (len > 4 || pinnedParticipantId || isScreenSharing) {
      const mainTileId = pinnedParticipantId || (isScreenSharing ? selfConnectionId : (dominantSpeakerId || allTiles[0].connectionId));
      const mainTile = allTiles.find(t => t.connectionId === mainTileId) || allTiles[0];
      const otherTiles = allTiles.filter(t => t.connectionId !== mainTile.connectionId);

      return (
        <div className="flex flex-col h-full w-full gap-4 p-4">
          <div className="flex-1 min-h-0 w-full rounded-xl overflow-hidden shadow-2xl transition-all duration-300">
            <VideoTile 
              participant={mainTile} 
              isLarge={true}
              onPin={() => setPinnedParticipantId(mainTile.isPinned ? null : mainTile.connectionId)} 
            />
          </div>
          <div className="h-32 sm:h-40 w-full flex gap-3 overflow-x-auto pb-2 shrink-0 snap-x">
            {otherTiles.map(t => (
              <div key={t.connectionId} className="h-full aspect-video snap-center shrink-0">
                <VideoTile 
                  participant={t}
                  isLarge={false}
                  onPin={() => setPinnedParticipantId(t.connectionId)} 
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className={gridClass}>
        {allTiles.map(t => (
          <VideoTile 
            key={t.connectionId} 
            participant={t}
            isLarge={len <= 2}
            onPin={() => setPinnedParticipantId(t.isPinned ? null : t.connectionId)} 
          />
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-[#0d0d1a] flex flex-col z-50 text-white font-sans overflow-hidden">
      {/* Toast Stack */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="bg-white/10 backdrop-blur-md border border-white/5 rounded-full px-5 py-2 text-sm shadow-xl animate-in slide-in-from-top-4 fade-in duration-300">
            {t.msg}
          </div>
        ))}
      </div>

      <EmojiOverlay reactions={reactions} />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col relative" onMouseMove={handleActivity} onClick={handleActivity}>
          
          {/* Header */}
          <div className={`absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/80 to-transparent z-10 flex items-center justify-between px-6 transition-opacity duration-300 ${isAutoHideControls ? 'opacity-0' : 'opacity-100'}`}>
            <h1 className="text-sm font-bold tracking-wide truncate max-w-[50%]">{roomTitle}</h1>
            <div className="flex items-center gap-3 text-xs font-medium text-white/80">
              <span className="bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">{participants.length} Participant{participants.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <div className="flex-1 relative overflow-hidden bg-[#0d0d1a]">
            {!isConnected && (
              <div className="absolute inset-0 z-20 bg-[#0d0d1a] flex flex-col items-center justify-center">
                <div className="w-8 h-8 border-4 border-signal border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-white/60 font-medium">Reconnecting...</p>
              </div>
            )}
            {renderVideoGrid()}
          </div>
        </div>

        {/* Sidebars */}
        {showChat && (
          <ChatPanel 
            messages={chatMessages} 
            onSend={sendChatMessage} 
            onClose={() => setShowChat(false)} 
          />
        )}
        {showParticipants && (
          <ParticipantList 
            participants={participants} 
            hostId={participants.find(p => p.role === 'host')?.connectionId} 
            raisedHands={raisedHands} 
            onClose={() => setShowParticipants(false)} 
          />
        )}
      </div>

      <ControlsBar
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        isHandRaised={participants.find(p => p.connectionId === selfConnectionId)?.isHandRaised}
        isScreenSharing={isScreenSharing}
        participantCount={participants.length}
        showChat={showChat}
        showParticipants={showParticipants}
        visible={!isAutoHideControls}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onToggleHandRaise={toggleHandRaise}
        onToggleScreenShare={isScreenSharing ? stopScreenShare : startScreenShare}
        onToggleChat={() => setShowChat(!showChat)}
        onToggleParticipants={() => setShowParticipants(!showParticipants)}
        onEmojiReaction={sendEmojiReaction}
        onLeave={onLeave}
      />
    </div>
  );
}