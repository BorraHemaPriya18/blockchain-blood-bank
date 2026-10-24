const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');

router.get('/dashboard', protect, analyticsController.getDashboardMetrics);
router.get('/export-csv', protect, analyticsController.exportCSV);

module.exports = router;
