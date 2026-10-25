

const mongoose = require('mongoose');

const marksSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  examType: {
    type: String,
    enum: ['quiz', 'test', 'midterm', 'assignment', 'final'],
    default: 'quiz'
  },
  score: {
    type: Number,
    required: true,
    min: 0
  },
  maxScore: {
    type: Number,
    default: 100
  },
  remarks: {
    type: String,
    default: ''
  },
  semester: {
    type: String,
    enum: ['Semester 1', 'Semester 2'],
    default: 'Semester 1'
  },
  academicYear: {
    type: String,
    default: '2024-2025'
  }
}, { timestamps: true });

module.exports = mongoose.models.Marks || mongoose.model('Marks', marksSchema);