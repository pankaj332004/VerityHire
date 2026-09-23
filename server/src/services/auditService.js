const AuditLog = require('../models/AuditLog');

/**
 * Creates an immutable audit trail entry
 */
const recordAuditLog = async ({
  entityType = 'application',
  entityId,
  action,
  actor,
  before = null,
  after = null,
  reason = '',
  aiScoreAtTimeOfAction = null,
}) => {
  try {
    const log = await AuditLog.create({
      entityType,
      entityId,
      action,
      actor: {
        type: actor?.type || (actor?.id ? 'user' : 'system'),
        userId: actor?.id || actor?._id || null,
        role: actor?.role || 'system',
      },
      before,
      after,
      reason,
      aiScoreAtTimeOfAction,
      timestamp: new Date(),
    });
    return log;
  } catch (err) {
    console.error(`⚠️ Failed to record audit log: ${err.message}`);
    return null;
  }
};

module.exports = { recordAuditLog };
