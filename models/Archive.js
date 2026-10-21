// models/Archive.js
const mongoose = require('mongoose');

const archiveSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  className: { type: String, required: true },
  grade: { type: String, required: true },
  section: { type: String, required: true },
  subject: { type: String, required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  academicYear: { type: String, required: true },
  archiveYear: { type: String, required: true },
  students: [{
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    rollNumber: String,
    sex: String,
    age: Number,
    email: String,
    phone: String,
    profileImage: String,
    semester1Marks: mongoose.Schema.Types.Mixed,
    semester2Marks: mongoose.Schema.Types.Mixed,
    semester1Total: Number,
    semester2Total: Number,
    overallTotal: Number,
    semester1Grade: String,
    semester2Grade: String,
    overallGrade: String
  }],
  totalStudents: { type: Number, default: 0 },
  archivedBy: { type: String, default: 'System' },
  archivedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Archive', archiveSchema);