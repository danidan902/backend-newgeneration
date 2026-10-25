// // backend/models/Student.js
// const mongoose = require('mongoose');

// const studentSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   email: { type: String, required: true, unique: true },
//   sex: { type: String },
//   password: { type: String, required: true },
//   role: { type: String, default: 'student' },
//   rollNumber: { type: String, unique: true, sparse: true },
//   classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
//   // ✅ THIS MUST EXIST
//   parents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
//   grade: { type: String },
//   section: { type: String },
//   programs: { type: String },
//   isActive: { type: Boolean, default: true },
//   createdAt: { type: Date, default: Date.now }
// });

// module.exports = mongoose.model('Student', studentSchema);