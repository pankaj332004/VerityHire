const AuditLog = require('../models/AuditLog');
const Application = require('../models/Application');
const Student = require('../models/Student');
const Job = require('../models/Job');
const Recruiter = require('../models/Recruiter');

/**
 * @desc    Get audit logs with search/filtering
 * @route   GET /api/admin/audit-logs
 * @access  Private (Admin)
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const { action, entityType, limit = 50, page = 1 } = req.query;

    const query = {};
    if (action) query.action = action;
    if (entityType) query.entityType = entityType;

    const parsedLimit = Math.min(100, Math.max(1, Number(limit)));
    const skip = (Math.max(1, Number(page)) - 1) * parsedLimit;

    const logs = await AuditLog.find(query)
      .populate('actor.userId', 'email role')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parsedLimit);

    const totalCount = await AuditLog.countDocuments(query);

    res.status(200).json({
      success: true,
      count: logs.length,
      totalCount,
      page: Number(page),
      totalPages: Math.ceil(totalCount / parsedLimit),
      logs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get cross-company placement analytics and fairness metrics
 * @route   GET /api/admin/analytics
 * @access  Private (Admin)
 */
const getPlacementAnalytics = async (req, res, next) => {
  try {
    const [
      totalStudents,
      totalRecruiters,
      totalJobs,
      totalApplications,
      applicationsByStatus,
      branchStats,
      overrideLogsCount,
    ] = await Promise.all([
      Student.countDocuments(),
      Recruiter.countDocuments(),
      Job.countDocuments(),
      Application.countDocuments(),
      Application.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Application.aggregate([
        {
          $lookup: {
            from: 'students',
            localField: 'studentId',
            foreignField: '_id',
            as: 'student',
          },
        },
        { $unwind: '$student' },
        {
          $group: {
            _id: '$student.branch',
            totalApplied: { $sum: 1 },
            shortlistedCount: {
              $sum: {
                $cond: [{ $in: ['$status', ['shortlisted', 'interview', 'offered']] }, 1, 0],
              },
            },
            offeredCount: {
              $sum: { $cond: [{ $eq: ['$status', 'offered'] }, 1, 0] },
            },
            avgScore: { $avg: '$aiScore.finalScore' },
          },
        },
      ]),
      AuditLog.countDocuments({ action: 'recruiter_overrode_ai' }),
    ]);

    // Calculate status map
    const statusCounts = {
      applied: 0,
      shortlisted: 0,
      interview: 0,
      offered: 0,
      rejected: 0,
    };
    applicationsByStatus.forEach((item) => {
      if (statusCounts[item._id] !== undefined) {
        statusCounts[item._id] = item.count;
      }
    });

    // Compute fairness / shortlisting rate per branch
    const branchFairness = branchStats.map((b) => ({
      branch: b._id || 'Unknown',
      totalApplied: b.totalApplied,
      shortlistedCount: b.shortlistedCount,
      offeredCount: b.offeredCount,
      shortlistRate: b.totalApplied > 0 ? Math.round((b.shortlistedCount / b.totalApplied) * 100) : 0,
      avgAiScore: Math.round(b.avgScore || 0),
    }));

    res.status(200).json({
      success: true,
      analytics: {
        overview: {
          totalStudents,
          totalRecruiters,
          totalJobs,
          totalApplications,
          overrideCount: overrideLogsCount,
        },
        statusCounts,
        branchFairness,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditLogs,
  getPlacementAnalytics,
};
