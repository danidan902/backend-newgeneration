

const Marks = require('../models/Marks');

// Add marks
exports.addMarks = async (req, res) => {
  try {
    const { 
      studentId, classId, subject, examType, score, 
      semester, academicYear, maxScore 
    } = req.body;
    
    const teacherId = req.userId;
    
    if (!teacherId) {
      return res.status(401).json({ error: 'Teacher not authenticated' });
    }
    
    // Find existing mark
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
    res.status(500).json({ error: error.message });
  }
};

// Get marks by student - FIXED to accept query params
exports.getMarksByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { semester, subject, academicYear } = req.query;
    
    console.log('=== GET MARKS BY CLASS ===');
    console.log('classId:', classId);
    console.log('semester:', semester);
    console.log('academicYear:', academicYear);
    console.log('subject:', subject);
    
    let query = { classId };
    
    // Add subject filter
    if (subject && subject !== 'undefined' && subject !== 'null') {
      query.subject = subject;
    }
    
    // 🔥 CRITICAL: Add semester filter
    if (semester && semester !== 'undefined' && semester !== 'null') {
      query.semester = semester;
    } else {
      // Default to Semester 1 if not specified
      query.semester = 'Semester 1';
    }
    
    // Add academic year filter
    if (academicYear && academicYear !== 'undefined' && academicYear !== 'null') {
      query.academicYear = academicYear;
    } else {
      query.academicYear = '2024-2025';
    }
    
    console.log('Final MongoDB query:', JSON.stringify(query, null, 2));
    
    const marks = await Marks.find(query)
      .populate('studentId', 'name email rollNumber')
      .populate('teacherId', 'name');
    
    console.log(`Found ${marks.length} marks for query`);
    
    res.json(marks);
  } catch (error) {
    console.error('Error in getMarksByClass:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get marks by student with proper semester filtering
exports.getMarksByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { semester, academicYear } = req.query;
    
    console.log('=== GET MARKS BY STUDENT ===');
    console.log('studentId:', studentId);
    console.log('semester:', semester);
    console.log('academicYear:', academicYear);
    
    let query = { studentId };
    
    // 🔥 CRITICAL: Add semester filter
    if (semester && semester !== 'undefined' && semester !== 'null') {
      query.semester = semester;
    }
    
    // Add academic year filter
    if (academicYear && academicYear !== 'undefined' && academicYear !== 'null') {
      query.academicYear = academicYear;
    }
    
    const marks = await Marks.find(query)
      .populate('teacherId', 'name')
      .populate('classId');
    
    res.json(marks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update mark
exports.updateMarks = async (req, res) => {
  try {
    const { id } = req.params;
    const mark = await Marks.findByIdAndUpdate(id, req.body, { new: true });
    if (!mark) return res.status(404).json({ error: 'Mark not found' });
    res.json({ success: true, data: mark });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete mark
exports.deleteMarks = async (req, res) => {
  try {
    const mark = await Marks.findByIdAndDelete(req.params.id);
    if (!mark) return res.status(404).json({ error: 'Mark not found' });
    res.json({ success: true, message: 'Mark deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get Semester 1 marks
exports.getSemester1Marks = async (req, res) => {
  try {
    const { studentId } = req.params;
    const marks = await Marks.find({ 
      studentId, 
      semester: 'Semester 1' 
    });
    res.json({ success: true, data: marks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get Semester 2 marks
exports.getSemester2Marks = async (req, res) => {
  try {
    const { studentId } = req.params;
    const marks = await Marks.find({ 
      studentId, 
      semester: 'Semester 2' 
    });
    res.json({ success: true, data: marks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get Final Result
exports.getFinalResult = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { academicYear } = req.query;
    const year = academicYear || '2024-2025';
    
    const sem1Marks = await Marks.find({ studentId, semester: 'Semester 1', academicYear: year });
    const sem2Marks = await Marks.find({ studentId, semester: 'Semester 2', academicYear: year });
    
    const allSubjects = new Set();
    sem1Marks.forEach(m => allSubjects.add(m.subject));
    sem2Marks.forEach(m => allSubjects.add(m.subject));
    
    const results = Array.from(allSubjects).map(subject => {
      const sem1Avg = sem1Marks.filter(m => m.subject === subject).reduce((sum, m) => sum + m.score, 0) / 
                      (sem1Marks.filter(m => m.subject === subject).length || 1);
      const sem2Avg = sem2Marks.filter(m => m.subject === subject).reduce((sum, m) => sum + m.score, 0) / 
                      (sem2Marks.filter(m => m.subject === subject).length || 1);
      
      return {
        subject,
        semester1: sem1Avg.toFixed(2),
        semester2: sem2Avg.toFixed(2),
        final: ((sem1Avg + sem2Avg) / 2).toFixed(2)
      };
    });
    
    res.json({ success: true, subjects: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};