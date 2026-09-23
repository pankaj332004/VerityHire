const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Student = require('../models/Student');
const Recruiter = require('../models/Recruiter');

/**
 * @desc    Register a new user (Student or Recruiter)
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const {
      email,
      password,
      role = 'student',
      // Student specific fields
      name,
      rollNumber,
      branch,
      batch,
      cgpa,
      phone,
      // Recruiter specific fields
      companyName,
      website,
      industry,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists.',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      role,
      isVerified: true,
    });

    let profile = null;

    // Create corresponding role profile
    if (role === 'student') {
      profile = await Student.create({
        userId: user._id,
        name: name || email.split('@')[0],
        rollNumber: rollNumber || `ROLL-${Date.now().toString().slice(-6)}`,
        branch: branch || 'CSE',
        batch: batch || new Date().getFullYear(),
        cgpa: cgpa !== undefined ? Number(cgpa) : 7.0,
        phone: phone || '',
      });
    } else if (role === 'recruiter') {
      profile = await Recruiter.create({
        userId: user._id,
        companyName: companyName || `${email.split('@')[0]} Technologies`,
        website: website || '',
        industry: industry || 'Technology',
      });
    }

    const token = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
      profile,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    let profile = null;
    if (user.role === 'student') {
      profile = await Student.findOne({ userId: user._id });
    } else if (user.role === 'recruiter') {
      profile = await Recruiter.findOne({ userId: user._id });
    }

    const token = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      token,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
      profile,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Refresh access token
 * @route   POST /api/auth/refresh
 * @access  Public
 */
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is required.',
      });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'verityhire_refresh_secret_jwt_key_2026_secure'
    );

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User belonging to token no longer exists.',
      });
    }

    const newToken = user.generateAccessToken();

    res.status(200).json({
      success: true,
      token: newToken,
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token.',
    });
  }
};

/**
 * @desc    Get currently authenticated user & profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-passwordHash');
    let profile = null;

    if (user.role === 'student') {
      profile = await Student.findOne({ userId: user._id });
    } else if (user.role === 'recruiter') {
      profile = await Recruiter.findOne({ userId: user._id });
    }

    res.status(200).json({
      success: true,
      user,
      profile,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refresh,
  getMe,
};
