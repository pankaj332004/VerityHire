const Student = require('../models/Student');
const Job = require('../models/Job');
const SkillGapReport = require('../models/SkillGapReport');
const { cloudinary, isConfigured } = require('../config/cloudinary');
const { parseResumeText, generateSkillGap, simulateWhatIf } = require('../services/mlServiceClient');

/**
 * @desc    Get student profile
 * @route   GET /api/students/:id/profile or GET /api/students/me
 * @access  Private
 */
const getProfile = async (req, res, next) => {
  try {
    let student;
    if (req.params.id === 'me' || !req.params.id) {
      student = await Student.findOne({ userId: req.user._id });
    } else {
      student = await Student.findById(req.params.id);
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found.',
      });
    }

    res.status(200).json({
      success: true,
      student,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update student profile (allowing student to review/edit parsed resume entities)
 * @route   PUT /api/students/:id/profile or PUT /api/students/me
 * @access  Private (Student or Admin)
 */
const updateProfile = async (req, res, next) => {
  try {
    let student;
    if (req.params.id === 'me' || !req.params.id) {
      student = await Student.findOne({ userId: req.user._id });
    } else {
      student = await Student.findById(req.params.id);
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found.',
      });
    }

    const {
      name,
      rollNumber,
      branch,
      batch,
      cgpa,
      backlogs,
      phone,
      parsedProfile,
    } = req.body;

    if (name) student.name = name;
    if (rollNumber) student.rollNumber = rollNumber;
    if (branch) student.branch = branch;
    if (batch) student.batch = batch;
    if (cgpa !== undefined) student.cgpa = Number(cgpa);
    if (backlogs !== undefined) student.backlogs = Number(backlogs);
    if (phone !== undefined) student.phone = phone;
    if (parsedProfile) student.parsedProfile = parsedProfile;

    await student.save();

    res.status(200).json({
      success: true,
      message: 'Student profile updated successfully.',
      student,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload resume PDF, extract entities, populate parsedProfile
 * @route   POST /api/students/:id/resume
 * @access  Private (Student)
 */
const uploadResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please attach a resume file (PDF or DOCX).',
      });
    }

    let student;
    if (req.params.id === 'me' || !req.params.id) {
      student = await Student.findOne({ userId: req.user._id });
    } else {
      student = await Student.findById(req.params.id);
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found.',
      });
    }

    let resumeUrl = `https://res.cloudinary.com/demo/image/upload/sample_resume_${student.rollNumber || student._id}.pdf`;

    // Upload to Cloudinary if keys are present
    if (isConfigured) {
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              resource_type: 'raw',
              folder: 'verityhire/resumes',
              public_id: `resume_${student.rollNumber || student._id}_${Date.now()}`,
            },
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            }
          );
          uploadStream.end(req.file.buffer);
        });
        resumeUrl = uploadResult.secure_url || uploadResult.url;
      } catch (cloudErr) {
        console.warn(`Cloudinary upload warning: ${cloudErr.message}. Using simulated URL.`);
      }
    }

    // Convert buffer text or string representation
    const rawTextSample = req.file.buffer.toString('utf-8', 0, Math.min(req.file.buffer.length, 10000));
    
    // Call ML entity extractor
    const parsedData = await parseResumeText(rawTextSample);

    student.resumeUrl = resumeUrl;
    student.resumeText = rawTextSample.slice(0, 5000);
    
    // Merge extracted skills with existing
    const existingSkills = student.parsedProfile?.skills || [];
    const newSkills = Array.from(new Set([...existingSkills, ...(parsedData.skills || [])]));
    
    student.parsedProfile = {
      skills: newSkills,
      experience: parsedData.experience || student.parsedProfile?.experience || [],
      education: parsedData.education || student.parsedProfile?.education || [],
      projects: parsedData.projects || student.parsedProfile?.projects || [],
    };

    await student.save();

    res.status(200).json({
      success: true,
      message: 'Resume uploaded and parsed successfully. You can now review your extracted skills.',
      resumeUrl: student.resumeUrl,
      parsedProfile: student.parsedProfile,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate skill-gap analysis for student against a job or target role
 * @route   POST /api/students/:id/skill-gap
 * @access  Private
 */
const getSkillGapAnalysis = async (req, res, next) => {
  try {
    const { jobId, targetRole } = req.body;

    let student;
    if (req.params.id === 'me' || !req.params.id) {
      student = await Student.findOne({ userId: req.user._id });
    } else {
      student = await Student.findById(req.params.id);
    }

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    let requiredSkills = [];
    let jobTitle = targetRole || 'Software Development Engineer';

    if (jobId) {
      const job = await Job.findById(jobId);
      if (job) {
        requiredSkills = job.skillsRequired || [];
        jobTitle = job.title;
      }
    }

    if (requiredSkills.length === 0) {
      requiredSkills = ['JavaScript', 'React', 'Node.js', 'Docker', 'PostgreSQL', 'AWS'];
    }

    const report = await generateSkillGap({
      studentSkills: student.parsedProfile?.skills || [],
      requiredSkills,
    });

    // Save report in DB
    const savedReport = await SkillGapReport.create({
      studentId: student._id,
      targetJobId: jobId || null,
      targetRole: jobTitle,
      currentSkills: report.currentSkills,
      requiredSkills: report.requiredSkills,
      missingSkills: report.missingSkills,
      recommendations: report.recommendations,
    });

    res.status(200).json({
      success: true,
      report: savedReport,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Simulate "What-If" career score delta
 * @route   POST /api/students/:id/simulate
 * @access  Private
 */
const simulateCareerChange = async (req, res, next) => {
  try {
    const { jobId, hypotheticalSkills = [], currentScore = 65 } = req.body;

    let student;
    if (req.params.id === 'me' || !req.params.id) {
      student = await Student.findOne({ userId: req.user._id });
    } else {
      student = await Student.findById(req.params.id);
    }

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    let requiredSkills = ['React', 'Node.js', 'Docker', 'PostgreSQL', 'AWS'];
    if (jobId) {
      const job = await Job.findById(jobId);
      if (job && job.skillsRequired?.length) {
        requiredSkills = job.skillsRequired;
      }
    }

    const simulation = await simulateWhatIf({
      currentScore: Number(currentScore),
      currentSkills: student.parsedProfile?.skills || [],
      hypotheticalSkills,
      requiredSkills,
    });

    res.status(200).json({
      success: true,
      simulation,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadResume,
  getSkillGapAnalysis,
  simulateCareerChange,
};
