/**
 * useProctoring.js
 * Core hook that manages:
 * - Socket.io connection for real-time alerts
 * - Video frame capture and dispatch to AI service
 * - Audio capture and analysis
 * - Tab visibility detection
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const FRAME_INTERVAL_MS = 1500; // Capture frame every 1.5s
const AUDIO_INTERVAL_MS = 5000; // Analyze audio every 5s
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8000';

export function useProctoring({ sessionId, videoRef, onAlert }) {
  const socketRef = useRef(null);
  const frameIntervalRef = useRef(null);
  const audioIntervalRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const canvasRef = useRef(document.createElement('canvas'));
  const [connected, setConnected] = useState(false);
  const [analysisStats, setAnalysisStats] = useState({
    framesAnalyzed: 0,
    lastAnalysisTime: null,
  });

  // --- Socket connection ---
  useEffect(() => {
    if (!sessionId) return;

    const socket = io(BACKEND_URL, {
      query: { sessionId, role: 'candidate' },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_session', { sessionId });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('alert', (alert) => {
      onAlert(alert);
    });

    socket.on('session_ended', () => {
      window.location.href = `/report/${sessionId}`;
    });

    return () => {
      socket.disconnect();
    };
  }, [sessionId, onAlert]);

  // --- Tab visibility detection ---
  useEffect(() => {
    if (!sessionId) return;

    let tabSwitchCount = 0;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        tabSwitchCount++;
        const alert = {
          type: 'tab_switch',
          severity: 'medium',
          message: `Tab switch detected (count: ${tabSwitchCount})`,
          timestamp: new Date().toISOString(),
          metadata: { count: tabSwitchCount },
        };
        onAlert(alert);
        emitAlert(alert);
      }
    };

    const handleBlur = () => {
      const alert = {
        type: 'tab_switch',
        severity: 'medium',
        message: 'Browser window lost focus',
        timestamp: new Date().toISOString(),
      };
      emitAlert(alert);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [sessionId, onAlert]);

  // --- Context menu / right-click detection ---
  useEffect(() => {
    const handleContextMenu = (e) => {
      e.preventDefault();
      const alert = {
        type: 'tab_switch',
        severity: 'low',
        message: 'Right-click attempt detected',
        timestamp: new Date().toISOString(),
      };
      onAlert(alert);
      emitAlert(alert);
    };

    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, [sessionId]);

  // --- Frame capture and AI analysis ---
  const captureFrame = useCallback(async () => {
    if (!videoRef.current || videoRef.current.readyState < 2) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');

    // FIX: The video element has CSS transform scaleX(-1) for mirror display.
    // We must capture the ACTUAL unmirrored frame (what the camera sees),
    // NOT the mirrored display. MediaPipe/YOLO work on real camera coords.
    // Draw normally (no flip) — the AI handles it in real camera space.
    ctx.drawImage(video, 0, 0, 640, 480);

    const frameBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    try {
      const response = await axios.post(`${AI_SERVICE_URL}/analyze/frame`, {
        frame: frameBase64,
        sessionId,
        timestamp: new Date().toISOString(),
      }, { timeout: 5000 });

      const { alerts: detectedAlerts } = response.data;

      if (detectedAlerts && detectedAlerts.length > 0) {
        detectedAlerts.forEach((alert) => {
          onAlert(alert);
          emitAlert(alert);
        });
      }

      setAnalysisStats((prev) => ({
        framesAnalyzed: prev.framesAnalyzed + 1,
        lastAnalysisTime: new Date().toISOString(),
      }));
    } catch (err) {
      // AI service unreachable — silently continue; offline mode
      console.warn('[HIREX] AI service unreachable, continuing offline');
    }
  }, [sessionId, videoRef, onAlert]);

  // --- Audio capture and analysis ---
  const startAudioMonitoring = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start(1000); // Collect chunks every 1s

      audioIntervalRef.current = setInterval(async () => {
        if (audioChunksRef.current.length === 0) return;

        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];

        const formData = new FormData();
        formData.append('audio', blob, 'chunk.webm');
        formData.append('sessionId', sessionId);
        formData.append('timestamp', new Date().toISOString());

        try {
          const res = await axios.post(`${AI_SERVICE_URL}/analyze/audio`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 10000,
          });

          if (res.data.alerts?.length > 0) {
            res.data.alerts.forEach((alert) => {
              onAlert(alert);
              emitAlert(alert);
            });
          }
        } catch {
          console.warn('[HIREX] Audio analysis unavailable');
        }
      }, AUDIO_INTERVAL_MS);
    } catch (err) {
      console.error('[HIREX] Microphone access denied');
    }
  }, [sessionId, onAlert]);

  // --- Start / stop monitoring ---
  const startMonitoring = useCallback(async () => {
    // Reset gaze calibration for this new session
    try {
      await axios.post(`${AI_SERVICE_URL}/session/start`, { sessionId });
    } catch {
      // AI service may not be running — continue anyway
    }
    frameIntervalRef.current = setInterval(captureFrame, FRAME_INTERVAL_MS);
    startAudioMonitoring();
  }, [captureFrame, startAudioMonitoring, sessionId]);

  const stopMonitoring = useCallback(async () => {
    clearInterval(frameIntervalRef.current);
    clearInterval(audioIntervalRef.current);

    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }

    try {
      await axios.post(`${BACKEND_URL}/api/sessions/${sessionId}/end`);
    } catch (err) {
      console.warn('[HIREX] Could not end session');
    }
  }, [sessionId]);

  // --- Emit alert via socket ---
  const emitAlert = useCallback((alert) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('candidate_alert', {
        sessionId,
        ...alert,
      });
    }
    // Also persist via REST
    axios.post(`${BACKEND_URL}/api/alerts`, { sessionId, ...alert }).catch(() => { });
  }, [sessionId]);

  return {
    connected,
    analysisStats,
    startMonitoring,
    stopMonitoring,
    emitAlert,
  };
}
