/**
 * Alert.js — MongoDB model for proctoring alerts/events
 */
const mongoose = require('mongoose');

// Score weights per alert type
const ALERT_WEIGHTS = {
  gaze_away: 2,
  multiple_faces: 5,
  extra_voice: 3,
  body_intrusion: 4,
  tab_switch: 3,
  head_pose: 2,
  no_face: 4,
  suspicious_audio: 3,
  phone_detected: 5,
  low_confidence_face: 1,
};

const alertSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      ref: 'Session',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.keys(ALERT_WEIGHTS),
      required: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    message: { type: String, required: true },
    weight: { type: Number, default: 1 },
    timestamp: { type: Date, default: Date.now, index: true },
    metadata: {
      // Extra data from AI analysis
      gazeX: Number,
      gazeY: Number,
      faceCount: Number,
      confidence: Number,
      transcript: String,
      headPitch: Number,
      headYaw: Number,
      headRoll: Number,
      boundingBox: mongoose.Schema.Types.Mixed,
      frameBase64: String, // Optional: store evidence frame
    },
  },
  {
    timestamps: true,
    bufferCommands: false,
  }
);

// Auto-assign weight and severity
alertSchema.pre('save', function (next) {
  this.weight = ALERT_WEIGHTS[this.type] || 1;

  if (!this.severity) {
    const highTypes = ['multiple_faces', 'body_intrusion', 'phone_detected', 'no_face'];
    const medTypes = ['extra_voice', 'tab_switch', 'suspicious_audio'];
    this.severity = highTypes.includes(this.type)
      ? 'high'
      : medTypes.includes(this.type)
      ? 'medium'
      : 'low';
  }

  next();
});

alertSchema.statics.WEIGHTS = ALERT_WEIGHTS;

alertSchema.statics.getBySession = function (sessionId, limit = 200) {
  return this.find({ sessionId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

alertSchema.statics.getSummaryBySession = async function (sessionId) {
  const counts = await this.aggregate([
    { $match: { sessionId } },
    { $group: { _id: '$type', count: { $sum: 1 }, totalWeight: { $sum: '$weight' } } },
  ]);
  return counts;
};

module.exports = mongoose.model('Alert', alertSchema);
