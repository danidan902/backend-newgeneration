const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const {
  getSettings,
  updateSettings,
  updateSettingSection,
  resetSettings,
  getPublicSettings,
  getMaintenanceStatus,
  toggleMaintenance
} = require('../controllers/settingsController');

// Public routes
router.get('/public', getPublicSettings);
router.get('/maintenance', getMaintenanceStatus);

// Protected routes
router.get('/', authMiddleware, getSettings);
router.post('/', authMiddleware, updateSettings);
router.put('/section/:section', authMiddleware, updateSettingSection);
router.post('/reset', authMiddleware, roleMiddleware(['superadmin']), resetSettings);
router.post('/maintenance', authMiddleware, roleMiddleware(['superadmin']), toggleMaintenance);

module.exports = router;