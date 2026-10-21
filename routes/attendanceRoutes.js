

const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Single attendance record
router.post('/attendance', authMiddleware, roleMiddleware(['teacher']), attendanceController.markAttendance);

// Bulk attendance records
router.post('/attendance/bulk', authMiddleware, roleMiddleware(['teacher']), attendanceController.markBulkAttendance);

// Get attendance by student ID
router.get('/attendance/student/:studentId', authMiddleware, attendanceController.getAttendanceByStudent);

// Get attendance by class with filters (startDate, endDate, subject)
router.get('/attendance/class/:classId', authMiddleware, roleMiddleware(['teacher', 'admin']), attendanceController.getAttendanceByClass);

// Get attendance by class and specific date
router.get('/attendance/class/:classId/date/:date', authMiddleware, roleMiddleware(['teacher', 'admin']), attendanceController.getAttendanceByClassAndDate);

// Update attendance record
router.put('/attendance/:id', authMiddleware, roleMiddleware(['teacher']), attendanceController.updateAttendance);

// Delete attendance record
router.delete('/attendance/:id', authMiddleware, roleMiddleware(['teacher']), attendanceController.deleteAttendance);

// In your attendanceRoutes.js
router.get('/attendance/student/:studentId', authMiddleware, attendanceController.getAttendanceByStudent);

module.exports = router;