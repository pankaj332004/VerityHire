const express = require('express');
const router = express.Router();
const {
  createJob,
  getJobs,
  getJobById,
  shortlistCandidates,
} = require('../controllers/jobController');
const { applyToJob, getJobApplications } = require('../controllers/applicationController');
const { protect, authorize } = require('../middlewares/auth');

// Public or authenticated job search
router.get('/', getJobs);
router.get('/:id', getJobById);

// Recruiter actions
router.post('/', protect, authorize('recruiter', 'admin'), createJob);
router.post('/:id/shortlist', protect, authorize('recruiter', 'admin'), shortlistCandidates);
router.get('/:id/applications', protect, authorize('recruiter', 'admin'), getJobApplications);

// Student actions
router.post('/:id/apply', protect, authorize('student'), applyToJob);

module.exports = router;
