// backend/routes/studentRoutes.js
const express = require('express');
const router = express.Router();
const Student = require('../models/Student');

// ✅ Import correctly - destructure the authMiddleware
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// ✅ GET all students
router.get('/students', authMiddleware, async (req, res) => {
  try {
    let query = {};
    
    // Use req.userRole and req.userId from your auth middleware
    if (req.userRole === 'teacher') {
      query.classId = req.user.classId;
    } else if (req.userRole === 'parent') {
      query.parents = req.userId;
    }
    
    const students = await Student.find(query)
      .populate('classId', 'name')
      .select('name email rollNumber classId sex');
    
    console.log('Sending students:', students.length);
    
    res.json({
      success: true,
      count: students.length,
      data: students
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ Get single student by ID
router.get('/students/:id', authMiddleware, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('classId', 'name');
    
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    
    res.json({
      success: true,
      data: student
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ Create new student (Admin only)
router.post('/students', authMiddleware, roleMiddleware(['admin', 'superadmin']), async (req, res) => {
  try {
    const student = new Student(req.body);
    await student.save();
    
    res.status(201).json({
      success: true,
      data: student
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ Update student
router.put('/students/:id', authMiddleware, roleMiddleware(['admin', 'superadmin']), async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    
    res.json({
      success: true,
      data: student
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ Delete student
router.delete('/students/:id', authMiddleware, roleMiddleware(['admin', 'superadmin']), async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    
    res.json({
      success: true,
      message: 'Student deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;