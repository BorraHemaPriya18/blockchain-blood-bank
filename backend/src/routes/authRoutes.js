const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const upload = require('../middleware/upload');

// Rate limiter for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 mins for development testing
  message: { success: false, message: 'Too many authentication attempts. Please try again after 15 minutes.' },
});

router.post(
  '/register-donor',
  authLimiter,
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'document', maxCount: 1 },
  ]),
  authController.registerDonor
);

router.post('/register-organization', authLimiter, authController.registerOrganization);
router.post('/login', authLimiter, authController.login);
router.get('/me', protect, authController.getMe);

// Admin-only routes
router.get('/users', protect, authorize('admin'), authController.getAllUsers);
router.put('/users/:id/approve', protect, authorize('admin'), authController.approveOrganization);

module.exports = router;
