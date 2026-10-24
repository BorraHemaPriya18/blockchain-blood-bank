const express = require('express');
const router = express.Router();
const bloodUnitController = require('../controllers/bloodUnitController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.post(
  '/',
  protect,
  authorize('blood_bank', 'admin'),
  bloodUnitController.registerBloodUnit
);

router.get('/', protect, bloodUnitController.getInventory);

router.get('/:unitId', protect, bloodUnitController.getUnitDetails);
router.get('/:unitId/verify', bloodUnitController.verifyIntegrity);

router.put(
  '/:unitId/screening',
  protect,
  authorize('blood_bank', 'admin'),
  bloodUnitController.updateScreening
);

router.post(
  '/:unitId/discard',
  protect,
  authorize('blood_bank', 'hospital', 'admin'),
  bloodUnitController.discardBloodUnit
);

module.exports = router;
