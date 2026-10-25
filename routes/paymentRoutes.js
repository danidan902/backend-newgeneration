const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Payment = require('../models/Payment');
const User = require('../models/User');

// ============================================
// 📁 MULTER CONFIGURATION FOR FILE UPLOADS
// ============================================

// Ensure upload directory exists
const uploadDir = './uploads/receipts';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `receipt-${uniqueSuffix}${ext}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'];
  
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, GIF, WEBP, and PDF are allowed.'), false);
  }
};

// Create multer instance
const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
});

// ============================================
// 🎯 PAYMENT ROUTES
// ============================================

// 📤 Student: Upload payment receipt (with file)
router.post('/upload', upload.single('receipt'), async (req, res) => {
  try {
    console.log('📤 Upload request received');
    console.log('Body:', req.body);
    console.log('File:', req.file);

    const { studentId, amount, bankName, transactionRef, paymentDate } = req.body;

    // Validate required fields
    if (!studentId || !amount || !bankName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: studentId, amount, bankName' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No receipt file uploaded' 
      });
    }

    // Generate URL for the uploaded file
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const receiptUrl = `${baseUrl}/uploads/receipts/${req.file.filename}`;

    // Check if student exists
    const student = await User.findById(studentId);
    if (!student) {
      // Delete uploaded file if student not found
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ 
        success: false, 
        error: 'Student not found' 
      });
    }

    // Find existing payment or create new
    let payment = await Payment.findOne({ studentId });

    if (payment) {
      // Delete old receipt file if exists
      if (payment.receiptUrl) {
        const oldFilePath = path.join(__dirname, '..', payment.receiptUrl.replace(`${baseUrl}/`, ''));
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
          console.log('🗑️ Old receipt deleted:', oldFilePath);
        }
      }

      // Update existing payment
      payment.amount = parseFloat(amount);
      payment.bankName = bankName;
      payment.transactionRef = transactionRef || 'N/A';
      payment.paymentDate = paymentDate || new Date().toISOString().split('T')[0];
      payment.receiptUrl = receiptUrl;
      payment.status = 'Pending';
      payment.updatedAt = Date.now();
    } else {
      // Create new payment
      payment = new Payment({
        studentId,
        amount: parseFloat(amount),
        bankName,
        transactionRef: transactionRef || 'N/A',
        paymentDate: paymentDate || new Date().toISOString().split('T')[0],
        receiptUrl,
        status: 'Pending'
      });
    }

    await payment.save();
    console.log('✅ Payment saved successfully:', payment._id);

    res.json({
      success: true,
      message: 'Payment receipt uploaded successfully',
      payment
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    
    // Delete uploaded file if error occurs
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to upload receipt' 
    });
  }
});

// 👤 Student: Get payment status
router.get('/student/:studentId/status', async (req, res) => {
  try {
    const { studentId } = req.params;
    
    const payment = await Payment.findOne({ studentId });
    
    if (!payment) {
      return res.json({
        success: true,
        status: 'Not Paid',
        message: 'No payment record found'
      });
    }

    res.json({
      success: true,
      status: payment.status,
      amount: payment.amount,
      bankName: payment.bankName,
      transactionRef: payment.transactionRef,
      paymentDate: payment.paymentDate,
      receiptUrl: payment.receiptUrl,
      adminNote: payment.adminNote,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    });

  } catch (error) {
    console.error('❌ Error fetching payment status:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 📋 Student: Get payment history
router.get('/student/:studentId/history', async (req, res) => {
  try {
    const { studentId } = req.params;
    
    const payments = await Payment.find({ studentId })
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: payments
    });

  } catch (error) {
    console.error('❌ Error fetching payment history:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 🛡️ Admin: Get all students with payment status
router.get('/admin/all-students', async (req, res) => {
  try {
    // Get all students
    const students = await User.find({ role: 'student' }).select('-password');
    
    // Get all payments
    const payments = await Payment.find();
    
    // Combine data
    const studentsWithPayments = students.map(student => {
      const payment = payments.find(p => p.studentId.toString() === student._id.toString());
      return {
        ...student.toObject(),
        payment: payment || null
      };
    });
    
    res.json({
      success: true,
      students: studentsWithPayments
    });

  } catch (error) {
    console.error('❌ Error fetching students with payments:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 🛡️ Admin: Review payment
router.put('/admin/review/:studentId', async (req, res) => {
  try {
    const { action } = req.body;
    const { studentId } = req.params;
    
    const payment = await Payment.findOne({ studentId });
    if (!payment) {
      return res.status(404).json({ 
        success: false, 
        error: 'Payment not found' 
      });
    }
    
    let status = payment.status;
    let adminNote = '';
    
    switch(action) {
      case 'approve':
        status = 'Paid';
        adminNote = '✅ Payment approved by admin.';
        break;
      case 'reject':
        status = 'Rejected';
        adminNote = '❌ Payment rejected by admin. Please upload a valid receipt.';
        break;
      case 'request_new':
        status = 'Request New';
        adminNote = '🔄 Admin requested a new receipt. Please upload again.';
        break;
      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid action. Use: approve, reject, request_new' 
        });
    }
    
    payment.status = status;
    payment.adminNote = adminNote;
    payment.updatedAt = Date.now();
    await payment.save();
    
    res.json({
      success: true,
      message: `Payment ${action}d successfully`,
      payment
    });

  } catch (error) {
    console.error('❌ Error reviewing payment:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 🗑️ Admin: Delete payment record
router.delete('/admin/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ 
        success: false, 
        error: 'Payment not found' 
      });
    }

    // Delete receipt file if exists
    if (payment.receiptUrl) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const filePath = path.join(__dirname, '..', payment.receiptUrl.replace(`${baseUrl}/`, ''));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('🗑️ Receipt file deleted:', filePath);
      }
    }
    
    await Payment.findByIdAndDelete(paymentId);
    
    res.json({
      success: true,
      message: 'Payment record deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting payment:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;