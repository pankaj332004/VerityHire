const express = require('express');
const router = express.Router();
const {
  getMyApplications,
  updateApplicationStatus,
} = require('../controllers/applicationController');
const { protect, authorize } = require('../middlewares/auth');

// Student: get their own applications
router.get('/my', protect, authorize('student'), getMyApplications);

// Recruiter/Admin: update candidate status (Shortlist, Reject, etc.) with override check
router.patch('/:id/status', protect, authorize('recruiter', 'admin'), updateApplicationStatus);

module.exports = router;
