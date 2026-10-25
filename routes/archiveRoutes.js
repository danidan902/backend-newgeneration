// routes/archiveRoutes.js
const express = require('express');
const router = express.Router();
const Archive = require('../models/Archive');
const Class = require('../models/Class');
const Mark = require('../models/Marks');
const User = require('../models/User');

// 1. Archive a graduated class
router.post('/archive/class', async (req, res) => {
  try {
    const { 
      classId, 
      className, 
      grade, 
      section, 
      subject, 
      subjectId,
      academicYear,
      archiveYear,
      students,
      totalStudents,
      archivedBy 
    } = req.body;

    // Check if already archived
    const existing = await Archive.findOne({ 
      classId, 
      archiveYear,
      academicYear 
    });
    
    if (existing) {
      return res.status(400).json({ error: 'This class is already archived for this year' });
    }

    const archive = new Archive({
      classId,
      className,
      grade,
      section,
      subject,
      subjectId,
      academicYear,
      archiveYear,
      students,
      totalStudents,
      archivedBy: archivedBy || 'System',
      archivedAt: new Date()
    });

    await archive.save();
    res.status(201).json({ message: 'Class archived successfully', archive });
  } catch (error) {
    console.error('Archive error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Get all archives
router.get('/archive/all', async (req, res) => {
  try {
    const archives = await Archive.find().sort({ archivedAt: -1 });
    res.json(archives);
  } catch (error) {
    console.error('Fetch archives error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Get archives by year
router.get('/archive/year/:year', async (req, res) => {
  try {
    const archives = await Archive.find({ archiveYear: req.params.year });
    res.json(archives);
  } catch (error) {
    console.error('Fetch archives by year error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Get available archive years
router.get('/archive/years', async (req, res) => {
  try {
    const years = await Archive.distinct('archiveYear');
    res.json(years.sort());
  } catch (error) {
    console.error('Fetch years error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Get single archive
router.get('/archive/:id', async (req, res) => {
  try {
    const archive = await Archive.findById(req.params.id);
    if (!archive) {
      return res.status(404).json({ error: 'Archive not found' });
    }
    res.json(archive);
  } catch (error) {
    console.error('Fetch archive error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6. Restore archive
router.post('/archive/restore/:id', async (req, res) => {
  try {
    const archive = await Archive.findById(req.params.id);
    if (!archive) {
      return res.status(404).json({ error: 'Archive not found' });
    }

    // Restore students to class
    const classData = await Class.findById(archive.classId);
    if (classData) {
      const studentIds = archive.students.map(s => s.studentId);
      classData.students = studentIds;
      await classData.save();
    }

    // Restore marks
    for (const student of archive.students) {
      // Restore semester 1 marks
      if (student.semester1Marks) {
        for (const [examType, markData] of Object.entries(student.semester1Marks)) {
          const mark = new Mark({
            studentId: student.studentId,
            classId: archive.classId,
            subject: archive.subject,
            examType: examType,
            score: markData.score,
            maxScore: markData.maxScore,
            semester: 'Semester 1',
            academicYear: archive.academicYear
          });
          await mark.save();
        }
      }

      // Restore semester 2 marks
      if (student.semester2Marks) {
        for (const [examType, markData] of Object.entries(student.semester2Marks)) {
          const mark = new Mark({
            studentId: student.studentId,
            classId: archive.classId,
            subject: archive.subject,
            examType: examType,
            score: markData.score,
            maxScore: markData.maxScore,
            semester: 'Semester 2',
            academicYear: archive.academicYear
          });
          await mark.save();
        }
      }
    }

    res.json({ message: 'Archive restored successfully' });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 7. Delete archive
router.delete('/archive/:id', async (req, res) => {
  try {
    const archive = await Archive.findByIdAndDelete(req.params.id);
    if (!archive) {
      return res.status(404).json({ error: 'Archive not found' });
    }
    res.json({ message: 'Archive deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 8. Generate yearly report
router.get('/archive/report/:year', async (req, res) => {
  try {
    const archives = await Archive.find({ archiveYear: req.params.year });
    res.json(archives);
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 9. Archive graduated classes (auto-detect)
router.post('/archive/graduated', async (req, res) => {
  try {
    const { academicYear, archiveYear } = req.body;
    
    // Find all classes that are marked as graduated or completed
    const graduatedClasses = await Class.find({ 
      status: 'graduated',
      academicYear: academicYear
    });

    let archivedCount = 0;
    
    for (const cls of graduatedClasses) {
      // Check if already archived
      const existing = await Archive.findOne({ 
        classId: cls._id, 
        archiveYear: archiveYear 
      });
      
      if (existing) continue;
      
      // Get all students in the class
      const students = await User.find({ 
        _id: { $in: cls.students },
        role: 'student'
      });
      
      // Get marks for all students
      const studentData = [];
      for (const student of students) {
        const marks = await Mark.find({
          studentId: student._id,
          classId: cls._id,
          academicYear: academicYear
        });
        
        const semester1Marks = {};
        const semester2Marks = {};
        
        marks.forEach(mark => {
          if (mark.semester === 'Semester 1') {
            if (!semester1Marks[mark.subject]) semester1Marks[mark.subject] = {};
            semester1Marks[mark.subject][mark.examType] = {
              score: mark.score,
              maxScore: mark.maxScore,
              _id: mark._id
            };
          } else if (mark.semester === 'Semester 2') {
            if (!semester2Marks[mark.subject]) semester2Marks[mark.subject] = {};
            semester2Marks[mark.subject][mark.examType] = {
              score: mark.score,
              maxScore: mark.maxScore,
              _id: mark._id
            };
          }
        });
        
        studentData.push({
          studentId: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          sex: student.sex,
          age: student.age,
          email: student.email,
          phone: student.phone,
          profileImage: student.profileImage,
          semester1Marks: semester1Marks,
          semester2Marks: semester2Marks,
          semester1Total: calculateTotal(semester1Marks),
          semester2Total: calculateTotal(semester2Marks),
          overallTotal: calculateTotal(semester1Marks) + calculateTotal(semester2Marks),
          semester1Grade: getGrade(calculateTotal(semester1Marks)),
          semester2Grade: getGrade(calculateTotal(semester2Marks)),
          overallGrade: getGrade((calculateTotal(semester1Marks) + calculateTotal(semester2Marks)) / 2)
        });
      }
      
      const archive = new Archive({
        classId: cls._id,
        className: `${cls.grade}-${cls.section}`,
        grade: cls.grade,
        section: cls.section,
        subject: cls.subject?.name || 'General',
        subjectId: cls.subject?._id,
        academicYear: academicYear,
        archiveYear: archiveYear,
        students: studentData,
        totalStudents: studentData.length,
        archivedBy: 'System',
        archivedAt: new Date()
      });
      
      await archive.save();
      archivedCount++;
    }
    
    res.json({ 
      message: `Archived ${archivedCount} graduated classes`,
      archivedCount 
    });
  } catch (error) {
    console.error('Auto-archive error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
function calculateTotal(marks) {
  if (!marks) return 0;
  let total = 0;
  const examTypes = ['quiz', 'test', 'midterm', 'textbook', 'final'];
  for (const subject of Object.keys(marks)) {
    for (const exam of examTypes) {
      if (marks[subject]?.[exam]?.score) {
        total += marks[subject][exam].score;
      }
    }
  }
  return total;
}

function getGrade(total) {
  if (total >= 90) return 'A+';
  if (total >= 80) return 'A';
  if (total >= 75) return 'B+';
  if (total >= 70) return 'B';
  if (total >= 60) return 'C';
  if (total >= 50) return 'D';
  return 'F';
}

module.exports = router;