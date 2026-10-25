// utils/promoteStudents.js
const User = require('../models/User');

async function promoteStudentsToNextGrade(currentAcademicYear) {
  const session = await User.startSession();
  session.startTransaction();

  try {
    // 1. Get all active students
    const students = await User.find({
      role: 'student',
      academicStatus: 'active',
      isActive: true
    }).session(session);

    const promoted = [];
    const graduated = [];

    for (const student of students) {
      const currentGrade = parseInt(student.grade);
      
      // Handle Grade 12 students
      if (currentGrade === 12) {
        student.academicStatus = 'graduated';
        student.graduationYear = currentAcademicYear;
        student.isActive = false;  // Optional: deactivate account
        student.grade = null;       // Clear grade field
        graduated.push(student.name);
      } 
      // Handle Grades 1-11
      else if (currentGrade >= 1 && currentGrade < 12) {
        student.grade = String(currentGrade + 1);
        promoted.push(student.name);
      }
      // Grade is null/undefined or invalid - skip
      
      await student.save({ session });
    }

    await session.commitTransaction();
    
    return {
      success: true,
      promotedCount: promoted.length,
      graduatedCount: graduated.length,
      promotedStudents: promoted,
      graduatedStudents: graduated
    };
    
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

module.exports = promoteStudentsToNextGrade;