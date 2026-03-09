/**
 * routes/reports.js - with MongoDB <-> in-memory fallback
 */
const router = require('express').Router();
const { getIsConnected } = require('../config/database');
const { memSessions, memAlerts } = require('../services/memoryStore');

function getModels() {
  if (!getIsConnected()) return null;
  try {
    return { Session: require('../models/Session'), Alert: require('../models/Alert') };
  } catch { return null; }
}

// GET /api/reports/:sessionId
router.get('/:sessionId', async (req, res) => {
  try {
    const m = getModels();
    let session, alerts, summary;

    if (m) {
      session = await m.Session.findById(req.params.sessionId).lean();
      if (!session) return res.status(404).json({ error: 'Session not found' });
      alerts = await m.Alert.getBySession(req.params.sessionId, 500);
      summary = await m.Alert.getSummaryBySession(req.params.sessionId);
    } else {
      session = memSessions.findById(req.params.sessionId);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      alerts = memAlerts.getBySession(req.params.sessionId, 500);
      summary = memAlerts.getSummary(req.params.sessionId);
    }

    const typeToSummary = {
      gaze_away: 'gazeAway', multiple_faces: 'multipleFaces',
      extra_voice: 'audioAnomalies', suspicious_audio: 'audioAnomalies',
      tab_switch: 'tabSwitches', body_intrusion: 'bodyIntrusions',
    };
    const summaryMap = { gazeAway: 0, multipleFaces: 0, audioAnomalies: 0, tabSwitches: 0, bodyIntrusions: 0 };
    summary.forEach(({ _id, count }) => {
      const key = typeToSummary[_id];
      if (key) summaryMap[key] += count;
    });

    const report = {
      sessionId: session._id,
      candidateName: session.candidateName,
      candidateEmail: session.candidateEmail,
      startTime: session.startTime,
      endTime: session.endTime,
      durationMinutes: session.durationMinutes,
      suspicionScore: session.suspicionScore,
      riskLevel: session.riskLevel,
      framesAnalyzed: session.framesAnalyzed,
      alertCount: session.alertCount,
      events: alerts.map((a) => ({ type: a.type, severity: a.severity, message: a.message, timestamp: a.timestamp, weight: a.weight, metadata: a.metadata })),
      summary: summaryMap,
      aiVerdict: session.aiVerdict,
      generatedAt: new Date().toISOString(),
    };

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/:sessionId/pdf
router.get('/:sessionId/pdf', async (req, res) => {
  try {
    const m = getModels();
    let session, alerts;
    if (m) {
      session = await m.Session.findById(req.params.sessionId).lean();
      if (!session) return res.status(404).json({ error: 'Session not found' });
      alerts = await m.Alert.getBySession(req.params.sessionId, 500);
    } else {
      session = memSessions.findById(req.params.sessionId);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      alerts = memAlerts.getBySession(req.params.sessionId, 500);
    }
    const { generatePDFReport } = require('../services/reportService');
    const pdfBuffer = await generatePDFReport(session, alerts);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="HIREX_${session.candidateName}_${session._id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
