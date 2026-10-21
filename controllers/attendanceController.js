
const Attendance = require('../models/Attendance');

// Single attendance record
exports.markAttendance = async (req, res) => {
  try {
    const { studentId, classId, status, date, subject } = req.body;
    const teacherId = req.userId;
    
    if (!studentId || !classId || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const existingAttendance = await Attendance.findOne({
      studentId,
      classId,
      date: new Date(date),
      subject: subject
    });
    
    if (existingAttendance) {
      existingAttendance.status = status;
      existingAttendance.teacherId = teacherId;
      await existingAttendance.save();
      return res.json(existingAttendance);
    }
    
    const attendance = new Attendance({
      studentId,
      classId,
      status,
      teacherId,
      subject: subject || 'General',
      date: date || new Date()
    });
    
    await attendance.save();
    res.status(201).json(attendance);
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Bulk attendance records
exports.markBulkAttendance = async (req, res) => {
  try {
    const { records } = req.body;
    const teacherId = req.userId;
    
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Invalid records data' });
    }
    
    const results = {
      successful: [],
      failed: []
    };
    
    for (const record of records) {
      try {
        const { studentId, classId, status, date, subject } = record;
        
        if (!studentId || !classId || !status) {
          results.failed.push({ record, error: 'Missing required fields' });
          continue;
        }
        
        const existingAttendance = await Attendance.findOne({
          studentId,
          classId,
          date: new Date(date),
          subject: subject
        });
        
        if (existingAttendance) {
          existingAttendance.status = status;
          existingAttendance.teacherId = teacherId;
          await existingAttendance.save();
          results.successful.push(existingAttendance);
        } else {
          const attendance = new Attendance({
            studentId,
            classId,
            status,
            teacherId,
            subject: subject || 'General',
            date: date || new Date()
          });
          
          await attendance.save();
          results.successful.push(attendance);
        }
      } catch (error) {
        results.failed.push({ record, error: error.message });
      }
    }
    
    res.status(200).json({
      message: `Processed ${results.successful.length} of ${records.length} records`,
      results
    });
  } catch (error) {
    console.error('Bulk attendance error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get attendance by student ID
exports.getAttendanceByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }
    
    const attendance = await Attendance.find({ studentId })
      .populate('classId', 'grade section subject')
      .sort({ date: -1 });
    
    res.json(attendance);
  } catch (error) {
    console.error('Get student attendance error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get attendance by class with filters
exports.getAttendanceByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { startDate, endDate, subject } = req.query;
    
    if (!classId) {
      return res.status(400).json({ error: 'Class ID is required' });
    }
    
    const query = { classId };
    
    // Add date range filter
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }
    
    // Add subject filter
    if (subject) {
      query.subject = subject;
    }
    
    const attendance = await Attendance.find(query)
      .populate('studentId', 'name email rollNumber')
      .sort({ date: -1 });
    
    res.json(attendance);
  } catch (error) {
    console.error('Get class attendance error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get attendance by class and specific date
exports.getAttendanceByClassAndDate = async (req, res) => {
  try {
    const { classId, date } = req.params;
    
    if (!classId || !date) {
      return res.status(400).json({ error: 'Class ID and date are required' });
    }
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const attendance = await Attendance.find({
      classId,
      date: { $gte: startOfDay, $lte: endOfDay }
    }).populate('studentId', 'name email rollNumber');
    
    res.json(attendance);
  } catch (error) {
    console.error('Get attendance by date error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update attendance record
exports.updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const teacherId = req.userId;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    const attendance = await Attendance.findById(id);
    
    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }
    
    // Check if the teacher owns this record
    if (attendance.teacherId.toString() !== teacherId) {
      return res.status(403).json({ error: 'You are not authorized to edit this record' });
    }
    
    attendance.status = status;
    await attendance.save();
    
    res.json(attendance);
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete attendance record
exports.deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const teacherId = req.userId;
    
    const attendance = await Attendance.findById(id);
    
    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }
    
    // Check if the teacher owns this record
    if (attendance.teacherId.toString() !== teacherId) {
      return res.status(403).json({ error: 'You are not authorized to delete this record' });
    }
    
    await Attendance.findByIdAndDelete(id);
    
    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    console.error('Delete attendance error:', error);
    res.status(500).json({ error: error.message });
  }
};