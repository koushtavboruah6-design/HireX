/**
 * RecruiterDashboard.jsx
 * Live monitoring dashboard for recruiters.
 * Shows all active sessions, live video feeds, alert timelines, and risk scores.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Eye, BarChart3, AlertTriangle, Users, Mic, Clock,
  FileText, RefreshCw, Shield, ChevronRight, Wifi, WifiOff,
  TrendingUp, Activity, Download
} from 'lucide-react';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import SuspicionMeter from '../components/SuspicionMeter';
import AlertTimeline from '../components/AlertTimeline';
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

function SessionCard({ session, onSelect, isSelected }) {
  const riskStyles = session.riskLevel === 'high'
    ? 'border-red-200 bg-red-50/50'
    : session.riskLevel === 'medium'
      ? 'border-amber-200 bg-amber-50/50'
      : 'border-paper-200 bg-white';

  return (
    <button
      onClick={() => onSelect(session)}
      className={`w-full text-left p-4 rounded-xl border transition-all duration-300 hover:shadow-subtle hover:-translate-y-0.5 ${riskStyles} ${isSelected ? 'ring-2 ring-ink-900 border-ink-900 shadow-md bg-paper-50' : 'hover:border-ink-500'
        }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-2 h-2 rounded-full ${session.active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-ink-300'}`} />
          <span className={`text-sm font-bold tracking-wide truncate max-w-[120px] ${isSelected ? 'text-ink-900' : 'text-ink-800'}`}>
            {session.candidateName || 'Unknown'}
          </span>
        </div>
        <span className={`text-xs font-bold tracking-widest px-2.5 py-1 rounded-md border ${session.riskLevel === 'high' ? 'bg-red-50 text-red-700 border-red-200' :
          session.riskLevel === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-paper-50 text-ink-600 border-paper-200'
          }`}>
          {(session.riskLevel || 'LOW').toUpperCase()}
        </span>
      </div>
      <div className="flex justify-between text-xs font-medium text-ink-500 mt-2">
        <span className="flex items-center gap-1.5"><AlertTriangle size={12} /> {session.alertCount || 0} alerts</span>
        <span className="bg-paper-100 px-2 py-0.5 rounded border border-paper-200">Score: <span className="text-ink-900 font-bold">{session.suspicionScore || 0}</span></span>
      </div>
    </button>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = 'cyan' }) {
  const colors = {
    cyan: 'text-ink-800 bg-paper-100 border-paper-200',
    red: 'text-red-600 bg-red-50 border-red-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    green: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  };
  return (
    <div className="panel p-5 bg-white transition-all hover:-translate-y-0.5 hover:shadow-subtle duration-300">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-sm ${colors[color]}`}>
          <Icon size={18} className="currentColor" />
        </div>
        <span className="text-xs font-bold text-ink-500 uppercase tracking-widest">{label}</span>
      </div>
      <div className="font-display font-black text-3xl text-ink-900 tracking-tight">{value}</div>
      {sub && <div className="text-sm text-ink-400 mt-1 font-medium">{sub}</div>}
    </div>
  );
}

export default function RecruiterDashboard() {
  const { sessionId: paramSessionId } = useParams();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [scoreHistory, setScoreHistory] = useState([]);
  const [stats, setStats] = useState({
    activeSessions: 0, totalAlerts: 0, highRiskCount: 0,
  });

  // Fetch existing sessions
  const fetchSessions = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/sessions`);
      setSessions(res.data.sessions || []);
      setStats({
        activeSessions: res.data.sessions?.filter((s) => s.active).length || 0,
        totalAlerts: res.data.sessions?.reduce((acc, s) => acc + (s.alertCount || 0), 0) || 0,
        highRiskCount: res.data.sessions?.filter((s) => s.riskLevel === 'high').length || 0,
      });
    } catch {
      // Use mock data if backend not running
      const mock = [
        { _id: 'sess-001', candidateName: 'Koushtav', riskLevel: 'high', suspicionScore: 67, alertCount: 12, active: true },
        { _id: 'sess-002', candidateName: 'Kirtiman', riskLevel: 'medium', suspicionScore: 28, alertCount: 5, active: true },
        { _id: 'sess-003', candidateName: 'Padmaksh', riskLevel: 'low', suspicionScore: 8, alertCount: 2, active: false },
      ];
      setSessions(mock);
      setStats({ activeSessions: 2, totalAlerts: 19, highRiskCount: 1 });
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  // Socket connection
  useEffect(() => {
    const socket = io(BACKEND_URL, {
      query: { role: 'recruiter' },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('candidate_alert', (alert) => {
      if (!selectedSession || alert.sessionId === selectedSession._id) {
        setAlerts((prev) => [alert, ...prev].slice(0, 200));
      }
      // Update session list
      setSessions((prev) =>
        prev.map((s) =>
          s._id === alert.sessionId
            ? {
              ...s,
              alertCount: (s.alertCount || 0) + 1,
              suspicionScore: Math.min(100, (s.suspicionScore || 0) + (alert.weight || 1)),
              riskLevel:
                s.suspicionScore > 50 ? 'high' :
                  s.suspicionScore > 20 ? 'medium' : 'low',
            }
            : s
        )
      );
    });

    socket.on('session_update', (update) => {
      setSessions((prev) =>
        prev.map((s) => (s._id === update.sessionId ? { ...s, ...update } : s))
      );
    });

    socket.on('new_session', (session) => {
      setSessions((prev) => [session, ...prev]);
    });

    return () => socket.disconnect();
  }, [selectedSession]);

  // Score history tracking
  useEffect(() => {
    if (!selectedSession) return;
    const interval = setInterval(() => {
      const current = sessions.find((s) => s._id === selectedSession._id);
      if (current) {
        setScoreHistory((prev) =>
          [
            ...prev,
            {
              time: format(new Date(), 'HH:mm:ss'),
              score: current.suspicionScore || 0,
            },
          ].slice(-30)
        );
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedSession, sessions]);

  const handleSelectSession = async (session) => {
    setSelectedSession(session);
    setScoreHistory([]);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/alerts/${session._id}`);
      setAlerts(res.data.alerts || []);
    } catch {
      setAlerts([]);
    }
  };

  const handleGenerateReport = () => {
    if (selectedSession) navigate(`/report/${selectedSession._id}`);
  };

  const currentSession = selectedSession
    ? sessions.find((s) => s._id === selectedSession._id) || selectedSession
    : null;

  return (
    <div className="min-h-screen bg-paper-50 flex flex-col font-body">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-paper-200 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-paper-100 rounded-xl flex items-center justify-center border border-paper-200 shadow-sm">
            <Eye size={16} className="text-ink-800" />
          </div>
          <span className="font-display font-bold text-ink-900 text-lg">HIREX</span>
          <span className="hidden md:flex items-center gap-2 text-ink-400 text-sm font-medium bg-paper-50 px-3 py-1 rounded-full border border-paper-100 ml-2">
            <span className="w-1.5 h-1.5 rounded-full bg-ink-300" /> Recruiter Dashboard
          </span>
        </div>
        <div className="flex items-center gap-5">
          <button onClick={fetchSessions} className="text-ink-500 hover:text-ink-900 hover:rotate-180 transition-all duration-500 bg-paper-50 p-2 rounded-full border border-paper-200 shadow-sm">
            <RefreshCw size={14} />
          </button>
          <div className={`flex items-center gap-2 text-sm font-bold tracking-wider ${connected ? 'text-ink-800' : 'text-red-600'} bg-paper-50 px-3 py-1.5 rounded-full border border-paper-200 shadow-sm`}>
            {connected ? <span className="w-2 h-2 rounded-full bg-ink-800 animate-pulse-soft" /> : <WifiOff size={14} />}
            {connected ? 'LIVE' : 'OFFLINE'}
          </div>
          <div className="text-sm font-bold text-ink-600 bg-white border border-paper-200 px-3 py-1.5 rounded-full shadow-sm">
            {format(new Date(), 'HH:mm:ss')}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden p-6 gap-6 max-w-[1600px] w-full mx-auto">
        {/* Left: Session list */}
        <aside className="w-80 flex flex-col gap-6 shrink-0">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="panel p-4 text-center bg-white border border-paper-200 shadow-sm rounded-2xl">
              <div className="font-display font-black text-2xl text-ink-900 tracking-tight">{stats.activeSessions}</div>
              <div className="text-xs font-bold text-ink-500 mt-1 uppercase tracking-widest">ACTIVE</div>
            </div>
            <div className="panel p-4 text-center bg-white border border-paper-200 shadow-sm rounded-2xl">
              <div className="font-display font-black text-2xl text-red-600 tracking-tight">{stats.highRiskCount}</div>
              <div className="text-xs font-bold text-ink-500 mt-1 uppercase tracking-widest">HIGH RISK</div>
            </div>
          </div>

          {/* Sessions */}
          <div className="panel p-5 flex-1 flex flex-col bg-white border border-paper-200 shadow-sm rounded-2xl">
            <h3 className="text-sm font-bold text-ink-900 uppercase tracking-widest mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2"><Users size={16} className="text-ink-600" /> Sessions</span>
              <span className="bg-paper-100 text-ink-800 px-2 py-0.5 rounded-md text-xs">{sessions.length}</span>
            </h3>
            <div className="space-y-3 overflow-y-auto flex-1 pr-2">
              {sessions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-50">
                  <Users size={32} className="text-ink-300 mb-3" />
                  <p className="text-sm text-ink-500 font-bold tracking-wide">NO ACTIVE SESSIONS</p>
                </div>
              ) : (
                sessions.map((s) => (
                  <SessionCard
                    key={s._id}
                    session={s}
                    onSelect={handleSelectSession}
                    isSelected={selectedSession?._id === s._id}
                  />
                ))
              )}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col gap-6 overflow-hidden min-w-0">
          {!currentSession ? (
            <div className="flex-1 flex items-center justify-center panel bg-white border border-paper-200">
              <div className="text-center max-w-sm">
                <div className="w-20 h-20 bg-paper-50 rounded-full border border-paper-200 flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <Eye size={32} className="text-ink-300" />
                </div>
                <h3 className="font-display font-bold text-ink-900 text-2xl mb-3">Select a Session</h3>
                <p className="text-ink-500 text-base leading-relaxed">Click a session from the left panel to monitor it in real-time and review full analytics.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Session header */}
              <div className="panel p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-paper-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-ink-900" />
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 ml-2">
                  <div>
                    <h2 className="font-display font-black text-ink-900 text-2xl tracking-tight mb-1">
                      {currentSession.candidateName}
                    </h2>
                    <p className="text-sm font-medium text-ink-500 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-paper-300" />
                      ID: {currentSession._id}
                    </p>
                  </div>
                  <span className={`text-xs font-bold tracking-widest px-3 py-1.5 rounded-lg border ${currentSession.riskLevel === 'high' ? 'bg-red-50 text-red-700 border-red-200' :
                    currentSession.riskLevel === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-paper-50 text-ink-600 border-paper-200'
                    }`}>
                    {(currentSession.riskLevel || 'LOW').toUpperCase()} RISK
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleGenerateReport}
                    className="flex items-center gap-2 bg-ink-900 text-white px-5 py-2.5 rounded-xl border border-ink-800 text-sm font-bold tracking-wide hover:shadow-elegant hover:-translate-y-0.5 transition-all duration-300"
                  >
                    <FileText size={16} />
                    REPORT
                  </button>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-3">
                <StatCard icon={AlertTriangle} label="Total Alerts" value={currentSession.alertCount || 0} color="red" />
                <StatCard icon={TrendingUp} label="Risk Score" value={currentSession.suspicionScore || 0} sub="/ 100" color="amber" />
                <StatCard icon={Activity} label="Frames" value={(currentSession.framesAnalyzed || 0)} sub="analyzed" color="cyan" />
                <StatCard icon={Clock} label="Duration" value={currentSession.duration || '—'} color="green" />
              </div>

              {/* Middle: Score meter + Timeline + Chart */}
              <div className="flex-1 grid lg:grid-cols-3 gap-6 min-h-0">
                {/* Suspicion meter */}
                <div className="panel p-6 flex flex-col items-center justify-center bg-white border border-paper-200">
                  <h3 className="text-sm font-bold text-ink-900 uppercase tracking-widest mb-6 flex items-center gap-2 w-full text-left">
                    <Shield size={16} className="text-ink-700" /> Integrity Score
                  </h3>
                  <div className="flex-1 flex items-center justify-center w-full">
                    <SuspicionMeter score={currentSession.suspicionScore || 0} />
                  </div>
                </div>

                {/* Alert timeline */}
                <div className="panel p-0 overflow-hidden bg-white border border-paper-200 h-full flex flex-col">
                  {/* Wrapping in relatively positioned div to isolate timeline layout */}
                  <div className="h-full w-full">
                    <AlertTimeline alerts={alerts} />
                  </div>
                </div>

                {/* Score over time chart */}
                <div className="panel p-6 flex flex-col bg-white border border-paper-200">
                  <h3 className="text-sm font-bold text-ink-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Activity size={16} className="text-ink-700" /> Score Timeline
                  </h3>
                  {scoreHistory.length < 2 ? (
                    <div className="flex-1 flex items-center justify-center bg-paper-50 rounded-xl border border-dashed border-paper-200">
                      <p className="text-sm text-ink-400 font-bold tracking-wide animate-pulse-soft">COLLECTING DATA...</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%" className="-ml-3">
                      <AreaChart data={scoreHistory} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                        <defs>
                          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0a0a0a" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#0a0a0a" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="time"
                          tick={{ fill: '#71717a', fontSize: 11, fontWeight: 500 }}
                          interval="preserveStartEnd"
                          tickLine={false}
                          axisLine={false}
                          dy={10}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fill: '#71717a', fontSize: 11, fontWeight: 500 }}
                          tickLine={false}
                          axisLine={false}
                          dx={-10}
                        />
                        <Tooltip
                          contentStyle={{
                            background: '#ffffff',
                            border: '1px solid #e4e4e7',
                            borderRadius: '12px',
                            color: '#0a0a0a',
                            fontWeight: 600,
                            fontSize: '12px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                          }}
                          itemStyle={{ color: '#0a0a0a', fontWeight: 'bold' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="score"
                          stroke="#0a0a0a"
                          strokeWidth={3}
                          fill="url(#scoreGrad)"
                          dot={false}
                          activeDot={{ r: 6, fill: '#000', stroke: '#fff', strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Watermark */}
      <div className="fixed bottom-4 right-6 pointer-events-none opacity-40 z-50">
        <p className="font-display font-bold text-ink-900 text-xs tracking-widest uppercase">builded by team Code Tandoor</p>
      </div>
    </div>
  );
}
