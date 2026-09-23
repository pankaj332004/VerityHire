const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('../controllers/recruiterController');
const { protect, authorize } = require('../middlewares/auth');

router.get('/me', protect, authorize('recruiter', 'admin'), getProfile);
router.put('/me', protect, authorize('recruiter', 'admin'), updateProfile);

router.get('/:id/profile', protect, getProfile);
router.put('/:id/profile', protect, authorize('recruiter', 'admin'), updateProfile);

module.exports = router;
