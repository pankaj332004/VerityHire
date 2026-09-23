const mongoose = require('mongoose');

const skillGapReportSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    targetJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
    },
    targetRole: {
      type: String,
      default: '',
    },
    currentSkills: {
      type: [String],
      default: [],
    },
    requiredSkills: {
      type: [String],
      default: [],
    },
    missingSkills: {
      type: [String],
      default: [],
    },
    recommendations: [
      {
        skill: { type: String, required: true },
        resourceType: {
          type: String,
          enum: ['documentation', 'course', 'project', 'tutorial'],
          default: 'documentation',
        },
        title: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

skillGapReportSchema.index({ studentId: 1, targetJobId: 1 });

module.exports = mongoose.model('SkillGapReport', skillGapReportSchema);
