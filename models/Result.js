// models/Result.js (NEW - For final results)
const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  academicYear: {
    type: String,
    required: true
  },
  semester1Total: {
    type: Number,
    default: 0
  },
  semester2Total: {
    type: Number,
    default: 0
  },
  yearlyTotal: {
    type: Number,
    default: 0
  },
  percentage: {
    type: Number,
    default: 0
  },
  grade: {
    type: String,
    enum: ['A+', 'A', 'B+', 'B', 'C', 'D', 'F'],
    default: 'F'
  },
  certificateGenerated: {
    semester1: { type: Boolean, default: false },
    semester2: { type: Boolean, default: false },
    yearly: { type: Boolean, default: false }
  },
  certificateUrl: {
    semester1: String,
    semester2: String,
    yearly: String
  }
});

module.exports = mongoose.model('Result', resultSchema);