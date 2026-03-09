/**
 * routes/sessions.js
 * All session operations with automatic MongoDB <-> in-memory fallback.
 */
const router = require('express').Router();
const { getIsConnected } = require('../config/database');
const { memSessions, memAlerts } = require('../services/memoryStore');

function getModels() {
  if (!getIsConnected()) return null;
  try {
    return {
      Session: require('../models/Session'),
      Alert:   require('../models/Alert'),
    };
  } catch { return null; }
}

function generateVerdict(session, level) {
  const c = session.anomalyCounts || {};
  const parts = [];
  if (c.gazeAway > 0) parts.push(`${c.gazeAway} gaze deviation(s)`);
  if (c.multipleFaces > 0) parts.push(`${c.multipleFaces} multiple-person detection(s)`);
  if (c.audioAnomalies > 0) parts.push(`${c.audioAnomalies} audio anomaly/anomalies`);
  if (c.tabSwitches > 0) parts.push(`${c.tabSwitches} tab switch(es)`);
  if (c.bodyIntrusions > 0) parts.push(`${c.bodyIntrusions} body intrusion(s)`);
  if (c.phoneDetected > 0) parts.push(`${c.phoneDetected} phone detection(s)`);
  const detected = parts.length > 0 ? `Detected: ${parts.join(', ')}. ` : '';
  const verdicts = {
    low:    `Interview appears legitimate. ${detected}No action needed.`,
    medium: `Some anomalies detected. ${detected}Manual review recommended.`,
    high:   `Multiple anomalies detected. ${detected}Immediate review strongly recommended.`,
  };
  return verdicts[level];
}

// GET /api/sessions
router.get('/', async (req, res) => {
  try {
    const m = getModels();
    if (m) {
      const sessions = await m.Session.find().sort({ startTime: -1 }).limit(50).lean();
      return res.json({ sessions });
    }
    return res.json({ sessions: memSessions.findAll() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:id
router.get('/:id', async (req, res) => {
  try {
    const m = getModels();
    if (m) {
      const session = await m.Session.findById(req.params.id).lean();
      if (!session) return res.status(404).json({ error: 'Session not found' });
      return res.json(session);
    }
    const session = memSessions.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    return res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/join
router.post('/join', async (req, res) => {
  try {
    const { candidateName, candidateEmail, sessionId } = req.body;
    if (!candidateName || !candidateEmail) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const m = getModels();
    let session;

    if (m) {
      if (sessionId) {
        session = await m.Session.findById(sessionId);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        if (session.status === 'ended') return res.status(400).json({ error: 'Session already ended' });
      } else {
        session = new m.Session({ candidateName, candidateEmail, status: 'active', active: true, startTime: new Date() });
        await session.save();
      }
    } else {
      if (sessionId) {
        session = memSessions.findById(sessionId);
        if (!session) return res.status(404).json({ error: 'Session not found' });
      } else {
        session = memSessions.create(candidateName, candidateEmail);
      }
    }

    const io = req.app.get('io');
    io?.to('recruiter_room').emit('new_session', session._doc || session);

    res.json({ sessionId: session._id, candidateName: session.candidateName, status: session.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/end
router.post('/:id/end', async (req, res) => {
  try {
    const m = getModels();
    let session;

    if (m) {
      session = await m.Session.findById(req.params.id);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      session.status = 'ended';
      session.active = false;
      session.endTime = new Date();
      const level = session.suspicionScore >= 50 ? 'high' : session.suspicionScore >= 20 ? 'medium' : 'low';
      session.riskLevel = level;
      session.aiVerdict = generateVerdict(session, level);
      await session.save();
    } else {
      session = memSessions.end(req.params.id);
      if (!session) return res.status(404).json({ error: 'Session not found' });
    }

    const io = req.app.get('io');
    io?.to('recruiter_room').emit('session_ended', { sessionId: session._id });
    io?.to(`session:${session._id}`).emit('session_ended');

    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sessions/:id
router.delete('/:id', async (req, res) => {
  try {
    const m = getModels();
    if (m) {
      await m.Session.findByIdAndDelete(req.params.id);
      await m.Alert.deleteMany({ sessionId: req.params.id });
    } else {
      memSessions.delete(req.params.id);
      memAlerts.deleteBySession(req.params.id);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
