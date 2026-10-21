const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Marks = require('../models/Marks');

// ✅ PUBLIC ROUTE - No token needed
router.get('/student/:id', async (req, res) => {
  try {
    const student = await User.findById(req.params.id).select('-password');
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    const marks = await Marks.find({ studentId: req.params.id });
    
    res.json({
      student: {
        name: student.name,
        rollNumber: student.rollNumber,
        grade: student.grade,
        section: student.section,
        sex: student.sex,
        email: student.email,
        phone: student.phone,
        profileImage: student.profileImage,
        programs: student.programs
      },
      marks: marks
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;