import React, { createContext, useContext, useState, useCallback } from 'react';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [suspicionScore, setSuspicionScore] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [eventLog, setEventLog] = useState([]);

  const addAlert = useCallback((alert) => {
    const enriched = {
      ...alert,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: alert.timestamp || new Date().toISOString(),
    };
    setAlerts((prev) => [enriched, ...prev].slice(0, 200));
    setEventLog((prev) => [enriched, ...prev].slice(0, 500));

    // Update suspicion score
    const weights = {
      gaze_away: 2,
      multiple_faces: 5,
      extra_voice: 3,
      body_intrusion: 4,
      tab_switch: 3,
      head_pose: 2,
      no_face: 4,
      suspicious_audio: 3,
      phone_detected: 5,
    };
    const points = weights[enriched.type] || 1;
    setSuspicionScore((prev) => Math.min(100, prev + points));
  }, []);

  const resetSession = useCallback(() => {
    setAlerts([]);
    setSuspicionScore(0);
    setEventLog([]);
    setIsRecording(false);
  }, []);

  return (
    <SessionContext.Provider
      value={{
        session,
        setSession,
        alerts,
        addAlert,
        suspicionScore,
        setSuspicionScore,
        isRecording,
        setIsRecording,
        eventLog,
        resetSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
