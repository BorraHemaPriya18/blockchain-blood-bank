const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get(
  '/search-compatible',
  protect,
  authorize('hospital', 'admin'),
  transferController.searchCompatibleHospitalStock
);

router.post(
  '/',
  protect,
  authorize('hospital', 'admin'),
  transferController.createEmergencyTransfer
);

router.get('/', protect, transferController.getTransfers);

router.post(
  '/:transferId/complete',
  protect,
  authorize('hospital', 'admin'),
  transferController.completeEmergencyTransfer
);

module.exports = router;
