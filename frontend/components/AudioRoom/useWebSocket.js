// components/Audioroom/useWebSocket.js
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export default function useWebSocket(roomId, userSettings) {
  const [connectionState, setConnectionState] = useState('connecting');
  const [lastMessage, setLastMessage] = useState(null);
  
  const ws = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectDelay = 30000;
  const pingInterval = useRef(null);
  const messageQueue = useRef([]);
  
  // Store settings in a ref to prevent dependency array infinite loops[cite: 10]
  const settingsRef = useRef(userSettings);
  useEffect(() => {
    settingsRef.current = userSettings;
  }, [userSettings]);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

  const connect = useCallback(() => {
    // Extract token/userId to pass as a query parameter for authentication
    const token = settingsRef.current?.userId || '';
    const baseWsUrl = API_BASE 
      ? `${API_BASE.replace(/^http/, 'ws')}/rooms/${roomId}/ws`
      : `${typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${typeof window !== 'undefined' ? window.location.host : ''}/rooms/${roomId}/ws`;
    
    const WS_URL = `${baseWsUrl}?token=${encodeURIComponent(token)}`;

    setConnectionState('connecting');
    ws.current = new WebSocket(WS_URL);

    ws.current.onopen = () => {
      setConnectionState('open');
      reconnectAttempts.current = 0;
      
      // Join room using the stable ref values[cite: 10]
      ws.current.send(JSON.stringify({
        type: 'join',
        payload: { 
          name: settingsRef.current.name, 
          avatar: settingsRef.current.avatar, 
          userId: settingsRef.current.userId 
        }
      }));

      // Flush queue[cite: 10]
      while (messageQueue.current.length > 0) {
        ws.current.send(messageQueue.current.shift());
      }

      // Ping/pong[cite: 10]
      pingInterval.current = setInterval(() => {
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
      } catch (e) {}
    };

    ws.current.onclose = () => {
      setConnectionState('closed');
      clearInterval(pingInterval.current);
      
      // Reconnect logic[cite: 10]
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), maxReconnectDelay);
      reconnectAttempts.current += 1;
      setTimeout(() => connect(), delay);
    };

    ws.current.onerror = () => {
      setConnectionState('error');
    };
  }, [API_BASE, roomId]);

  useEffect(() => {
    connect();
    return () => {
      clearInterval(pingInterval.current);
      if (ws.current) {
        ws.current.onclose = null; // Prevent reconnect on intentional unmount[cite: 10]
        ws.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((type, payload) => {
    const msgString = JSON.stringify({ type, payload });
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(msgString);
    } else {
      if (messageQueue.current.length < 100) messageQueue.current.push(msgString);
    }
  }, []);

  return { 
    send, 
    lastMessage, 
    connectionState, 
    isConnected: connectionState === 'open' 
  };
}