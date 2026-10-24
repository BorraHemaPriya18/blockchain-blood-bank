const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.post(
  '/',
  protect,
  authorize('hospital', 'admin'),
  requestController.createRequest
);

router.get('/', protect, requestController.getRequests);

router.post(
  '/:requestId/allocate',
  protect,
  authorize('blood_bank', 'admin'),
  requestController.allocateUnits
);

module.exports = router;
