const express = require('express');
const router = express.Router();
const CertificateRequest = require('../models/CertificateRequest');

// ========== CREATE CERTIFICATE REQUEST ==========
router.post('/certificates/request', async (req, res) => {
  console.log('📝 Certificate request received');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const {
      studentId,
      studentName,
      classId,
      className,
      semester,
      academicYear,
      certificateType,
      overallAverage,
      totalMarks,
      subjectsList
    } = req.body;

    // Validate required fields
    if (!studentId) {
      return res.status(400).json({ error: 'studentId is required' });
    }
    if (!studentName) {
      return res.status(400).json({ error: 'studentName is required' });
    }
    if (!classId) {
      return res.status(400).json({ error: 'classId is required' });
    }
    if (!semester) {
      return res.status(400).json({ error: 'semester is required' });
    }

    // Generate certificate number
    const certNumber = `CERT/${certificateType === 'semester' ? 'SEM' : 'ANN'}/${semester === 'Semester 1' ? 'S1' : 'S2'}/${academicYear || '2024'}/${Date.now()}`;

    // Create new request
    const newRequest = new CertificateRequest({
      studentId,
      studentName,
      classId,
      className,
      semester: semester || 'Semester 1',
      academicYear: academicYear || '2024-2025',
      certificateType: certificateType || 'semester',
      status: 'pending_review',
      overallAverage: overallAverage || 0,
      totalMarks: totalMarks || 0,
      subjectsList: subjectsList || [],
      requestedBy: req.headers['x-user-id'] || 'system',
      requestedByRole: req.headers['x-user-role'] || 'teacher',
      requestedAt: new Date(),
      certificateNumber: certNumber
    });

    await newRequest.save();
    
    console.log('✅ Certificate request saved:', newRequest._id);

    res.status(201).json({ 
      success: true, 
      message: 'Certificate request submitted successfully',
      data: newRequest 
    });
  } catch (error) {
    console.error('❌ Error creating certificate request:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== GET ALL CERTIFICATE REQUESTS ==========
router.get('/certificates/requests', async (req, res) => {
  try {
    const requests = await CertificateRequest.find().sort({ requestedAt: -1 });
    console.log(`📋 Found ${requests.length} certificate requests`);
    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== GET PENDING COUNTS ==========
router.get('/certificates/pending/count', async (req, res) => {
  try {
    const pendingReview = await CertificateRequest.countDocuments({ status: 'pending_review' });
    const pendingApproval = await CertificateRequest.countDocuments({ status: 'reviewed' });
    
    res.json({
      pendingReview,
      pendingApproval,
      total: pendingReview + pendingApproval
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== REVIEW CERTIFICATE ==========
router.put('/certificates/review/:id', async (req, res) => {
  try {
    const { action, comments } = req.body;
    
    const request = await CertificateRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Certificate request not found' });
    }
    
    if (action === 'review') {
      request.status = 'reviewed';
      request.reviewedBy = req.headers['x-user-id'] || 'admin';
      request.reviewedAt = new Date();
      request.reviewComments = comments || 'Reviewed and forwarded';
    } else if (action === 'reject') {
      request.status = 'rejected';
      request.reviewedBy = req.headers['x-user-id'] || 'admin';
      request.reviewedAt = new Date();
      request.rejectionReason = comments || 'Request rejected';
    }
    
    await request.save();
    
    res.json({ 
      success: true, 
      message: `Certificate ${action === 'review' ? 'reviewed' : 'rejected'}`,
      data: request 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== APPROVE CERTIFICATE ==========
router.put('/certificates/approve/:id', async (req, res) => {
  try {
    const request = await CertificateRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Certificate request not found' });
    }
    
    request.status = 'approved';
    request.approvedBy = req.headers['x-user-id'] || 'superadmin';
    request.approvedAt = new Date();
    
    await request.save();
    
    res.json({ 
      success: true, 
      message: 'Certificate approved successfully',
      data: request 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;