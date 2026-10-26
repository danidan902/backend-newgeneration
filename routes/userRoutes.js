const express = require('express');
const User = require('../models/User');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const upload = require('../config/multer');
const cloudinary = require('../config/cloudinary');

// ==================== CLOUDINARY HELPERS ====================

// Delete a just-uploaded file (on validation failure)
const destroyUploadedFile = async (file) => {
  if (!file || !file.filename) return;
  try {
    await cloudinary.uploader.destroy(file.filename);
  } catch (e) {
    console.error('Cloudinary destroy failed:', e.message);
  }
};

// Extract public_id from a Cloudinary URL
// https://res.cloudinary.com/duz0kwsrd/image/upload/v1792.../profile-images/123-456.jpg
//   -> profile-images/123-456
const extractPublicId = (url) => {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('res.cloudinary.com')) return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i);
  return match ? match[1] : null;
};

// Delete any old Cloudinary image safely (ignores local paths)
const destroyOldImage = async (url) => {
  const publicId = extractPublicId(url);
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (e) {
    console.warn('Old Cloudinary delete failed:', e.message);
  }
};

// ==================== FORGOT / RESET PASSWORD ====================
router.post('/forgot-password', userController.forgotPassword);
router.post('/reset-password/:token', userController.resetPassword);

// ==================== LOGIN ====================
router.post('/login', async (req, res) => {
  try {
    const { email, password, studentId } = req.body;

    if (!studentId && !email) {
      return res.status(400).json({
        error: 'Students must login with Student ID. Admins login with Email.',
      });
    }

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    let user = null;
    let loginMethod = '';

    // CASE 1: Student ID login
    if (studentId) {
      const cleanStudentId = studentId.trim().toUpperCase();

      user = await User.findOne({
        studentId: cleanStudentId,
        role: 'student',
      });

      if (user) {
        loginMethod = 'studentId';
        console.log(`🔑 Student login attempt by Student ID: ${cleanStudentId}`);
      } else {
        const nonStudentUser = await User.findOne({
          studentId: cleanStudentId,
          role: { $ne: 'student' },
        });

        if (nonStudentUser) {
          return res.status(401).json({
            error: 'Invalid credentials. Please use your email to login.',
          });
        }

        return res.status(401).json({
          error: 'Invalid Student ID. Please check your Student ID and try again.',
        });
      }
    }

    // CASE 2: Email login
    if (!user && email) {
      user = await User.findOne({ email: email.toLowerCase().trim() });

      if (user) {
        if (user.role === 'student') {
          return res.status(401).json({
            error:
              'Students must login using their Student ID. Please use your Student ID to login.',
          });
        }
        loginMethod = 'email';
        console.log(`🔑 ${user.role} login attempt by email: ${email}`);
      } else {
        const studentUser = await User.findOne({
          email: email.toLowerCase().trim(),
          role: 'student',
        });

        if (studentUser) {
          return res.status(401).json({
            error: `This email belongs to a student. Please use your Student ID to login.`,
          });
        }
      }
    }

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials. Please check your Student ID/Email and try again.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: 'Your account is deactivated. Please contact the administrator.',
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid password. Please try again.' });
    }

    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'my_test_secret_key_12345';

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        studentId: user.studentId || '',
        rollNumber: user.rollNumber || '',
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const userResponse = user.toObject();
    delete userResponse.password;

    console.log(`✅ Login successful: ${user.email} (${user.role}) via ${loginMethod}`);

    let responseMessage = 'Login successful';
    let loginCredential = '';

    if (user.role === 'student') {
      loginCredential = `Student ID: ${user.studentId}`;
      responseMessage = `Welcome ${user.name}! You have successfully logged in with your Student ID.`;
    } else {
      loginCredential = `Email: ${user.email}`;
      responseMessage = `Welcome ${user.name}!`;
    }

    res.json({
      message: responseMessage,
      success: true,
      token,
      user: {
        ...userResponse,
        loginMethod,
        loginCredential,
      },
      needsPasswordChange: user.needsPasswordChange || false,
      studentId: user.studentId || null,
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      error: 'An error occurred during login. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// ==================== CHANGE PASSWORD ====================
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: 'New password must be at least 6 characters long' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.needsPasswordChange = false;
    user.updatedAt = Date.now();
    await user.save();

    res.json({
      message: 'Password changed successfully. Please login again.',
      passwordChanged: true,
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== GET OWN PROFILE ====================
router.get('/me/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    console.log('📥 GET /me/profile - User ID:', userId);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userResponse = user.toObject();
    delete userResponse.password;

    console.log('✅ Profile data:', {
      name: userResponse.name,
      email: userResponse.email,
      role: userResponse.role,
      sex: userResponse.sex,
      age: userResponse.age,
      grade: userResponse.grade,
      programs: userResponse.programs,
      section: userResponse.section,
      rollNumber: userResponse.rollNumber,
      profileImage: userResponse.profileImage,
      needsPasswordChange: userResponse.needsPasswordChange,
      academicStatus: userResponse.academicStatus,
      graduationYear: userResponse.graduationYear,
    });

    res.json(userResponse);
  } catch (error) {
    console.error('❌ /me/profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== GET STUDENTS WITH ENROLLMENT ====================
router.get('/students-with-enrollment', authMiddleware, async (req, res) => {
  try {
    const { academicYear } = req.query;

    const students = await User.find({ role: 'student' })
      .select('-password')
      .sort({ createdAt: -1 });

    const studentsWithEnrollment = students.map((student) => {
      const isGraduated =
        student.academicStatus === 'graduated' || student.grade === 'Graduated';

      return {
        ...student.toObject(),
        enrollmentStatus: isGraduated ? 'Graduated' : 'Active',
        program: student.programs,
        academicYear: academicYear || '2019/2020',
      };
    });

    const activeStudents = studentsWithEnrollment.filter(
      (s) => s.enrollmentStatus !== 'Graduated'
    );
    const graduatedStudents = studentsWithEnrollment.filter(
      (s) => s.enrollmentStatus === 'Graduated'
    );

    res.json({
      success: true,
      students: studentsWithEnrollment,
      activeStudents,
      graduatedStudents,
      counts: {
        total: studentsWithEnrollment.length,
        active: activeStudents.length,
        graduated: graduatedStudents.length,
      },
    });
  } catch (error) {
    console.error('Error fetching students with enrollment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== DEBUG STUDENTS ====================
router.get(
  '/debug-students',
  authMiddleware,
  roleMiddleware(['superadmin', 'admin']),
  async (req, res) => {
    try {
      const students = await User.find({ role: 'student' }).select(
        'name grade academicStatus isActive rollNumber'
      );

      const summary = students.map((s) => ({
        name: s.name,
        grade: s.grade,
        gradeType: typeof s.grade,
        academicStatus: s.academicStatus || 'NOT SET',
        isActive: s.isActive,
        canPromote:
          s.grade &&
          s.grade !== 'Graduated' &&
          s.academicStatus !== 'graduated' &&
          s.isActive === true,
      }));

      res.json({
        total: students.length,
        students: summary,
        issues: summary
          .filter((s) => !s.canPromote)
          .map((s) => ({
            name: s.name,
            reason: !s.grade
              ? 'No grade'
              : s.grade === 'Graduated'
              ? 'Already graduated'
              : s.academicStatus === 'graduated'
              ? 'Status graduated'
              : !s.isActive
              ? 'Not Active'
              : 'Unknown',
          })),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ==================== PROMOTE ALL ====================
router.post(
  '/promote-all',
  authMiddleware,
  roleMiddleware(['superadmin', 'admin']),
  async (req, res) => {
    const { fromYear, toYear } = req.body;

    console.log('🚀 Promotion request received:', { fromYear, toYear });

    try {
      const allStudents = await User.find({ role: 'student' });
      console.log(`📚 Total students in DB: ${allStudents.length}`);

      if (allStudents.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No students found in database',
        });
      }

      const activeStudents = allStudents.filter((s) => {
        const grade = s.grade;
        const isGraduated =
          s.academicStatus === 'graduated' || grade === 'Graduated';
        const isActiveStudent = s.isActive !== false;
        const hasValidGrade = grade && grade !== 'Graduated' && grade !== '';

        return !isGraduated && isActiveStudent && hasValidGrade;
      });

      console.log(`🎯 Active students to process: ${activeStudents.length}`);

      if (activeStudents.length === 0) {
        return res.json({
          success: false,
          message: 'No active students to promote',
          debug: {
            totalStudents: allStudents.length,
            studentDetails: allStudents.map((s) => ({
              name: s.name,
              grade: s.grade,
              academicStatus: s.academicStatus || 'missing',
              isActive: s.isActive,
            })),
          },
        });
      }

      const promoted = [];
      const graduated = [];
      const errors = [];

      for (const student of activeStudents) {
        try {
          let gradeNum = null;
          if (typeof student.grade === 'string') {
            if (student.grade.includes('Grade')) {
              gradeNum = parseInt(student.grade.split(' ')[1]);
            } else {
              gradeNum = parseInt(student.grade);
            }
          }

          console.log(
            `Processing ${student.name}: grade="${student.grade}" -> parsed: ${gradeNum}`
          );

          if (isNaN(gradeNum)) {
            errors.push({
              name: student.name,
              grade: student.grade,
              reason: 'Invalid grade format',
            });
            continue;
          }

          if (gradeNum === 12) {
            student.academicStatus = 'Graduated';
            student.graduationYear = new Date().getFullYear();
            student.graduatedAt = new Date();
            student.isActive = false;
            student.grade = 'Graduated';

            await student.save();
            graduated.push({
              name: student.name,
              email: student.email,
              rollNumber: student.rollNumber,
            });
            console.log(`✅ Graduated: ${student.name}`);
          } else if (gradeNum >= 1 && gradeNum < 12) {
            const oldGrade = student.grade;
            student.grade = String(gradeNum + 1);

            await student.save();
            promoted.push({
              name: student.name,
              email: student.email,
              from: oldGrade,
              to: gradeNum + 1,
            });
            console.log(
              `✅ Promoted: ${student.name} from ${oldGrade} to ${gradeNum + 1}`
            );
          }
        } catch (err) {
          console.error(`Error with ${student.name}:`, err);
          errors.push({
            name: student.name,
            error: err.message,
          });
        }
      }

      console.log(
        `🎉 Done! Promoted: ${promoted.length}, Graduated: ${graduated.length}`
      );

      res.json({
        success: true,
        message: `✅ Promoted ${promoted.length} students, graduated ${graduated.length} students`,
        promotedCount: promoted.length,
        graduatedCount: graduated.length,
        promotedStudents: promoted,
        graduatedStudents: graduated,
        errors: errors,
        fromYear,
        toYear,
      });
    } catch (error) {
      console.error('❌ Promotion error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        stack: error.stack,
      });
    }
  }
);

// ==================== RESTORE STUDENT ====================
router.post(
  '/:id/restore',
  authMiddleware,
  roleMiddleware(['superadmin', 'admin']),
  async (req, res) => {
    try {
      const { newGrade = '12' } = req.body;
      const student = await User.findById(req.params.id);

      if (!student) {
        return res.status(404).json({
          success: false,
          error: 'Student not found',
        });
      }

      student.academicStatus = 'Active';
      student.isActive = true;
      student.grade = newGrade;
      student.graduationYear = null;
      student.graduatedAt = null;

      await student.save();

      return res.status(200).json({
        success: true,
        message: `${student.name} restored to active students`,
        student: {
          id: student._id,
          name: student.name,
          grade: student.grade,
        },
      });
    } catch (error) {
      console.error('Restore error:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ==================== GRADUATE SINGLE STUDENT ====================
router.post(
  '/:id/graduate',
  authMiddleware,
  roleMiddleware(['superadmin', 'admin']),
  async (req, res) => {
    try {
      const student = await User.findById(req.params.id);

      if (!student) {
        return res
          .status(404)
          .json({ success: false, error: 'Student not found' });
      }

      if (student.role !== 'student') {
        return res
          .status(400)
          .json({ success: false, error: 'User is not a student' });
      }

      if (student.academicStatus === 'Graduated') {
        return res
          .status(400)
          .json({ success: false, error: 'Student is already graduated' });
      }

      student.academicStatus = 'Graduated';
      student.graduationYear = new Date().getFullYear();
      student.graduatedAt = new Date();
      student.isActive = false;
      student.grade = 'Graduated';

      await student.save();

      const studentResponse = student.toObject();
      delete studentResponse.password;

      res.json({
        success: true,
        message: `${student.name} has been graduated successfully`,
        student: studentResponse,
      });
    } catch (error) {
      console.error('Graduate single error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ==================== GET GRADUATES ====================
router.get('/graduates', authMiddleware, async (req, res) => {
  try {
    const { year, page = 1, limit = 50 } = req.query;

    let query = {
      role: 'student',
      academicStatus: 'Graduated',
    };

    if (year) {
      query.graduationYear = parseInt(year);
    }

    const graduates = await User.find(query)
      .select(
        'name email rollNumber sex grade graduationYear graduatedAt programs section profileImage'
      )
      .sort({ graduatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      graduates,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      currentYear: new Date().getFullYear(),
    });
  } catch (error) {
    console.error('Get graduates error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== PROMOTION STATS ====================
router.get(
  '/promotion-stats',
  authMiddleware,
  roleMiddleware(['superadmin', 'admin']),
  async (req, res) => {
    try {
      const activeStudents = await User.find({
        role: 'student',
        academicStatus: { $ne: 'Graduated' },
        isActive: true,
      });

      const stats = {
        total: activeStudents.length,
        grade9: 0,
        grade10: 0,
        grade11: 0,
        grade12: 0,
        other: 0,
      };

      activeStudents.forEach((student) => {
        const gradeNum = parseInt(student.grade);
        if (gradeNum === 9) stats.grade9++;
        else if (gradeNum === 10) stats.grade10++;
        else if (gradeNum === 11) stats.grade11++;
        else if (gradeNum === 12) stats.grade12++;
        else stats.other++;
      });

      const graduatedCount = await User.countDocuments({
        role: 'student',
        academicStatus: 'Graduated',
      });

      res.json({
        success: true,
        stats,
        graduatedCount,
        totalStudents: stats.total + graduatedCount,
      });
    } catch (error) {
      console.error('Get promotion stats error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ==================== DEBUG: USER WITH PASSWORD ====================
router.get(
  '/:id/with-password',
  authMiddleware,
  roleMiddleware(['superadmin']),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userResponse = user.toObject();

      res.json({
        message: 'User fetched with password (debug mode)',
        user: userResponse,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ==================== DEBUG: ALL USERS WITH PASSWORDS ====================
router.get(
  '/all/with-passwords',
  authMiddleware,
  roleMiddleware(['superadmin']),
  async (req, res) => {
    try {
      const users = await User.find();

      const usersWithPasswords = users.map((user) => user.toObject());

      res.json({
        message: 'All users fetched with passwords (debug mode)',
        count: usersWithPasswords.length,
        users: usersWithPasswords,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ==================== DEBUG: CREATE USER ====================
router.post(
  '/debug-create',
  authMiddleware,
  roleMiddleware(['superadmin']),
  async (req, res) => {
    try {
      const { name, email, password, role } = req.body;

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const userData = {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: role || 'student',
        needsPasswordChange: true,
        academicStatus: 'Active',
      };

      const user = new User(userData);
      await user.save();

      const userResponse = user.toObject();
      delete userResponse.password;

      res.status(201).json({
        message: 'User created successfully',
        user: userResponse,
        temporary_password: password,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ==================== CREATE USER ====================
router.post(
  '/',
  authMiddleware,
  roleMiddleware(['admin', 'superadmin']),
  upload.single('profileImage'),
  async (req, res) => {
    try {
      const {
        name,
        email,
        password,
        role,
        studentId,
        rollNumber,
        sex,
        grade,
        programs,
        section,
        parentPhone,
        age,
      } = req.body;

      // Validate required fields
      if (!name || !password) {
        await destroyUploadedFile(req.file);
        return res.status(400).json({
          error: 'Name and password are required',
        });
      }

      // For students, Student ID is REQUIRED
      if ((role === 'student' || !role) && !studentId) {
        await destroyUploadedFile(req.file);
        return res.status(400).json({
          error:
            'Student ID is required for students. Please provide a unique Student ID.',
        });
      }

      // Generate email for students if not provided
      let finalEmail = email;
      if (!email && (role === 'student' || !role)) {
        const cleanStudentId = studentId.trim().toUpperCase();
        const cleanName = name.trim().toLowerCase().replace(/\s+/g, '.');
        finalEmail = `${cleanName}.${cleanStudentId}@school.local`;
      } else if (email) {
        finalEmail = email.toLowerCase().trim();
      } else {
        await destroyUploadedFile(req.file);
        return res.status(400).json({
          error: 'Email is required for non-student users',
        });
      }

      // Check email uniqueness
      const existingUser = await User.findOne({ email: finalEmail });
      if (existingUser) {
        await destroyUploadedFile(req.file);
        return res.status(409).json({ error: 'Email already exists' });
      }

      // Check Student ID uniqueness
      if (studentId) {
        const cleanStudentId = studentId.trim().toUpperCase();
        const existingStudentId = await User.findOne({
          studentId: { $regex: new RegExp(`^${cleanStudentId}$`, 'i') },
        });
        if (existingStudentId) {
          await destroyUploadedFile(req.file);
          return res.status(409).json({
            error: `Student ID '${studentId}' already exists. Please use a unique Student ID.`,
          });
        }
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const sanitizedParentPhone = parentPhone ? parentPhone.toString().trim() : '';
      const sanitizedName = name ? name.trim() : '';
      const sanitizedStudentId = studentId ? studentId.trim().toUpperCase() : '';
      const sanitizedRollNumber = rollNumber ? rollNumber.toString().trim() : '';
      const sanitizedSex = sex ? sex.toString().trim() : '';
      const sanitizedAge = age ? age.toString().trim() : '';
      const sanitizedGrade = grade ? grade.toString().trim() : '';
      const sanitizedPrograms = programs ? programs.toString().trim() : '';
      const sanitizedSection = section ? section.toString().trim() : '';

      const userData = {
        name: sanitizedName,
        email: finalEmail,
        password: hashedPassword,
        role: role || 'student',
        age: sanitizedAge || '',
        needsPasswordChange: true,
        academicStatus: 'Active',
        parentPhone: sanitizedParentPhone,
      };

      if (role === 'student' || !role) {
        userData.studentId = sanitizedStudentId;
        userData.rollNumber = sanitizedRollNumber || '';
        userData.sex = sanitizedSex || '';
        userData.age = sanitizedAge || '';
        userData.grade = sanitizedGrade || '';
        userData.programs = sanitizedPrograms || '';
        userData.section = sanitizedSection || '';
        userData.parentPhone = sanitizedParentPhone;
      }

      // ✅ Cloudinary URL (https://res.cloudinary.com/...)
      if (req.file) {
        userData.profileImage = req.file.path;
      }

      const user = new User(userData);
      await user.save();

      const userResponse = user.toObject();
      delete userResponse.password;

      let loginInstructions = '';
      let responseMessage = '';

      if (user.role === 'student') {
        loginInstructions = `Student ID: ${user.studentId}`;
        responseMessage = `Student created successfully with Student ID: ${user.studentId}`;
      } else {
        loginInstructions = `Email: ${user.email}`;
        responseMessage = `${user.role} created successfully!`;
      }

      res.status(201).json({
        success: true,
        message: responseMessage,
        user: {
          ...userResponse,
          loginCredential: loginInstructions,
          loginMethod: user.role === 'student' ? 'studentId' : 'email',
        },
        temporary_password: password,
        studentId: user.studentId || null,
      });
    } catch (error) {
      console.error('❌ Create user error:', error);
      await destroyUploadedFile(req.file);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ==================== PROFILE IMAGE ROUTES ====================
router.post(
  '/:userId/profile-image',
  authMiddleware,
  upload.single('profileImage'),
  async (req, res) => {
    try {
      const { userId } = req.params;

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // ✅ Cloudinary URL
      const imageUrl = req.file.path;

      const user = await User.findById(userId);

      if (!user) {
        await destroyUploadedFile(req.file);
        return res.status(404).json({ error: 'User not found' });
      }

      if (
        req.userRole !== 'superadmin' &&
        req.userRole !== 'admin' &&
        req.userId !== userId
      ) {
        await destroyUploadedFile(req.file);
        return res.status(403).json({ error: 'Access denied' });
      }

      // ✅ Delete old Cloudinary image
      if (user.profileImage) {
        await destroyOldImage(user.profileImage);
      }

      user.profileImage = imageUrl;
      user.updatedAt = Date.now();
      await user.save();

      const userResponse = user.toObject();
      delete userResponse.password;

      res.status(200).json({
        message: 'Profile image uploaded successfully',
        profileImage: imageUrl,
        user: userResponse,
      });
    } catch (error) {
      console.error('Upload error:', error);
      await destroyUploadedFile(req.file);
      res.status(500).json({ error: error.message });
    }
  }
);

// Delete profile image
router.delete('/:userId/profile-image', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (
      req.userRole !== 'superadmin' &&
      req.userRole !== 'admin' &&
      req.userId !== userId
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // ✅ Delete from Cloudinary
    if (user.profileImage) {
      await destroyOldImage(user.profileImage);
    }

    user.profileImage = null;
    user.updatedAt = Date.now();
    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      message: 'Profile image removed successfully',
      user: userResponse,
    });
  } catch (error) {
    console.error('Remove error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== GET ALL USERS ====================
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['admin', 'superadmin']),
  userController.getAllUsers
);

// ==================== GET USERS BY ROLE ====================
router.get('/role/:role', authMiddleware, async (req, res) => {
  try {
    const { role } = req.params;

    if (role === 'admin') {
      const users = await User.find({ role: { $in: ['admin', 'superadmin'] } });
      const usersWithoutPassword = users.map((u) => {
        const obj = u.toObject();
        delete obj.password;
        return obj;
      });
      return res.json(usersWithoutPassword);
    }

    const users = await User.find({ role });
    const usersWithoutPassword = users.map((u) => {
      const obj = u.toObject();
      delete obj.password;
      return obj;
    });
    res.json(usersWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== GET USER BY ID ====================
router.get(
  '/:id',
  authMiddleware,
  roleMiddleware(['admin', 'superadmin']),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userResponse = user.toObject();
      delete userResponse.password;

      res.json(userResponse);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ==================== UPDATE USER ====================
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['admin', 'superadmin']),
  upload.single('profileImage'),
  async (req, res) => {
    try {
      const {
        name,
        email,
        sex,
        grade,
        programs,
        section,
        password,
        rollNumber,
        studentId,
        age,
      } = req.body;

      const user = await User.findById(req.params.id);
      if (!user) {
        await destroyUploadedFile(req.file);
        return res.status(404).json({ error: 'User not found' });
      }

      if (email && email !== user.email) {
        const existingEmail = await User.findOne({
          email: email.toLowerCase().trim(),
        });
        if (existingEmail) {
          await destroyUploadedFile(req.file);
          return res.status(409).json({ error: 'Email already exists' });
        }
      }

      // Check Student ID uniqueness if provided and different
      if (studentId && studentId !== user.studentId) {
        const cleanStudentId = studentId.trim().toUpperCase();
        const existingStudentId = await User.findOne({
          studentId: cleanStudentId,
        });
        if (existingStudentId) {
          await destroyUploadedFile(req.file);
          return res.status(409).json({
            error: `Student ID '${cleanStudentId}' already exists`,
          });
        }
      }

      const updateData = {};
      if (name) updateData.name = name.trim();
      if (email) updateData.email = email.toLowerCase().trim();

      if (password) {
        const salt = await bcrypt.genSalt(10);
        updateData.password = await bcrypt.hash(password, salt);
        updateData.needsPasswordChange = true;
      }

      // Update student-specific fields
      if (studentId && user.role === 'student') {
        updateData.studentId = studentId.trim().toUpperCase();
      }
      if (sex !== undefined) updateData.sex = sex;
      if (grade !== undefined) {
        if (grade === 'Graduated' || grade === 'graduated') {
          updateData.academicStatus = 'Graduated';
          updateData.graduationYear = new Date().getFullYear();
          updateData.graduatedAt = new Date();
          updateData.isActive = false;
          updateData.grade = 'Graduated';
        } else {
          updateData.grade = grade;
          if (user.academicStatus === 'Graduated') {
            updateData.academicStatus = 'Active';
            updateData.isActive = true;
            updateData.graduationYear = null;
            updateData.graduatedAt = null;
          }
        }
      }
      if (programs !== undefined) updateData.programs = programs;
      if (section !== undefined) updateData.section = section;
      if (age !== undefined) updateData.age = age;
      if (rollNumber !== undefined) updateData.rollNumber = rollNumber.trim();

      // ✅ Handle new profile image (Cloudinary)
      if (req.file) {
        if (user.profileImage) {
          await destroyOldImage(user.profileImage);
        }
        updateData.profileImage = req.file.path;
      }

      updateData.updatedAt = Date.now();

      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      const userResponse = updatedUser.toObject();
      delete userResponse.password;

      res.json({
        message: 'User updated successfully',
        user: userResponse,
      });
    } catch (error) {
      console.error('Update error:', error);
      await destroyUploadedFile(req.file);
      res.status(400).json({ error: error.message });
    }
  }
);

// ==================== DELETE USER ====================
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(['admin', 'superadmin']),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.role === 'superadmin' && req.userRole !== 'superadmin') {
        return res
          .status(403)
          .json({ error: 'Only superadmin can delete superadmin accounts' });
      }

      // ✅ Delete Cloudinary image
      if (user.profileImage) {
        await destroyOldImage(user.profileImage);
      }

      await User.findByIdAndDelete(req.params.id);
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Delete error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ==================== ADMIN/SUPERADMIN ROUTES ====================
router.put(
  '/:id/promote',
  authMiddleware,
  roleMiddleware(['superadmin']),
  async (req, res) => {
    try {
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { role: 'superadmin', updatedAt: Date.now() },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userResponse = user.toObject();
      delete userResponse.password;

      res.json({ message: 'User promoted to Super Admin', user: userResponse });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

router.put(
  '/:id/demote',
  authMiddleware,
  roleMiddleware(['superadmin']),
  async (req, res) => {
    try {
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { role: 'admin', updatedAt: Date.now() },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userResponse = user.toObject();
      delete userResponse.password;

      res.json({ message: 'Super Admin demoted to Admin', user: userResponse });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

// ==================== SETUP ROUTE ====================
router.post('/setup/first-superadmin', async (req, res) => {
  try {
    const existingSuperAdmin = await User.findOne({ role: 'superadmin' });
    if (existingSuperAdmin) {
      return res.status(400).json({ error: 'SuperAdmin already exists' });
    }

    const plainPassword = 'admin1234';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);

    const superAdmin = new User({
      name: 'Super Admin',
      email: 'superadmin@school.com',
      password: hashedPassword,
      role: 'superadmin',
      needsPasswordChange: false,
      academicStatus: 'Active',
    });

    await superAdmin.save();

    const userResponse = superAdmin.toObject();
    delete userResponse.password;

    res.json({
      message: 'SuperAdmin created successfully',
      email: 'superadmin@school.com',
      password: plainPassword,
      user: userResponse,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
