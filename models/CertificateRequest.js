const mongoose = require('mongoose');

const certificateRequestSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  studentName: { type: String, required: true },
  classId: { type: String, required: true },
  className: { type: String, required: true },
  semester: { type: String, required: true },
  academicYear: { type: String, default: '2024-2025' },
  certificateType: { type: String, default: 'semester' },
  status: { type: String, default: 'pending_review' },
  overallAverage: { type: Number, default: 0 },
  totalMarks: { type: Number, default: 0 },
  subjectsList: { type: Array, default: [] },
  requestedBy: { type: String },
  requestedByRole: { type: String },
  requestedAt: { type: Date, default: Date.now },
  reviewedBy: { type: String },
  reviewedAt: Date,
  approvedBy: { type: String },
  approvedAt: Date,
  certificateNumber: { type: String }
});

// Don't use ref if User model doesn't exist yet
module.exports = mongoose.model('CertificateRequest', certificateRequestSchema);