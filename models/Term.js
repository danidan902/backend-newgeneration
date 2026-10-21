// models/Term.js
const mongoose = require('mongoose');

const termSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: ['Semester 1', 'Semester 2']
  },
  academicYear: {
    type: String,
    required: true, // e.g., "2024-2025"
  },
  startDate: Date,
  endDate: Date,
  isActive: {
    type: Boolean,
    default: true
  }
});

module.exports = mongoose.model('Term', termSchema);