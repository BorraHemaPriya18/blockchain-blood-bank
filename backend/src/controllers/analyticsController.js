const User = require('../models/User');
const BloodUnit = require('../models/BloodUnit');
const BloodRequest = require('../models/BloodRequest');
const EmergencyTransfer = require('../models/EmergencyTransfer');
const AuditLog = require('../models/AuditLog');
const blockchainService = require('../services/blockchainService');

// @desc    Get comprehensive role-based dashboard analytics & metrics
// @route   GET /api/analytics/dashboard
// @access  Private
exports.getDashboardMetrics = async (req, res, next) => {
  try {
    const role = req.user.role;
    const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const componentTypes = ['Whole Blood', 'Red Blood Cells', 'Platelets', 'Plasma'];
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 1. ADMIN ROLE ANALYTICS
    if (role === 'admin') {
      const totalDonors = await User.countDocuments({ role: 'donor' });
      const totalBloodBanks = await User.countDocuments({ role: 'blood_bank', isApproved: true });
      const totalHospitals = await User.countDocuments({ role: 'hospital', isApproved: true });
      const pendingApprovals = await User.countDocuments({
        role: { $in: ['blood_bank', 'hospital'] },
        isApproved: false,
      });

      const totalUnits = await BloodUnit.countDocuments();
      const availableUnits = await BloodUnit.countDocuments({ status: { $in: ['available', 'approved'] } });

      // Blood group breakdown across network
      const groupBreakdown = {};
      for (const bg of bloodGroups) {
        groupBreakdown[bg] = await BloodUnit.countDocuments({
          bloodGroup: bg,
          status: { $in: ['available', 'approved'] },
        });
      }

      // Component breakdown across network
      const componentBreakdown = {};
      for (const comp of componentTypes) {
        componentBreakdown[comp] = await BloodUnit.countDocuments({
          componentType: comp,
          status: { $in: ['available', 'approved'] },
        });
      }

      const totalRequests = await BloodRequest.countDocuments();
      const pendingRequests = await BloodRequest.countDocuments({ status: 'pending' });
      const approvedRequests = await BloodRequest.countDocuments({ status: 'approved' });
      const fulfilledRequests = await BloodRequest.countDocuments({ status: 'fulfilled' });
      const emergencyRequests = await BloodRequest.countDocuments({ urgency: 'emergency' });
      const fulfillmentRate = totalRequests > 0 ? Math.round((fulfilledRequests / totalRequests) * 100) : 100;

      const totalEmergencyTransfers = await EmergencyTransfer.countDocuments();
      const activeEmergencyTransfers = await EmergencyTransfer.countDocuments({ status: { $in: ['requested', 'approved', 'dispatched'] } });
      const completedEmergencyTransfers = await EmergencyTransfer.countDocuments({ status: 'completed' });

      const expiringSoon = await BloodUnit.countDocuments({
        status: { $in: ['available', 'approved', 'received'] },
        expiryDate: { $gt: now, $lte: sevenDaysLater },
      });

      const expiredCount = await BloodUnit.countDocuments({
        $or: [
          { status: 'expired' },
          { status: { $in: ['available', 'approved'] }, expiryDate: { $lte: now } },
        ],
      });
      const discardedCount = await BloodUnit.countDocuments({ status: 'discarded' });

      // Monthly trends over past 6 months
      const monthlyTrends = [];
      for (let i = 5; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        const monthName = start.toLocaleString('default', { month: 'short' });
        const reqCount = await BloodRequest.countDocuments({ createdAt: { $gte: start, $lte: end } });
        const unitCount = await BloodUnit.countDocuments({ createdAt: { $gte: start, $lte: end } });
        monthlyTrends.push({ month: monthName, requests: reqCount, collections: unitCount });
      }

      // Blockchain transaction stats
      const totalBlockchainTxs = await AuditLog.countDocuments({
        blockchainTxHash: { $ne: null, $exists: true },
      });
      const failedBlockchainTxs = await AuditLog.countDocuments({
        action: { $regex: /FAIL|REVERT|ERROR/i },
      });

      const chainStatus = await blockchainService.isBlockchainConnected();

      return res.status(200).json({
        success: true,
        data: {
          role: 'admin',
          totalDonors,
          totalBloodBanks,
          totalHospitals,
          pendingApprovals,
          totalUnits,
          availableUnits,
          groupBreakdown,
          componentBreakdown,
          totalRequests,
          pendingRequests,
          approvedRequests,
          fulfilledRequests,
          fulfillmentRate,
          emergencyRequests,
          totalEmergencyTransfers,
          activeEmergencyTransfers,
          completedEmergencyTransfers,
          expiringSoon,
          expiredCount,
          discardedCount,
          monthlyTrends,
          totalBlockchainTxs,
          failedBlockchainTxs,
          blockchainConnected: chainStatus.connected,
          blockNumber: chainStatus.blockNumber || 108,
        },
      });
    }

    // 2. BLOOD BANK ROLE ANALYTICS
    if (role === 'blood_bank') {
      const bankId = req.user._id;

      const ownUnits = await BloodUnit.find({
        $or: [{ bloodBankId: bankId }, { 'currentCustodian.id': bankId }],
      });

      const totalUnits = ownUnits.length;
      const availableUnits = ownUnits.filter((u) => ['available', 'approved'].includes(u.status)).length;
      const pendingScreening = ownUnits.filter((u) => ['collected', 'pending_screening'].includes(u.status)).length;
      const reservedUnits = ownUnits.filter((u) => u.status === 'reserved').length;
      const dispatchedUnits = ownUnits.filter((u) => u.status === 'dispatched').length;

      const groupBreakdown = {};
      for (const bg of bloodGroups) {
        groupBreakdown[bg] = ownUnits.filter((u) => u.bloodGroup === bg && ['available', 'approved'].includes(u.status)).length;
      }

      const componentBreakdown = {};
      for (const comp of componentTypes) {
        componentBreakdown[comp] = ownUnits.filter((u) => u.componentType === comp && ['available', 'approved'].includes(u.status)).length;
      }

      const expiringSoon = ownUnits.filter((u) =>
        ['available', 'approved'].includes(u.status) &&
        new Date(u.expiryDate) > now &&
        new Date(u.expiryDate) <= sevenDaysLater
      ).length;

      const expiredCount = ownUnits.filter((u) =>
        u.status === 'expired' || (['available', 'approved'].includes(u.status) && new Date(u.expiryDate) <= now)
      ).length;

      // Pending requests in the network eligible for this bank to fulfill
      const pendingRequests = await BloodRequest.countDocuments({
        status: 'pending',
        $or: [{ bloodBankId: bankId }, { bloodBankId: null }, { bloodBankName: 'All Participating Blood Banks' }],
      });

      // Total allocations made by this blood bank
      const totalAllocated = await BloodRequest.countDocuments({
        bloodBankId: bankId,
        status: { $in: ['approved', 'fulfilled'] },
      });

      // Monthly collections by this blood bank
      const stockTrends = [];
      for (let i = 5; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        const monthName = start.toLocaleString('default', { month: 'short' });
        const count = ownUnits.filter((u) => new Date(u.createdAt) >= start && new Date(u.createdAt) <= end).length;
        stockTrends.push({ month: monthName, collections: count });
      }

      return res.status(200).json({
        success: true,
        data: {
          role: 'blood_bank',
          totalUnits,
          availableUnits,
          pendingScreening,
          reservedUnits,
          dispatchedUnits,
          groupBreakdown,
          componentBreakdown,
          expiringSoon,
          expiredCount,
          pendingRequests,
          totalAllocated,
          stockTrends,
        },
      });
    }

    // 3. HOSPITAL ROLE ANALYTICS
    if (role === 'hospital') {
      const hospitalId = req.user._id;

      const ownRequests = await BloodRequest.find({ hospitalId });
      const totalRequests = ownRequests.length;
      const pendingRequests = ownRequests.filter((r) => r.status === 'pending').length;
      const approvedRequests = ownRequests.filter((r) => r.status === 'approved').length;
      const fulfilledRequests = ownRequests.filter((r) => r.status === 'fulfilled').length;

      let totalUnitsRequested = 0;
      let totalUnitsAllocated = 0;
      ownRequests.forEach((r) => {
        totalUnitsRequested += Number(r.quantity) || 1;
        totalUnitsAllocated += (r.allocatedUnits && r.allocatedUnits.length) || 0;
      });

      const fulfillmentRate = totalUnitsRequested > 0
        ? Math.round((totalUnitsAllocated / totalUnitsRequested) * 100)
        : 100;

      // Hospital's on-site blood inventory (received units)
      const hospitalStock = await BloodUnit.find({
        status: 'received',
        'currentCustodian.id': hospitalId,
      });

      const groupBreakdown = {};
      for (const bg of bloodGroups) {
        groupBreakdown[bg] = hospitalStock.filter((u) => u.bloodGroup === bg).length;
      }

      // Transfusions logged by this hospital
      const transfusedCount = await BloodUnit.countDocuments({
        status: 'transfused',
        'currentCustodian.id': hospitalId,
      });

      // Emergency transfers involving this hospital
      const emergencyTransfersRequested = await EmergencyTransfer.countDocuments({ requestingHospitalId: hospitalId });
      const emergencyTransfersSupplied = await EmergencyTransfer.countDocuments({ supplyingHospitalId: hospitalId });

      // Demand breakdown by group
      const demandByGroup = {};
      for (const bg of bloodGroups) {
        demandByGroup[bg] = ownRequests.filter((r) => r.bloodGroup === bg).reduce((acc, r) => acc + (Number(r.quantity) || 1), 0);
      }

      return res.status(200).json({
        success: true,
        data: {
          role: 'hospital',
          totalRequests,
          pendingRequests,
          approvedRequests,
          fulfilledRequests,
          totalUnitsRequested,
          totalUnitsAllocated,
          fulfillmentRate,
          receivedUnitsCount: hospitalStock.length,
          transfusedCount,
          emergencyTransfersRequested,
          emergencyTransfersSupplied,
          groupBreakdown,
          demandByGroup,
        },
      });
    }

    // Default / Donor overview
    const totalDonors = await User.countDocuments({ role: 'donor' });
    const totalUnits = await BloodUnit.countDocuments();
    const groupBreakdown = {};
    for (const bg of bloodGroups) {
      groupBreakdown[bg] = await BloodUnit.countDocuments({ bloodGroup: bg, status: { $in: ['available', 'approved'] } });
    }

    res.status(200).json({
      success: true,
      data: {
        role: role || 'donor',
        totalDonors,
        totalUnits,
        groupBreakdown,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Export downloadable reports as clean CSV with proper headers
// @route   GET /api/analytics/export-csv
// @access  Private (Staff, Admin)
exports.exportCSV = async (req, res, next) => {
  try {
    const { type = 'inventory' } = req.query;
    let csvContent = '';
    let filename = `blood_supply_chain_${type}_report_${Date.now()}.csv`;

    if (type === 'requests') {
      const requests = await BloodRequest.find().sort({ createdAt: -1 });
      csvContent = 'RequestId,Hospital,BloodBank,BloodGroup,Component,Quantity,Urgency,Status,PatientRefId,AllocatedUnits,CreatedAt,RequiredByDate\n';
      requests.forEach((r) => {
        const createdStr = r.createdAt ? r.createdAt.toISOString().slice(0, 10) : '';
        const requiredStr = r.requiredByDate ? r.requiredByDate.toISOString().slice(0, 10) : '';
        const allocated = (r.allocatedUnits || []).join(';');
        csvContent += `"${r.requestId}","${r.hospitalName || ''}","${r.bloodBankName || 'All'}","${r.bloodGroup}","${r.componentType}",${r.quantity},"${r.urgency}","${r.status}","${r.patientRefId}","${allocated}","${createdStr}","${requiredStr}"\n`;
      });
    } else if (type === 'transfers') {
      const transfers = await EmergencyTransfer.find().sort({ createdAt: -1 });
      csvContent = 'TransferId,UnitId,RequestingHospital,SupplyingHospital,BloodGroup,Component,Urgency,Status,RequestedAt,CompletedAt,ElapsedMinutes,TxHash\n';
      transfers.forEach((t) => {
        const reqAt = t.timestamps?.requestedAt ? new Date(t.timestamps.requestedAt).toISOString().slice(0, 16).replace('T', ' ') : '';
        const compAt = t.timestamps?.completedAt ? new Date(t.timestamps.completedAt).toISOString().slice(0, 16).replace('T', ' ') : '';
        csvContent += `"${t.transferId}","${t.unitId}","${t.requestingHospitalName}","${t.supplyingHospitalName}","${t.bloodGroup}","${t.componentType}","${t.urgency}","${t.status}","${reqAt}","${compAt}",${t.elapsedTimeMinutes || ''},"${t.blockchainTxHash || ''}"\n`;
      });
    } else if (type === 'audit') {
      const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(500);
      csvContent = 'Timestamp,Action,EntityType,EntityId,ActorUsername,ActorRole,BlockchainTxHash,Details\n';
      logs.forEach((l) => {
        const ts = l.timestamp ? l.timestamp.toISOString().slice(0, 19).replace('T', ' ') : '';
        const detailsStr = JSON.stringify(l.details || {}).replace(/"/g, '""');
        csvContent += `"${ts}","${l.action}","${l.entityType}","${l.entityId || ''}","${l.actorUsername}","${l.actorRole}","${l.blockchainTxHash || ''}","${detailsStr}"\n`;
      });
    } else {
      // Default: Blood Unit Inventory
      const units = await BloodUnit.find().sort({ createdAt: -1 });
      csvContent = 'UnitId,BloodGroup,Component,Status,ScreeningStatus,CollectionDate,ExpiryDate,Custodian,DataHash,LastTxHash\n';
      units.forEach((u) => {
        const colDate = u.collectionDate ? u.collectionDate.toISOString().slice(0, 10) : '';
        const expDate = u.expiryDate ? u.expiryDate.toISOString().slice(0, 10) : '';
        const custodian = (u.currentCustodian && u.currentCustodian.name) || '';
        const lastTx = u.blockchainHistory && u.blockchainHistory.length > 0
          ? u.blockchainHistory[u.blockchainHistory.length - 1].txHash || ''
          : '';
        csvContent += `"${u.unitId}","${u.bloodGroup}","${u.componentType}","${u.status}","${u.screeningStatus}","${colDate}","${expDate}","${custodian}","${u.dataHash || ''}","${lastTx}"\n`;
      });
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
};
