// const express = require('express');
// const router = express.Router();
// const { authMiddleware, roleMiddleware } = require('../middleware/auth');
// const {
//   addMarks,
//   getMarksByStudent,
//   getMarksByClass,
//   getSemester1Marks,
//   getSemester2Marks,
//   getFinalResult,
//   updateMarks,
//   deleteMarks
// } = require('../controllers/marksController');

// // Apply auth middleware to all routes
// router.use(authMiddleware);

// // Routes
// router.post('/marks', roleMiddleware(['teacher', 'admin', 'superadmin']), addMarks);
// router.get('/marks/student/:studentId', getMarksByStudent);
// router.get('/marks/class/:classId', getMarksByClass);
// router.get('/marks/semester1/:studentId', getSemester1Marks);
// router.get('/marks/semester2/:studentId', getSemester2Marks);
// router.get('/marks/final/:studentId', getFinalResult);
// router.put('/marks/:id', roleMiddleware(['teacher', 'admin', 'superadmin']), updateMarks);
// router.delete('/marks/:id', roleMiddleware(['teacher', 'admin', 'superadmin']), deleteMarks);

// // Test route
// router.get('/test', (req, res) => {
//   res.json({ message: 'Auth working!', userId: req.userId });
// });

// module.exports = router;


// const express = require('express');
// const router = express.Router();
// const { authMiddleware, roleMiddleware } = require('../middleware/auth');
// const Marks = require('../models/Marks');
// const Class = require('../models/Class');



// // POST - Save marks (teacher auto-detects subject from class)
// router.post('/save', authMiddleware, roleMiddleware(['teacher']), async (req, res) => {
//   try {
//     const { classId, examType, marks, semester, academicYear } = req.body;
//     const teacherId = req.userId;
    
//     if (!teacherId) {
//       return res.status(401).json({ error: 'Teacher not authenticated' });
//     }
    
//     // Get class and find which subject this teacher teaches
//     const classData = await Class.findOne({
//       _id: classId,
//       'subjects.teacher': teacherId
//     });
    
//     if (!classData) {
//       return res.status(403).json({ 
//         error: 'You are not authorized to enter marks for this class' 
//       });
//     }
    
//     // Auto-detect the subject this teacher teaches in this class
//     const teacherSubject = classData.subjects.find(
//       subject => subject.teacher.toString() === teacherId.toString()
//     );
    
//     if (!teacherSubject) {
//       return res.status(403).json({ 
//         error: 'No subject assigned to you in this class' 
//       });
//     }
    
//     console.log(`Teacher ${teacherId} is saving marks for subject: ${teacherSubject.name}`);
    
//     const savedMarks = [];
//     const errors = [];
    
//     for (const markData of marks) {
//       try {
//         const existingMark = await Marks.findOne({
//           studentId: markData.studentId,
//           classId: classId,
//           subject: teacherSubject.name,
//           examType: examType,
//           semester: semester || 'Semester 1',
//           academicYear: academicYear || '2024-2025'
//         });
        
//         if (existingMark) {
//           existingMark.score = markData.score;
//           existingMark.maxScore = markData.maxScore || 100;
//           existingMark.remarks = markData.remarks || '';
//           existingMark.teacherId = teacherId;
//           await existingMark.save();
//           savedMarks.push(existingMark);
//         } else {
//           const newMark = new Marks({
//             studentId: markData.studentId,
//             teacherId: teacherId,
//             classId: classId,
//             subject: teacherSubject.name,
//             examType: examType,
//             score: markData.score,
//             maxScore: markData.maxScore || 100,
//             remarks: markData.remarks || '',
//             semester: semester || 'Semester 1',
//             academicYear: academicYear || '2024-2025'
//           });
//           await newMark.save();
//           savedMarks.push(newMark);
//         }
//       } catch (error) {
//         errors.push({ 
//           studentId: markData.studentId, 
//           error: error.message 
//         });
//       }
//     }
    
//     res.status(200).json({
//       success: true,
//       message: `Saved ${savedMarks.length} marks for ${teacherSubject.name}`,
//       subject: teacherSubject.name,
//       savedCount: savedMarks.length,
//       errors: errors.length > 0 ? errors : undefined
//     });
    
//   } catch (error) {
//     console.error('Save marks error:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // GET - Get marks for a class and subject (auto-detects teacher's subject)
// router.get('/class/:classId', authMiddleware, roleMiddleware(['teacher']), async (req, res) => {
//   try {
//     const { classId } = req.params;
//     const { examType, semester, academicYear } = req.query;
//     const teacherId = req.userId;
    
//     // Verify teacher is assigned and get their subject
//     const classData = await Class.findOne({
//       _id: classId,
//       'subjects.teacher': teacherId
//     });
    
//     if (!classData) {
//       return res.status(403).json({ error: 'You are not assigned to this class' });
//     }
    
//     const teacherSubject = classData.subjects.find(
//       subject => subject.teacher.toString() === teacherId.toString()
//     );
    
//     if (!teacherSubject) {
//       return res.status(403).json({ error: 'No subject assigned to you in this class' });
//     }
    
//     const query = {
//       classId: classId,
//       subject: teacherSubject.name
//     };
    
//     if (examType) query.examType = examType;
//     if (semester) query.semester = semester;
//     if (academicYear) query.academicYear = academicYear;
    
//     const marks = await Marks.find(query)
//       .populate('studentId', 'name email rollNumber')
//       .populate('teacherId', 'name');
    
//     res.json({
//       subject: teacherSubject.name,
//       marks: marks
//     });
    
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // GET - Get marks for a student
// router.get('/student/:studentId', authMiddleware, async (req, res) => {
//   try {
//     const { studentId } = req.params;
//     const { semester, academicYear } = req.query;
    
//     const query = { studentId };
//     if (semester) query.semester = semester;
//     if (academicYear) query.academicYear = academicYear;
    
//     const marks = await Marks.find(query)
//       .populate('teacherId', 'name')
//       .populate('classId', 'grade section');
    
//     res.json(marks);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// module.exports = router;



const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const Marks = require('../models/Marks');
const Class = require('../models/Class');

// POST - Save marks (teacher only)
router.post('/save', authMiddleware, roleMiddleware(['teacher']), async (req, res) => {
  try {
    const { classId, examType, marks, semester, academicYear } = req.body;
    const teacherId = req.userId;
    
    if (!teacherId) {
      return res.status(401).json({ error: 'Teacher not authenticated' });
    }
    
    // Get class and find which subject this teacher teaches
    const classData = await Class.findOne({
      _id: classId,
      'subjects.teacher': teacherId
    });
    
    if (!classData) {
      return res.status(403).json({ 
        error: 'You are not authorized to enter marks for this class' 
      });
    }
    
    // Auto-detect the subject this teacher teaches in this class
    const teacherSubject = classData.subjects.find(
      subject => subject.teacher.toString() === teacherId.toString()
    );
    
    if (!teacherSubject) {
      return res.status(403).json({ 
        error: 'No subject assigned to you in this class' 
      });
    }
    
    const savedMarks = [];
    const errors = [];
    
    for (const markData of marks) {
      try {
        const existingMark = await Marks.findOne({
          studentId: markData.studentId,
          classId: classId,
          subject: teacherSubject.name,
          examType: examType,
          semester: semester || 'Semester 1',
          academicYear: academicYear || '2024-2025'
        });
        
        if (existingMark) {
          existingMark.score = markData.score;
          existingMark.maxScore = markData.maxScore || 100;
          existingMark.remarks = markData.remarks || '';
          existingMark.teacherId = teacherId;
          await existingMark.save();
          savedMarks.push(existingMark);
        } else {
          const newMark = new Marks({
            studentId: markData.studentId,
            teacherId: teacherId,
            classId: classId,
            subject: teacherSubject.name,
            examType: examType,
            score: markData.score,
            maxScore: markData.maxScore || 100,
            remarks: markData.remarks || '',
            semester: semester || 'Semester 1',
            academicYear: academicYear || '2024-2025'
          });
          await newMark.save();
          savedMarks.push(newMark);
        }
      } catch (error) {
        errors.push({ 
          studentId: markData.studentId, 
          error: error.message 
        });
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Saved ${savedMarks.length} marks for ${teacherSubject.name}`,
      subject: teacherSubject.name,
      savedCount: savedMarks.length,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    console.error('Save marks error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Get marks for a class (ALLOW ALL AUTHENTICATED USERS - No teacher check)
router.get('/class/:classId', authMiddleware, async (req, res) => {
  try {
    const { classId } = req.params;
    const { examType, semester, academicYear, subject } = req.query;
    
    console.log('Fetching marks for class:', classId);
    console.log('Filters:', { examType, semester, academicYear, subject });
    
    // Build query
    const query = { classId };
    if (subject) query.subject = subject;
    if (examType) query.examType = examType;
    if (semester) query.semester = semester;
    if (academicYear) query.academicYear = academicYear;
    
    const marks = await Marks.find(query)
      .populate('studentId', 'name email rollNumber')
      .populate('teacherId', 'name');
    
    console.log(`Found ${marks.length} marks`);
    res.json(marks);
    
  } catch (error) {
    console.error('Get marks error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Get marks for a student (allow all authenticated users)
router.get('/student/:studentId', authMiddleware, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { semester, academicYear } = req.query;
    
    const query = { studentId };
    if (semester) query.semester = semester;
    if (academicYear) query.academicYear = academicYear;
    
    const marks = await Marks.find(query)
      .populate('teacherId', 'name')
      .populate('classId', 'grade section');
    
    res.json(marks);
  } catch (error) {
    console.error('Get student marks error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update mark (teacher, admin, or superadmin)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const userRole = req.userRole;
    
    const mark = await Marks.findById(id);
    if (!mark) {
      return res.status(404).json({ error: 'Mark not found' });
    }
    
    // Allow superadmin, admin, or the teacher who created the mark
    if (userRole !== 'superadmin' && userRole !== 'admin' && mark.teacherId.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this mark' });
    }
    
    const updatedMark = await Marks.findByIdAndUpdate(id, req.body, { new: true });
    res.json({ success: true, data: updatedMark });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Delete mark (admin or superadmin only)
router.delete('/:id', authMiddleware, roleMiddleware(['superadmin', 'admin']), async (req, res) => {
  try {
    const mark = await Marks.findByIdAndDelete(req.params.id);
    if (!mark) {
      return res.status(404).json({ error: 'Mark not found' });
    }
    res.json({ success: true, message: 'Mark deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST - Add single mark (teacher only)
router.post('/add', authMiddleware, roleMiddleware(['teacher']), async (req, res) => {
  try {
    const { studentId, classId, subject, examType, score, semester, academicYear, maxScore } = req.body;
    const teacherId = req.userId;
    
    if (!teacherId) {
      return res.status(401).json({ error: 'Teacher not authenticated' });
    }
    
    // Verify teacher is authorized
    const classData = await Class.findOne({
      _id: classId,
      'subjects.teacher': teacherId,
      'subjects.name': subject
    });
    
    if (!classData) {
      return res.status(403).json({ error: 'You are not authorized to add marks for this subject' });
    }
    
    const existingMark = await Marks.findOne({
      studentId,
      classId,
      subject,
      examType,
      semester: semester || 'Semester 1',
      academicYear: academicYear || '2024-2025'
    });
    
    if (existingMark) {
      existingMark.score = score;
      existingMark.maxScore = maxScore || 100;
      existingMark.teacherId = teacherId;
      await existingMark.save();
      return res.json({ success: true, message: 'Mark updated', data: existingMark });
    }
    
    const mark = new Marks({
      studentId,
      teacherId,
      classId,
      subject,
      examType,
      score,
      maxScore: maxScore || 100,
      semester: semester || 'Semester 1',
      academicYear: academicYear || '2024-2025'
    });
    
    await mark.save();
    res.status(201).json({ success: true, message: 'Mark added', data: mark });
  } catch (error) {
    console.error('Add mark error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Marks routes are working!' });
});

module.exports = router;