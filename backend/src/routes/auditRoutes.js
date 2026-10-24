const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/', protect, authorize('blood_bank', 'hospital', 'admin'), auditController.getAuditLogs);
router.get('/blockchain-explorer', auditController.getBlockchainExplorer);

module.exports = router;
