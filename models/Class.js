const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  program: {
    type: String,
  },
  grade: {
    type: String,
    required: true
  },
  section: {
    type: String,
    required: true
  },
  classTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  subjects: [
    {
      name: {
        type: String,
        required: true
      },
      teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      }
    }
  ],
  students: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  ],
  academicStatus: {
    type: String,
    enum: ['Active', 'Graduated'],
    default: 'Active'
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Class', classSchema);