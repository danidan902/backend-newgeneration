// models/Payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  bankName: {
    type: String,
    required: true
  },
  transactionRef: {
    type: String,
    trim: true
  },
  paymentDate: {
    type: String,
    default: () => new Date().toISOString().split('T')[0]
  },
  receiptUrl: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Paid', 'Pending', 'Rejected', 'Request New'],
    default: 'Pending'
  },
  adminNote: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Payment', paymentSchema);