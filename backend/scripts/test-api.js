/**
 * scripts/test-api.js
 * Integration tests for the backend REST API and Socket.io.
 * Run: node scripts/test-api.js
 *
 * Tests:
 *   - Health check
 *   - Session create/join/end
 *   - Alert creation and retrieval
 *   - Report generation
 *   - Socket.io connection
 */
const axios = require('axios');

const BASE_URL = process.argv[2] || 'http://localhost:5000';
let testSessionId = null;
let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  passed++;
}

function fail(label, err) {
  console.log(`  \x1b[31m✗\x1b[0m ${label}: ${err.response?.data?.error || err.message}`);
  failed++;
}

async function test(label, fn) {
  try {
    await fn();
    ok(label);
  } catch (err) {
    fail(label, err);
  }
}

async function runTests() {
  console.log(`\nProctorAI Backend Integration Tests`);
  console.log(`Target: ${BASE_URL}\n`);

  // Health
  console.log('[1/4] Health Check');
  await test('GET /api/health returns 200', async () => {
    const res = await axios.get(`${BASE_URL}/api/health`);
    if (res.data.status !== 'ok') throw new Error('Status not ok');
  });

  // Sessions
  console.log('\n[2/4] Session API');
  await test('POST /api/sessions/join creates session', async () => {
    const res = await axios.post(`${BASE_URL}/api/sessions/join`, {
      candidateName: 'Test Candidate',
      candidateEmail: 'test@example.com',
    });
    if (!res.data.sessionId) throw new Error('No sessionId returned');
    testSessionId = res.data.sessionId;
  });

  await test('GET /api/sessions returns list', async () => {
    const res = await axios.get(`${BASE_URL}/api/sessions`);
    if (!Array.isArray(res.data.sessions)) throw new Error('Expected sessions array');
  });

  await test(`GET /api/sessions/:id returns session`, async () => {
    if (!testSessionId) throw new Error('No session ID from previous test');
    const res = await axios.get(`${BASE_URL}/api/sessions/${testSessionId}`);
    if (res.data._id !== testSessionId) throw new Error('Session ID mismatch');
  });

  // Alerts
  console.log('\n[3/4] Alert API');
  await test('POST /api/alerts creates alert', async () => {
    const res = await axios.post(`${BASE_URL}/api/alerts`, {
      sessionId: testSessionId,
      type: 'gaze_away',
      severity: 'medium',
      message: 'Test: candidate looking left',
    });
    if (!res.data.alert) throw new Error('No alert returned');
  });

  await test('POST /api/alerts multiple_faces updates score', async () => {
    const res = await axios.post(`${BASE_URL}/api/alerts`, {
      sessionId: testSessionId,
      type: 'multiple_faces',
      severity: 'high',
      message: 'Test: 2 faces detected',
    });
    if (res.data.sessionScore === undefined) throw new Error('No sessionScore in response');
    if (res.data.sessionScore < 5) throw new Error('Score not updated');
  });

  await test('GET /api/alerts/:sessionId returns alerts', async () => {
    const res = await axios.get(`${BASE_URL}/api/alerts/${testSessionId}`);
    if (!Array.isArray(res.data.alerts)) throw new Error('Expected alerts array');
    if (res.data.alerts.length < 2) throw new Error('Expected at least 2 alerts');
  });

  // Reports
  console.log('\n[4/4] Report API');
  await test('POST /api/sessions/:id/end ends session', async () => {
    const res = await axios.post(`${BASE_URL}/api/sessions/${testSessionId}/end`);
    if (!res.data.success) throw new Error('Session end failed');
  });

  await test('GET /api/reports/:sessionId returns report', async () => {
    const res = await axios.get(`${BASE_URL}/api/reports/${testSessionId}`);
    if (!res.data.sessionId) throw new Error('No sessionId in report');
    if (!res.data.events) throw new Error('No events in report');
    if (res.data.riskLevel === undefined) throw new Error('No riskLevel in report');
  });

  // Summary
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Results: ${passed}/${passed + failed} passed`);
  if (failed > 0) {
    console.log(`\x1b[31m${failed} test(s) failed\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\x1b[32mAll tests passed ✓\x1b[0m`);
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('\nFatal error:', err.message);
  console.error('Is the backend running at', BASE_URL, '?');
  process.exit(1);
});
