/**
 * scripts/seed.js
 * Seeds the database with demo sessions and alerts for development.
 * Run with: node scripts/seed.js
 */
require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_proctoring';

// Inline schema definitions (avoid relative import issues)
const Session = require('../models/Session');
const Alert = require('../models/Alert');

const DEMO_SESSIONS = [
  {
    _id: 'sess-demo-001',
    candidateName: 'Koushtav',
    candidateEmail: 'koushtav@example.com',
    status: 'ended',
    active: false,
    startTime: new Date(Date.now() - 90 * 60000),
    endTime: new Date(Date.now() - 45 * 60000),
    durationMinutes: 45,
    suspicionScore: 67,
    riskLevel: 'high',
    alertCount: 12,
    framesAnalyzed: 1800,
    anomalyCounts: {
      gazeAway: 5, multipleFaces: 2, audioAnomalies: 2,
      tabSwitches: 2, bodyIntrusions: 1, phoneDetected: 0,
    },
    aiVerdict: 'Multiple significant anomalies detected. Two instances of multiple faces and frequent gaze deviations suggest possible external assistance.',
  },
  {
    _id: 'sess-demo-002',
    candidateName: 'Kirtiman',
    candidateEmail: 'kirtiman@example.com',
    status: 'active',
    active: true,
    startTime: new Date(Date.now() - 20 * 60000),
    suspicionScore: 28,
    riskLevel: 'medium',
    alertCount: 5,
    framesAnalyzed: 800,
    anomalyCounts: {
      gazeAway: 3, multipleFaces: 0, audioAnomalies: 1,
      tabSwitches: 1, bodyIntrusions: 0, phoneDetected: 0,
    },
  },
  {
    _id: 'sess-demo-003',
    candidateName: 'Padmaksh',
    candidateEmail: 'padmaksh@example.com',
    status: 'ended',
    active: false,
    startTime: new Date(Date.now() - 3 * 60 * 60000),
    endTime: new Date(Date.now() - 2.5 * 60 * 60000),
    durationMinutes: 30,
    suspicionScore: 4,
    riskLevel: 'low',
    alertCount: 1,
    framesAnalyzed: 1200,
    anomalyCounts: {
      gazeAway: 1, multipleFaces: 0, audioAnomalies: 0,
      tabSwitches: 0, bodyIntrusions: 0, phoneDetected: 0,
    },
    aiVerdict: 'No significant anomalies detected. Interview appears legitimate.',
  },
];

const DEMO_ALERTS = [
  // Koushtav - sess-demo-001
  { sessionId: 'sess-demo-001', type: 'gaze_away', severity: 'medium', message: 'Candidate looking left — away from screen', timestamp: new Date(Date.now() - 85 * 60000) },
  { sessionId: 'sess-demo-001', type: 'multiple_faces', severity: 'high', message: '2 faces detected in frame', timestamp: new Date(Date.now() - 80 * 60000) },
  { sessionId: 'sess-demo-001', type: 'tab_switch', severity: 'medium', message: 'Browser window lost focus', timestamp: new Date(Date.now() - 75 * 60000) },
  { sessionId: 'sess-demo-001', type: 'gaze_away', severity: 'medium', message: 'Candidate looking right — away from screen', timestamp: new Date(Date.now() - 70 * 60000) },
  { sessionId: 'sess-demo-001', type: 'extra_voice', severity: 'medium', message: 'Additional voice detected in background', timestamp: new Date(Date.now() - 65 * 60000) },
  { sessionId: 'sess-demo-001', type: 'multiple_faces', severity: 'high', message: '2 faces detected in frame', timestamp: new Date(Date.now() - 60 * 60000) },
  { sessionId: 'sess-demo-001', type: 'body_intrusion', severity: 'high', message: 'Multiple persons detected (2)', timestamp: new Date(Date.now() - 55 * 60000) },

  // Kirtiman - sess-demo-002
  { sessionId: 'sess-demo-002', type: 'gaze_away', severity: 'medium', message: 'Candidate looking down briefly', timestamp: new Date(Date.now() - 15 * 60000) },
  { sessionId: 'sess-demo-002', type: 'tab_switch', severity: 'medium', message: 'Tab switch detected (count: 1)', timestamp: new Date(Date.now() - 10 * 60000) },
  { sessionId: 'sess-demo-002', type: 'suspicious_audio', severity: 'medium', message: 'Possible whispering detected', timestamp: new Date(Date.now() - 5 * 60000) },

  // Padmaksh - sess-demo-003
  { sessionId: 'sess-demo-003', type: 'gaze_away', severity: 'low', message: 'Brief gaze deviation', timestamp: new Date(Date.now() - 2.7 * 60 * 60000) },
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing demo data
    await Session.deleteMany({ _id: { $in: DEMO_SESSIONS.map((s) => s._id) } });
    await Alert.deleteMany({ sessionId: { $in: DEMO_SESSIONS.map((s) => s._id) } });

    // Insert sessions
    await Session.insertMany(DEMO_SESSIONS);
    console.log(`✓ Seeded ${DEMO_SESSIONS.length} sessions`);

    // Insert alerts
    await Alert.insertMany(DEMO_ALERTS);
    console.log(`✓ Seeded ${DEMO_ALERTS.length} alerts`);

    console.log('\nDemo credentials:');
    console.log('  Recruiter login: recruiter@company.com / demo1234');
    console.log('\nDemo session IDs:');
    DEMO_SESSIONS.forEach((s) =>
      console.log(`  ${s._id} — ${s.candidateName} (${s.riskLevel.toUpperCase()} RISK)`)
    );

    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
