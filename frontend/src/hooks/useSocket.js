/**
 * hooks/useSocket.js
 * Reusable hook for Socket.io connections.
 * Handles connect/disconnect lifecycle and room management.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export function useSocket({ role, sessionId, onEvent } = {}) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      query: { role: role || 'candidate', sessionId: sessionId || '' },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
      if (sessionId) socket.emit('join_session', { sessionId });
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      setError(err.message);
      setConnected(false);
    });

    // Forward all events to the onEvent callback
    if (onEvent) {
      const events = [
        'alert', 'candidate_alert', 'session_ended', 'session_update',
        'new_session', 'active_sessions', 'candidate_connected',
        'candidate_disconnected', 'heartbeat',
      ];
      events.forEach((event) => {
        socket.on(event, (data) => onEvent(event, data));
      });
    }

    return () => {
      socket.disconnect();
    };
  }, [role, sessionId]);

  const emit = useCallback((event, data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  return { socket: socketRef, connected, error, emit, on };
}
