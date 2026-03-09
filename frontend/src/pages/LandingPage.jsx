import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, Mic, Users, ChevronRight, Lock, Zap, BarChart3 } from 'lucide-react';
import axios from 'axios';

export default function LandingPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState(null); // 'candidate' | 'recruiter'
  const [form, setForm] = useState({ name: '', email: '', sessionId: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCandidateJoin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/sessions/join', {
        candidateName: form.name,
        candidateEmail: form.email,
        sessionId: form.sessionId || undefined,
      });
      navigate(`/candidate/${res.data.sessionId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join session');
    } finally {
      setLoading(false);
    }
  };

  const handleRecruiterLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white relative overflow-hidden text-ink-900">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex justify-center">
        <div className="absolute top-[-20%] w-[150vw] h-[60vh] bg-gradient-to-b from-paper-100 to-transparent blur-3xl opacity-50" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6 border-b border-paper-200 bg-white/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-paper-100 rounded-xl flex items-center justify-center border border-paper-200 shadow-sm animate-fade-in">
            <Eye size={18} className="text-ink-800" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-ink-900">
            HIR<span className="text-ink-400 font-medium">EX</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-500 bg-paper-50 px-3 py-1.5 rounded-full border border-paper-200 shadow-sm">
          <span className="live-dot-green" />
          <span>SYSTEM ONLINE</span>
        </div>
      </header>

      <main className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-4">
        {!mode ? (
          <div className="w-full max-w-4xl">
            {/* Hero */}
            <div className="text-center mb-16 animate-slide-up">
              <div className="inline-flex items-center gap-2 bg-paper-100 border border-paper-200 rounded-full px-5 py-2 text-ink-700 text-xs font-bold tracking-widest mb-8 shadow-sm">
                <Zap size={14} className="text-ink-900" />
                AI-POWERED INTERVIEW INTEGRITY
              </div>
              <h1 className="font-display text-5xl md:text-7xl font-black text-ink-900 leading-tight tracking-tight mb-6">
                Secure Every <br />
                <span className="text-ink-400">Interview</span>
              </h1>
              <p className="text-ink-500 text-lg md:text-xl max-w-2xl mx-auto font-body leading-relaxed">
                Real-time AI proctoring using computer vision, gaze tracking, and audio analysis.
                Detect anomalies. Ensure integrity. Generate instant reports.
              </p>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-3 mb-20 animate-fade-in" style={{ animationDelay: '200ms' }}>
              {[
                { icon: Eye, label: 'Gaze Tracking' },
                { icon: Users, label: 'Person Detection' },
                { icon: Mic, label: 'Audio Analysis' },
                { icon: BarChart3, label: 'Risk Scoring' },
                { icon: Shield, label: 'Integrity Reports' },
                { icon: Lock, label: 'Tab Monitoring' },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 bg-white border border-paper-200 shadow-sm rounded-full px-5 py-2.5 text-sm font-medium text-ink-600 hover:shadow-subtle hover:-translate-y-0.5 hover:border-paper-300 transition-all cursor-default"
                >
                  <Icon size={16} className="text-ink-900" />
                  {label}
                </div>
              ))}
            </div>

            {/* Role selection */}
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto animate-slide-up" style={{ animationDelay: '300ms' }}>
              <button
                onClick={() => setMode('candidate')}
                className="group panel p-10 text-left transition-all duration-300 flex flex-col items-start bg-white"
              >
                <div className="w-14 h-14 bg-paper-100 rounded-2xl flex items-center justify-center border border-paper-200 mb-6 group-hover:scale-110 group-hover:bg-ink-900 group-hover:text-white transition-all duration-300 shadow-sm">
                  <Users size={24} className="text-ink-800 group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-display font-bold text-2xl text-ink-900 mb-3">I'm a Candidate</h3>
                <p className="text-ink-500 text-base leading-relaxed flex-1">
                  Join your scheduled interview session with webcam and microphone access.
                </p>
                <div className="flex items-center gap-1.5 text-ink-900 font-bold text-sm mt-8 group-hover:translate-x-2 transition-transform">
                  Start Session <ChevronRight size={16} />
                </div>
              </button>

              <button
                onClick={() => setMode('recruiter')}
                className="group panel p-10 text-left transition-all duration-300 flex flex-col items-start bg-white"
              >
                <div className="w-14 h-14 bg-paper-100 rounded-2xl flex items-center justify-center border border-paper-200 mb-6 group-hover:scale-110 group-hover:bg-ink-900 group-hover:text-white transition-all duration-300 shadow-sm">
                  <BarChart3 size={24} className="text-ink-800 group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-display font-bold text-2xl text-ink-900 mb-3">I'm a Recruiter</h3>
                <p className="text-ink-500 text-base leading-relaxed flex-1">
                  Monitor live sessions, review alerts, and generate integrity reports.
                </p>
                <div className="flex items-center gap-1.5 text-ink-900 font-bold text-sm mt-8 group-hover:translate-x-2 transition-transform">
                  Open Dashboard <ChevronRight size={16} />
                </div>
              </button>
            </div>
          </div>
        ) : mode === 'candidate' ? (
          <div className="w-full max-w-md animate-slide-up">
            <button
              onClick={() => setMode(null)}
              className="text-ink-500 text-sm font-bold hover:text-ink-900 transition-colors mb-8 flex items-center gap-2 bg-paper-50 px-4 py-2 rounded-full border border-paper-200 shadow-sm hover:shadow hover:-translate-y-0.5"
            >
              ← Back
            </button>
            <div className="panel p-8 md:p-10 bg-white">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-paper-100 rounded-xl flex items-center justify-center border border-paper-200 shadow-sm">
                  <Users size={20} className="text-ink-800" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-ink-900 text-2xl">Join Interview</h2>
                  <p className="text-ink-500 text-xs font-bold tracking-widest uppercase mt-1">CANDIDATE SESSION</p>
                </div>
              </div>

              {error && (
                <div className="bg-paper-100 border border-ink-900 rounded-xl p-4 mb-6 text-ink-900 text-sm font-medium animate-fade-in flex items-start gap-3">
                  <AlertTriangle size={18} className="shrink-0 text-ink-900" />
                  {error}
                </div>
              )}

              <form onSubmit={handleCandidateJoin} className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-ink-600 uppercase tracking-widest block mb-2 px-1">
                    Full Name
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Koushtav"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-paper-50 border border-paper-200 rounded-xl px-4 py-3.5 text-ink-900 placeholder-ink-300 focus:outline-none focus:border-ink-900 focus:ring-1 focus:ring-ink-900 text-base font-body transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-ink-600 uppercase tracking-widest block mb-2 px-1">
                    Email
                  </label>
                  <input
                    required
                    type="email"
                    placeholder="koushtav@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-paper-50 border border-paper-200 rounded-xl px-4 py-3.5 text-ink-900 placeholder-ink-300 focus:outline-none focus:border-ink-900 focus:ring-1 focus:ring-ink-900 text-base font-body transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-ink-600 uppercase tracking-widest block mb-2 px-1">
                    Session ID <span className="text-ink-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Leave blank for new session"
                    value={form.sessionId}
                    onChange={(e) => setForm({ ...form, sessionId: e.target.value })}
                    className="w-full bg-paper-50 border border-paper-200 rounded-xl px-4 py-3.5 text-ink-900 placeholder-ink-300 focus:outline-none focus:border-ink-900 focus:ring-1 focus:ring-ink-900 text-base font-body transition-all shadow-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-ink-900 hover:bg-ink-800 hover:-translate-y-0.5 hover:shadow-elegant disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none text-white font-display font-bold py-4 rounded-xl transition-all duration-300 text-base tracking-wide mt-4 shadow-sm"
                >
                  {loading ? 'CONNECTING...' : 'JOIN SESSION'}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-md animate-slide-up">
            <button
              onClick={() => setMode(null)}
              className="text-ink-500 text-sm font-bold hover:text-ink-900 transition-colors mb-8 flex items-center gap-2 bg-paper-50 px-4 py-2 rounded-full border border-paper-200 shadow-sm hover:shadow hover:-translate-y-0.5"
            >
              ← Back
            </button>
            <div className="panel p-8 md:p-10 bg-white">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-paper-100 rounded-xl flex items-center justify-center border border-paper-200 shadow-sm">
                  <BarChart3 size={20} className="text-ink-800" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-ink-900 text-2xl">Recruiter Access</h2>
                  <p className="text-ink-500 text-xs font-bold tracking-widest uppercase mt-1">MONITORING DASHBOARD</p>
                </div>
              </div>
              <form onSubmit={handleRecruiterLogin} className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-ink-600 uppercase tracking-widest block mb-2 px-1">
                    Email
                  </label>
                  <input
                    required
                    type="email"
                    placeholder="recruiter@company.com"
                    className="w-full bg-paper-50 border border-paper-200 rounded-xl px-4 py-3.5 text-ink-900 placeholder-ink-300 focus:outline-none focus:border-ink-900 focus:ring-1 focus:ring-ink-900 text-base font-body transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-ink-600 uppercase tracking-widest block mb-2 px-1">
                    Password
                  </label>
                  <input
                    required
                    type="password"
                    placeholder="••••••••"
                    className="w-full bg-paper-50 border border-paper-200 rounded-xl px-4 py-3.5 text-ink-900 placeholder-ink-300 focus:outline-none focus:border-ink-900 focus:ring-1 focus:ring-ink-900 text-base font-body transition-all shadow-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-ink-900 hover:bg-ink-800 hover:-translate-y-0.5 hover:shadow-elegant disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none text-white font-display font-bold py-4 rounded-xl transition-all duration-300 text-base tracking-wide mt-4 shadow-sm"
                >
                  {loading ? 'AUTHENTICATING...' : 'OPEN DASHBOARD'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Watermark */}
      <div className="fixed bottom-4 right-6 pointer-events-none opacity-40 z-50">
        <p className="font-display font-bold text-ink-900 text-xs tracking-widest uppercase">builded by team Code Tandoor</p>
      </div>
    </div>
  );
}
