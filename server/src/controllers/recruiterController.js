const Recruiter = require('../models/Recruiter');

/**
 * @desc    Get recruiter profile
 * @route   GET /api/recruiters/:id/profile or GET /api/recruiters/me
 * @access  Private
 */
const getProfile = async (req, res, next) => {
  try {
    let recruiter;
    if (req.params.id === 'me' || !req.params.id) {
      recruiter = await Recruiter.findOne({ userId: req.user._id });
    } else {
      recruiter = await Recruiter.findById(req.params.id);
    }

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: 'Recruiter profile not found.',
      });
    }

    res.status(200).json({
      success: true,
      recruiter,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update recruiter profile
 * @route   PUT /api/recruiters/:id/profile or PUT /api/recruiters/me
 * @access  Private (Recruiter)
 */
const updateProfile = async (req, res, next) => {
  try {
    let recruiter;
    if (req.params.id === 'me' || !req.params.id) {
      recruiter = await Recruiter.findOne({ userId: req.user._id });
    } else {
      recruiter = await Recruiter.findById(req.params.id);
    }

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: 'Recruiter profile not found.',
      });
    }

    const { companyName, companyLogoUrl, website, industry, description } = req.body;

    if (companyName) recruiter.companyName = companyName;
    if (companyLogoUrl !== undefined) recruiter.companyLogoUrl = companyLogoUrl;
    if (website !== undefined) recruiter.website = website;
    if (industry) recruiter.industry = industry;
    if (description !== undefined) recruiter.description = description;

    await recruiter.save();

    res.status(200).json({
      success: true,
      message: 'Recruiter profile updated successfully.',
      recruiter,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
};
