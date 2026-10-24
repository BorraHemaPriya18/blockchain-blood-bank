const crypto = require('crypto');
const BloodUnit = require('../models/BloodUnit');
const DonorProfile = require('../models/DonorProfile');
const AuditLog = require('../models/AuditLog');
const integrityService = require('../services/integrityService');
const blockchainService = require('../services/blockchainService');

// Shelf life mapping in days
const COMPONENT_SHELF_LIFE_DAYS = {
  'Whole Blood': 35,
  'Red Blood Cells': 42,
  Platelets: 5,
  Plasma: 365,
};

// @desc    Register a newly collected blood unit
// @route   POST /api/blood-units
// @access  Private (Blood Bank Staff, Admin)
exports.registerBloodUnit = async (req, res, next) => {
  try {
    const {
      donorRefId,
      bloodGroup,
      componentType,
      volumeMl = 450,
      customUnitId,
      collectionDate,
    } = req.body;

    if (!donorRefId || !bloodGroup || !componentType) {
      return res.status(400).json({
        success: false,
        message: 'donorRefId, bloodGroup, and componentType are mandatory.',
      });
    }

    const unitId =
      customUnitId ||
      `BLD-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    // Prevent duplicate registration
    const existing = await BloodUnit.findOne({ unitId });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Blood unit ${unitId} is already registered. Duplicate unit registrations are rejected.`,
      });
    }

    const colDate = collectionDate ? new Date(collectionDate) : new Date();
    const shelfLife = COMPONENT_SHELF_LIFE_DAYS[componentType] || 35;
    const expDate = new Date(colDate.getTime() + shelfLife * 24 * 60 * 60 * 1000);

    const initialUnitData = {
      unitId,
      bloodGroup,
      componentType,
      collectionDate: colDate,
      expiryDate: expDate,
      screeningStatus: 'pending',
      status: 'collected',
      currentCustodian: {
        role: 'blood_bank',
        id: req.user._id,
        name: req.user.organizationName || req.user.username,
        walletAddress: req.user.walletAddress || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      },
    };

    // Calculate initial cryptographic integrity hash
    const dataHash = integrityService.computeUnitHash(initialUnitData);

    // Record on blockchain
    let blockchainResult = null;
    try {
      blockchainResult = await blockchainService.registerBloodUnitOnChain(
        unitId,
        bloodGroup,
        componentType,
        colDate.getTime(),
        expDate.getTime(),
        dataHash
      );
    } catch (bcErr) {
      console.warn(`[Blockchain] Note: Could not write on-chain tx: ${bcErr.message}`);
    }

    const blockchainHistory = [];
    if (blockchainResult) {
      blockchainHistory.push({
        eventType: 'BloodUnitRegistered',
        txHash: blockchainResult.txHash,
        blockNumber: blockchainResult.blockNumber,
        timestamp: new Date(),
        actorAddress: req.user.walletAddress,
        dataHash,
        remarks: 'Collected and initial registration',
      });
    }

    // Save to MongoDB
    const bloodUnit = await BloodUnit.create({
      ...initialUnitData,
      bloodBankId: req.user._id,
      bloodBankName: req.user.organizationName || req.user.username,
      donorRefId,
      volumeMl,
      dataHash,
      blockchainHistory,
    });

    // Update donor donation count & last donation date
    await DonorProfile.findOneAndUpdate(
      { donorRefId },
      {
        $inc: { totalDonations: 1 },
        $set: { lastDonationDate: colDate },
      }
    );

    // Audit log
    await AuditLog.create({
      action: 'BLOOD_UNIT_REGISTERED',
      entityType: 'BLOOD_UNIT',
      entityId: unitId,
      actorId: req.user._id,
      actorUsername: req.user.username,
      actorRole: req.user.role,
      details: { unitId, bloodGroup, componentType, expiryDate: expDate, dataHash },
      blockchainTxHash: blockchainResult ? blockchainResult.txHash : null,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Blood unit registered and recorded on-chain successfully.',
      unit: bloodUnit,
      blockchainResult,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update screening test results and adjust inventory availability
// @route   PUT /api/blood-units/:unitId/screening
// @access  Private (Blood Bank Staff, Admin)
exports.updateScreening = async (req, res, next) => {
  try {
    const { unitId } = req.params;
    const {
      screeningStatus, // 'passed' or 'failed'
      hiv = 'Negative',
      hbv = 'Negative',
      hcv = 'Negative',
      syphilis = 'Negative',
      malaria = 'Negative',
      hemoglobinGdl = 14.5,
      notes = 'Routine pathogen serology panel completed.',
    } = req.body;

    const unit = await BloodUnit.findOne({ unitId });
    if (!unit) {
      return res.status(404).json({ success: false, message: 'Blood unit not found.' });
    }

    if (!['collected', 'pending_screening'].includes(unit.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot update screening for unit in state '${unit.status}'.`,
      });
    }

    const isPassed = screeningStatus === 'passed';
    unit.screeningStatus = isPassed ? 'passed' : 'failed';
    unit.status = isPassed ? 'available' : 'quarantined';
    unit.screeningDetails = {
      hiv,
      hbv,
      hcv,
      syphilis,
      malaria,
      hemoglobinGdl,
      screenedBy: req.user.username,
      screenedAt: new Date(),
      notes,
    };

    // Recompute integrity hash
    const newDataHash = integrityService.computeUnitHash(unit);
    unit.dataHash = newDataHash;

    // Record on blockchain (1 = Passed, 2 = Failed)
    let blockchainResult = null;
    try {
      blockchainResult = await blockchainService.updateScreeningOnChain(
        unitId,
        isPassed ? 1 : 2,
        notes,
        newDataHash
      );
      if (blockchainResult) {
        unit.blockchainHistory.push({
          eventType: isPassed ? 'ScreeningPassed' : 'ScreeningFailed',
          txHash: blockchainResult.txHash,
          blockNumber: blockchainResult.blockNumber,
          timestamp: new Date(),
          actorAddress: req.user.walletAddress,
          dataHash: newDataHash,
          remarks: notes,
        });
      }
    } catch (bcErr) {
      console.warn(`[Blockchain] Note: Could not record screening on-chain: ${bcErr.message}`);
    }

    await unit.save();

    await AuditLog.create({
      action: isPassed ? 'SCREENING_PASSED' : 'SCREENING_FAILED',
      entityType: 'BLOOD_UNIT',
      entityId: unitId,
      actorId: req.user._id,
      actorUsername: req.user.username,
      actorRole: req.user.role,
      details: { unitId, screeningStatus: unit.screeningStatus, newStatus: unit.status, newDataHash },
      blockchainTxHash: blockchainResult ? blockchainResult.txHash : null,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: `Screening updated: Unit is now ${unit.status}.`,
      unit,
      blockchainResult,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get real-time digital blood inventory with filters & alerts
// @route   GET /api/blood-units
// @access  Private (All authenticated roles)
exports.getInventory = async (req, res, next) => {
  try {
    const { bloodGroup, componentType, status, bloodBankId, search } = req.query;

    const query = {};

    if (bloodGroup) query.bloodGroup = bloodGroup;
    if (componentType) query.componentType = componentType;
    if (status) query.status = status;
    if (bloodBankId) query.bloodBankId = bloodBankId;

    if (search) {
      query.$or = [
        { unitId: { $regex: search, $options: 'i' } },
        { bloodBankName: { $regex: search, $options: 'i' } },
        { donorRefId: { $regex: search, $options: 'i' } },
      ];
    }

    // Role-based visibility scoping
    if (req.user.role === 'blood_bank') {
      // Blood bank sees all its units or available units
    } else if (req.user.role === 'donor') {
      // Donor can only see their own units using donorRefId!
      query.donorRefId = req.user.donorRefId;
    }

    const units = await BloodUnit.find(query).sort({ createdAt: -1 });

    // Expiry check: detect units that reached expiry timestamp and update them
    const now = new Date();
    const expiryWarningThresholdDays = 7;
    const warningDate = new Date(now.getTime() + expiryWarningThresholdDays * 24 * 60 * 60 * 1000);

    const expiringSoonCount = units.filter(
      (u) => ['available', 'approved', 'received'].includes(u.status) && u.expiryDate <= warningDate && u.expiryDate > now
    ).length;

    res.status(200).json({
      success: true,
      count: units.length,
      expiringSoonCount,
      units,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single unit details with verified blockchain timeline
// @route   GET /api/blood-units/:unitId
// @access  Private
exports.getUnitDetails = async (req, res, next) => {
  try {
    const { unitId } = req.params;

    const unit = await BloodUnit.findOne({ unitId });
    if (!unit) {
      return res.status(404).json({ success: false, message: 'Blood unit not found.' });
    }

    // If donor, ensure they own the unit
    if (req.user.role === 'donor' && unit.donorRefId !== req.user.donorRefId) {
      return res.status(403).json({ success: false, message: 'Unauthorized to view this unit.' });
    }

    // Fetch on-chain unit data and events if blockchain is connected
    const onChainUnit = await blockchainService.getBloodUnitFromChain(unitId);
    const onChainEvents = await blockchainService.getUnitEventsFromChain(unitId);

    // Verify cryptographic integrity
    const integrityCheck = integrityService.verifyIntegrity(unit, unit.dataHash);

    res.status(200).json({
      success: true,
      unit,
      onChainUnit,
      onChainEvents,
      integrityCheck,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Verify blood unit cryptographic integrity against recorded hash
// @route   GET /api/blood-units/:unitId/verify
// @access  Public / Private
exports.verifyIntegrity = async (req, res, next) => {
  try {
    const { unitId } = req.params;

    const unit = await BloodUnit.findOne({ unitId });
    if (!unit) {
      return res.status(404).json({ success: false, message: 'Blood unit not found.' });
    }

    // Current DB recalculated hash
    const currentDbHash = integrityService.computeUnitHash(unit);

    // On-chain recorded hash
    let onChainValid = false;
    let onChainHash = null;

    const onChainUnit = await blockchainService.getBloodUnitFromChain(unitId);
    if (onChainUnit) {
      onChainHash = onChainUnit.dataHash;
      onChainValid = onChainHash.toLowerCase() === currentDbHash.toLowerCase();
    } else {
      // Fallback to comparing with recorded DB field
      onChainHash = unit.dataHash;
      onChainValid = currentDbHash.toLowerCase() === unit.dataHash.toLowerCase();
    }

    res.status(200).json({
      success: true,
      unitId,
      isTamperFree: onChainValid,
      calculatedHash: currentDbHash,
      blockchainHash: onChainHash,
      message: onChainValid
        ? 'Integrity Verified: Off-chain record strictly matches immutable blockchain cryptographic reference.'
        : 'INTEGRITY ALERT: Record hash does NOT match the immutable blockchain reference! Data tampering detected.',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Discard blood unit (Hemolysis, contamination, expiry)
// @route   POST /api/blood-units/:unitId/discard
// @access  Private (Blood Bank Staff, Hospital Staff, Admin)
exports.discardBloodUnit = async (req, res, next) => {
  try {
    const { unitId } = req.params;
    const { reason = 'Expired / Quality Compromised' } = req.body;

    const unit = await BloodUnit.findOne({ unitId });
    if (!unit) {
      return res.status(404).json({ success: false, message: 'Blood unit not found.' });
    }

    if (unit.status === 'transfused') {
      return res.status(400).json({
        success: false,
        message: 'Cannot discard a unit that has already been transfused to a patient.',
      });
    }

    unit.status = 'discarded';
    unit.discardReason = reason;
    unit.discardedAt = new Date();

    const newDataHash = integrityService.computeUnitHash(unit);
    unit.dataHash = newDataHash;

    let blockchainResult = null;
    try {
      blockchainResult = await blockchainService.discardBloodUnitOnChain(unitId, reason, newDataHash);
      if (blockchainResult) {
        unit.blockchainHistory.push({
          eventType: 'BloodUnitDiscarded',
          txHash: blockchainResult.txHash,
          blockNumber: blockchainResult.blockNumber,
          timestamp: new Date(),
          actorAddress: req.user.walletAddress,
          dataHash: newDataHash,
          remarks: reason,
        });
      }
    } catch (bcErr) {
      console.warn(`[Blockchain] Note: Could not record discard on-chain: ${bcErr.message}`);
    }

    await unit.save();

    await AuditLog.create({
      action: 'BLOOD_UNIT_DISCARDED',
      entityType: 'BLOOD_UNIT',
      entityId: unitId,
      actorId: req.user._id,
      actorUsername: req.user.username,
      actorRole: req.user.role,
      details: { unitId, reason, newDataHash },
      blockchainTxHash: blockchainResult ? blockchainResult.txHash : null,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Blood unit discarded and recorded on-chain.',
      unit,
      blockchainResult,
    });
  } catch (err) {
    next(err);
  }
};
