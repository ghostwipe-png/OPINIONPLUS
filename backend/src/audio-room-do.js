export class AudioRoomDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.participants = new Map(); // participantId -> participant object
    this.chatMessages = []; // last 200 messages
    this.roomMetadata = {
      title: 'Live Audio Space',
      hostId: '',
      createdAt: new Date().toISOString(),
      isRecording: false,
      recordingStartedAt: null,
    };
    this.raisedHands = []; // ordered queue of participantIds
  }

  async fetch(request) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    // pathParts format: ['', 'room', roomId, ...] or similar depending on routing

    if (url.pathname.endsWith('/create') && request.method === 'POST') {
      const body = await request.json();
      this.roomMetadata.title = body.title || 'Live Audio Space';
      this.roomMetadata.hostId = body.hostId || '';
      this.roomMetadata.createdAt = new Date().toISOString();
      return Response.json({ ok: true, roomMetadata: this.roomMetadata });
    }

    if (url.pathname.includes('/room/') || pathParts.length >= 3) {
      if (request.method === 'GET') {
        return Response.json({
          roomMetadata: this.roomMetadata,
          participants: Array.from(this.participants.values()),
          raisedHands: this.raisedHands,
          chatMessages: this.chatMessages,
        });
      }
    }

    // WebSocket upgrade check
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected upgrade to websocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.state.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws, messageString) {
    try {
      const msg = JSON.parse(messageString);
      const { type, payload } = msg;
      const participantId = ws.deserializeAttachment?.()?.participantId || ws.participantId;

      switch (type) {
        case 'join': {
          const id = 'p_' + crypto.randomUUID().slice(0, 8);
          ws.participantId = id;
          ws.serializeAttachment?.({ participantId: id });

          const participant = {
            id,
            name: payload.name || 'Guest',
            avatar: payload.avatar || '',
            isMuted: true,
            isCameraOff: true,
            isHandRaised: false,
            isScreenSharing: false,
            isSpeaking: false,
            audioLevel: 0,
            joinedAt: new Date().toISOString(),
          };

          this.participants.set(id, participant);

          // Send full room state to the newly joined client
          ws.send(JSON.stringify({
            type: 'room-state',
            payload: {
              roomMetadata: this.roomMetadata,
              participants: Array.from(this.participants.values()),
              raisedHands: this.raisedHands,
              chatHistory: this.chatMessages,
              selfId: id,
            },
          }));

          // Broadcast participant joined to others
          this.broadcast({
            type: 'participant-joined',
            payload: participant,
          }, id);
          break;
        }

        case 'leave': {
          if (participantId) {
            this.handleRemoveParticipant(participantId);
          }
          break;
        }

        case 'webrtc-offer':
        case 'webrtc-answer':
        case 'webrtc-ice-candidate': {
          const targetSocket = this.findSocketByParticipantId(payload.targetId);
          if (targetSocket) {
            targetSocket.send(JSON.stringify({
              type,
              payload: {
                senderId: participantId,
                ...payload,
              },
            }));
          }
          break;
        }

        case 'toggle-mute': {
          const p = this.participants.get(participantId);
          if (p) {
            p.isMuted = payload.isMuted;
            this.broadcast({
              type: 'participant-updated',
              payload: { id: participantId, isMuted: p.isMuted },
            });
          }
          break;
        }

        case 'toggle-camera': {
          const p = this.participants.get(participantId);
          if (p) {
            p.isCameraOff = payload.isCameraOff;
            this.broadcast({
              type: 'participant-updated',
              payload: { id: participantId, isCameraOff: p.isCameraOff },
            });
          }
          break;
        }

        case 'raise-hand': {
          const p = this.participants.get(participantId);
          if (p) {
            p.isHandRaised = !p.isHandRaised;
            if (p.isHandRaised) {
              if (!this.raisedHands.includes(participantId)) {
                this.raisedHands.push(participantId);
              }
              this.broadcast({
                type: 'hand-raised',
                payload: { participantId, name: p.name },
              });
            } else {
              this.raisedHands = this.raisedHands.filter(id => id !== participantId);
              this.broadcast({
                type: 'hand-lowered',
                payload: { participantId },
              });
            }
          }
          break;
        }

        case 'chat-message': {
          const p = this.participants.get(participantId);
          const chatObj = {
            id: 'msg_' + crypto.randomUUID().slice(0, 8),
            senderId: participantId,
            senderName: p ? p.name : 'Guest',
            text: payload.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };

          this.chatMessages.push(chatObj);
          if (this.chatMessages.length > 200) {
            this.chatMessages.shift();
          }

          this.broadcast({
            type: 'chat-message',
            payload: chatObj,
          });

          // Persist to D1 asynchronously if DB binding exists
          if (this.env?.DB) {
            const roomId = this.state.id.toString();
            this.env.DB.prepare(
              `INSERT INTO room_chat_messages (id, room_id, sender_id, sender_name, text) VALUES (?, ?, ?, ?, ?)`
            ).bind(chatObj.id, roomId, chatObj.senderId, chatObj.senderName, chatObj.text).run().catch(() => {});
          }
          break;
        }

        case 'emoji-reaction': {
          const p = this.participants.get(participantId);
          this.broadcast({
            type: 'emoji-reaction',
            payload: {
              senderId: participantId,
              senderName: p ? p.name : 'Guest',
              emoji: payload.emoji,
            },
          });
          break;
        }

        case 'speaking-update': {
          const p = this.participants.get(participantId);
          if (p) {
            p.audioLevel = payload.audioLevel || 0;
            p.isSpeaking = p.audioLevel > 15;
          }
          break;
        }

        case 'start-screen-share': {
          const p = this.participants.get(participantId);
          if (p) {
            p.isScreenSharing = true;
            this.broadcast({
              type: 'screen-share-started',
              payload: { participantId },
            });
          }
          break;
        }

        case 'stop-screen-share': {
          const p = this.participants.get(participantId);
          if (p) {
            p.isScreenSharing = false;
            this.broadcast({
              type: 'screen-share-stopped',
              payload: { participantId },
            });
          }
          break;
        }

        case 'start-recording': {
          if (participantId === this.roomMetadata.hostId) {
            this.roomMetadata.isRecording = true;
            this.roomMetadata.recordingStartedAt = new Date().toISOString();
            this.broadcast({ type: 'recording-started' });
          }
          break;
        }

        case 'stop-recording': {
          if (participantId === this.roomMetadata.hostId) {
            this.roomMetadata.isRecording = false;
            this.broadcast({ type: 'recording-stopped' });
          }
          break;
        }

        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        }

        default:
          break;
      }
    } catch (err) {
      // Handle parse errors silently
    }
  }

  webSocketClose(ws, code, reason, wasClean) {
    const participantId = ws.participantId;
    if (participantId) {
      this.handleRemoveParticipant(participantId);
    }
  }

  webSocketError(ws, error) {
    const participantId = ws.participantId;
    if (participantId) {
      this.handleRemoveParticipant(participantId);
    }
  }

  handleRemoveParticipant(participantId) {
    const p = this.participants.get(participantId);
    if (!p) return;

    this.participants.delete(participantId);
    this.raisedHands = this.raisedHands.filter(id => id !== participantId);

    // If host left, assign new host
    if (this.roomMetadata.hostId === participantId && this.participants.size > 0) {
      const nextParticipant = Array.from(this.participants.values())[0];
      this.roomMetadata.hostId = nextParticipant.id;
      this.broadcast({
        type: 'host-changed',
        payload: { newHostId: nextParticipant.id, newHostName: nextParticipant.name },
      });
    }

    this.broadcast({
      type: 'participant-left',
      payload: { id: participantId },
    });
  }

  findSocketByParticipantId(targetId) {
    const sockets = this.state.getWebSockets();
    for (const ws of sockets) {
      if (ws.participantId === targetId) {
        return ws;
      }
    }
    return null;
  }

  broadcast(messageObj, excludeParticipantId = null) {
    const sockets = this.state.getWebSockets();
    const str = JSON.stringify(messageObj);
    for (const ws of sockets) {
      if (ws.participantId && ws.participantId !== excludeParticipantId) {
        try {
          ws.send(str);
        } catch (e) {
          // Socket dead
        }
      }
    }
  }
}