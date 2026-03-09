/**
 * services/memoryStore.js
 * In-memory fallback store used when MongoDB is not connected.
 * Mirrors the same interface as the Mongoose models so routes
 * can call one helper (dbOp) and get the right backend automatically.
 */

const { v4: uuidv4 } = require('uuid');

// Simple in-memory collections
const store = {
  sessions: new Map(),
  alerts: new Map(), // key = sessionId, value = alert[]
};

// ── Alert weights (mirrors Alert.js) ─────────────────────────────────────────
const ALERT_WEIGHTS = {
  gaze_away: 2, multiple_faces: 5, extra_voice: 3,
  body_intrusion: 4, tab_switch: 3, head_pose: 2,
  no_face: 4, suspicious_audio: 3, phone_detected: 5,
};

const TYPE_TO_FIELD = {
  gaze_away: 'gazeAway', multiple_faces: 'multipleFaces',
  extra_voice: 'audioAnomalies', suspicious_audio: 'audioAnomalies',
  tab_switch: 'tabSwitches', body_intrusion: 'bodyIntrusions',
  head_pose: 'headPose', no_face: 'noFace', phone_detected: 'phoneDetected',
};

function calcRisk(score) {
  if (score >= 50) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
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
  const detected = parts.length > 0 ? `Detected: ${parts.join(', ')}. ` : 'No specific anomalies recorded. ';
  const verdicts = {
    low: `This interview appears legitimate. ${detected}No further action needed.`,
    medium: `Some anomalies were detected. ${detected}Manual review is recommended.`,
    high: `Multiple significant anomalies detected. ${detected}This interview may have been compromised.`,
  };
  return verdicts[level];
}

// ── Session operations ────────────────────────────────────────────────────────
const memSessions = {
  create(candidateName, candidateEmail) {
    const id = `sess-${uuidv4().slice(0, 8)}`;
    const session = {
      _id: id, candidateName, candidateEmail,
      status: 'active', active: true,
      startTime: new Date(), endTime: null, durationMinutes: 0,
      suspicionScore: 0, riskLevel: 'low', alertCount: 0, framesAnalyzed: 0,
      anomalyCounts: {
        gazeAway: 0, multipleFaces: 0, audioAnomalies: 0,
        tabSwitches: 0, bodyIntrusions: 0, headPose: 0, noFace: 0, phoneDetected: 0,
      },
      aiVerdict: '', createdAt: new Date(), updatedAt: new Date(),
    };
    store.sessions.set(id, session);
    return session;
  },

  findById(id) {
    return store.sessions.get(id) || null;
  },

  findAll() {
    return Array.from(store.sessions.values()).sort(
      (a, b) => new Date(b.startTime) - new Date(a.startTime)
    );
  },

  addAlert(sessionId, type) {
    const session = store.sessions.get(sessionId);
    if (!session) return null;
    const weight = ALERT_WEIGHTS[type] || 1;
    session.suspicionScore = Math.min(100, session.suspicionScore + weight);
    session.alertCount += 1;
    session.riskLevel = calcRisk(session.suspicionScore);
    const field = TYPE_TO_FIELD[type];
    if (field && session.anomalyCounts[field] !== undefined) {
      session.anomalyCounts[field] += 1;
    }
    session.updatedAt = new Date();
    return session;
  },

  end(sessionId) {
    const session = store.sessions.get(sessionId);
    if (!session) return null;
    session.status = 'ended';
    session.active = false;
    session.endTime = new Date();
    session.durationMinutes = Math.round((session.endTime - session.startTime) / 60000);
    session.riskLevel = calcRisk(session.suspicionScore);
    session.aiVerdict = generateVerdict(session, session.riskLevel);
    session.updatedAt = new Date();
    return session;
  },

  delete(sessionId) {
    return store.sessions.delete(sessionId);
  },
};

// ── Alert operations ──────────────────────────────────────────────────────────
const memAlerts = {
  create({ sessionId, type, severity, message, timestamp, metadata }) {
    const alert = {
      _id: uuidv4(),
      sessionId, type, message,
      severity: severity || (
        ['multiple_faces','body_intrusion','phone_detected','no_face'].includes(type) ? 'high' :
        ['extra_voice','tab_switch','suspicious_audio'].includes(type) ? 'medium' : 'low'
      ),
      weight: ALERT_WEIGHTS[type] || 1,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      metadata: metadata || {},
      createdAt: new Date(),
    };
    if (!store.alerts.has(sessionId)) store.alerts.set(sessionId, []);
    store.alerts.get(sessionId).unshift(alert);
    return alert;
  },

  getBySession(sessionId, limit = 200) {
    const list = store.alerts.get(sessionId) || [];
    return list.slice(0, limit);
  },

  getSummary(sessionId) {
    const list = store.alerts.get(sessionId) || [];
    const counts = {};
    list.forEach(({ type, weight }) => {
      if (!counts[type]) counts[type] = { _id: type, count: 0, totalWeight: 0 };
      counts[type].count++;
      counts[type].totalWeight += weight;
    });
    return Object.values(counts);
  },

  deleteBySession(sessionId) {
    const count = (store.alerts.get(sessionId) || []).length;
    store.alerts.delete(sessionId);
    return count;
  },
};

module.exports = { memSessions, memAlerts, ALERT_WEIGHTS, TYPE_TO_FIELD };
