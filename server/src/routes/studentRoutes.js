const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  uploadResume,
  getSkillGapAnalysis,
  simulateCareerChange,
} = require('../controllers/studentController');
const { protect, authorize } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

router.get('/me', protect, getProfile);
router.put('/me', protect, updateProfile);
router.post('/me/resume', protect, upload.single('resume'), uploadResume);
router.post('/me/skill-gap', protect, getSkillGapAnalysis);
router.post('/me/simulate', protect, simulateCareerChange);

// Specific student ID routes (accessible by ID or by admin/recruiter)
router.get('/:id/profile', protect, getProfile);
router.put('/:id/profile', protect, updateProfile);
router.post('/:id/resume', protect, upload.single('resume'), uploadResume);
router.post('/:id/skill-gap', protect, getSkillGapAnalysis);
router.post('/:id/simulate', protect, simulateCareerChange);

module.exports = router;
