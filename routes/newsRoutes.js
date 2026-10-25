const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newsController');

// All routes are public - no authentication required
router.post('/', newsController.createNews);
router.get('/all', newsController.getAllNews);
router.delete('/:id', newsController.deleteNews);
router.get('/', newsController.getNewsByRole);
router.put('/:id/read', newsController.markAsRead);

module.exports = router;
