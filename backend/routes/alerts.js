/**
 * routes/alerts.js - with MongoDB <-> in-memory fallback
 */
const router = require('express').Router();
const { getIsConnected } = require('../config/database');
const { memAlerts, memSessions, ALERT_WEIGHTS } = require('../services/memoryStore');

function getModels() {
  if (!getIsConnected()) return null;
  try {
    return { Alert: require('../models/Alert'), Session: require('../models/Session') };
  } catch { return null; }
}

// GET /api/alerts/:sessionId
router.get('/:sessionId', async (req, res) => {
  try {
    const m = getModels();
    if (m) {
      const alerts = await m.Alert.getBySession(req.params.sessionId);
      return res.json({ alerts, count: alerts.length });
    }
    const alerts = memAlerts.getBySession(req.params.sessionId);
    return res.json({ alerts, count: alerts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/alerts/:sessionId/summary
router.get('/:sessionId/summary', async (req, res) => {
  try {
    const m = getModels();
    if (m) {
      const summary = await m.Alert.getSummaryBySession(req.params.sessionId);
      return res.json({ summary });
    }
    return res.json({ summary: memAlerts.getSummary(req.params.sessionId) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts
router.post('/', async (req, res) => {
  try {
    const { sessionId, type, severity, message, timestamp, metadata } = req.body;
    if (!sessionId || !type || !message) {
      return res.status(400).json({ error: 'sessionId, type, and message required' });
    }

    const m = getModels();
    let alert, session;

    if (m) {
      alert = new m.Alert({ sessionId, type, severity, message, timestamp: timestamp ? new Date(timestamp) : new Date(), metadata: metadata || {} });
      await alert.save();
      const typeToField = {
        gaze_away: 'gazeAway', multiple_faces: 'multipleFaces',
        extra_voice: 'audioAnomalies', suspicious_audio: 'audioAnomalies',
        tab_switch: 'tabSwitches', body_intrusion: 'bodyIntrusions',
        head_pose: 'headPose', no_face: 'noFace', phone_detected: 'phoneDetected',
      };
      const fieldName = typeToField[type];
      session = await m.Session.findByIdAndUpdate(
        sessionId,
        { $inc: { suspicionScore: alert.weight, alertCount: 1, ...(fieldName ? { [`anomalyCounts.${fieldName}`]: 1 } : {}) } },
        { new: true }
      );
    } else {
      alert = memAlerts.create({ sessionId, type, severity, message, timestamp, metadata });
      session = memSessions.addAlert(sessionId, type);
    }

    const io = req.app.get('io');
    if (io) {
      io.to('recruiter_room').emit('candidate_alert', {
        ...(alert._doc || alert),
        sessionRiskLevel: session?.riskLevel,
        sessionScore: session?.suspicionScore,
      });
      io.to(`session:${sessionId}`).emit('alert', alert._doc || alert);
    }

    res.status(201).json({ alert: alert._doc || alert, sessionScore: session?.suspicionScore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/alerts/:sessionId
router.delete('/:sessionId', async (req, res) => {
  try {
    const m = getModels();
    if (m) {
      const result = await m.Alert.deleteMany({ sessionId: req.params.sessionId });
      return res.json({ deleted: result.deletedCount });
    }
    const deleted = memAlerts.deleteBySession(req.params.sessionId);
    res.json({ deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
