const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    status: {
      type: String,
      enum: ['applied', 'shortlisted', 'interview', 'offered', 'rejected'],
      default: 'applied',
    },
    aiScore: {
      finalScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      featureBreakdown: [
        {
          feature: { type: String, required: true },
          value: { type: Number, required: true },
          weight: { type: Number, required: true },
        },
      ],
      matchedSkills: {
        type: [String],
        default: [],
      },
      missingSkills: {
        type: [String],
        default: [],
      },
      explanation: {
        summary: { type: String, default: '' },
        modelVersion: { type: String, default: 'v1.0' },
      },
      scoredAt: {
        type: Date,
      },
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String, default: '' },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate applications for the same job
applicationSchema.index({ jobId: 1, studentId: 1 }, { unique: true });
applicationSchema.index({ jobId: 1, status: 1 });
applicationSchema.index({ 'aiScore.finalScore': -1 });

module.exports = mongoose.model('Application', applicationSchema);
