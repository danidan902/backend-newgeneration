const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const Class = require('../models/Class');
const User = require('../models/User');

// ============ TEACHER ROUTES (Auto-detect subject) ============

// GET - Get all classes for a teacher (auto-detects their subject)
router.get('/my-classes', authMiddleware, roleMiddleware(['teacher']), async (req, res) => {
  try {
    const teacherId = req.userId;
    
    console.log('Teacher ID:', teacherId);
    
    // Find active classes where this teacher is assigned to any subject
    const classes = await Class.find({
      'subjects.teacher': teacherId,
      academicStatus: { $ne: 'Graduated' } // Exclude graduated classes
    })
      .populate('subjects.teacher', 'name email')
      .populate('students', 'name email rollNumber academicStatus');
    
    console.log('Found classes:', classes.length);
    
    // Format response - each class includes the subject this teacher teaches
    const teacherClasses = classes.map(cls => {
      const teacherSubject = cls.subjects.find(
        subject => subject.teacher && subject.teacher._id.toString() === teacherId.toString()
      );
      
      return {
        _id: cls._id,
        grade: cls.grade,
        section: cls.section,
        program: cls.program,
        classTeacher: cls.classTeacher,
        subject: teacherSubject ? {
          _id: teacherSubject._id,
          name: teacherSubject.name,
          teacher: teacherSubject.teacher
        } : null,
        subjects: cls.subjects,
        students: cls.students.filter(s => s.academicStatus !== 'Graduated'), // Filter out graduated students
        academicStatus: cls.academicStatus,
        createdAt: cls.createdAt,
        updatedAt: cls.updatedAt
      };
    });
    
    res.json(teacherClasses);
  } catch (error) {
    console.error('Get teacher classes error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Get students for a specific class (teacher must be assigned)
router.get('/my-classes/:classId/students', authMiddleware, roleMiddleware(['teacher']), async (req, res) => {
  try {
    const { classId } = req.params;
    const teacherId = req.userId;
    
    const classData = await Class.findOne({
      _id: classId,
      'subjects.teacher': teacherId
    }).populate('students', 'name email rollNumber academicStatus');
    
    if (!classData) {
      return res.status(403).json({ 
        error: 'You are not assigned to this class' 
      });
    }
    
    const teacherSubject = classData.subjects.find(
      subject => subject.teacher.toString() === teacherId.toString()
    );
    
    res.json({
      classInfo: {
        _id: classData._id,
        grade: classData.grade,
        section: classData.section,
        program: classData.program,
        academicStatus: classData.academicStatus
      },
      subject: teacherSubject ? teacherSubject.name : null,
      students: classData.students.filter(s => s.academicStatus !== 'Graduated')
    });
  } catch (error) {
    console.error('Get class students error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN ROUTES ============

// GET - All active classes (admin only)
router.get('/', authMiddleware, roleMiddleware(['superadmin', 'admin']), async (req, res) => {
  try {
    const classes = await Class.find({ academicStatus: { $ne: 'Graduated' } })
      .populate('classTeacher', 'name email')
      .populate('subjects.teacher', 'name email')
      .populate('students', 'name email rollNumber academicStatus');
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Get graduated classes only
router.get('/graduated', authMiddleware, roleMiddleware(['superadmin', 'admin']), async (req, res) => {
  try {
    const classes = await Class.find({ academicStatus: 'Graduated' })
      .populate('classTeacher', 'name email')
      .populate('subjects.teacher', 'name email')
      .populate('students', 'name email rollNumber academicStatus');
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Get all classes including graduated (for admin overview)
router.get('/all', authMiddleware, roleMiddleware(['superadmin', 'admin']), async (req, res) => {
  try {
    const classes = await Class.find()
      .populate('classTeacher', 'name email')
      .populate('subjects.teacher', 'name email')
      .populate('students', 'name email rollNumber academicStatus');
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Single class by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const classData = await Class.findById(req.params.id)
      .populate('classTeacher', 'name email')
      .populate('subjects.teacher', 'name email')
      .populate('students', 'name email rollNumber academicStatus');
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.json(classData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Create class (admin only)
router.post('/', authMiddleware, roleMiddleware(['superadmin', 'admin']), async (req, res) => {
  try {
    const { program, grade, section, classTeacher, subjects, students, academicStatus } = req.body;
    
    const cleanedClassTeacher = classTeacher === '' || classTeacher === null || classTeacher === undefined ? null : classTeacher;
    
    // Check if class exists
    const existingClass = await Class.findOne({ grade, section });
    if (existingClass) {
      return res.status(400).json({ error: 'Class already exists' });
    }
    
    // Validate class teacher
    if (cleanedClassTeacher) {
      const teacher = await User.findById(cleanedClassTeacher);
      if (!teacher || teacher.role !== 'teacher') {
        return res.status(400).json({ error: 'Invalid class teacher' });
      }
    }
    
    // Validate subjects
    const preparedSubjects = [];
    if (subjects && subjects.length > 0) {
      for (let subject of subjects) {
        const teacher = await User.findById(subject.teacher);
        if (!teacher || teacher.role !== 'teacher') {
          return res.status(400).json({ error: `Invalid teacher for subject: ${subject.name}` });
        }
        preparedSubjects.push({
          name: subject.name,
          teacher: subject.teacher
        });
      }
    }
    
    const newClass = new Class({ 
      program, 
      grade, 
      section, 
      classTeacher: cleanedClassTeacher,
      subjects: preparedSubjects, 
      students: students || [],
      academicStatus: academicStatus || 'Active'
    });
    
    await newClass.save();
    
    const populatedClass = await Class.findById(newClass._id)
      .populate('classTeacher', 'name email')
      .populate('subjects.teacher', 'name email')
      .populate('students', 'name email rollNumber academicStatus');
    
    res.status(201).json(populatedClass);
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update class (admin only)
router.put('/:id', authMiddleware, roleMiddleware(['superadmin', 'admin']), async (req, res) => {
  try {
    const { classTeacher, academicStatus } = req.body;
    const cleanedClassTeacher = classTeacher === '' || classTeacher === null || classTeacher === undefined ? null : classTeacher;
    
    const updateData = { ...req.body, classTeacher: cleanedClassTeacher };
    
    const classData = await Class.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate('classTeacher', 'name email')
      .populate('subjects.teacher', 'name email')
      .populate('students', 'name email rollNumber academicStatus');
    
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    res.json(classData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT - Graduate a class (admin only)
router.put('/:id/graduate', authMiddleware, roleMiddleware(['superadmin', 'admin']), async (req, res) => {
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
      .populate('students', 'name email rollNumber academicStatus');
    
    res.json({ 
      message: 'Class marked as graduated successfully',
      class: updatedClass 
    });
  } catch (error) {
    console.error('Graduate class error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Restore a graduated class (admin only)
router.put('/:id/restore', authMiddleware, roleMiddleware(['superadmin', 'admin']), async (req, res) => {
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
      .populate('students', 'name email rollNumber academicStatus');
    
    res.json({ 
      message: 'Class restored successfully',
      class: updatedClass 
    });
  } catch (error) {
    console.error('Restore class error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Delete class (admin only)
router.delete('/:id', authMiddleware, roleMiddleware(['superadmin', 'admin']), async (req, res) => {
  try {
    const classData = await Class.findByIdAndDelete(req.params.id);
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    await User.updateMany(
      { _id: { $in: classData.students } },
      { $unset: { classId: 1 } }
    );
    
    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Add student to class
router.post('/add-student', authMiddleware, roleMiddleware(['superadmin', 'admin', 'teacher']), async (req, res) => {
  try {
    const { classId, studentId } = req.body;
    
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Check if class is graduated
    if (classData.academicStatus === 'Graduated') {
      return res.status(400).json({ error: 'Cannot add students to a graduated class' });
    }
    
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Check if student is graduated
    if (student.academicStatus === 'Graduated') {
      return res.status(400).json({ error: 'Cannot assign graduated student to class' });
    }
    
    if (!classData.students.includes(studentId)) {
      classData.students.push(studentId);
      await classData.save();
      await User.findByIdAndUpdate(studentId, { classId });
    }
    
    await classData.populate('students', 'name email rollNumber academicStatus');
    await classData.populate('classTeacher', 'name email');
    await classData.populate('subjects.teacher', 'name email');
    
    res.json(classData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Bulk add students
router.post('/bulk-add-students', authMiddleware, roleMiddleware(['superadmin', 'admin']), async (req, res) => {
  try {
    const { classId, studentIds } = req.body;
    
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Check if class is graduated
    if (classData.academicStatus === 'Graduated') {
      return res.status(400).json({ error: 'Cannot add students to a graduated class' });
    }
    
    let successCount = 0;
    for (const studentId of studentIds) {
      const student = await User.findById(studentId);
      
      // Skip if student is graduated
      if (student && student.academicStatus === 'Graduated') {
        continue;
      }
      
      if (!classData.students.includes(studentId)) {
        classData.students.push(studentId);
        await User.findByIdAndUpdate(studentId, { classId });
        successCount++;
      }
    }
    
    await classData.save();
    
    const updatedClass = await Class.findById(classId)
      .populate('classTeacher', 'name email')
      .populate('subjects.teacher', 'name email')
      .populate('students', 'name email rollNumber academicStatus');
    
    res.json({ message: `Added ${successCount} students`, class: updatedClass });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Bulk remove students
router.post('/bulk-remove-students', authMiddleware, roleMiddleware(['superadmin', 'admin']), async (req, res) => {
  try {
    const { classId, studentIds } = req.body;
    
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    for (const studentId of studentIds) {
      classData.students = classData.students.filter(id => id.toString() !== studentId);
      await User.findByIdAndUpdate(studentId, { $unset: { classId: 1 } });
    }
    
    await classData.save();
    
    const updatedClass = await Class.findById(classId)
      .populate('classTeacher', 'name email')
      .populate('subjects.teacher', 'name email')
      .populate('students', 'name email rollNumber academicStatus');
    
    res.json({ message: `Removed ${studentIds.length} students`, class: updatedClass });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Get graduated students (admin only)
router.get('/graduated-students', authMiddleware, roleMiddleware(['superadmin', 'admin']), async (req, res) => {
  try {
    const graduatedStudents = await User.find({ 
      role: 'student', 
      academicStatus: 'Graduated' 
    }).select('name email rollNumber grade section programs academicStatus');
    
    res.json(graduatedStudents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT - Restore a graduated student (admin only)
router.put('/students/:id/restore', authMiddleware, roleMiddleware(['superadmin', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const student = await User.findByIdAndUpdate(
      id, 
      { academicStatus: 'Active' },
      { new: true }
    );
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    res.json({ message: 'Student restored successfully', student });
  } catch (error) {
    console.error('Restore student error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;