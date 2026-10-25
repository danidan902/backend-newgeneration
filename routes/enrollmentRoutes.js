const express = require('express');
const router = express.Router();
const enrollmentController = require('../controllers/enrollmentController');
const promotionController = require('../controllers/promotionController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Get students with enrollment
router.get('/students-with-enrollment', enrollmentController.getStudentsWithEnrollment);

// Get student's current enrollment
router.get('/student/:studentId/current', enrollmentController.getStudentCurrentEnrollment);

// UPDATE student enrollment - ADD THIS LINE
router.put('/student/:studentId/enrollment', enrollmentController.updateStudentEnrollment);

// Promotion routes
router.get('/promotion-preview', roleMiddleware(['admin', 'superadmin']), promotionController.getPromotionPreview);
router.post('/promote', roleMiddleware(['admin', 'superadmin']), promotionController.promoteStudents);

module.exports = router;