const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  schoolInfo: {
    name: { type: String, default: '' },
    logo: { type: String, default: '' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    website: { type: String, default: '' },
    principalName: { type: String, default: '' },
    establishmentYear: { type: String, default: '' }
  },
  academicSettings: {
    academicYear: { type: String, default: '' },
    semester: { type: String, default: '1' },
    term: { type: String, default: '1' },
    examType: { type: String, default: 'Quarterly' },
    gradingSystem: { type: String, default: 'Percentage' },
    attendanceRequired: { type: Number, default: 75 }
  },
  securitySettings: {
    minPasswordLength: { type: Number, default: 6 },
    allowMultipleLogin: { type: Boolean, default: false },
    sessionTimeout: { type: Number, default: 30 },
    maxLoginAttempts: { type: Number, default: 5 },
    lockoutDuration: { type: Number, default: 30 },
    twoFactorAuth: { type: Boolean, default: false }
  },
  userManagement: {
    defaultRole: { type: String, default: 'student' },
    allowSelfRegistration: { type: Boolean, default: false },
    maxStudentsPerClass: { type: Number, default: 50 },
    maxTeachersPerClass: { type: Number, default: 5 },
    requireAdminApproval: { type: Boolean, default: true },
    autoGeneratePassword: { type: Boolean, default: true }
  },
  appearance: {
    theme: { type: String, default: 'light' },
    primaryColor: { type: String, default: '#3B82F6' },
    sidebarColor: { type: String, default: '#1F2937' },
    fontSize: { type: String, default: 'medium' },
    compactMode: { type: Boolean, default: false }
  },
  generalSettings: {
    language: { type: String, default: 'english' },
    timezone: { type: String, default: 'Africa/Addis_Ababa' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' },
    timeFormat: { type: String, default: '24h' },
    weekStartDay: { type: String, default: 'Monday' }
  },
  backupSettings: {
    autoBackup: { type: Boolean, default: false },
    backupFrequency: { type: String, default: 'weekly' },
    backupTime: { type: String, default: '00:00' },
    retentionDays: { type: Number, default: 30 }
  },
  notificationSettings: {
    emailNotifications: { type: Boolean, default: true },
    smsAlerts: { type: Boolean, default: false },
    attendanceAlerts: { type: Boolean, default: true },
    examResultAlerts: { type: Boolean, default: true },
    paymentReminders: { type: Boolean, default: false },
    adminEmail: { type: String, default: '' }
  },
  maintenanceMode: { type: Boolean, default: false },
  maintenanceMessage: { type: String, default: 'System is under maintenance' }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);