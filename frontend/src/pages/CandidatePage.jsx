/**
 * CandidatePage.jsx
 * The candidate's view during an interview.
 * Shows webcam feed, monitoring status, and compliance indicators.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Eye, Mic, Shield, AlertTriangle, CheckCircle,
  Clock, Wifi, WifiOff, XCircle, ChevronRight
} from 'lucide-react';
import { useProctoring } from '../hooks/useProctoring';
import { useSession } from '../context/SessionContext';
import { formatDistanceToNow } from 'date-fns';

const MAX_SCORE_DISPLAY = 50;

export default function CandidatePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);
  const [permError, setPermError] = useState('');
  const [sessionActive, setSessionActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const { addAlert, suspicionScore } = useSession();

  // Alert handler
  const handleAlert = useCallback((alert) => {
    addAlert(alert);
    setRecentAlerts((prev) => [alert, ...prev].slice(0, 5));
  }, [addAlert]);

  const { connected, analysisStats, startMonitoring, stopMonitoring } = useProctoring({
    sessionId,
    videoRef,
    onAlert: handleAlert,
  });

  // Start webcam
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: true,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            setVideoReady(true);
          };
        }
      } catch (err) {
        setPermError(
          err.name === 'NotAllowedError'
            ? 'Camera/microphone access denied. Please allow access and refresh.'
            : `Device error: ${err.message}`
        );
      }
    };
    initCamera();

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Start monitoring when video is ready
  useEffect(() => {
    if (videoReady && connected) {
      setSessionActive(true);
      startMonitoring();
    }
  }, [videoReady, connected, startMonitoring]);

  // Timer
  useEffect(() => {
    if (!sessionActive) return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [sessionActive]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getRiskColor = () => {
    if (suspicionScore < 15) return 'text-emerald-400';
    if (suspicionScore < 35) return 'text-amber-400';
    return 'text-red-400';
  };

  const handleEndSession = async () => {
    await stopMonitoring();
    navigate(`/report/${sessionId}`);
  };

  if (permError) {
    return (
      <div className="min-h-screen bg-paper-50 flex items-center justify-center p-4">
        <div className="panel p-10 max-w-md text-center bg-white">
          <div className="w-16 h-16 bg-paper-100 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-paper-200">
            <XCircle size={32} className="text-ink-900" />
          </div>
          <h2 className="font-display font-bold text-ink-900 text-2xl mb-3">Permission Required</h2>
          <p className="text-ink-500 text-base">{permError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper-50 flex flex-col font-body">
      {/* Header bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-paper-200 bg-white/80 backdrop-blur-md z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-paper-100 rounded-lg flex items-center justify-center border border-paper-200 shadow-sm">
            <Eye size={16} className="text-ink-800" />
          </div>
          <span className="font-display font-bold text-ink-900 text-lg">HIREX</span>
          <span className="hidden md:flex items-center gap-2 text-ink-400 text-sm font-medium bg-paper-50 px-3 py-1 rounded-full border border-paper-100 ml-2">
            <span className="w-1.5 h-1.5 rounded-full bg-ink-300" /> {sessionId}
          </span>
        </div>

        <div className="flex items-center gap-5">
          {/* Connection status */}
          <div className={`flex items-center gap-2 text-sm font-bold tracking-wider ${connected ? 'text-ink-800' : 'text-red-600'} bg-paper-50 px-3 py-1.5 rounded-full border border-paper-200 shadow-sm`}>
            {connected ? <span className="w-2 h-2 rounded-full bg-ink-800 animate-pulse-soft" /> : <WifiOff size={14} />}
            {connected ? 'CONNECTED' : 'DISCONNECTED'}
          </div>

          {/* Timer */}
          <div className="flex items-center gap-2 text-ink-700 font-bold text-sm bg-white border border-paper-200 px-3 py-1.5 rounded-full shadow-sm">
            <Clock size={16} className="text-ink-500" />
            <span>{formatTime(elapsed)}</span>
          </div>

          <button
            onClick={handleEndSession}
            className="bg-ink-900 text-white hover:bg-ink-800 hover:-translate-y-0.5 px-5 py-2 rounded-full text-sm font-bold tracking-widest transition-all shadow-sm hover:shadow-subtle"
          >
            END SESSION
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 p-6 max-w-[1600px] mx-auto w-full">
        {/* Main video feed */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Video Container Custom Implementation (Bypassing LiveVideoFeed component here for deeper integration if preferred, but updating styles) */}
          <div className="panel relative overflow-hidden aspect-video max-h-[70vh] flex items-center justify-center bg-paper-100 group shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
            {/* Corner brackets */}
            <div className="video-overlay-corner corner-tl z-10" />
            <div className="video-overlay-corner corner-tr z-10" />
            <div className="video-overlay-corner corner-bl z-10" />
            <div className="video-overlay-corner corner-br z-10" />

            {!videoReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm z-20">
                <div className="relative w-16 h-16 mb-4">
                  <div className="absolute inset-0 border-4 border-paper-200 rounded-full" />
                  <div className="absolute inset-0 border-4 border-ink-900 rounded-full animate-spin border-t-transparent" style={{ animationDuration: '1s' }} />
                </div>
                <p className="text-ink-600 text-sm font-bold tracking-widest animate-pulse-soft">INITIALIZING CAMERA</p>
              </div>
            )}

            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover transition-opacity duration-500"
              style={{ transform: 'scaleX(-1)', opacity: videoReady ? 1 : 0 }}
            />

            {/* Status overlays */}
            {sessionActive && (
              <>
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-white/90 backdrop-blur-md rounded-full px-3 py-1.5 shadow-sm border border-paper-200 transition-transform hover:scale-105">
                  <span className="live-dot" />
                  <span className="text-ink-900 text-xs font-bold tracking-widest">REC</span>
                </div>

                <div className="absolute top-4 right-4 flex items-center gap-2 bg-white/90 backdrop-blur-md rounded-full px-3 py-1.5 shadow-sm border border-paper-200 transition-transform hover:scale-105">
                  <Shield size={14} className="text-ink-700" />
                  <span className="text-ink-700 text-xs font-bold tracking-widest">MONITORING</span>
                </div>

                {/* Suspicion score overlay */}
                <div className={`absolute bottom-4 right-4 bg-white/90 backdrop-blur-md rounded-xl px-4 py-2 text-sm font-bold shadow-sm border border-paper-200 transition-transform hover:-translate-y-1 ${suspicionScore > 35 ? 'text-red-600' : suspicionScore > 15 ? 'text-ink-600' : 'text-ink-900'
                  }`}>
                  RISK: {suspicionScore}
                </div>

                {/* Frame count */}
                <div className="absolute bottom-4 left-4 text-ink-500 font-medium text-xs bg-white/90 backdrop-blur-md border border-paper-200 shadow-sm rounded-xl px-3 py-2 transition-transform hover:-translate-y-1">
                  {analysisStats.framesAnalyzed} frames
                </div>
              </>
            )}
          </div>

          {/* Monitoring status row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: Eye, label: 'Tracking', active: sessionActive },
              { icon: Mic, label: 'Audio', active: sessionActive },
              { icon: Shield, label: 'Integrity', active: connected },
            ].map(({ icon: Icon, label, active }) => (
              <div key={label} className={`panel p-4 flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-3 transition-colors ${active ? 'bg-white' : 'bg-paper-50 opacity-70'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${active ? 'bg-paper-100 text-ink-900 border border-paper-200' : 'bg-paper-200 text-ink-400 border border-paper-300'}`}>
                  <Icon size={18} />
                </div>
                <div className="text-center sm:text-left">
                  <span className={`text-xs font-bold tracking-widest uppercase ${active ? 'text-ink-900' : 'text-ink-500'}`}>{label}</span>
                  <div className={`text-xs mt-0.5 ${active ? 'text-emerald-600 font-medium font-body' : 'text-ink-400'}`}>
                    {active ? 'Active' : 'Standby'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="lg:w-80 flex flex-col gap-6">
          {/* Session info */}
          <div className="panel p-6">
            <h3 className="text-sm font-bold text-ink-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-ink-900 rounded-full" /> Session Details
            </h3>
            <p className="font-mono text-ink-600 text-sm break-all bg-paper-50 p-2.5 rounded-lg border border-paper-200 mb-4">{sessionId}</p>
            <div className="space-y-3">
              <div className="flex justify-between text-sm py-2 border-b border-paper-100">
                <span className="text-ink-500 font-medium">Status</span>
                <span className={`font-bold ${sessionActive ? 'text-emerald-600 px-2 py-0.5 bg-emerald-50 rounded-md border border-emerald-100' : 'text-ink-400'}`}>
                  {sessionActive ? 'ACTIVE' : 'INITIALIZING'}
                </span>
              </div>
              <div className="flex justify-between text-sm py-2">
                <span className="text-ink-500 font-medium">Duration</span>
                <span className="text-ink-900 font-bold tabular-nums">{formatTime(elapsed)}</span>
              </div>
            </div>
          </div>

          {/* Rules reminder */}
          <div className="panel p-6 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
            <h3 className="text-sm font-bold text-ink-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Shield size={16} className="text-ink-700" /> Rules
            </h3>
            <ul className="space-y-3">
              {[
                'Keep face visible at all times',
                'No others in the room',
                'No notes or devices',
                'Stay on this tab',
                'Speak clearly',
              ].map((rule) => (
                <li key={rule} className="flex items-start gap-3 text-sm text-ink-600 font-medium group cursor-default">
                  <div className="mt-0.5 w-4 h-4 rounded-full bg-paper-100 flex items-center justify-center border border-paper-200 group-hover:bg-ink-900 group-hover:border-ink-900 transition-colors">
                    <CheckCircle size={10} className="text-ink-400 group-hover:text-white transition-colors" />
                  </div>
                  {rule}
                </li>
              ))}
            </ul>
          </div>

          {/* Recent flags */}
          <div className="panel p-6 flex-1 flex flex-col shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
            <h3 className="text-sm font-bold text-ink-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              <AlertTriangle size={16} className="text-ink-700" /> Notifications
            </h3>
            {recentAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center flex-1 bg-paper-50 rounded-xl border border-dashed border-paper-300">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-paper-200 mb-3 shadow-sm animate-scale-in">
                  <CheckCircle size={20} className="text-ink-400" />
                </div>
                <p className="text-sm font-bold text-ink-600 tracking-wide">NO ALERTS</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                {recentAlerts.map((a) => (
                  <div
                    key={a.id || a.timestamp}
                    className={`text-sm p-3 rounded-xl border flex items-start gap-3 animate-slide-up shadow-sm transition-transform hover:-translate-y-0.5 ${a.severity === 'high'
                      ? 'bg-paper-100 border-ink-400 text-ink-900'
                      : a.severity === 'medium'
                        ? 'bg-paper-50 border-paper-300 text-ink-800'
                        : 'bg-white border-paper-200 text-ink-600'
                      }`}
                  >
                    <AlertTriangle size={16} className={`shrink-0 mt-0.5 ${a.severity === 'high' ? 'text-ink-900' : 'text-ink-500'}`} />
                    <span className="font-medium">{a.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Watermark */}
      <div className="fixed bottom-4 right-6 pointer-events-none opacity-40 z-50">
        <p className="font-display font-bold text-ink-900 text-xs tracking-widest uppercase">builded by team Code Tandoor</p>
      </div>
    </div>
  );
}
