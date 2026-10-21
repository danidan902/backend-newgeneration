const User = require('../models/User');
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const sendEmail = require("../utils/sendEmail");
const fs = require('fs');
const path = require('path');

// 👑 GET ALL USERS
exports.getAllUsers = async (req, res) => {
  try {
    let users;

    // 👑 Super Admin → full access
    if (req.userRole === 'superadmin') {
      users = await User.find();
    }

    // 🧑‍💼 Admin → cannot see superadmin
    else if (req.userRole === 'admin') {
      users = await User.find({ role: { $ne: 'superadmin' } });
    }

    // 👨‍🏫 others
    else {
      users = await User.find();
    }

    res.json(users);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 👑 GET USERS BY ROLE
exports.getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;

    // ❌ block access to superadmin for non-superadmin
    if (role === 'superadmin' && req.userRole !== 'superadmin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const users = await User.find({ role });

    res.json(users);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 👤 CREATE USER (with password hashing and profile image)
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, rollNumber, sex, grade, programs, section, parentPhone, age } = req.body;

    // ❌ only superadmin can create admin
    if (role === 'admin' && req.userRole !== 'superadmin') {
      return res.status(403).json({ error: 'Only Super Admin can create Admin' });
    }

    // ❌ no one can create superadmin
    if (role === 'superadmin') {
      return res.status(403).json({ error: 'Cannot create Super Admin' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash the password before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Prepare user data
    const userData = {
      name,
      email,
      password: hashedPassword,
      role,
      sex: sex || '',
      programs: programs || '',
      grade: grade || '',
      section: section || '',
      rollNumber: rollNumber || '',
      age: age || null,
      parentPhone: parentPhone || ''
    };

    // Add profile image if uploaded
    if (req.file) {
      const imageUrl = `/uploads/profile-images/${req.file.filename}`;
      userData.profileImage = imageUrl;
    }

    const user = new User(userData);
    await user.save();

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      message: 'User created successfully',
      user: userResponse
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 📸 UPLOAD PROFILE IMAGE
exports.uploadProfileImage = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const imageUrl = `/uploads/profile-images/${req.file.filename}`;
    
    // Get user to delete old image
    const user = await User.findById(userId);
    
    if (!user) {
      // Delete uploaded file if user not found
      const filePath = path.join(__dirname, '..', imageUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check permissions
    if (req.userRole !== 'superadmin' && req.userRole !== 'admin' && req.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Delete old profile image if exists
    if (user.profileImage) {
      const oldImagePath = path.join(__dirname, '..', user.profileImage);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }
    
    // Update user with new profile image
    user.profileImage = imageUrl;
    user.updatedAt = Date.now();
    await user.save();
    
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.status(200).json({ 
      message: 'Profile image uploaded successfully',
      profileImage: imageUrl,
      user: userResponse
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🗑️ REMOVE PROFILE IMAGE
exports.removeProfileImage = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check permissions
    if (req.userRole !== 'superadmin' && req.userRole !== 'admin' && req.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Delete image file
    if (user.profileImage) {
      const imagePath = path.join(__dirname, '..', user.profileImage);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    // Remove image reference from database
    user.profileImage = null;
    user.updatedAt = Date.now();
    await user.save();
    
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.status(200).json({ 
      message: 'Profile image removed successfully',
      user: userResponse
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✏️ UPDATE USER
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Check permissions
    if (req.userRole !== 'superadmin' && req.userRole !== 'admin' && req.userId !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // If password is being updated, hash it
    if (updates.password) {
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(updates.password, salt);
    }

    updates.updatedAt = Date.now();

    const user = await User.findByIdAndUpdate(id, updates, { new: true }).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ❌ DELETE USER (with profile image cleanup)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // ❌ admin cannot delete admin/superadmin
    if (
      req.userRole === 'admin' &&
      (user.role === 'admin' || user.role === 'superadmin')
    ) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // ❌ no one deletes superadmin
    if (user.role === 'superadmin') {
      return res.status(403).json({ error: 'Cannot delete Super Admin' });
    }

    // Delete profile image if exists
    if (user.profileImage) {
      const imagePath = path.join(__dirname, '..', user.profileImage);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await User.findByIdAndDelete(id);

    res.json({ message: 'User deleted successfully' });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🔐 RESET STUDENT PASSWORD (with hashing)
exports.resetStudentPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!['admin', 'superadmin'].includes(req.userRole)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await User.findById(id);

    if (!user || user.role !== 'student') {
      return res.status(400).json({ error: 'Only student allowed' });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.updatedAt = Date.now();
    await user.save();

    res.json({ message: 'Password reset successful' });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🔐 FORGOT PASSWORD
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");

      const hashedToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

      await user.save();

      const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

      await sendEmail(
        user.email,
        "Password Reset",
        `Click this link to reset your password:\n\n${resetUrl}`
      );
    }

    return res.json({
      message: "If this email exists, a reset link has been sent."
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 🔁 RESET PASSWORD (BY TOKEN)
exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        error: "Invalid or expired token"
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.updatedAt = Date.now();

    await user.save();

    res.json({ message: "Password reset successful" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 👤 GET SINGLE USER BY ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check permissions
    if (req.userRole !== 'superadmin' && req.userRole !== 'admin' && req.userId !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;
    
    res.json(userResponse);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 📊 GET USER STATISTICS
exports.getUserStats = async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalTeachers = await User.countDocuments({ role: 'teacher' });
    const totalAdmins = await User.countDocuments({ role: 'admin' });
    const totalSuperAdmins = await User.countDocuments({ role: 'superadmin' });
    
    const maleStudents = await User.countDocuments({ role: 'student', sex: 'Male' });
    const femaleStudents = await User.countDocuments({ role: 'student', sex: 'Female' });
    
    const gradeDistribution = await User.aggregate([
      { $match: { role: 'student', grade: { $exists: true, $ne: '' } } },
      { $group: { _id: '$grade', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    res.json({
      totalStudents,
      totalTeachers,
      totalAdmins,
      totalSuperAdmins,
      maleStudents,
      femaleStudents,
      gradeDistribution
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};