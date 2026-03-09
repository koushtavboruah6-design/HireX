/**
 * utils/helpers.js
 * Shared utility functions for the frontend.
 */

/**
 * Format seconds into mm:ss display string.
 */
export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Map a suspicion score (0–100) to a risk level string.
 */
export function getRiskLevel(score) {
  if (score >= 50) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

/**
 * Return Tailwind color classes for a risk level.
 */
export function getRiskColors(level) {
  const map = {
    high:   { text: 'text-red-400',     bg: 'bg-red-500/10',   border: 'border-red-500/25' },
    medium: { text: 'text-amber-400',   bg: 'bg-amber-500/10', border: 'border-amber-500/25' },
    low:    { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  };
  return map[level] || map.low;
}

/**
 * Score weights for each alert type (mirrors backend constants).
 */
export const ALERT_WEIGHTS = {
  gaze_away:        2,
  multiple_faces:   5,
  extra_voice:      3,
  body_intrusion:   4,
  tab_switch:       3,
  head_pose:        2,
  no_face:          4,
  suspicious_audio: 3,
  phone_detected:   5,
};

/**
 * Human-readable labels for alert types.
 */
export const ALERT_LABELS = {
  gaze_away:        'Gaze Away',
  multiple_faces:   'Multiple Persons',
  extra_voice:      'Extra Voice',
  body_intrusion:   'Body Intrusion',
  tab_switch:       'Tab Switch',
  head_pose:        'Head Turned',
  no_face:          'Face Not Detected',
  suspicious_audio: 'Suspicious Audio',
  phone_detected:   'Phone Detected',
};

/**
 * Compute a cheating probability (0–1) from a suspicion score and alert counts.
 */
export function computeCheatingProbability(score, alertCounts = {}) {
  const scorePart = (score / 100) * 0.5;

  const highRiskTypes = ['multiple_faces', 'phone_detected', 'body_intrusion', 'no_face'];
  const highCount = highRiskTypes.reduce((acc, t) => acc + (alertCounts[t] || 0), 0);
  const freqPart = Math.min(1, highCount / 5) * 0.3;

  const hasGaze  = (alertCounts.gaze_away || 0) > 0;
  const hasVoice = (alertCounts.extra_voice || 0) > 0;
  const hasFace  = (alertCounts.multiple_faces || 0) > 0;
  const corrPart = ((hasGaze && hasVoice ? 0.1 : 0) + (hasFace ? 0.1 : 0));

  return Math.min(1, scorePart + freqPart + corrPart);
}

/**
 * Truncate a string to maxLen characters with ellipsis.
 */
export function truncate(str, maxLen = 60) {
  if (!str) return '';
  return str.length <= maxLen ? str : str.slice(0, maxLen) + '…';
}

/**
 * Generate a random session display ID.
 */
export function generateDisplayId() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}
