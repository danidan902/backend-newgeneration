// server.js — Full corrected version
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const app = express();

// ═══════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════

// CORS — must run before all routes
app.use(
  cors({
    origin: [
      'https://tuludimtuschoolerp.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001',
      /^https:\/\/.*\.vercel\.app$/,
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.options('*', cors());

// Body parsers with generous limit for uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads folder (for legacy local files)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ═══════════════════════════════════════════════
// HEALTH CHECK — use this to verify the deploy
// ═══════════════════════════════════════════════
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    time: Date.now(),
    env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5000,
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    cloudinary: process.env.CLOUDINARY_CLOUD_NAME ? 'configured' : 'MISSING',
  });
});

// ═══════════════════════════════════════════════
// MODELS
// ═══════════════════════════════════════════════
const User = require('./models/User');
const Message = require('./models/Message');

// ═══════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════
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

// ═══════════════════════════════════════════════
// AUTH MIDDLEWARE
// ═══════════════════════════════════════════════
const authMiddleware = (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'my_test_secret_key_12345'
    );
    req.user = decoded;
    req.userId = decoded.userId || decoded.id;
    req.userRole = decoded.role;
    req.userEmail = decoded.email;
    next();
  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ═══════════════════════════════════════════════
// MOUNT ROUTES
// ═══════════════════════════════════════════════
app.use('/api/promotions', promotionRoutes);
app.use('/api/verify', require('./routes/verification'));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/marks', marksRoutes);
app.use('/api/news', authRoutesNews);
app.use('/api/settings', settingsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api', attendanceRoutes);
app.use('/api', archiveRoutes);

// ═══════════════════════════════════════════════
// PARENT MANAGEMENT ROUTES
// ═══════════════════════════════════════════════

app.get('/api/users/role/student', authMiddleware, async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }).select(
      'name email rollNumber grade section'
    );
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/superadmin/parents', authMiddleware, async (req, res) => {
  try {
    const parents = await User.find({ role: 'parent' }).sort({
      createdAt: -1,
    });

    const parentsWithStudents = await Promise.all(
      parents.map(async (parent) => {
        const linkedStudents = await User.find({
          role: 'student',
          parents: parent._id,
        }).select('name rollNumber grade section email programs');

        return {
          _id: parent._id,
          name: parent.name,
          email: parent.email,
          phone: parent.phone || '',
          relationship: parent.relationship || 'guardian',
          isActive: parent.isActive !== false,
          students: linkedStudents,
        };
      })
    );

    res.json({ success: true, data: parentsWithStudents });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/superadmin/create-parent', authMiddleware, async (req, res) => {
  try {
    const { name, email, password, phone, relationship } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password required',
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: 'Email already exists' });
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
      isFirstLogin: true,
    });

    await parent.save();

    res.status(201).json({
      success: true,
      data: {
        parent: {
          id: parent._id,
          name: parent.name,
          email: parent.email,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/link-parent-student', authMiddleware, async (req, res) => {
  try {
    const { parentId, studentId } = req.body;

    if (!parentId || !studentId) {
      return res.status(400).json({
        success: false,
        message: 'Parent ID and Student ID are required',
      });
    }

    const parent = await User.findOne({ _id: parentId, role: 'parent' });
    if (!parent)
      return res
        .status(404)
        .json({ success: false, message: 'Parent not found' });

    const student = await User.findOne({ _id: studentId, role: 'student' });
    if (!student)
      return res
        .status(404)
        .json({ success: false, message: 'Student not found' });

    if (!student.parents) student.parents = [];
    if (student.parents.includes(parentId)) {
      return res.status(400).json({
        success: false,
        message: 'Parent already linked to this student',
      });
    }

    student.parents.push(parentId);
    await student.save();

    res.json({
      success: true,
      message: `Successfully linked ${parent.name} to ${student.name}`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete(
  '/api/admin/unlink-parent-student',
  authMiddleware,
  async (req, res) => {
    try {
      const { parentId, studentId } = req.body;
      await User.findByIdAndUpdate(studentId, {
        $pull: { parents: parentId },
      });
      res.json({ success: true, message: 'Parent unlinked successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

app.post(
  '/api/superadmin/parent/:id/reset-password',
  authMiddleware,
  async (req, res) => {
    try {
      const { newPassword } = req.body;
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await User.findByIdAndUpdate(req.params.id, {
        password: hashedPassword,
        isFirstLogin: true,
      });

      res.json({
        success: true,
        message: 'Password reset successfully',
        newPassword,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

app.delete('/api/superadmin/parent/:id', authMiddleware, async (req, res) => {
  try {
    const parent = await User.findOne({
      _id: req.params.id,
      role: 'parent',
    });
    if (!parent)
      return res
        .status(404)
        .json({ success: false, message: 'Parent not found' });

    await User.updateMany(
      { role: 'student', parents: parent._id },
      { $pull: { parents: parent._id } }
    );

    await User.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Parent deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/parent/children', authMiddleware, async (req, res) => {
  try {
    const parent = await User.findById(req.userId);
    if (!parent || parent.role !== 'parent') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Parent account required.',
      });
    }

    const children = await User.find(
      { role: 'student', parents: parent._id },
      'name email rollNumber grade section'
    );

    res.json({ success: true, children });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post(
  '/api/superadmin/fetch-parent-password',
  authMiddleware,
  async (req, res) => {
    try {
      const { email, phone } = req.body;

      if (!email && !phone) {
        return res.status(400).json({
          success: false,
          message: 'Please provide either email or phone number',
        });
      }

      let query = { role: 'parent' };
      if (email) query.email = email;
      if (phone) query.phone = phone;

      const parent = await User.findOne(query);

      if (!parent) {
        return res.status(404).json({
          success: false,
          message: 'Parent not found with provided email or phone',
        });
      }

      res.json({
        success: true,
        message: 'Password fetched successfully',
        password: parent.password,
        parent: {
          name: parent.name,
          email: parent.email,
          phone: parent.phone,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

app.get('/api/debug/students-parents', authMiddleware, async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }, 'name parents');
    const parents = await User.find({ role: 'parent' }, 'name');

    res.json({
      students: students.map((s) => ({
        name: s.name,
        parentsCount: s.parents?.length || 0,
        parentIds: s.parents || [],
      })),
      parents: parents.map((p) => p.name),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/debug/all-students', authMiddleware, async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }, 'name parents');
    const parents = await User.find({ role: 'parent' }, 'name');

    res.json({
      totalStudents: students.length,
      totalParents: parents.length,
      students: students.map((s) => ({
        name: s.name,
        hasParentsArray: !!s.parents,
        parentsCount: s.parents?.length || 0,
        parents: s.parents || [],
      })),
      parents: parents.map((p) => p.name),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════
// IN-MEMORY NEWS (temporary — not persisted)
// ═══════════════════════════════════════════════
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
    updatedAt: new Date(),
  };
  newsDatabase.push(newNews);
  res.status(201).json({ success: true, data: newNews });
});

app.get('/api/news/all', (req, res) => {
  res.json({ success: true, data: newsDatabase });
});

app.get('/api/news', (req, res) => {
  const { role } = req.query;
  const filtered = newsDatabase.filter((n) =>
    n.targetRoles.includes(role || 'student')
  );
  res.json({ success: true, data: filtered });
});

app.delete('/api/news/:id', (req, res) => {
  const id = parseInt(req.params.id);
  newsDatabase = newsDatabase.filter((n) => n._id !== id);
  res.json({ success: true, message: 'News deleted' });
});

app.put('/api/news/:id/read', (req, res) => {
  const id = parseInt(req.params.id);
  const { userId } = req.body;
  const news = newsDatabase.find((n) => n._id === id);
  if (news && userId) {
    const alreadyRead = news.readBy.some((r) => r.user === userId);
    if (!alreadyRead) news.readBy.push({ user: userId, readAt: new Date() });
  }
  res.json({ success: true, data: news });
});

// ═══════════════════════════════════════════════
// SOCKET.IO
// ═══════════════════════════════════════════════
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      'https://tuludimtuschoolerp.vercel.app',
      'http://localhost:3000',
      /^https:\/\/.*\.vercel\.app$/,
    ],
    credentials: true,
  },
});

app.get('/messages', async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

io.on('connection', (socket) => {
  socket.on('send_message', async (data) => {
    try {
      const msg = new Message(data);
      await msg.save();
      io.emit('receive_message', msg);
    } catch (err) {
      console.error('Socket save error:', err.message);
    }
  });
});

// ═══════════════════════════════════════════════
// DATABASE
// ═══════════════════════════════════════════════
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('✅ Connected to MongoDB Atlas');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
  }
};

connectDB();

const createAdmin = async () => {
  try {
    const existingAdmin = await User.findOne({ role: 'superadmin' });
    if (existingAdmin) {
      console.log('⚠️  Super Admin already exists');
      return;
    }
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = new User({
      name: 'Super Admin',
      email: 'danid93575@gmail.com',
      password: hashedPassword,
      role: 'superadmin',
    });
    await admin.save();
    console.log('✅ Super Admin created');
  } catch (err) {
    console.error('createAdmin error:', err.message);
  }
};

createAdmin();

// ═══════════════════════════════════════════════
// START SERVER — must use process.env.PORT
// ═══════════════════════════════════════════════
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on 0.0.0.0:${PORT}`);
  console.log(`   Health check: /api/health`);
});

