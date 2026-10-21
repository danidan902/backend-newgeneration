const User = require('../models/User');
const Class = require('../models/Class');

// Bulk create students
exports.bulkCreateStudents = async (req, res) => {
  try {
    const { students } = req.body;
    
    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ 
        error: 'Please provide an array of students' 
      });
    }

    const results = {
      successful: [],
      failed: [],
      total: students.length,
      summary: {
        successCount: 0,
        failedCount: 0
      }
    };

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      
      try {
        // Validate required fields
        if (!student.name || !student.email || !student.password) {
          results.failed.push({
            index: i,
            rollNumber: student.rollNumber || 'N/A',
            name: student.name || 'N/A',
            email: student.email || 'N/A',
            error: 'Missing required fields: name, email, or password'
          });
          continue;
        }

        // Check if email already exists
        const existingEmail = await User.findOne({ email: student.email });
        if (existingEmail) {
          results.failed.push({
            index: i,
            rollNumber: student.rollNumber || 'N/A',
            name: student.name,
            email: student.email,
            error: `Email ${student.email} already exists`
          });
          continue;
        }

        // Check if roll number already exists (if provided)
        if (student.rollNumber) {
          const existingRollNumber = await User.findOne({ 
            rollNumber: student.rollNumber 
          });
          if (existingRollNumber) {
            results.failed.push({
              index: i,
              rollNumber: student.rollNumber,
              name: student.name,
              email: student.email,
              error: `Roll number ${student.rollNumber} already exists`
            });
            continue;
          }
        }

        // Create student
        const newStudent = new User({
          name: student.name,
          email: student.email,
          password: student.password,
          role: 'student',
          rollNumber: student.rollNumber || null
        });

        await newStudent.save();
        
        results.successful.push({
          index: i,
          rollNumber: newStudent.rollNumber || 'N/A',
          name: newStudent.name,
          email: newStudent.email,
          id: newStudent._id
        });
        
      } catch (error) {
        results.failed.push({
          index: i,
          rollNumber: student.rollNumber || 'N/A',
          name: student.name || 'N/A',
          email: student.email || 'N/A',
          error: error.message
        });
      }
    }

    results.summary.successCount = results.successful.length;
    results.summary.failedCount = results.failed.length;

    // Log detailed errors to console for debugging
    if (results.failed.length > 0) {
      console.error('Bulk Upload Errors Details:');
      results.failed.forEach(failure => {
        console.error(`- Row ${failure.index + 1}: ${failure.error}`);
        console.error(`  Name: ${failure.name}, Email: ${failure.email}, Roll: ${failure.rollNumber}`);
      });
    }

    res.status(200).json({
      message: `Successfully created ${results.successful.length} out of ${results.total} students`,
      results
    });
    
  } catch (error) {
    console.error('Bulk create error:', error);
    res.status(500).json({ 
      error: 'Failed to process bulk student upload',
      details: error.message 
    });
  }
};

// Bulk assign students to class
exports.bulkAssignToClass = async (req, res) => {
  try {
    const { classId, students } = req.body;
    
    if (!classId) {
      return res.status(400).json({ error: 'Class ID is required' });
    }
    
    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ 
        error: 'Please provide an array of students' 
      });
    }

    // Check if class exists
    const classExists = await Class.findById(classId);
    if (!classExists) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const results = {
      successful: [],
      failed: [],
      total: students.length,
      summary: {
        successCount: 0,
        failedCount: 0
      }
    };

    for (let i = 0; i < students.length; i++) {
      const studentData = students[i];
      
      try {
        // Find student by roll number or email
        let student = null;
        
        if (studentData.rollNumber) {
          student = await User.findOne({ 
            rollNumber: studentData.rollNumber,
            role: 'student'
          });
        } else if (studentData.email) {
          student = await User.findOne({ 
            email: studentData.email,
            role: 'student'
          });
        } else if (studentData.studentId) {
          student = await User.findById(studentData.studentId);
        }

        if (!student) {
          results.failed.push({
            index: i,
            rollNumber: studentData.rollNumber || 'N/A',
            email: studentData.email || 'N/A',
            error: 'Student not found. Please check roll number or email.'
          });
          continue;
        }

        // Check if student is already assigned to this class
        const isAlreadyAssigned = classExists.students.some(
          id => id.toString() === student._id.toString()
        );
        
        if (isAlreadyAssigned) {
          results.failed.push({
            index: i,
            rollNumber: student.rollNumber || 'N/A',
            name: student.name,
            email: student.email,
            error: `Student is already assigned to this class`
          });
          continue;
        }


        // Assign student to class
        classExists.students.push(student._id);
        await classExists.save();
        
        results.successful.push({
          index: i,
          studentId: student._id,
          name: student.name,
          email: student.email,
          rollNumber: student.rollNumber || 'N/A'
        });
        
      } catch (error) {
        results.failed.push({
          index: i,
          rollNumber: studentData.rollNumber || 'N/A',
          email: studentData.email || 'N/A',
          error: error.message
        });
      }
    }

    results.summary.successCount = results.successful.length;
    results.summary.failedCount = results.failed.length;

    // Log detailed errors to console
    if (results.failed.length > 0) {
      console.error('Bulk Assignment Errors Details:');
      results.failed.forEach(failure => {
        console.error(`- Row ${failure.index + 1}: ${failure.error}`);
        if (failure.rollNumber !== 'N/A') console.error(`  Roll Number: ${failure.rollNumber}`);
        if (failure.email !== 'N/A') console.error(`  Email: ${failure.email}`);
      });
    }

    // Get updated class with populated students
    const updatedClass = await Class.findById(classId)
      .populate('students', 'name email rollNumber')
      .populate('teacherId', 'name email');

    res.status(200).json({
      message: `Successfully assigned ${results.successful.length} out of ${results.total} students to class`,
      results,
      class: updatedClass
    });
    
  } catch (error) {
    console.error('Bulk assign error:', error);
    res.status(500).json({ 
      error: 'Failed to process bulk assignment',
      details: error.message 
    });
  }
};

// Get detailed error report for a bulk operation
exports.getBulkOperationReport = async (req, res) => {
  try {
    const { operationId } = req.params;
    
    // You can implement storing bulk operation results in a separate collection
    // For now, return a template response
    res.status(200).json({
      operationId,
      message: 'Bulk operation completed',
      tips: [
        'Make sure roll numbers are unique',
        'Check that email addresses are valid',
        'Ensure students exist before assigning to class',
        'Download the error log for detailed information'
      ]
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};