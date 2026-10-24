const crypto = require('crypto');
const EmergencyTransfer = require('../models/EmergencyTransfer');
const BloodUnit = require('../models/BloodUnit');
const User = require('../models/User');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const integrityService = require('../services/integrityService');
const blockchainService = require('../services/blockchainService');

// @desc    Search compatible units available in other hospitals for emergency transfer
// @route   GET /api/transfers/search-compatible
// @access  Private (Hospital Staff, Admin)
exports.searchCompatibleHospitalStock = async (req, res, next) => {
  try {
    const { bloodGroup, componentType } = req.query;

    const query = {
      status: 'received', // Stored in hospital inventory
      expiryDate: { $gt: new Date() },
    };

    if (bloodGroup && bloodGroup !== 'all') query.bloodGroup = bloodGroup;
    if (componentType && componentType !== 'all') query.componentType = componentType;

    // Exclude units already held by the calling hospital
    if (req.user.role === 'hospital') {
      query['currentCustodian.id'] = { $ne: req.user._id };
    }

    const units = await BloodUnit.find(query).sort({ expiryDate: 1 });

    res.status(200).json({
      success: true,
      count: units.length,
      units,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Initiate an emergency inter-hospital transfer request
// @route   POST /api/transfers
// @access  Private (Hospital Staff, Admin)
exports.createEmergencyTransfer = async (req, res, next) => {
  try {
    const { unitId, reason = 'Mass casualty / emergency surgical blood shortage', urgency = 'CRITICAL' } = req.body;

    if (!unitId) {
      return res.status(400).json({ success: false, message: 'unitId is mandatory.' });
    }

    const unit = await BloodUnit.findOne({ unitId });
    if (!unit) {
      return res.status(404).json({ success: false, message: 'Blood unit not found.' });
    }

    if (unit.status !== 'received') {
      return res.status(400).json({
        success: false,
        message: `Unit must be in hospital inventory ('received') to request inter-hospital transfer. Current status: '${unit.status}'.`,
      });
    }

    if (new Date() >= unit.expiryDate) {
      return res.status(400).json({ success: false, message: 'Cannot transfer expired unit.' });
    }

    const supplyingHospitalId = unit.currentCustodian?.id || (unit.reservedHospital && unit.reservedHospital.id);
    const supplyingHospital = supplyingHospitalId ? await User.findById(supplyingHospitalId) : null;

    const supplyingHospitalName =
      (supplyingHospital && (supplyingHospital.organizationName || supplyingHospital.username)) ||
      unit.currentCustodian?.name ||
      'Supplying Regional Hospital';

    const supplyingHospitalWallet =
      (supplyingHospital && supplyingHospital.walletAddress) ||
      unit.currentCustodian?.walletAddress ||
      '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

    const transferId = `EMG-TR-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    let blockchainResult = null;
    try {
      // Ensure unit is synced to on-chain received state with supplying hospital wallet as custodian
      await blockchainService.ensureUnitOnChain(unit, 'received', {
        hospitalWallet: supplyingHospitalWallet,
      });

      blockchainResult = await blockchainService.createEmergencyTransferOnChain(
        transferId,
        unitId,
        supplyingHospitalWallet,
        urgency,
        req.user.walletAddress || '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
      );
    } catch (bcErr) {
      console.warn(`[Blockchain] Note: Could not record emergency transfer request on-chain: ${bcErr.message}`);
    }

    const transfer = await EmergencyTransfer.create({
      transferId,
      requestingHospitalId: req.user._id,
      requestingHospitalName: req.user.organizationName || req.user.username,
      requestingHospitalWallet: req.user.walletAddress || '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      supplyingHospitalId: supplyingHospitalId || req.user._id,
      supplyingHospitalName,
      supplyingHospitalWallet,
      unitId,
      bloodGroup: unit.bloodGroup,
      componentType: unit.componentType,
      urgency,
      reason,
      status: 'requested',
      timestamps: {
        requestedAt: new Date(),
      },
      blockchainTxHash: blockchainResult ? blockchainResult.txHash : null,
    });

    // Notify supplying hospital
    if (supplyingHospitalId) {
      await Notification.create({
        userId: supplyingHospitalId,
        title: 'EMERGENCY Blood Transfer Request',
        message: `${req.user.organizationName || req.user.username} requested emergency transfer of ${unit.bloodGroup} ${unit.componentType} (${unitId}). Reason: ${reason}`,
        type: 'emergency',
        link: `/transfers`,
      });
    }

    await AuditLog.create({
      action: 'EMERGENCY_TRANSFER_REQUESTED',
      entityType: 'TRANSFER',
      entityId: transferId,
      actorId: req.user._id,
      actorUsername: req.user.username,
      actorRole: req.user.role,
      details: { transferId, unitId, urgency, supplyingHospital: supplyingHospitalName, requestingHospital: transfer.requestingHospitalName },
      blockchainTxHash: blockchainResult ? blockchainResult.txHash : null,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Emergency transfer initiated and broadcasted.',
      transfer,
      blockchainResult,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all emergency transfers
// @route   GET /api/transfers
// @access  Private
exports.getTransfers = async (req, res, next) => {
  try {
    const query = {};
    if (req.user.role === 'hospital') {
      query.$or = [{ requestingHospitalId: req.user._id }, { supplyingHospitalId: req.user._id }];
    }

    const transfers = await EmergencyTransfer.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: transfers.length,
      transfers,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Complete emergency transfer upon physical delivery to requesting hospital
// @route   POST /api/transfers/:transferId/complete
// @access  Private (Requesting Hospital Staff, Admin)
exports.completeEmergencyTransfer = async (req, res, next) => {
  try {
    const { transferId } = req.params;

    const transfer = await EmergencyTransfer.findOne({ transferId });
    if (!transfer) {
      return res.status(404).json({ success: false, message: 'Transfer record not found.' });
    }

    if (transfer.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Transfer is already marked complete.' });
    }

    const unit = await BloodUnit.findOne({ unitId: transfer.unitId });
    if (!unit) {
      return res.status(404).json({ success: false, message: 'Blood unit not found.' });
    }

    const completedAt = new Date();
    const elapsedMinutes = Math.max(1, Math.round((completedAt - new Date(transfer.timestamps.requestedAt)) / 60000));

    transfer.status = 'completed';
    transfer.timestamps.completedAt = completedAt;
    transfer.elapsedTimeMinutes = elapsedMinutes;

    // Update unit custodian to requesting hospital
    unit.currentCustodian = {
      role: 'hospital',
      id: transfer.requestingHospitalId,
      name: transfer.requestingHospitalName,
      walletAddress: transfer.requestingHospitalWallet,
    };
    unit.status = 'received';

    const newDataHash = integrityService.computeUnitHash(unit);
    unit.dataHash = newDataHash;

    let blockchainResult = null;
    try {
      // Ensure the transfer request exists on-chain before completing it
      await blockchainService.ensureTransferOnChain(
        transfer,
        transfer.supplyingHospitalWallet,
        transfer.urgency
      );

      blockchainResult = await blockchainService.completeEmergencyTransferOnChain(transferId, newDataHash);
      if (blockchainResult) {
        unit.blockchainHistory.push({
          eventType: 'BloodTransferCompleted',
          txHash: blockchainResult.txHash,
          blockNumber: blockchainResult.blockNumber,
          timestamp: completedAt,
          actorAddress: req.user.walletAddress,
          dataHash: newDataHash,
          remarks: `Emergency transfer ${transferId} completed. Elapsed: ${elapsedMinutes} mins.`,
        });
      }
    } catch (bcErr) {
      console.warn(`[Blockchain] Note: Could not record transfer completion on-chain: ${bcErr.message}`);
    }

    await unit.save();
    await transfer.save();

    await AuditLog.create({
      action: 'EMERGENCY_TRANSFER_COMPLETED',
      entityType: 'TRANSFER',
      entityId: transferId,
      actorId: req.user._id,
      actorUsername: req.user.username,
      actorRole: req.user.role,
      details: { transferId, unitId: transfer.unitId, elapsedMinutes, newDataHash, requestingHospital: transfer.requestingHospitalName },
      blockchainTxHash: blockchainResult ? blockchainResult.txHash : null,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: `Emergency transfer completed in ${elapsedMinutes} minutes. Custody successfully transferred.`,
      transfer,
      unit,
      blockchainResult,
    });
  } catch (err) {
    next(err);
  }
};
