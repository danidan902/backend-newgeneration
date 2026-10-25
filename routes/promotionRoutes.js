// routes/promotionRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authMiddleware, roleMiddleware } = require('../middleware/auth'); // Use your existing middleware

// POST /api/promotions/promote-all
router.post('/promote-all', 
  authMiddleware, 
  roleMiddleware(['superadmin', 'admin']),  // Use roleMiddleware instead of authorize
  async (req, res) => {
    const { fromYear, toYear } = req.body;
    
    if (!fromYear || !toYear) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing fromYear or toYear' 
      });
    }
    
    try {
      // Find all active students (not graduated)
      const students = await User.find({
        role: 'student',
        academicStatus: { $ne: 'graduated' },
        isActive: true,
        grade: { $ne: null, $nin: ['Graduated', null, ''] }
      });
      
      if (students.length === 0) {
        return res.json({
          success: true,
          message: 'No active students to promote',
          promotedCount: 0,
          graduatedCount: 0
        });
      }
      
      const promoted = [];
      const graduated = [];
      const errors = [];
      
      for (const student of students) {
        try {
          let currentGrade = parseInt(student.grade);
          
          // Handle Grade 12 students
          if (currentGrade === 12) {
            student.academicStatus = 'graduated';
            student.graduationYear = new Date().getFullYear();
            student.graduatedAt = new Date();
            student.isActive = false;
            student.grade = 'Graduated';
            
            await student.save();
            
            graduated.push({ 
              name: student.name, 
              email: student.email,
              rollNumber: student.rollNumber
            });
          } 
          // Handle Grades 1-11
          else if (currentGrade >= 1 && currentGrade < 12) {
            const oldGrade = student.grade;
            student.grade = String(currentGrade + 1);
            
            await student.save();
            
            promoted.push({ 
              name: student.name, 
              email: student.email,
              from: oldGrade, 
              to: currentGrade + 1 
            });
          }
          else {
            errors.push({ 
              name: student.name, 
              grade: student.grade, 
              reason: 'Invalid grade value' 
            });
          }
          
        } catch (err) {
          console.error(`Error processing student ${student.name}:`, err);
          errors.push({ 
            name: student.name, 
            error: err.message 
          });
        }
      }
      
      console.log(`Promotion completed: ${promoted.length} promoted, ${graduated.length} graduated`);
      
      res.json({
        success: true,
        message: `✅ Successfully promoted ${promoted.length} students and graduated ${graduated.length} students`,
        promotedCount: promoted.length,
        graduatedCount: graduated.length,
        promotedStudents: promoted,
        graduatedStudents: graduated,
        errors: errors,
        fromYear,
        toYear
      });
      
    } catch (error) {
      console.error('Promotion error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to promote students: ' + error.message 
      });
    }
  }
);

// GET /api/promotions/graduates
router.get('/graduates', 
  authMiddleware, 
  async (req, res) => {
    try {
      const { year, page = 1, limit = 50 } = req.query;
      
      let query = {
        role: 'student',
        academicStatus: 'graduated'
      };
      
      if (year) {
        query.graduationYear = parseInt(year);
      }
      
      const graduates = await User.find(query)
        .select('name email rollNumber sex grade graduationYear graduatedAt programs section profileImage')
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
        currentYear: new Date().getFullYear()
      });
      
    } catch (error) {
      console.error('Get graduates error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// POST /api/promotions/graduate-single/:id
router.post('/graduate-single/:id', 
  authMiddleware, 
  roleMiddleware(['superadmin', 'admin']),
  async (req, res) => {
    try {
      const student = await User.findById(req.params.id);
      
      if (!student) {
        return res.status(404).json({ success: false, error: 'Student not found' });
      }
      
      if (student.role !== 'student') {
        return res.status(400).json({ success: false, error: 'User is not a student' });
      }
      
      if (student.academicStatus === 'graduated') {
        return res.status(400).json({ success: false, error: 'Student is already graduated' });
      }
      
      student.academicStatus = 'graduated';
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
        student: studentResponse
      });
      
    } catch (error) {
      console.error('Graduate single error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// POST /api/promotions/restore/:id
router.post('/restore/:id', 
  authMiddleware, 
  roleMiddleware(['superadmin', 'admin']),
  async (req, res) => {
    try {
      const { newGrade } = req.body;
      
      const student = await User.findById(req.params.id);
      
      if (!student) {
        return res.status(404).json({ success: false, error: 'Student not found' });
      }
      
      if (student.role !== 'student') {
        return res.status(400).json({ success: false, error: 'User is not a student' });
      }
      
      student.academicStatus = 'active';
      student.isActive = true;
      student.grade = newGrade || '12';
      student.graduationYear = null;
      student.graduatedAt = null;
      
      await student.save();
      
      const studentResponse = student.toObject();
      delete studentResponse.password;
      
      res.json({
        success: true,
        message: `${student.name} has been restored to active students`,
        student: studentResponse
      });
      
    } catch (error) {
      console.error('Restore error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// GET /api/promotions/stats
router.get('/stats', 
  authMiddleware, 
  roleMiddleware(['superadmin', 'admin']),
  async (req, res) => {
    try {
      const activeStudents = await User.countDocuments({
        role: 'student',
        academicStatus: { $ne: 'graduated' },
        isActive: true
      });
      
      const graduatedStudents = await User.countDocuments({
        role: 'student',
        academicStatus: 'graduated'
      });
      
      const gradeDistribution = await User.aggregate([
        { $match: { role: 'student', academicStatus: { $ne: 'graduated' } } },
        { $group: { _id: '$grade', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);
      
      const graduatesByYear = await User.aggregate([
        { $match: { role: 'student', academicStatus: 'graduated' } },
        { $group: { _id: '$graduationYear', count: { $sum: 1 } } },
        { $sort: { _id: -1 } }
      ]);
      
      res.json({
        success: true,
        stats: {
          activeStudents,
          graduatedStudents,
          gradeDistribution,
          graduatesByYear
        }
      });
      
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

module.exports = router;