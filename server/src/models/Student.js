const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
    },
    rollNumber: {
      type: String,
      required: [true, 'Roll number is required'],
      trim: true,
      uppercase: true,
      unique: true,
    },
    branch: {
      type: String,
      required: [true, 'Branch / Department is required'],
      trim: true,
      uppercase: true,
    },
    batch: {
      type: Number,
      required: [true, 'Graduation batch year is required'],
    },
    cgpa: {
      type: Number,
      required: [true, 'CGPA is required'],
      min: [0, 'CGPA cannot be negative'],
      max: [10, 'CGPA cannot exceed 10'],
      default: 0.0,
    },
    backlogs: {
      type: Number,
      default: 0,
      min: [0, 'Backlogs cannot be negative'],
    },
    phone: {
      type: String,
      trim: true,
    },
    resumeUrl: {
      type: String,
      default: '',
    },
    resumeText: {
      type: String,
      default: '',
    },
    parsedProfile: {
      skills: {
        type: [String],
        default: [],
      },
      experience: [
        {
          title: String,
          org: String,
          duration: String,
          description: String,
        },
      ],
      education: [
        {
          degree: String,
          institute: String,
          year: Number,
          score: String,
        },
      ],
      projects: [
        {
          title: String,
          description: String,
          techStack: [String],
          link: String,
        },
      ],
    },
    embeddings: {
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

// Compound indexes for fast eligibility queries and ranking filters
studentSchema.index({ branch: 1, cgpa: -1, batch: 1 });
studentSchema.index({ backlogs: 1 });

module.exports = mongoose.model('Student', studentSchema);
