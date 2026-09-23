const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    recruiterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Recruiter',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Job description is required'],
    },
    jdText: {
      type: String,
      default: '',
    },
    skillsRequired: {
      type: [String],
      required: [true, 'At least one required skill must be specified'],
      default: [],
    },
    eligibility: {
      minCgpa: {
        type: Number,
        default: 6.0,
        min: 0,
        max: 10,
      },
      branches: {
        type: [String],
        default: ['ALL'],
      },
      maxBacklogs: {
        type: Number,
        default: 0,
        min: 0,
      },
      batch: {
        type: Number,
        default: new Date().getFullYear(),
      },
    },
    ctc: {
      type: String,
      required: [true, 'Compensation / CTC is required'],
      trim: true,
    },
    location: {
      type: String,
      required: [true, 'Job location is required'],
      trim: true,
      default: 'On-site',
    },
    deadline: {
      type: Date,
      required: [true, 'Application deadline is required'],
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
    },
    jdEmbedding: {
      vector: {
        type: [Number],
        default: [],
      },
      modelVersion: {
        type: String,
        default: 'v1.0',
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast job queries
jobSchema.index({ status: 1, deadline: 1 });
jobSchema.index({ 'eligibility.branches': 1, 'eligibility.minCgpa': 1 });

module.exports = mongoose.model('Job', jobSchema);
