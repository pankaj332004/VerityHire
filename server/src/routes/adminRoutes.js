const express = require('express');
const router = express.Router();
const { getAuditLogs, getPlacementAnalytics } = require('../controllers/adminController');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);
router.use(authorize('admin'));

router.get('/audit-logs', getAuditLogs);
router.get('/analytics', getPlacementAnalytics);

module.exports = router;
