const Application = require('../models/Application');
const Job = require('../models/Job');
const Student = require('../models/Student');
const { scoreApplication } = require('../services/mlServiceClient');
const { recordAuditLog } = require('../services/auditService');

/**
 * @desc    Apply to a job
 * @route   POST /api/jobs/:id/apply
 * @access  Private (Student)
 */
const applyToJob = async (req, res, next) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found. Please complete your profile first.',
      });
    }

    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job posting not found.' });
    }

    if (job.status !== 'open') {
      return res.status(400).json({
        success: false,
        message: 'This job posting is currently closed for applications.',
      });
    }

    if (new Date() > new Date(job.deadline)) {
      return res.status(400).json({
        success: false,
        message: 'The application deadline for this job has expired.',
      });
    }

    // Check duplicate
    const existingApplication = await Application.findOne({
      jobId: job._id,
      studentId: student._id,
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied for this job.',
        application: existingApplication,
      });
    }

    // Initial AI Score calculation upon application
    const initialAiScore = await scoreApplication({
      jdText: job.jdText || job.description,
      requiredSkills: job.skillsRequired,
      studentProfile: student,
      cgpa: student.cgpa,
    });

    const application = await Application.create({
      jobId: job._id,
      studentId: student._id,
      status: 'applied',
      aiScore: initialAiScore,
      statusHistory: [
        {
          status: 'applied',
          changedAt: new Date(),
          changedBy: req.user._id,
          reason: 'Application submitted by candidate',
        },
      ],
    });

    await recordAuditLog({
      entityType: 'application',
      entityId: application._id,
      action: 'status_changed',
      actor: { id: req.user._id, role: req.user.role },
      after: { status: 'applied', jobId: job._id },
      aiScoreAtTimeOfAction: initialAiScore.finalScore,
      reason: 'Candidate submitted application',
    });

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully!',
      application,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all applications for a job (ranked by AI score)
 * @route   GET /api/jobs/:id/applications
 * @access  Private (Recruiter or Admin)
 */
const getJobApplications = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    const applications = await Application.find({ jobId: job._id })
      .populate('studentId')
      .sort({ 'aiScore.finalScore': -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: applications.length,
      applications,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all applications for logged-in student
 * @route   GET /api/applications/my
 * @access  Private (Student)
 */
const getMyApplications = async (req, res, next) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const applications = await Application.find({ studentId: student._id })
      .populate({
        path: 'jobId',
        populate: { path: 'recruiterId', select: 'companyName companyLogoUrl' },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: applications.length,
      applications,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update application status (Shortlist, Reject, Interview, Offer) with Mandatory Override Check
 * @route   PATCH /api/applications/:id/status
 * @access  Private (Recruiter or Admin)
 */
const updateApplicationStatus = async (req, res, next) => {
  try {
    const { status, reason, isOverride = false } = req.body;

    const validStatuses = ['applied', 'shortlisted', 'interview', 'offered', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const application = await Application.findById(req.params.id)
      .populate('jobId')
      .populate('studentId');

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const previousStatus = application.status;
    const aiScore = application.aiScore?.finalScore || 0;

    // Enforce mandatory reason if overriding AI recommendation
    // (e.g. rejecting a candidate with score >= 80, or shortlisting with score < 50, or explicit isOverride)
    const isAiOverride =
      isOverride ||
      (status === 'rejected' && aiScore >= 80) ||
      (status === 'shortlisted' && aiScore < 50);

    if (isAiOverride && (!reason || reason.trim().length === 0)) {
      return res.status(400).json({
        success: false,
        message:
          'Mandatory override requirement: A non-empty reason is required when your decision overrides the AI ranking.',
        requiredField: 'reason',
      });
    }

    // Update status and append to history
    application.status = status;
    application.statusHistory.push({
      status,
      changedAt: new Date(),
      changedBy: req.user._id,
      reason: reason || 'Standard status transition',
    });

    await application.save();

    // Record immutable audit log
    const auditAction = isAiOverride ? 'recruiter_overrode_ai' : 'status_changed';
    await recordAuditLog({
      entityType: 'application',
      entityId: application._id,
      action: auditAction,
      actor: { id: req.user._id, role: req.user.role },
      before: { status: previousStatus },
      after: { status },
      reason: reason || `Status changed from ${previousStatus} to ${status}`,
      aiScoreAtTimeOfAction: aiScore,
    });

    res.status(200).json({
      success: true,
      message: `Application status updated to '${status}'.`,
      application,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  applyToJob,
  getJobApplications,
  getMyApplications,
  updateApplicationStatus,
};
