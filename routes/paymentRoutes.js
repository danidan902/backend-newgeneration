const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Payment = require('../models/Payment');
const User = require('../models/User');
const cloudinary = require('../config/cloudinaryConfig');

// ============================================
// 📁 MULTER CONFIG — MEMORY STORAGE (no disk)
// ============================================
const storage = multer.memoryStorage();

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

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter
});

// ============================================
// ☁️ HELPER: upload a buffer to Cloudinary
// ============================================
const uploadToCloudinary = (buffer, originalName, folder = 'receipts') => {
  return new Promise((resolve, reject) => {
    const ext = path.extname(originalName).toLowerCase();
    const isPdf = ext === '.pdf';

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: isPdf ? 'raw' : 'image', // PDFs must be 'raw'
        public_id: `receipt-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
        // For PDFs Cloudinary needs the extension preserved
        ...(isPdf ? { format: 'pdf' } : {})
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
};

// ============================================
// 🎯 PAYMENT ROUTES
// ============================================

// 📤 Student: Upload payment receipt
router.post('/upload', upload.single('receipt'), async (req, res) => {
  try {
    const { studentId, amount, paymentDate, transactionRef, bankName } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // ☁️ Upload buffer directly to Cloudinary (no disk involved)
    const result = await uploadToCloudinary(
      req.file.buffer,
      req.file.originalname,
      'receipts'
    );

    const receiptUrl = result.secure_url;
    const cloudinaryPublicId = result.public_id;
    const resourceType = result.resource_type; // 'image' | 'raw'

    let payment = await Payment.findOne({ studentId, transactionRef });

    if (payment) {
      // 🧹 Delete old Cloudinary file before replacing
      if (payment.cloudinaryPublicId) {
        try {
          await cloudinary.uploader.destroy(payment.cloudinaryPublicId, {
            resource_type: payment.cloudinaryResourceType || 'image'
          });
        } catch (e) {
          console.warn('⚠️ Could not delete old Cloudinary file:', e.message);
        }
      }

      payment.amount = amount;
      payment.paymentDate = paymentDate;
      payment.bankName = bankName;
      payment.receiptUrl = receiptUrl;
      payment.cloudinaryPublicId = cloudinaryPublicId;
      payment.cloudinaryResourceType = resourceType;
      payment.status = 'pending';
      payment.updatedAt = new Date();
    } else {
      payment = new Payment({
        studentId,
        amount,
        bankName,
        paymentDate,
        transactionRef,
        receiptUrl,
        cloudinaryPublicId,
        cloudinaryResourceType: resourceType,
        status: 'Pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    await payment.save();

    res.json({
      success: true,
      message: 'Payment receipt uploaded successfully',
      data: payment
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error while uploading receipt'
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// 📋 Student: Get payment history
router.get('/student/:studentId/history', async (req, res) => {
  try {
    const { studentId } = req.params;
    const payments = await Payment.find({ studentId }).sort({ createdAt: -1 });
    res.json({ success: true, data: payments });
  } catch (error) {
    console.error('❌ Error fetching payment history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🛡️ Admin: Get all students with payment status
router.get('/admin/all-students', async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }).select('-password');
    const payments = await Payment.find();

    const studentsWithPayments = students.map(student => {
      const payment = payments.find(
        p => p.studentId.toString() === student._id.toString()
      );
      return { ...student.toObject(), payment: payment || null };
    });

    res.json({ success: true, students: studentsWithPayments });
  } catch (error) {
    console.error('❌ Error fetching students with payments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🛡️ Admin: Review payment
router.put('/admin/review/:studentId', async (req, res) => {
  try {
    const { action } = req.body;
    const { studentId } = req.params;

    const payment = await Payment.findOne({ studentId });
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    let status = payment.status;
    let adminNote = '';

    switch (action) {
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
    payment.updatedAt = new Date();
    await payment.save();

    res.json({
      success: true,
      message: `Payment ${action}d successfully`,
      payment
    });
  } catch (error) {
    console.error('❌ Error reviewing payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🗑️ Admin: Delete payment record (and its Cloudinary file)
router.delete('/admin/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    // ☁️ Delete from Cloudinary
    if (payment.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(payment.cloudinaryPublicId, {
          resource_type: payment.cloudinaryResourceType || 'image'
        });
      } catch (e) {
        console.warn('⚠️ Cloudinary delete failed:', e.message);
      }
    }

    await Payment.findByIdAndDelete(paymentId);
    res.json({ success: true, message: 'Payment record deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;