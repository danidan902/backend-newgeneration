
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');

const seedAdmin = async () => {
  try {
    await mongoose.connect('mongodb+srv://danid93575_db_user:dani123456@cluster0.kskqnbz.mongodb.net/school_role?retryWrites=true&w=majority&appName=Cluster0');
    
    // Check if admin already exists
    const adminExists = await User.findOne({ email: 'admin@school.com' });
    
    if (!adminExists) {
      const admin = new User({
        name: 'System Administrator',
        email: 'admin@school.com',
        password: '123456',
        role: 'admin'
      });
      await admin.save();
      console.log('✅ Admin user created successfully!');
      console.log('Email: admin@school.com');
      console.log('Password: admin123');
    } else {
      console.log('⚠️ Admin already exists');
    }
    
    process.exit();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

seedAdmin();