/**
 * Session.js — MongoDB model for interview sessions
 */
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const sessionSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => `sess-${uuidv4().slice(0, 8)}`,
    },
    candidateName: { type: String, required: true, trim: true },
    candidateEmail: { type: String, required: true, trim: true, lowercase: true },
    recruiterId: { type: String, default: null },
    status: {
      type: String,
      enum: ['waiting', 'active', 'ended', 'flagged'],
      default: 'waiting',
    },
    active: { type: Boolean, default: true },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date, default: null },
    durationMinutes: { type: Number, default: 0 },
    suspicionScore: { type: Number, default: 0, min: 0, max: 100 },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low',
    },
    alertCount: { type: Number, default: 0 },
    framesAnalyzed: { type: Number, default: 0 },
    // Per-category counts
    anomalyCounts: {
      gazeAway: { type: Number, default: 0 },
      multipleFaces: { type: Number, default: 0 },
      audioAnomalies: { type: Number, default: 0 },
      tabSwitches: { type: Number, default: 0 },
      bodyIntrusions: { type: Number, default: 0 },
      headPose: { type: Number, default: 0 },
      noFace: { type: Number, default: 0 },
      phoneDetected: { type: Number, default: 0 },
    },
    aiVerdict: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    id: false,
    bufferCommands: false,
  }
);

// Auto-calculate risk level before save
sessionSchema.pre('save', function (next) {
  const MEDIUM = parseInt(process.env.SCORE_MEDIUM_THRESHOLD) || 20;
  const HIGH = parseInt(process.env.SCORE_HIGH_THRESHOLD) || 50;

  if (this.suspicionScore >= HIGH) this.riskLevel = 'high';
  else if (this.suspicionScore >= MEDIUM) this.riskLevel = 'medium';
  else this.riskLevel = 'low';

  if (this.endTime && this.startTime) {
    this.durationMinutes = Math.round(
      (this.endTime - this.startTime) / 60000
    );
  }

  next();
});

sessionSchema.methods.addScore = function (points) {
  this.suspicionScore = Math.min(100, this.suspicionScore + points);
  this.alertCount += 1;
};

sessionSchema.statics.getActive = function () {
  return this.find({ active: true }).sort({ startTime: -1 });
};

module.exports = mongoose.model('Session', sessionSchema);
