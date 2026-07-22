export class AudioRoomDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sockets = []; 
    this.roomState = {
      id: '',
      title: 'Live Audio Space',
      hostId: '',
      hostName: '',
      createdAt: new Date().toISOString(),
      isRecording: false,
      recordingStartedAt: null,
      participants: new Map(),
      chatMessages: [],
      raisedHands: [],
    };
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'GET' && !request.headers.get('Upgrade')) {
      return Response.json({
        id: this.roomState.id,
        title: this.roomState.title,
        hostId: this.roomState.hostId,
        participantCount: this.roomState.participants.size,
      });
    }

    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    // MAXIMUM SECURITY: Extract identity strictly from secure headers injected by our own router.
    // Hackers cannot modify these headers externally.
    const secureUserId = request.headers.get('X-Secure-User-Id');
    const secureUserName = request.headers.get('X-Secure-User-Name') || 'Verified User';
    const secureUserAvatar = request.headers.get('X-Secure-User-Avatar') || null;
    const secureUserRole = request.headers.get('X-Secure-User-Role') || 'user';

    if (!secureUserId) {
      return new Response('Security Exception: Unverified Identity', { status: 403 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();
    
    // Bind immutable identity to the socket instance.
    server.verifiedIdentity = {
      id: secureUserId,
      name: secureUserName,
      avatar: secureUserAvatar,
      role: secureUserRole
    };

    this.sockets.push(server);

    server.addEventListener('message', async (event) => {
      await this.webSocketMessage(server, event.data);
    });

    server.addEventListener('close', () => { this.webSocketClose(server); });
    server.addEventListener('error', () => { this.webSocketClose(server); });

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, messageString) {
    try {
      const msg = JSON.parse(messageString);
      const { type, payload } = msg;

      switch (type) {
        case 'join': {
          if (this.roomState.participants.size >= 50) {
            ws.send(JSON.stringify({ type: 'error', payload: { message: 'Room is full.' } }));
            ws.close();
            return;
          }

          const connectionId = crypto.randomUUID();
          ws.connectionId = connectionId;

          // ZERO-TRUST: We completely ignore payload.userId from the client.
          const participant = {
            id: ws.verifiedIdentity.id,
            name: ws.verifiedIdentity.name,
            avatar: ws.verifiedIdentity.avatar,
            role: ws.verifiedIdentity.role,
            connectionId,
            isMuted: true,
            isCameraOff: true,
            isHandRaised: false,
            isScreenSharing: false,
            isSpeaking: false,
            audioLevel: 0,
            joinedAt: new Date().toISOString(),
          };

          if (this.roomState.participants.size === 0 && !this.roomState.hostId) {
            this.roomState.hostId = participant.id;
            this.roomState.hostName = participant.name;
          }

          this.roomState.participants.set(connectionId, participant);

          ws.send(JSON.stringify({ 
            type: 'room-state', 
            payload: {
              id: this.roomState.id,
              title: this.roomState.title,
              hostId: this.roomState.hostId,
              isRecording: this.roomState.isRecording,
              participants: Array.from(this.roomState.participants.values()),
              chatMessages: this.roomState.chatMessages,
              raisedHands: this.roomState.raisedHands,
              selfConnectionId: connectionId
            }
          }));

          this.broadcast({ type: 'participant-joined', payload: participant }, connectionId);
          break;
        }
        case 'leave': {
          if (ws.connectionId) this.handleRemoveParticipant(ws.connectionId);
          break;
        }
        case 'webrtc-offer': 
        case 'webrtc-answer': 
        case 'webrtc-ice-candidate': {
          const targetWs = this.sockets.find(s => s.connectionId === payload.targetConnectionId);
          if (targetWs) {
            targetWs.send(JSON.stringify({ 
              type, 
              payload: { senderConnectionId: ws.connectionId, [type === 'webrtc-ice-candidate' ? 'candidate' : 'sdp']: payload[type === 'webrtc-ice-candidate' ? 'candidate' : 'sdp'] } 
            }));
          }
          break;
        }
        case 'toggle-mute':
        case 'toggle-camera': {
          const p = this.roomState.participants.get(ws.connectionId);
          if (p) { 
            if (type === 'toggle-mute') p.isMuted = payload.isMuted;
            else p.isCameraOff = payload.isCameraOff;
            this.broadcast({ type: 'participant-updated', payload: { connectionId: ws.connectionId, isMuted: p.isMuted, isCameraOff: p.isCameraOff } }); 
          }
          break;
        }
        case 'raise-hand': {
          const p = this.roomState.participants.get(ws.connectionId);
          if (p) {
            p.isHandRaised = !p.isHandRaised;
            if (p.isHandRaised) this.roomState.raisedHands.push(ws.connectionId);
            else this.roomState.raisedHands = this.roomState.raisedHands.filter(id => id !== ws.connectionId);
            this.broadcast({ type: 'participant-updated', payload: { connectionId: ws.connectionId, isHandRaised: p.isHandRaised } });
          }
          break;
        }
        case 'chat-message': {
          // Strict Sanitization: Strip html tags and cap length
          if (!payload.text || typeof payload.text !== 'string') return;
          const sanitizedText = payload.text.replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, 500);
          if (!sanitizedText) return;

          const p = this.roomState.participants.get(ws.connectionId);
          const msgObj = { 
            id: crypto.randomUUID(), 
            senderId: ws.connectionId, 
            senderName: p ? p.name : ws.verifiedIdentity.name, 
            text: sanitizedText, 
            timestamp: new Date().toISOString() 
          };
          
          this.roomState.chatMessages.push(msgObj);
          if (this.roomState.chatMessages.length > 300) this.roomState.chatMessages.shift();
          this.broadcast({ type: 'chat-message', payload: msgObj });
          break;
        }
        case 'emoji-reaction': {
          const allowed = ['🎉', '👏', '❤️', '🔥', '😂', '😮', '👍', '💡'];
          if (!allowed.includes(payload.emoji)) return;
          const p = this.roomState.participants.get(ws.connectionId);
          this.broadcast({ type: 'emoji-reaction', payload: { senderId: ws.connectionId, senderName: p ? p.name : '', emoji: payload.emoji } });
          break;
        }
        case 'speaking-update': {
          const p = this.roomState.participants.get(ws.connectionId);
          if (p) {
            p.audioLevel = typeof payload.audioLevel === 'number' ? Math.min(100, Math.max(0, payload.audioLevel)) : 0;
            p.isSpeaking = p.audioLevel > 10;
            this.handleDominantSpeaker();
          }
          break;
        }
        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        }
      }
    } catch (e) {}
  }

  webSocketClose(ws) {
    this.sockets = this.sockets.filter(s => s !== ws);
    if (ws.connectionId) this.handleRemoveParticipant(ws.connectionId);
  }

  handleRemoveParticipant(connectionId) {
    const p = this.roomState.participants.get(connectionId);
    if (!p) return;
    this.roomState.participants.delete(connectionId);
    this.roomState.raisedHands = this.roomState.raisedHands.filter(id => id !== connectionId);
    this.broadcast({ type: 'participant-left', payload: { connectionId, name: p.name } });

    if (p.id === this.roomState.hostId && this.roomState.participants.size > 0) {
      const nextParticipant = Array.from(this.roomState.participants.values())[0];
      this.roomState.hostId = nextParticipant.id;
      this.broadcast({ type: 'host-changed', payload: { newHostId: nextParticipant.id } });
    }
  }

  handleDominantSpeaker() {
    let dominant = null;
    let maxLevel = 10;
    const audioLevels = {};
    for (const [connId, p] of this.roomState.participants.entries()) {
      audioLevels[connId] = p.audioLevel;
      if (p.audioLevel > maxLevel) { maxLevel = p.audioLevel; dominant = connId; }
    }
    this.broadcast({ type: 'speaker-update', payload: { dominantSpeakerId: dominant, audioLevels } });
  }

  broadcast(messageObj, excludeConnectionId = null) {
    const str = JSON.stringify(messageObj);
    for (const ws of this.sockets) {
      if (ws.connectionId && ws.connectionId !== excludeConnectionId) {
        try { ws.send(str); } catch (e) {}
      }
    }
  }
}