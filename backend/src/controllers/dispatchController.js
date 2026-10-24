const BloodUnit = require('../models/BloodUnit');
const BloodRequest = require('../models/BloodRequest');
const AuditLog = require('../models/AuditLog');
const integrityService = require('../services/integrityService');
const blockchainService = require('../services/blockchainService');

// @desc    Dispatch blood unit from Blood Bank to Hospital
// @route   POST /api/dispatch/:unitId
// @access  Private (Blood Bank Staff, Admin)
exports.dispatchUnit = async (req, res, next) => {
  try {
    const { unitId } = req.params;
    const {
      shipmentRef = `SHIP-${Date.now().toString().slice(-6)}`,
      carrier = 'Dedicated Medical Cold Courier',
      temperatureCelsius = 4.0,
    } = req.body;

    const unit = await BloodUnit.findOne({ unitId });
    if (!unit) {
      return res.status(404).json({ success: false, message: 'Blood unit not found.' });
    }

    if (unit.status !== 'reserved') {
      return res.status(400).json({
        success: false,
        message: `Only reserved units can be dispatched. Current status: '${unit.status}'.`,
      });
    }

    if (new Date() >= unit.expiryDate) {
      return res.status(400).json({
        success: false,
        message: 'Cannot dispatch expired blood unit.',
      });
    }

    unit.status = 'dispatched';
    unit.currentCustodian = {
      role: 'transit',
      name: carrier,
    };
    unit.shipmentDetails = {
      shipmentRef,
      carrier,
      dispatchedAt: new Date(),
      temperatureCelsius,
    };

    const newDataHash = integrityService.computeUnitHash(unit);
    unit.dataHash = newDataHash;

    const destWallet =
      (unit.reservedHospital && unit.reservedHospital.walletAddress) ||
      '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

    let blockchainResult = null;
    try {
      await blockchainService.ensureUnitOnChain(unit, 'reserved', {
        hospitalWallet: destWallet,
        destinationAddress: destWallet,
        requestId: unit.hospitalRequestId,
      });
      blockchainResult = await blockchainService.dispatchBloodUnitOnChain(
        unitId,
        destWallet,
        shipmentRef,
        newDataHash
      );
      if (blockchainResult) {
        unit.blockchainHistory.push({
          eventType: 'BloodUnitDispatched',
          txHash: blockchainResult.txHash,
          blockNumber: blockchainResult.blockNumber,
          timestamp: new Date(),
          actorAddress: req.user.walletAddress,
          dataHash: newDataHash,
          remarks: `Dispatched via ${carrier} (${shipmentRef})`,
        });
      }
    } catch (bcErr) {
      console.warn(`[Blockchain] Note: Could not record dispatch on-chain: ${bcErr.message}`);
    }

    await unit.save();

    await AuditLog.create({
      action: 'BLOOD_UNIT_DISPATCHED',
      entityType: 'BLOOD_UNIT',
      entityId: unitId,
      actorId: req.user._id,
      actorUsername: req.user.username,
      actorRole: req.user.role,
      details: { unitId, shipmentRef, carrier, temperatureCelsius, newDataHash },
      blockchainTxHash: blockchainResult ? blockchainResult.txHash : null,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: `Unit ${unitId} dispatched under cold chain conditions.`,
      unit,
      blockchainResult,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Hospital receives dispatched blood unit
// @route   POST /api/dispatch/:unitId/receive
// @access  Private (Hospital Staff, Admin)
exports.receiveUnit = async (req, res, next) => {
  try {
    const { unitId } = req.params;

    const unit = await BloodUnit.findOne({ unitId });
    if (!unit) {
      return res.status(404).json({ success: false, message: 'Blood unit not found.' });
    }

    if (unit.status !== 'dispatched') {
      return res.status(400).json({
        success: false,
        message: `Unit must be in 'dispatched' state to acknowledge receipt. Current status: '${unit.status}'.`,
      });
    }

    unit.status = 'received';
    unit.currentCustodian = {
      role: 'hospital',
      id: req.user._id,
      name: req.user.organizationName || req.user.username,
      walletAddress: req.user.walletAddress || '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    };
    if (unit.shipmentDetails) {
      unit.shipmentDetails.receivedAt = new Date();
    }

    const newDataHash = integrityService.computeUnitHash(unit);
    unit.dataHash = newDataHash;

    let blockchainResult = null;
    try {
      await blockchainService.ensureUnitOnChain(unit, 'dispatched', {
        destinationAddress: req.user.walletAddress || '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      });
      blockchainResult = await blockchainService.receiveBloodUnitOnChain(unitId, newDataHash);
      if (blockchainResult) {
        unit.blockchainHistory.push({
          eventType: 'BloodUnitReceived',
          txHash: blockchainResult.txHash,
          blockNumber: blockchainResult.blockNumber,
          timestamp: new Date(),
          actorAddress: req.user.walletAddress,
          dataHash: newDataHash,
          remarks: `Received by hospital ${req.user.organizationName || req.user.username}`,
        });
      }
    } catch (bcErr) {
      console.warn(`[Blockchain] Note: Could not record receipt on-chain: ${bcErr.message}`);
    }

    await unit.save();

    // Check if the associated hospital request is fulfilled
    if (unit.hospitalRequestId) {
      const request = await BloodRequest.findOne({ requestId: unit.hospitalRequestId });
      if (request) {
        const unitsInRequest = await BloodUnit.find({ hospitalRequestId: unit.hospitalRequestId });
        const allReceived = unitsInRequest.every((u) => ['received', 'transfused'].includes(u.status));
        if (allReceived && unitsInRequest.length >= request.quantity) {
          request.status = 'fulfilled';
          await request.save();
        }
      }
    }

    await AuditLog.create({
      action: 'BLOOD_UNIT_RECEIVED',
      entityType: 'BLOOD_UNIT',
      entityId: unitId,
      actorId: req.user._id,
      actorUsername: req.user.username,
      actorRole: req.user.role,
      details: { unitId, hospital: req.user.organizationName, newDataHash },
      blockchainTxHash: blockchainResult ? blockchainResult.txHash : null,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: `Blood unit ${unitId} successfully received and custody transferred to hospital.`,
      unit,
      blockchainResult,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Hospital records patient transfusion outcome
// @route   POST /api/dispatch/:unitId/transfuse
// @access  Private (Hospital Staff, Admin)
exports.transfuseUnit = async (req, res, next) => {
  try {
    const { unitId } = req.params;
    const { patientRefId, clinicalNotes = 'Transfusion administered without immediate adverse reaction.' } = req.body;

    if (!patientRefId) {
      return res.status(400).json({
        success: false,
        message: 'Pseudonymized patientRefId is required for clinical traceability.',
      });
    }

    const unit = await BloodUnit.findOne({ unitId });
    if (!unit) {
      return res.status(404).json({ success: false, message: 'Blood unit not found.' });
    }

    if (unit.status !== 'received') {
      return res.status(400).json({
        success: false,
        message: `Unit must be in hospital storage ('received') to record transfusion. Current status: '${unit.status}'.`,
      });
    }

    if (new Date() > unit.expiryDate) {
      return res.status(400).json({
        success: false,
        message: 'Cannot transfuse expired blood unit.',
      });
    }

    const patientRefHash = integrityService.computePatientRefHash(patientRefId);

    unit.status = 'transfused';
    unit.patientRefHash = patientRefHash;

    const newDataHash = integrityService.computeUnitHash(unit);
    unit.dataHash = newDataHash;

    let blockchainResult = null;
    try {
      await blockchainService.ensureUnitOnChain(unit, 'received');
      blockchainResult = await blockchainService.transfuseBloodUnitOnChain(
        unitId,
        patientRefHash,
        newDataHash
      );
      if (blockchainResult) {
        unit.blockchainHistory.push({
          eventType: 'BloodUnitTransfused',
          txHash: blockchainResult.txHash,
          blockNumber: blockchainResult.blockNumber,
          timestamp: new Date(),
          actorAddress: req.user.walletAddress,
          dataHash: newDataHash,
          remarks: `Transfused: ${clinicalNotes}`,
        });
      }
    } catch (bcErr) {
      console.warn(`[Blockchain] Note: Could not record transfusion on-chain: ${bcErr.message}`);
    }

    await unit.save();

    await AuditLog.create({
      action: 'BLOOD_UNIT_TRANSFUSED',
      entityType: 'BLOOD_UNIT',
      entityId: unitId,
      actorId: req.user._id,
      actorUsername: req.user.username,
      actorRole: req.user.role,
      details: { unitId, patientRefHash, clinicalNotes, newDataHash },
      blockchainTxHash: blockchainResult ? blockchainResult.txHash : null,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: `Blood unit ${unitId} transfusion completed and permanently recorded.`,
      unit,
      blockchainResult,
    });
  } catch (err) {
    next(err);
  }
};
