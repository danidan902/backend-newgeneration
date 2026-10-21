// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Name is required'],
    trim: true 
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true,
    lowercase: true,
    trim: true 
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'] 
  },
  role: { 
    type: String, 
    default: 'student',
    enum: ['student', 'admin', 'superadmin', 'teacher', 'parent']
  },
  
  // Student ID - MANUALLY INPUT by admin
  studentId: { 
    type: String,
    unique: true,
    sparse: true, // Allows null/undefined for non-students
    trim: true,
    uppercase: true,
    required: function() {
      return this.role === 'student'; // Required for students
    },
    validate: {
      validator: function(value) {
        if (this.role === 'student' && !value) {
          return false;
        }
        return true;
      },
      message: 'Student ID is required for students'
    }
  },
  
  // Keep rollNumber for other purposes
  rollNumber: { 
    type: String,
    trim: true,
    sparse: true
  },
  
  age: { 
    type: Number,
    min: 0
  },
  sex: { 
    type: String,
    enum: ['Male', 'Female', 'Other', '']
  },
  grade: { 
    type: String,
    default: null
  },
  programs: { 
    type: String 
  },
  section: { 
    type: String 
  },
  profileImage: { 
    type: String, 
    default: null 
  },
  relationship: { 
    type: String, 
    default: 'guardian' 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  isFirstLogin: { 
    type: Boolean, 
    default: true 
  },
  
  // Graduation Fields
  academicStatus: { 
    type: String, 
    enum: ['Active', 'Graduated', 'transferred', 'dropped'],
    default: 'Active'
  },
  graduationYear: { 
    type: Number,
    default: null
  },
  graduatedAt: {
    type: Date,
    default: null
  },
  
  parents: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
  needsPasswordChange: {
    type: Boolean,
    default: true
  },
  resetPasswordToken: { 
    type: String 
  },
  resetPasswordExpire: { 
    type: Date 
  },
  parentPhone: {
    type: String,
  },
});

// Pre-save hook - NO AUTO-GENERATION of studentId
userSchema.pre('save', function(next) {
  // Remove the auto-generation logic
  // Student ID must be provided manually
  
  this.updatedAt = Date.now();
  next();
});

// Pre-update hook for findByIdAndUpdate
userSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});

// Indexes for better performance
userSchema.index({ role: 1, academicStatus: 1, grade: 1 });
userSchema.index({ graduationYear: 1 });
userSchema.index({ studentId: 1 }); // Index for faster student login
userSchema.index({ email: 1 }); // Index for email login
userSchema.index({ rollNumber: 1 }); // Index for roll number

module.exports = mongoose.model('User', userSchema);