const crypto = require('crypto');
const BloodRequest = require('../models/BloodRequest');
const BloodUnit = require('../models/BloodUnit');
const User = require('../models/User');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const integrityService = require('../services/integrityService');
const blockchainService = require('../services/blockchainService');

// Blood group compatibility validation helper
function isBloodGroupCompatible(donorGroup, recipientGroup) {
  if (donorGroup === recipientGroup) return true;
  if (donorGroup === 'O-') return true; // Universal donor
  if (donorGroup === 'O+' && ['O+', 'A+', 'B+', 'AB+'].includes(recipientGroup)) return true;
  if (donorGroup === 'A-' && ['A-', 'A+', 'AB-', 'AB+'].includes(recipientGroup)) return true;
  if (donorGroup === 'A+' && ['A+', 'AB+'].includes(recipientGroup)) return true;
  if (donorGroup === 'B-' && ['B-', 'B+', 'AB-', 'AB+'].includes(recipientGroup)) return true;
  if (donorGroup === 'B+' && ['B+', 'AB+'].includes(recipientGroup)) return true;
  if (donorGroup === 'AB-' && ['AB-', 'AB+'].includes(recipientGroup)) return true;
  return false;
}

// @desc    Submit a new blood request from hospital
// @route   POST /api/requests
// @access  Private (Hospital Staff, Admin)
exports.createRequest = async (req, res, next) => {
  try {
    const {
      bloodGroup,
      componentType,
      quantity = 1,
      urgency = 'normal',
      patientRefId,
      requiredByDate,
      remarks,
      bloodBankId,
    } = req.body;

    if (!bloodGroup || !componentType || !patientRefId) {
      return res.status(400).json({
        success: false,
        message: 'bloodGroup, componentType, and patientRefId are mandatory.',
      });
    }

    let targetBankName = 'All Participating Blood Banks';
    let targetBankId = null;

    if (bloodBankId) {
      const bankUser = await User.findById(bloodBankId);
      if (bankUser) {
        targetBankId = bankUser._id;
        targetBankName = bankUser.organizationName || bankUser.username;
      }
    }

    const requestId = `REQ-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const request = await BloodRequest.create({
      requestId,
      hospitalId: req.user._id,
      hospitalName: req.user.organizationName || req.user.username,
      hospitalWallet: req.user.walletAddress || '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      bloodBankId: targetBankId,
      bloodBankName: targetBankName,
      bloodGroup,
      componentType,
      quantity: Number(quantity),
      urgency,
      patientRefId,
      requiredByDate: requiredByDate ? new Date(requiredByDate) : new Date(Date.now() + 48 * 3600 * 1000),
      remarks,
      status: 'pending',
    });

    await AuditLog.create({
      action: 'BLOOD_REQUEST_CREATED',
      entityType: 'REQUEST',
      entityId: requestId,
      actorId: req.user._id,
      actorUsername: req.user.username,
      actorRole: req.user.role,
      details: { requestId, bloodGroup, componentType, quantity, urgency, targetBankName },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Blood request submitted successfully.',
      request,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get hospital blood requests
// @route   GET /api/requests
// @access  Private (Hospital, Blood Bank, Admin)
exports.getRequests = async (req, res, next) => {
  try {
    const { status, urgency, bloodGroup, search } = req.query;
    const query = {};

    if (status && status !== 'all') query.status = status;
    if (urgency && urgency !== 'all') query.urgency = urgency;
    if (bloodGroup && bloodGroup !== 'all') query.bloodGroup = bloodGroup;

    // Hospital sees only its own requests
    if (req.user.role === 'hospital') {
      query.hospitalId = req.user._id;
    } else if (req.user.role === 'blood_bank') {
      // Blood bank sees requests targeted to it or open to all
      query.$or = [
        { bloodBankId: req.user._id },
        { bloodBankId: null },
        { bloodBankName: 'All Participating Blood Banks' },
        { bloodBankId: { $exists: false } },
      ];
    }

    if (search) {
      query.$or = [
        { requestId: { $regex: search, $options: 'i' } },
        { hospitalName: { $regex: search, $options: 'i' } },
        { patientRefId: { $regex: search, $options: 'i' } },
      ];
    }

    const requests = await BloodRequest.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Allocate available blood units to a pending request
// @route   POST /api/requests/:requestId/allocate
// @access  Private (Blood Bank Staff, Admin)
exports.allocateUnits = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { unitIds } = req.body; // Array of unitId strings to allocate

    if (!Array.isArray(unitIds) || unitIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of unitIds to allocate.',
      });
    }

    const bloodReq = await BloodRequest.findOne({ requestId });
    if (!bloodReq) {
      return res.status(404).json({ success: false, message: 'Blood request not found.' });
    }

    if (['fulfilled', 'rejected', 'cancelled'].includes(bloodReq.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot allocate to request in '${bloodReq.status}' state.`,
      });
    }

    const now = new Date();
    const allocatedSuccess = [];
    const errors = [];

    for (const unitId of unitIds) {
      const unit = await BloodUnit.findOne({ unitId });
      if (!unit) {
        errors.push(`Unit ${unitId} does not exist.`);
        continue;
      }

      // Check screening approval
      if (unit.screeningStatus !== 'passed' || unit.status !== 'available') {
        errors.push(`Unit ${unitId} is not available (status: ${unit.status}, screening: ${unit.screeningStatus}).`);
        continue;
      }

      // Check expiry
      if (unit.expiryDate <= now) {
        unit.status = 'expired';
        await unit.save();
        errors.push(`Unit ${unitId} has expired and cannot be allocated.`);
        continue;
      }

      // Check ABO/Rh compatibility
      const isCompatible = isBloodGroupCompatible(unit.bloodGroup, bloodReq.bloodGroup);
      if (!isCompatible || unit.componentType !== bloodReq.componentType) {
        errors.push(`Unit ${unitId} (${unit.bloodGroup} ${unit.componentType}) is not compatible with request (${bloodReq.bloodGroup} ${bloodReq.componentType}).`);
        continue;
      }

      // If user is blood bank, ensure unit belongs to their inventory
      if (req.user.role === 'blood_bank') {
        const custodianId = (unit.currentCustodian && unit.currentCustodian.id && unit.currentCustodian.id.toString()) || (unit.bloodBankId && unit.bloodBankId.toString());
        if (custodianId && custodianId !== req.user._id.toString()) {
          errors.push(`Unit ${unitId} is not in the custody of ${req.user.organizationName || req.user.username}.`);
          continue;
        }
      }

      // Reserve unit
      unit.status = 'reserved';
      unit.hospitalRequestId = requestId;
      unit.reservedHospital = {
        id: bloodReq.hospitalId,
        name: bloodReq.hospitalName,
        walletAddress: bloodReq.hospitalWallet || '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      };

      const newDataHash = integrityService.computeUnitHash(unit);
      unit.dataHash = newDataHash;

      // Ensure unit is synced to smart contract before reservation
      let blockchainResult = null;
      try {
        await blockchainService.ensureUnitOnChain(unit, 'available');
        blockchainResult = await blockchainService.reserveBloodUnitOnChain(
          unitId,
          bloodReq.hospitalWallet || '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
          requestId,
          newDataHash,
          bloodReq.bloodGroup,
          bloodReq.componentType
        );
        if (blockchainResult) {
          unit.blockchainHistory.push({
            eventType: 'BloodUnitReserved',
            txHash: blockchainResult.txHash,
            blockNumber: blockchainResult.blockNumber,
            timestamp: new Date(),
            actorAddress: req.user.walletAddress,
            dataHash: newDataHash,
            remarks: `Reserved for request ${requestId}`,
          });
        }
      } catch (bcErr) {
        console.warn(`[Blockchain] Note: Could not record reservation on-chain: ${bcErr.message}`);
      }

      await unit.save();

      if (!bloodReq.allocatedUnits.includes(unitId)) {
        bloodReq.allocatedUnits.push(unitId);
      }
      allocatedSuccess.push(unitId);
    }

    if (allocatedSuccess.length > 0) {
      bloodReq.bloodBankId = req.user._id;
      bloodReq.bloodBankName = req.user.organizationName || req.user.username;
      if (bloodReq.allocatedUnits.length >= bloodReq.quantity) {
        bloodReq.status = 'approved';
      }
      await bloodReq.save();

      // Notify hospital
      await Notification.create({
        userId: bloodReq.hospitalId,
        title: 'Blood Units Allocated',
        message: `${allocatedSuccess.length} unit(s) reserved for Request ${requestId} by ${req.user.organizationName || req.user.username}.`,
        type: 'success',
        link: `/requests`,
      });

      await AuditLog.create({
        action: 'BLOOD_UNITS_ALLOCATED',
        entityType: 'REQUEST',
        entityId: requestId,
        actorId: req.user._id,
        actorUsername: req.user.username,
        actorRole: req.user.role,
        details: { requestId, allocatedUnits: allocatedSuccess, errors },
        ipAddress: req.ip,
      });
    }

    res.status(200).json({
      success: allocatedSuccess.length > 0,
      message: allocatedSuccess.length > 0
        ? `Allocated ${allocatedSuccess.length} unit(s) to request ${requestId}.`
        : 'No units were allocated. Please check compatibility and available stock.',
      allocatedUnits: allocatedSuccess,
      errors,
      request: bloodReq,
    });
  } catch (err) {
    next(err);
  }
};
