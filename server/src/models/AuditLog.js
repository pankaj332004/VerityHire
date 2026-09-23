const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ['application', 'job', 'student', 'recruiter'],
      required: true,
      default: 'application',
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    action: {
      type: String,
      enum: [
        'ai_scored',
        'recruiter_shortlisted',
        'recruiter_rejected',
        'recruiter_overrode_ai',
        'status_changed',
      ],
      required: true,
    },
    actor: {
      type: {
        type: String,
        enum: ['system', 'user'],
        required: true,
      },
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      role: {
        type: String,
      },
    },
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    reason: {
      type: String,
      default: '',
    },
    aiScoreAtTimeOfAction: {
      type: Number,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ 'actor.userId': 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
