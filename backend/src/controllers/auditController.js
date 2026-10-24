const AuditLog = require('../models/AuditLog');
const BloodUnit = require('../models/BloodUnit');
const blockchainService = require('../services/blockchainService');

// @desc    Get system audit logs
// @route   GET /api/audit
// @access  Private (Staff, Admin)
exports.getAuditLogs = async (req, res, next) => {
  try {
    const { action, entityType, limit = 100 } = req.query;
    const query = {};

    if (action) query.action = action;
    if (entityType) query.entityType = entityType;

    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Blockchain explorer transactions query (authentic on-chain events + distinguished DB records)
// @route   GET /api/audit/blockchain-explorer
// @access  Public / Private
exports.getBlockchainExplorer = async (req, res, next) => {
  try {
    const { query } = req.query;

    const connection = await blockchainService.isBlockchainConnected();

    const transactions = [];
    const seenTxHashes = new Set();

    // 1. Fetch genuine on-chain events from the smart contract if connected
    if (connection.connected) {
      try {
        const liveEvents = await blockchainService.getContractEvents(100);
        for (const evt of liveEvents) {
          if (evt.txHash) {
            seenTxHashes.add(evt.txHash.toLowerCase());
          }
          transactions.push({
            eventType: evt.eventName,
            unitId: (evt.unitId && typeof evt.unitId === 'object') ? 'N/A' : (evt.unitId || 'N/A'),
            txHash: evt.txHash,
            blockNumber: evt.blockNumber,
            timestamp: new Date(evt.timestamp),
            actorAddress: evt.actor,
            dataHash: evt.dataHash,
            remarks: 'On-chain event validated by consensus',
            isConfirmedOnChain: true,
            source: 'smart_contract',
          });
        }
      } catch (evtErr) {
        console.warn('[AuditController] Note: Could not query live events:', evtErr.message);
      }
    }

    // 2. Fetch recorded database unit history
    let unitQuery = {};
    if (query) {
      unitQuery = {
        $or: [
          { unitId: { $regex: query, $options: 'i' } },
          { 'blockchainHistory.txHash': { $regex: query, $options: 'i' } },
          { bloodGroup: { $regex: query, $options: 'i' } },
        ],
      };
    }

    const units = await BloodUnit.find(unitQuery).sort({ updatedAt: -1 }).limit(50);

    units.forEach((u) => {
      (u.blockchainHistory || []).forEach((h) => {
        // If this tx is already in list from on-chain event, augment it
        if (h.txHash && seenTxHashes.has(h.txHash.toLowerCase())) {
          return;
        }

        const isRealTx = Boolean(h.txHash && h.txHash.startsWith('0x') && h.blockNumber);

        transactions.push({
          unitId: u.unitId,
          bloodGroup: u.bloodGroup,
          componentType: u.componentType,
          eventType: h.eventType,
          txHash: h.txHash || null,
          blockNumber: h.blockNumber || null,
          timestamp: h.timestamp || u.createdAt,
          actorAddress: h.actorAddress,
          dataHash: h.dataHash || u.dataHash,
          remarks: h.remarks || 'Database recorded transaction',
          isConfirmedOnChain: isRealTx,
          source: isRealTx ? 'smart_contract' : 'off-chain_db',
        });

        if (h.txHash) {
          seenTxHashes.add(h.txHash.toLowerCase());
        }
      });
    });

    // 3. Filter by search query if provided
    let filteredTransactions = transactions;
    if (query) {
      const qLower = query.toLowerCase();
      filteredTransactions = transactions.filter(
        (t) =>
          (t.unitId && typeof t.unitId === 'string' && t.unitId.toLowerCase().includes(qLower)) ||
          (t.txHash && t.txHash.toLowerCase().includes(qLower)) ||
          (t.eventType && t.eventType.toLowerCase().includes(qLower)) ||
          (t.blockNumber && String(t.blockNumber) === qLower)
      );
    }

    // Sort descending by timestamp
    filteredTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.status(200).json({
      success: true,
      connection,
      count: filteredTransactions.length,
      transactions: filteredTransactions,
    });
  } catch (err) {
    next(err);
  }
};
