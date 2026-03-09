/**
 * services/socketService.js
 * Real-time Socket.io event routing with MongoDB <-> memory fallback.
 */
const { getIsConnected } = require('../config/database');
const { memSessions, memAlerts } = require('./memoryStore');

function getModels() {
  if (!getIsConnected()) return null;
  try { return { Session: require('../models/Session'), Alert: require('../models/Alert') }; }
  catch { return null; }
}

const activeSessions = new Map();

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    const { sessionId, role } = socket.handshake.query;
    console.log(`[WS] ${socket.id} role=${role} session=${sessionId || 'none'}`);

    if (role === 'recruiter') {
      socket.join('recruiter_room');
      // Send active sessions on connect
      const m = getModels();
      if (m) {
        m.Session.getActive()
          .then((sessions) => socket.emit('active_sessions', sessions))
          .catch(() => socket.emit('active_sessions', []));
      } else {
        socket.emit('active_sessions', memSessions.findAll().filter((s) => s.active));
      }
    }

    if (role === 'candidate' && sessionId) {
      socket.join(`session:${sessionId}`);
      activeSessions.set(sessionId, { candidateSocketId: socket.id, connectedAt: new Date() });
      io.to('recruiter_room').emit('candidate_connected', { sessionId, socketId: socket.id, timestamp: new Date().toISOString() });
    }

    // Candidate alert
    socket.on('candidate_alert', async (data) => {
      try {
        const m = getModels();
        let alert, session;
        if (m) {
          const AlertModel = m.Alert;
          alert = new AlertModel({ sessionId: data.sessionId, type: data.type, severity: data.severity, message: data.message, timestamp: data.timestamp ? new Date(data.timestamp) : new Date(), metadata: data.metadata || {} });
          await alert.save();
          session = await m.Session.findByIdAndUpdate(data.sessionId, { $inc: { suspicionScore: alert.weight, alertCount: 1 } }, { new: true });
        } else {
          alert = memAlerts.create(data);
          session = memSessions.addAlert(data.sessionId, data.type);
        }
        io.to('recruiter_room').emit('candidate_alert', {
          ...(alert._doc || alert),
          weight: alert.weight,
          sessionScore: session?.suspicionScore,
          sessionRiskLevel: session?.riskLevel,
        });
      } catch (err) {
        console.error('[WS] Alert error:', err.message);
      }
    });

    // Recruiter: watch a session
    socket.on('watch_session', (data) => {
      socket.join(`recruiter:${data.sessionId}`);
      socket.emit('watching', { sessionId: data.sessionId });
    });

    // Recruiter: end session remotely
    socket.on('end_session', async (data) => {
      try {
        const m = getModels();
        if (m) {
          await m.Session.findByIdAndUpdate(data.sessionId, { status: 'ended', active: false, endTime: new Date() });
        } else {
          memSessions.end(data.sessionId);
        }
        io.to(`session:${data.sessionId}`).emit('session_ended', { sessionId: data.sessionId });
        io.to('recruiter_room').emit('session_update', { sessionId: data.sessionId, status: 'ended', active: false });
      } catch (err) {
        console.error('[WS] End session error:', err.message);
      }
    });

    socket.on('heartbeat', (data) => {
      const state = activeSessions.get(data.sessionId) || {};
      activeSessions.set(data.sessionId, { ...state, lastHeartbeat: new Date(), suspicionScore: data.suspicionScore });
    });

    socket.on('disconnect', () => {
      if (role === 'candidate' && sessionId) {
        io.to('recruiter_room').emit('candidate_disconnected', { sessionId, timestamp: new Date().toISOString() });
      }
    });
  });

  // Stale session cleanup
  setInterval(() => {
    const stale = 5 * 60 * 1000;
    const now = Date.now();
    for (const [id, state] of activeSessions.entries()) {
      if (state.lastHeartbeat && now - new Date(state.lastHeartbeat).getTime() > stale) {
        activeSessions.delete(id);
      }
    }
  }, 60000);
}

module.exports = { setupSocketHandlers, activeSessions };
