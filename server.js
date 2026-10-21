const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require("bcryptjs");
const fs = require('fs');
const multer = require('multer');
const cloudnary = require('cloudinary').v2;
// const path = require('path');
const router = express.Router()




dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Import models
const User = require('./models/User');
const Message = require('./models/Message');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const classRoutes = require('./routes/classRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const authRoutesNews = require('./routes/newsRoutes');
const marksRoutes = require('./routes/marksRoutes');
const promotionRoutes = require('./routes/promotionRoutes');
const archiveRoutes = require('./routes/archiveRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

// Register routes
app.use('/api/promotions', promotionRoutes);
app.use('/api/verify', require('./routes/verification'));
// ========== AUTH MIDDLEWARE ==========
const authMiddleware = (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  console.log('🔐 Auth Middleware');
  console.log('Token exists:', !!token);
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'my_test_secret_key_12345');
    console.log('📦 Decoded token:', decoded);
    
    req.user = decoded;
    req.userId = decoded.userId || decoded.id;
    req.userRole = decoded.role;
    req.userEmail = decoded.email;
    
    console.log('✅ Set userId:', req.userId);
    console.log('✅ Set userRole:', req.userRole);
    
    next();
  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

cloudnary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});


// ========== ROUTES ==========
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/classes', classRoutes);
app.use('/api', attendanceRoutes);
app.use('/api/marks', marksRoutes);
app.use('/api/news', authRoutesNews);
app.use('/api/settings', settingsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/payments', paymentRoutes);

// In your server.js or app.js

app.use('/api', archiveRoutes);
// ========== PARENT MANAGEMENT ROUTES ==========

// Get all students for parent linking
app.get('/api/users/role/student', authMiddleware, async (req, res) => {
  console.log('📋 GET /api/users/role/student');
  try {
    const students = await User.find({ role: 'student' })
      .select('name email rollNumber grade section');
    console.log(`Found ${students.length} students`);
    res.json(students);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});





app.get('/api/superadmin/parents', authMiddleware, async (req, res) => {
  console.log('📋 GET /api/superadmin/parents');
  try {
    // Get all parents from User collection
    const parents = await User.find({ role: 'parent' }).sort({ createdAt: -1 });
    console.log(`Found ${parents.length} parents`);
    
    const parentsWithStudents = await Promise.all(
      parents.map(async (parent) => {
        // Find ALL students first to debug
        const allStudents = await User.find({ role: 'student' });
        console.log(`Total students in DB: ${allStudents.length}`);
        
        // Method 1: Find students where parents array contains this parent's ID (as string comparison)
        const linkedStudents = await User.find({
          role: 'student',
          parents: parent._id  // Direct comparison without $in
        }).select('name rollNumber grade section email programs');
        
        console.log(`Parent ${parent.name} (${parent._id}) has ${linkedStudents.length} linked students`);
        
        // Debug: Check if student has parents array
        if (linkedStudents.length === 0) {
          // Check all students to see if any have parents
          const studentsWithParents = await User.find({ 
            role: 'student', 
            parents: { $exists: true, $ne: [] } 
          });
          console.log(`Students with parents array: ${studentsWithParents.length}`);
          
          if (studentsWithParents.length > 0) {
            studentsWithParents.forEach(s => {
              console.log(`  Student ${s.name} has parents: ${s.parents}`);
            });
          }
        }
        
        return {
          _id: parent._id,
          name: parent.name,
          email: parent.email,
          phone: parent.phone || '',
          relationship: parent.relationship || 'guardian',
          isActive: parent.isActive !== false,
          students: linkedStudents
        };
      })
    );
    
    res.json({ success: true, data: parentsWithStudents });
  } catch (error) {
    console.error('Error fetching parents:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create parent
app.post('/api/superadmin/create-parent', authMiddleware, async (req, res) => {
  console.log('🔥 POST /api/superadmin/create-parent');
  try {
    const { name, email, password, phone, relationship } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password required' });
    }
    
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const parent = new User({
      name,
      email,
      password: hashedPassword,
      role: 'parent',
      phone: phone || '',
      relationship: relationship || 'guardian',
      isActive: true,
      isFirstLogin: true
    });
    
    await parent.save();
    
    console.log(`✅ Parent created: ${name} (${email})`);
    
    res.status(201).json({
      success: true,
      data: { 
        parent: { 
          id: parent._id, 
          name: parent.name, 
          email: parent.email, 
          password: password 
        } 
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Link parent to student - FIXED (adds to User model)
app.post('/api/admin/link-parent-student', authMiddleware, async (req, res) => {
  console.log('='.repeat(50));
  console.log('🔗 LINK PARENT TO STUDENT');
  console.log('Parent ID:', req.body.parentId);
  console.log('Student ID:', req.body.studentId);
  
  try {
    const { parentId, studentId } = req.body;
    
    if (!parentId || !studentId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Parent ID and Student ID are required' 
      });
    }
    
    const parent = await User.findOne({ _id: parentId, role: 'parent' });
    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent not found' });
    }
    console.log('✅ Parent found:', parent.name);
    
    const student = await User.findOne({ _id: studentId, role: 'student' });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    console.log('✅ Student found:', student.name);
    
    if (!student.parents) {
      student.parents = [];
    }
    
    if (student.parents.includes(parentId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Parent already linked to this student' 
      });
    }
    
    student.parents.push(parentId);
    await student.save();
    
    console.log(`✅ Successfully linked ${parent.name} to ${student.name}`);
    console.log(`Student ${student.name} now has ${student.parents.length} parent(s)`);
    
    res.json({
      success: true,
      message: `Successfully linked ${parent.name} to ${student.name}`
    });
  } catch (error) {
    console.error('Link error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Unlink parent from student - FIXED
app.delete('/api/admin/unlink-parent-student', authMiddleware, async (req, res) => {
  console.log('🔗 UNLINK PARENT FROM STUDENT');
  try {
    const { parentId, studentId } = req.body;
    
    await User.findByIdAndUpdate(studentId, { $pull: { parents: parentId } });
    
    console.log(`✅ Unlinked successfully`);
    res.json({ success: true, message: 'Parent unlinked successfully' });
  } catch (error) {
    console.error('Unlink error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reset parent password
app.post('/api/superadmin/parent/:id/reset-password', authMiddleware, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await User.findByIdAndUpdate(req.params.id, { 
      password: hashedPassword, 
      isFirstLogin: true 
    });
    
    console.log(`✅ Password reset for parent: ${req.params.id}`);
    res.json({ success: true, message: 'Password reset successfully', newPassword });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete parent - FIXED
app.delete('/api/superadmin/parent/:id', authMiddleware, async (req, res) => {
  try {
    const parent = await User.findOne({ _id: req.params.id, role: 'parent' });
    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent not found' });
    }
    
    await User.updateMany(
      { role: 'student', parents: parent._id }, 
      { $pull: { parents: parent._id } }
    );
    
    await User.findByIdAndDelete(req.params.id);
    
    console.log(`✅ Deleted parent: ${parent.name}`);
    res.json({ success: true, message: 'Parent deleted successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get parent's children
app.get('/api/parent/children', authMiddleware, async (req, res) => {
  console.log('👨‍👩‍👧 GET PARENT CHILDREN');
  console.log('Parent ID:', req.userId);
  
  try {
    const parent = await User.findById(req.userId);
    if (!parent || parent.role !== 'parent') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Parent account required.' 
      });
    }
    
    const children = await User.find({ 
      role: 'student', 
      parents: parent._id 
    }, 'name email rollNumber grade section');
    
    console.log(`Found ${children.length} children for ${parent.name}`);
    
    res.json({
      success: true,
      children: children
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Fetch parent password by email or phone
app.post('/api/superadmin/fetch-parent-password', authMiddleware, async (req, res) => {
  console.log('🔑 FETCH PARENT PASSWORD');
  
  try {
    const { email, phone } = req.body;
    
    if (!email && !phone) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide either email or phone number' 
      });
    }
    
    let query = { role: 'parent' };
    if (email) query.email = email;
    if (phone) query.phone = phone;
    
    const parent = await User.findOne(query);
    
    if (!parent) {
      return res.status(404).json({ 
        success: false, 
        message: 'Parent not found with provided email or phone' 
      });
    }
    
    res.json({
      success: true,
      message: 'Password fetched successfully',
      password: parent.password,
      parent: {
        name: parent.name,
        email: parent.email,
        phone: parent.phone
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});



// Debug endpoint - Check all students and their parents
app.get('/api/debug/students-parents', authMiddleware, async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }, 'name parents');
    const parents = await User.find({ role: 'parent' }, 'name');
    
    res.json({
      students: students.map(s => ({
        name: s.name,
        parentsCount: s.parents?.length || 0,
        parentIds: s.parents || []
      })),
      parents: parents.map(p => p.name)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// Debug endpoint - Check all students and their parents array
app.get('/api/debug/all-students', authMiddleware, async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }, 'name parents');
    const parents = await User.find({ role: 'parent' }, 'name');
    
    const result = {
      totalStudents: students.length,
      totalParents: parents.length,
      students: students.map(s => ({
        name: s.name,
        hasParentsArray: !!s.parents,
        parentsCount: s.parents?.length || 0,
        parents: s.parents || []
      })),
      parents: parents.map(p => p.name)
    };
    
    console.log('Debug result:', JSON.stringify(result, null, 2));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});











// ========== NEWS ROUTES ==========
let newsDatabase = [];
let currentId = 1;

app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!' });
});

app.post('/api/news', (req, res) => {
  const { title, content, targetRoles } = req.body;
  const newNews = {
    _id: currentId++,
    title,
    content,
    targetRoles,
    sentBy: { name: 'Super Admin', role: 'super_admin' },
    readBy: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
  newsDatabase.push(newNews);
  res.status(201).json({ success: true, data: newNews });
});

app.get('/api/news/all', (req, res) => {
  res.json({ success: true, data: newsDatabase });
});

app.get('/api/news', (req, res) => {
  const { role } = req.query;
  const filteredNews = newsDatabase.filter(news => news.targetRoles.includes(role || 'student'));
  res.json({ success: true, data: filteredNews });
});

app.delete('/api/news/:id', (req, res) => {
  const id = parseInt(req.params.id);
  newsDatabase = newsDatabase.filter(news => news._id !== id);
  res.json({ success: true, message: 'News deleted successfully' });
});

app.put('/api/news/:id/read', (req, res) => {
  const id = parseInt(req.params.id);
  const { userId } = req.body;
  const news = newsDatabase.find(n => n._id === id);
  if (news && userId) {
    const alreadyRead = news.readBy.some(r => r.user === userId);
    if (!alreadyRead) {
      news.readBy.push({ user: userId, readAt: new Date() });
    }
  }
  res.json({ success: true, data: news });
});

// ========== SOCKET.IO ==========
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.get("/messages", async (req, res) => {
  const messages = await Message.find().sort({ createdAt: 1 });
  res.json(messages);
});

io.on("connection", (socket) => {
  console.log("User connected");
  socket.on("send_message", async (data) => {
    const msg = new Message(data);
    await msg.save();
    io.emit("receive_message", msg);
  });
  socket.on("disconnect", () => console.log("User disconnected"));
});

// ========== DATABASE CONNECTION ==========


const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 6000, // Timeout after 5 seconds
    });
    console.log("✅ Connected to MongoDB Atlas");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    console.log("Please check your connection string or network");
  }
};

connectDB();




const createAdmin = async () => {
  const existingAdmin = await User.findOne({ role: "superadmin" });
  if (existingAdmin) {
    console.log("⚠️ Super Admin already exists");
    return;
  }
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const admin = new User({
    name: "Super Admin",
    email: "danid93575@gmail.com",
    password: hashedPassword,
    role: "superadmin"
  });
  await admin.save();
  console.log("✅ Super Admin created");
};

createAdmin();







const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads/receipts';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `receipt-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, GIF, WEBP, and PDF are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter
});








// Upload receipt endpoint





// ========== START SERVER ==========
const PORT = 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Endpoints:`);
  console.log(`   GET    /api/users/role/student`);
  console.log(`   GET    /api/superadmin/parents`);
  console.log(`   POST   /api/superadmin/create-parent`);
  console.log(`   POST   /api/admin/link-parent-student`);
  console.log(`   DELETE /api/admin/unlink-parent-student`);
});