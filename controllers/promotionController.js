const Enrollment = require('../models/Enrollment');
const User = require('../models/User');

// Get promotion preview
exports.getPromotionPreview = async (req, res) => {
  try {
    const currentYear =  '2019/2020';
    
    const enrollments = await Enrollment.find({ 
      academicYear: currentYear,
      status: 'active'
    });
    
    const stats = {
      grade9: enrollments.filter(e => e.grade === 'Grade 9').length,
      grade10: enrollments.filter(e => e.grade === 'Grade 10').length,
      grade11: enrollments.filter(e => e.grade === 'Grade 11').length,
      grade12: enrollments.filter(e => e.grade === 'Grade 12').length,
      total: enrollments.length
    };
    
    res.json({ success: true, ...stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Execute promotion
exports.promoteStudents = async (req, res) => {
  try {
    const { fromYear, toYear } = req.body;
    
    const gradeMapping = {
      'Grade 9': 'Grade 10',
      'Grade 10': 'Grade 11',
      'Grade 11': 'Grade 12',
      'Grade 12': 'Graduated'
    };
    
    // Get current enrollments
    const currentEnrollments = await Enrollment.find({
      academicYear: fromYear,
      status: 'active'
    });
    
    let promoted = 0;
    let graduated = 0;
    
    for (const enrollment of currentEnrollments) {
      const nextGrade = gradeMapping[enrollment.grade];
      
      if (!nextGrade) continue;
      
      // Check if already promoted
      const alreadyPromoted = await Enrollment.findOne({
        studentId: enrollment.studentId,
        academicYear: toYear
      });
      
      if (alreadyPromoted) continue;
      
      // Create new enrollment for next year
      await Enrollment.create({
        studentId: enrollment.studentId,
        academicYear: toYear,
        grade: nextGrade,
        program: enrollment.program,
        section: enrollment.section,
        status: nextGrade === 'Graduated' ? 'graduated' : 'active',
        enrollmentDate: new Date()
      });
      
      if (nextGrade === 'Graduated') {
        graduated++;
      } else {
        promoted++;
      }
    }
    
    res.json({
      success: true,
      message: `Promoted ${promoted} students, Graduated ${graduated} students`,
      promoted,
      graduated
    });
    
  } catch (error) {
    console.error('Promotion error:', error);
    res.status(500).json({ error: error.message });
  }
};