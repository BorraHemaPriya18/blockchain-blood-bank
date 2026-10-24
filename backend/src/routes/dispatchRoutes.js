const express = require('express');
const router = express.Router();
const dispatchController = require('../controllers/dispatchController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.post(
  '/:unitId',
  protect,
  authorize('blood_bank', 'admin'),
  dispatchController.dispatchUnit
);

router.post(
  '/:unitId/receive',
  protect,
  authorize('hospital', 'admin'),
  dispatchController.receiveUnit
);

router.post(
  '/:unitId/transfuse',
  protect,
  authorize('hospital', 'admin'),
  dispatchController.transfuseUnit
);

module.exports = router;
