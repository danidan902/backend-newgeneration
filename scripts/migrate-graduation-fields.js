const mongoose = require('mongoose');
const User = require('../models/User');

async function fixStudentData() {
  try {
    await mongoose.connect('mongodb+srv://danid93575_db_user:dani123456@cluster0.kskqnbz.mongodb.net/SchoolDB?retryWrites=true&w=majority&appName=Cluster0');
    
    console.log('🔧 Fixing student data...');
    
    // Fix all students - add missing academicStatus
    const result1 = await User.updateMany(
      { 
        role: 'student',
        academicStatus: { $exists: false }
      },
      { 
        $set: { 
          academicStatus: 'active',
          graduationYear: null,
          graduatedAt: null
        } 
      }
    );
    console.log(`✅ Added academicStatus to ${result1.modifiedCount} students`);
    
    // Fix students with grade "Grade 9" format
    const result2 = await User.updateMany(
      { 
        role: 'student',
        grade: { $regex: /^Grade /i }
      },
      [
        {
          $set: {
            grade: {
              $trim: {
                input: {
                  $arrayElemAt: [
                    { $split: ["$grade", " "] },
                    1
                  ]
                }
              }
            }
          }
        }
      ]
    );
    console.log(`✅ Fixed grade format for ${result2.modifiedCount} students`);
    
    // Ensure all active students have isActive = true
    const result3 = await User.updateMany(
      { 
        role: 'student',
        academicStatus: 'active',
        isActive: { $ne: true }
      },
      { 
        $set: { isActive: true } 
      }
    );
    console.log(`✅ Set isActive=true for ${result3.modifiedCount} students`);
    
    // Show current state
    const students = await User.find({ role: 'student' });
    console.log('\n📊 Current Student Data:');
    students.forEach(s => {
      console.log(`- ${s.name}: grade="${s.grade}", status="${s.academicStatus}", active=${s.isActive}`);
    });
    
    console.log('\n✅ Data fix completed!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixStudentData();