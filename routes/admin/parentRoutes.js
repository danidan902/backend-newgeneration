// // backend/routes/admin/parentRoutes.js
// const express = require('express');
// const router = express.Router();
// const User = require('../../models/User');
// const Student = require('../../models/Student');
// const { authMiddleware, roleMiddleware } = require('../../middleware/auth');

// // ✅ CREATE PARENT
// router.post('/superadmin/create-parent', authMiddleware, roleMiddleware(['superadmin']), async (req, res) => {
//   console.log('🔥 CREATE PARENT:', req.body);
  
//   try {
//     const { name, email, password, phone, address, relationship, studentIds } = req.body;
    
//     if (!name || !email || !password) {
//       return res.status(400).json({ success: false, message: 'Name, email and password required' });
//     }
    
//     const existing = await User.findOne({ email });
//     if (existing) {
//       return res.status(400).json({ success: false, message: 'Email already exists' });
//     }
    
//     const parent = new User({
//       name, email, password, role: 'parent',
//       phone: phone || '', address: address || '',
//       relationship: relationship || 'guardian',
//       isActive: true, isFirstLogin: true
//     });
    
//     await parent.save();
    
//     if (studentIds && studentIds.length > 0) {
//       await Student.updateMany(
//         { _id: { $in: studentIds } },
//         { $addToSet: { parents: parent._id } }
//       );
//     }
    
//     res.status(201).json({
//       success: true,
//       message: 'Parent created successfully',
//       data: {
//         parent: { id: parent._id, name: parent.name, email: parent.email, password, role: parent.role },
//         linkedStudents: studentIds || []
//       }
//     });
//   } catch (error) {
//     console.error('Error:', error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

// // ✅ GET ALL PARENTS
// router.get('/superadmin/parents', authMiddleware, roleMiddleware(['superadmin']), async (req, res) => {
//   console.log('📋 GET ALL PARENTS');
  
//   try {
//     const parents = await User.find({ role: 'parent' }).sort({ createdAt: -1 });
    
//     const parentsWithStudents = await Promise.all(
//       parents.map(async (parent) => {
//         const students = await Student.find({ parents: parent._id }, 'name rollNumber classId').populate('classId', 'name');
//         return {
//           _id: parent._id, name: parent.name, email: parent.email,
//           phone: parent.phone, relationship: parent.relationship,
//           isActive: parent.isActive, students
//         };
//       })
//     );
    
//     res.json({ success: true, data: parentsWithStudents });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

// // ✅ LINK PARENT TO STUDENT
// router.post('/admin/link-parent-student', authMiddleware, roleMiddleware(['admin', 'superadmin']), async (req, res) => {
//   try {
//     const { parentId, studentId } = req.body;
    
//     const parent = await User.findOne({ _id: parentId, role: 'parent' });
//     if (!parent) return res.status(404).json({ success: false, message: 'Parent not found' });
    
//     const student = await Student.findById(studentId);
//     if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    
//     await Student.findByIdAndUpdate(studentId, { $addToSet: { parents: parentId } });
    
//     res.json({ success: true, message: `Linked ${parent.name} to ${student.name}` });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

// // ✅ UNLINK PARENT FROM STUDENT
// router.delete('/admin/unlink-parent-student', authMiddleware, roleMiddleware(['admin', 'superadmin']), async (req, res) => {
//   try {
//     const { parentId, studentId } = req.body;
//     await Student.findByIdAndUpdate(studentId, { $pull: { parents: parentId } });
//     res.json({ success: true, message: 'Parent unlinked successfully' });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

// // ✅ RESET PASSWORD
// router.post('/superadmin/parent/:id/reset-password', authMiddleware, roleMiddleware(['superadmin']), async (req, res) => {
//   try {
//     const { newPassword } = req.body;
//     await User.findByIdAndUpdate(req.params.id, { password: newPassword, isFirstLogin: true });
//     res.json({ success: true, message: 'Password reset successfully', newPassword });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

// // ✅ DELETE PARENT
// router.delete('/superadmin/parent/:id', authMiddleware, roleMiddleware(['superadmin']), async (req, res) => {
//   try {
//     const parent = await User.findOne({ _id: req.params.id, role: 'parent' });
//     if (!parent) return res.status(404).json({ success: false, message: 'Parent not found' });
    
//     await Student.updateMany({ parents: parent._id }, { $pull: { parents: parent._id } });
//     await User.findByIdAndDelete(req.params.id);
    
//     res.json({ success: true, message: 'Parent deleted successfully' });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

// module.exports = router;