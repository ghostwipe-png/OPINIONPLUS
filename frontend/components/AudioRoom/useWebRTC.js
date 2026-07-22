'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

export default function useWebRTC({ send, lastMessage, userSettings }) {
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [participants, setParticipants] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [raisedHands, setRaisedHands] = useState([]);
  const [dominantSpeakerId, setDominantSpeakerId] = useState(null);
  const [selfConnectionId, setSelfConnectionId] = useState(null);
  
  const [isMuted, setIsMuted] = useState(true);
  const [isCameraOff, setIsCameraOff] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const peerConnections = useRef({});
  const localStreamRef = useRef(null);
  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);

  // 1. Initialize Local Media
  useEffect(() => {
    async function initMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        // Start muted/camera off by default
        stream.getAudioTracks().forEach(t => t.enabled = false);
        stream.getVideoTracks().forEach(t => t.enabled = false);
        setLocalStream(stream);
        localStreamRef.current = stream;

        // Audio Metering
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContext();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        source.connect(analyserRef.current);

        const checkAudioLevel = () => {
          if (!analyserRef.current || isMuted) {
            setAudioLevel(0);
            requestAnimationFrame(checkAudioLevel);
            return;
          }
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const average = sum / dataArray.length;
          const level = Math.min(100, Math.round((average / 128) * 100));
          
          if (level > 5) send('speaking-update', { audioLevel: level });
          setAudioLevel(level);
          
          requestAnimationFrame(checkAudioLevel);
        };
        checkAudioLevel();
      } catch (e) {
        console.warn("Failed to get local media", e);
      }
    }
    initMedia();
    return () => {
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [isMuted, send]);

  // Peer Connection helper
  const createPeerConnection = useCallback((targetConnectionId) => {
    if (peerConnections.current[targetConnectionId]) return peerConnections.current[targetConnectionId];
    
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current[targetConnectionId] = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        send('webrtc-ice-candidate', { targetConnectionId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams(prev => ({
        ...prev,
        [targetConnectionId]: event.streams[0]
      }));
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    return pc;
  }, [send]);

  // 2. Handle WebSocket Signaling
  useEffect(() => {
    if (!lastMessage) return;
    const { type, payload } = lastMessage;

    const handleWebRTC = async () => {
      if (type === 'room-state') {
        setParticipants(payload.participants || []);
        setSelfConnectionId(payload.selfConnectionId);
        setChatMessages(payload.chatMessages || []);
        setRaisedHands(payload.raisedHands || []);
      }
      else if (type === 'participant-joined') {
        setParticipants(prev => [...prev.filter(p => p.connectionId !== payload.connectionId), payload]);
        if (payload.connectionId !== selfConnectionId) {
          const pc = createPeerConnection(payload.connectionId);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          send('webrtc-offer', { targetConnectionId: payload.connectionId, sdp: pc.localDescription });
        }
      }
      else if (type === 'webrtc-offer') {
        const pc = createPeerConnection(payload.senderConnectionId);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send('webrtc-answer', { targetConnectionId: payload.senderConnectionId, sdp: pc.localDescription });
      }
      else if (type === 'webrtc-answer') {
        const pc = peerConnections.current[payload.senderConnectionId];
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      }
      else if (type === 'webrtc-ice-candidate') {
        const pc = peerConnections.current[payload.senderConnectionId];
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      }
      else if (type === 'participant-left') {
        setParticipants(prev => prev.filter(p => p.connectionId !== payload.connectionId));
        if (peerConnections.current[payload.connectionId]) {
          peerConnections.current[payload.connectionId].close();
          delete peerConnections.current[payload.connectionId];
        }
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[payload.connectionId];
          return next;
        });
      }
      else if (type === 'participant-updated') {
        setParticipants(prev => prev.map(p => p.connectionId === payload.connectionId ? { ...p, ...payload } : p));
      }
      else if (type === 'chat-message') {
        setChatMessages(prev => [...prev, payload]);
      }
      else if (type === 'speaker-update') {
        setDominantSpeakerId(payload.dominantSpeakerId);
      }
    };
    handleWebRTC();
  }, [lastMessage, createPeerConnection, send, selfConnectionId]);

  // Controls
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => t.enabled = isMuted);
      if (isMuted && audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
    }
    setIsMuted(!isMuted);
    send('toggle-mute', { isMuted: !isMuted });
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => t.enabled = isCameraOff);
    }
    setIsCameraOff(!isCameraOff);
    send('toggle-camera', { isCameraOff: !isCameraOff });
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setScreenStream(stream);
      setIsScreenSharing(true);
      send('start-screen-share', {});

      const screenTrack = stream.getVideoTracks()[0];
      screenTrack.onended = stopScreenShare;

      // Replace track in all peer connections
      Object.values(peerConnections.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);
      });
    } catch (e) {}
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
      setScreenStream(null);
    }
    setIsScreenSharing(false);
    send('stop-screen-share', {});

    // Revert to camera track
    const camTrack = localStreamRef.current?.getVideoTracks()[0];
    Object.values(peerConnections.current).forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender && camTrack) sender.replaceTrack(camTrack);
    });
  };

  return {
    localStream, screenStream, remoteStreams, peerConnections,
    audioLevel, isMuted, isCameraOff, isScreenSharing,
    toggleMute, toggleCamera, startScreenShare, stopScreenShare,
    participants, chatMessages, raisedHands, dominantSpeakerId, selfConnectionId
  };
}