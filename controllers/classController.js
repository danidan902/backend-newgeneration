const Class = require('../models/Class');
const User = require('../models/User');

// In your classController.js - Update getAllClasses and getClassById

exports.getAllClasses = async (req, res) => {
  try {
    const classes = await Class.find()
      .populate('classTeacher', 'name email phone')
      .populate('subjects.teacher', 'name email')
      .populate('students', 'name email rollNumber grade section programs academicStatus'); // Add all student fields
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Also update the graduated classes endpoint
// Add this to your route file (classRoutes.js)

// GET - Get all classes including graduated (for admin)
router.get('/all', authMiddleware, roleMiddleware(['superadmin', 'admin']), async (req, res) => {
  try {
    const classes = await Class.find()
      .populate('classTeacher', 'name email')
      .populate('subjects.teacher', 'name email')
      .populate('students', 'name email rollNumber grade section programs academicStatus');
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



exports.getClassById = async (req, res) => {
  try {
    const classData = await Class.findById(req.params.id)
      .populate('classTeacher', 'name email phone')
      .populate('subjects.teacher', 'name email')
      .populate('students', 'name email rollNumber grade section programs academicStatus');
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.json(classData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createClass = async (req, res) => {
  try {
    const { grade, section, program, classTeacher, subjects, academicStatus } = req.body;
    
    // Check if class already exists
    const existingClass = await Class.findOne({ grade, section, program });
    if (existingClass) {
      return res.status(400).json({ error: 'Class already exists' });
    }
    
    const newClass = new Class({ 
      grade, 
      section, 
      program, 
      classTeacher, 
      subjects: subjects || [],
      academicStatus: academicStatus || 'Active'
    });
    
    await newClass.save();
    
    const populatedClass = await Class.findById(newClass._id)
      .populate('classTeacher', 'name email phone')
      .populate('subjects.teacher', 'name email')
      .populate('students', 'name email rollNumber');
    
    res.status(201).json(populatedClass);
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateClass = async (req, res) => {
  try {
    const { grade, section, program, classTeacher, subjects, academicStatus } = req.body;
    
    const classData = await Class.findByIdAndUpdate(
      req.params.id, 
      { grade, section, program, classTeacher, subjects, academicStatus },
      { new: true, runValidators: true }
    )
      .populate('classTeacher', 'name email phone')
      .populate('subjects.teacher', 'name email')
      .populate('students', 'name email rollNumber');
    
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    res.json(classData);
  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteClass = async (req, res) => {
  try {
    const classData = await Class.findByIdAndDelete(req.params.id);
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Remove class reference from all students
    await User.updateMany(
      { classId: req.params.id },
      { $unset: { classId: 1 } }
    );
    
    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addStudentToClass = async (req, res) => {
  try {
    const { classId, studentId } = req.body;
    
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Check if student is already in class
    if (classData.students.includes(studentId)) {
      return res.status(400).json({ error: 'Student already assigned to this class' });
    }
    
    // Check if student is graduated
    if (student.academicStatus === 'Graduated') {
      return res.status(400).json({ error: 'Cannot assign graduated student to class' });
    }
    
    classData.students.push(studentId);
    await classData.save();
    
    // Update user's classId
    await User.findByIdAndUpdate(studentId, { classId });
    
    const updatedClass = await Class.findById(classId)
      .populate('classTeacher', 'name email')
      .populate('subjects.teacher', 'name email')
      .populate('students', 'name email rollNumber grade section programs academicStatus');
    
    res.json(updatedClass);
  } catch (error) {
    console.error('Add student error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.bulkAddStudentsToClass = async (req, res) => {
  try {
    const { classId, studentIds } = req.body;
    
    if (!classId) {
      return res.status(400).json({ error: 'Class ID is required' });
    }
    
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of student IDs' });
    }
    
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    const results = {
      successful: [],
      failed: [],
      total: studentIds.length,
      summary: { successCount: 0, failedCount: 0 }
    };
    
    for (let i = 0; i < studentIds.length; i++) {
      const studentId = studentIds[i];
      
      try {
        const student = await User.findById(studentId);
        
        if (!student || student.role !== 'student') {
          results.failed.push({
            index: i,
            studentId: studentId,
            error: 'Student not found or not a student'
          });
          continue;
        }
        
        if (student.academicStatus === 'Graduated') {
          results.failed.push({
            index: i,
            studentId: studentId,
            name: student.name,
            error: 'Cannot assign graduated student to class'
          });
          continue;
        }
        
        if (classData.students.includes(studentId)) {
          results.failed.push({
            index: i,
            studentId: studentId,
            name: student.name,
            error: 'Student already assigned to this class'
          });
          continue;
        }
        
        classData.students.push(studentId);
        await classData.save();
        await User.findByIdAndUpdate(studentId, { classId });
        
        results.successful.push({
          index: i,
          studentId: studentId,
          name: student.name,
          rollNumber: student.rollNumber
        });
        
      } catch (error) {
        console.error(`Error adding student ${studentId}:`, error);
        results.failed.push({
          index: i,
          studentId: studentId,
          error: error.message
        });
      }
    }
    
    results.summary.successCount = results.successful.length;
    results.summary.failedCount = results.failed.length;
    
    const updatedClass = await Class.findById(classId)
      .populate('classTeacher', 'name email')
      .populate('subjects.teacher', 'name email')
      .populate('students', 'name email rollNumber grade section programs academicStatus');
    
    res.status(200).json({
      message: `Successfully added ${results.successful.length} out of ${results.total} students`,
      results,
      class: updatedClass
    });
    
  } catch (error) {
    console.error('Bulk add students error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.bulkAddStudentsByRollNumbers = async (req, res) => {
  try {
    const { classId, rollNumbers } = req.body;
    
    if (!classId) {
      return res.status(400).json({ error: 'Class ID is required' });
    }
    
    if (!rollNumbers || !Array.isArray(rollNumbers) || rollNumbers.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of roll numbers' });
    }
    
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    const results = {
      successful: [],
      failed: [],
      total: rollNumbers.length,
      summary: { successCount: 0, failedCount: 0 }
    };
    
    for (let i = 0; i < rollNumbers.length; i++) {
      const rollNumber = String(rollNumbers[i]).trim();
      
      try {
        const student = await User.findOne({ 
          rollNumber: rollNumber,
          role: 'student' 
        });
        
        if (!student) {
          results.failed.push({
            index: i,
            rollNumber: rollNumber,
            error: `Student not found with roll number: ${rollNumber}`
          });
          continue;
        }
        
        if (student.academicStatus === 'Graduated') {
          results.failed.push({
            index: i,
            rollNumber: rollNumber,
            name: student.name,
            error: 'Cannot assign graduated student to class'
          });
          continue;
        }
        
        if (classData.students.includes(student._id)) {
          results.failed.push({
            index: i,
            rollNumber: rollNumber,
            name: student.name,
            error: 'Student already assigned to this class'
          });
          continue;
        }
        
        classData.students.push(student._id);
        await classData.save();
        await User.findByIdAndUpdate(student._id, { classId });
        
        results.successful.push({
          index: i,
          studentId: student._id,
          name: student.name,
          rollNumber: student.rollNumber
        });
        
      } catch (error) {
        console.error(`Error adding student with roll number ${rollNumber}:`, error);
        results.failed.push({
          index: i,
          rollNumber: rollNumber,
          error: error.message
        });
      }
    }
    
    results.summary.successCount = results.successful.length;
    results.summary.failedCount = results.failed.length;
    
    const updatedClass = await Class.findById(classId)
      .populate('classTeacher', 'name email')
      .populate('subjects.teacher', 'name email')
      .populate('students', 'name email rollNumber grade section programs academicStatus');
    
    res.status(200).json({
      message: `Successfully added ${results.successful.length} out of ${results.total} students`,
      results,
      class: updatedClass
    });
    
  } catch (error) {
    console.error('Bulk add students by roll numbers error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.bulkRemoveStudentsFromClass = async (req, res) => {
  try {
    const { classId, studentIds } = req.body;
    
    if (!classId) {
      return res.status(400).json({ error: 'Class ID is required' });
    }
    
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of student IDs' });
    }
    
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    const results = {
      successful: [],
      failed: [],
      total: studentIds.length,
      summary: { successCount: 0, failedCount: 0 }
    };
    
    for (let i = 0; i < studentIds.length; i++) {
      const studentId = studentIds[i];
      
      try {
        const student = await User.findById(studentId);
        
        if (!classData.students.includes(studentId)) {
          results.failed.push({
            index: i,
            studentId: studentId,
            name: student?.name || 'Unknown',
            error: 'Student not found in this class'
          });
          continue;
        }
        
        classData.students = classData.students.filter(
          id => id.toString() !== studentId
        );
        await classData.save();
        await User.findByIdAndUpdate(studentId, { $unset: { classId: 1 } });
        
        results.successful.push({
          index: i,
          studentId: studentId,
          name: student?.name || 'Unknown',
          rollNumber: student?.rollNumber || 'N/A'
        });
        
      } catch (error) {
        console.error(`Error removing student ${studentId}:`, error);
        results.failed.push({
          index: i,
          studentId: studentId,
          error: error.message
        });
      }
    }
    
    results.summary.successCount = results.successful.length;
    results.summary.failedCount = results.failed.length;
    
    const updatedClass = await Class.findById(classId)
      .populate('classTeacher', 'name email')
      .populate('subjects.teacher', 'name email')
      .populate('students', 'name email rollNumber grade section programs academicStatus');
    
    res.status(200).json({
      message: `Successfully removed ${results.successful.length} out of ${results.total} students`,
      results,
      class: updatedClass
    });
    
  } catch (error) {
    console.error('Bulk remove students error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Mark a class as graduated
exports.graduateClass = async (req, res) => {
  try {
    const { id } = req.params;
    
    const classData = await Class.findById(id);
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Mark all students in the class as graduated
    for (const studentId of classData.students) {
      await User.findByIdAndUpdate(studentId, { academicStatus: 'Graduated' });
    }
    
    // Mark the class as graduated
    classData.academicStatus = 'Graduated';
    await classData.save();
    
    const updatedClass = await Class.findById(id)
      .populate('classTeacher', 'name email')
      .populate('subjects.teacher', 'name email')
      .populate('students', 'name email rollNumber grade section programs academicStatus');
    
    res.json({ 
      message: 'Class marked as graduated successfully',
      class: updatedClass 
    });
  } catch (error) {
    console.error('Graduate class error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Restore a graduated class
exports.restoreClass = async (req, res) => {
  try {
    const { id } = req.params;
    
    const classData = await Class.findById(id);
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    classData.academicStatus = 'Active';
    await classData.save();
    
    const updatedClass = await Class.findById(id)
      .populate('classTeacher', 'name email')
      .populate('subjects.teacher', 'name email')
      .populate('students', 'name email rollNumber grade section programs academicStatus');
    
    res.json({ 
      message: 'Class restored successfully',
      class: updatedClass 
    });
  } catch (error) {
    console.error('Restore class error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getTeacherClasses = async (req, res) => {
  try {
    const classes = await Class.find({ classTeacher: req.userId })
      .populate('students', 'name email rollNumber')
      .populate('subjects.teacher', 'name email');
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};