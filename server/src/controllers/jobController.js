const Job = require('../models/Job');
const Recruiter = require('../models/Recruiter');
const Application = require('../models/Application');
const Student = require('../models/Student');
const { scoreApplication } = require('../services/mlServiceClient');
const { recordAuditLog } = require('../services/auditService');

/**
 * @desc    Create a new job posting
 * @route   POST /api/jobs
 * @access  Private (Recruiter)
 */
const createJob = async (req, res, next) => {
  try {
    const recruiter = await Recruiter.findOne({ userId: req.user._id });
    if (!recruiter) {
      return res.status(403).json({
        success: false,
        message: 'Only registered recruiters can post jobs.',
      });
    }

    const {
      title,
      description,
      jdText,
      skillsRequired,
      eligibility,
      ctc,
      location,
      deadline,
    } = req.body;

    if (!title || !description || !ctc || !deadline) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title, description, CTC, and application deadline.',
      });
    }

    const job = await Job.create({
      recruiterId: recruiter._id,
      title,
      description,
      jdText: jdText || description,
      skillsRequired: Array.isArray(skillsRequired) ? skillsRequired : (skillsRequired || '').split(',').map((s) => s.trim()).filter(Boolean),
      eligibility: {
        minCgpa: eligibility?.minCgpa !== undefined ? Number(eligibility.minCgpa) : 6.0,
        branches: eligibility?.branches || ['ALL'],
        maxBacklogs: eligibility?.maxBacklogs !== undefined ? Number(eligibility.maxBacklogs) : 0,
        batch: eligibility?.batch || new Date().getFullYear(),
      },
      ctc,
      location: location || 'On-site',
      deadline: new Date(deadline),
      status: 'open',
    });

    await recordAuditLog({
      entityType: 'job',
      entityId: job._id,
      action: 'status_changed',
      actor: { id: req.user._id, role: req.user.role },
      before: null,
      after: { status: 'open', title: job.title },
      reason: 'Job opened for applications',
    });

    res.status(201).json({
      success: true,
      message: 'Job posting created successfully.',
      job,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all jobs (with query filters)
 * @route   GET /api/jobs
 * @access  Public or Private
 */
const getJobs = async (req, res, next) => {
  try {
    const { search, branch, status = 'open', minCgpa } = req.query;

    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { skillsRequired: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    if (branch && branch !== 'ALL') {
      query.$or = [
        { 'eligibility.branches': 'ALL' },
        { 'eligibility.branches': { $regex: branch, $options: 'i' } },
      ];
    }

    if (minCgpa) {
      query['eligibility.minCgpa'] = { $lte: Number(minCgpa) };
    }

    const jobs = await Job.find(query)
      .populate('recruiterId', 'companyName companyLogoUrl website industry')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: jobs.length,
      jobs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single job by ID
 * @route   GET /api/jobs/:id
 * @access  Public or Private
 */
const getJobById = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id).populate(
      'recruiterId',
      'companyName companyLogoUrl website industry description'
    );

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found.',
      });
    }

    res.status(200).json({
      success: true,
      job,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Trigger AI Shortlisting Pipeline (Stage 1 Hard Filters + Stage 2 AI Scoring)
 * @route   POST /api/jobs/:id/shortlist
 * @access  Private (Recruiter)
 */
const shortlistCandidates = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    // Fetch all current applications for this job
    const applications = await Application.find({ jobId: job._id }).populate('studentId');

    if (applications.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No candidates have applied to this job yet.',
        rankedApplicants: [],
      });
    }

    const eligibleApplications = [];
    const filteredOutApplications = [];

    // Stage 1: Fast Hard Filtering (CGPA, branch, backlogs)
    for (const app of applications) {
      const student = app.studentId;
      if (!student) continue;

      const meetsCgpa = student.cgpa >= (job.eligibility.minCgpa || 0);
      const meetsBacklogs = student.backlogs <= (job.eligibility.maxBacklogs || 0);
      const branches = job.eligibility.branches || ['ALL'];
      const meetsBranch =
        branches.includes('ALL') ||
        branches.some((b) => b.toUpperCase() === student.branch?.toUpperCase());

      if (meetsCgpa && meetsBacklogs && meetsBranch) {
        eligibleApplications.push(app);
      } else {
        filteredOutApplications.push({
          app,
          reasons: [
            !meetsCgpa && `CGPA ${student.cgpa} below cutoff ${job.eligibility.minCgpa}`,
            !meetsBacklogs && `Backlogs ${student.backlogs} exceeds max ${job.eligibility.maxBacklogs}`,
            !meetsBranch && `Branch ${student.branch} not in allowed list`,
          ].filter(Boolean),
        });
      }
    }

    // Stage 2: AI Multi-Factor Scoring for eligible candidates
    const scoredList = [];
    for (const app of eligibleApplications) {
      const student = app.studentId;
      const scoreResult = await scoreApplication({
        jdText: job.jdText || job.description,
        requiredSkills: job.skillsRequired,
        studentProfile: student,
        cgpa: student.cgpa,
      });

      // Update application in DB
      app.aiScore = scoreResult;
      await app.save();

      // Log AI scoring event
      await recordAuditLog({
        entityType: 'application',
        entityId: app._id,
        action: 'ai_scored',
        actor: { id: req.user._id, role: 'system' },
        after: { finalScore: scoreResult.finalScore },
        aiScoreAtTimeOfAction: scoreResult.finalScore,
        reason: 'Automated AI scoring and feature breakdown completed',
      });

      scoredList.push({
        applicationId: app._id,
        status: app.status,
        student: {
          id: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          branch: student.branch,
          cgpa: student.cgpa,
          skills: student.parsedProfile?.skills || [],
          resumeUrl: student.resumeUrl,
        },
        aiScore: scoreResult,
      });
    }

    // Sort descending by finalScore
    scoredList.sort((a, b) => b.aiScore.finalScore - a.aiScore.finalScore);

    res.status(200).json({
      success: true,
      message: `Shortlisting completed. ${eligibleApplications.length} eligible candidates scored, ${filteredOutApplications.length} excluded by hard filters.`,
      summary: {
        totalApplicants: applications.length,
        eligibleCount: eligibleApplications.length,
        hardFilteredCount: filteredOutApplications.length,
      },
      rankedApplicants: scoredList,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createJob,
  getJobs,
  getJobById,
  shortlistCandidates,
};
