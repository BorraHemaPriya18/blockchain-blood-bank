const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

let provider = null;
let contractInstance = null;
let contractAddress = null;
let contractAbi = null;

// Sequential transaction mutex to prevent concurrency conflicts
let txMutex = Promise.resolve();
function queueTx(fn) {
  const next = txMutex.then(fn, fn);
  txMutex = next.catch(() => {});
  return next;
}

// In-memory sequential nonce tracker for deterministic mining on Ganache & Hardhat
const accountNonceMap = new Map();

async function getNextNonce(signer) {
  try {
    const addr = (await signer.getAddress()).toLowerCase();
    let currentNonce = accountNonceMap.get(addr);
    if (currentNonce === undefined) {
      currentNonce = await provider.getTransactionCount(addr, 'latest');
    }
    const assigned = currentNonce;
    accountNonceMap.set(addr, currentNonce + 1);
    return assigned;
  } catch {
    return undefined;
  }
}

function resetNonce(addr) {
  if (addr) accountNonceMap.delete(addr.toLowerCase());
  else accountNonceMap.clear();
}

function initBlockchain() {
  const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  provider = new ethers.JsonRpcProvider(rpcUrl);

  const adminPrivateKey =
    process.env.ADMIN_PRIVATE_KEY ||
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Default Account #0

  const adminWallet = new ethers.Wallet(adminPrivateKey, provider);

  // Load contract deployment info if exists
  const configPath = path.join(__dirname, '../config/BloodSupplyChain.json');
  if (fs.existsSync(configPath)) {
    try {
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      contractAddress = process.env.CONTRACT_ADDRESS || configData.address;
      contractAbi = configData.abi;
      if (contractAddress && contractAbi && adminWallet) {
        contractInstance = new ethers.Contract(contractAddress, contractAbi, adminWallet);
        console.log(`[Blockchain] Contract attached at ${contractAddress}`);
      }
    } catch (err) {
      console.warn('[Blockchain] Error loading contract config:', err.message);
    }
  } else {
    console.log('[Blockchain] BloodSupplyChain.json not found yet; will attach after deployment.');
  }
}

// Helper to get signer with a fresh wallet instance connected to provider to prevent internal nonce caching
function getSigner(privateKey) {
  if (!provider) initBlockchain();
  const pk = privateKey || process.env.ADMIN_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  return new ethers.Wallet(pk, provider);
}

function getContractWithSigner(signer) {
  if (!contractInstance) {
    initBlockchain();
  }
  if (!contractInstance) {
    throw new Error('Contract not initialized or deployed yet. Run deployment script first.');
  }
  return contractInstance.connect(signer || getSigner());
}

async function registerBloodBankOnChain(address, name, licenseNumber, isAuthorized = true) {
  return queueTx(async () => {
    const signer = getSigner();
    const contract = getContractWithSigner(signer);
    const nonce = await getNextNonce(signer);
    const overrides = nonce !== undefined ? { nonce } : {};
    try {
      const tx = await contract.registerBloodBank(address, name, licenseNumber, isAuthorized, overrides);
      const receipt = await tx.wait(1);
      return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
    } catch (err) {
      resetNonce(signer.address);
      throw err;
    }
  });
}

async function registerHospitalOnChain(address, name, licenseNumber, isAuthorized = true) {
  return queueTx(async () => {
    const signer = getSigner();
    const contract = getContractWithSigner(signer);
    const nonce = await getNextNonce(signer);
    const overrides = nonce !== undefined ? { nonce } : {};
    try {
      const tx = await contract.registerHospital(address, name, licenseNumber, isAuthorized, overrides);
      const receipt = await tx.wait(1);
      return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
    } catch (err) {
      resetNonce(signer.address);
      throw err;
    }
  });
}

async function registerBloodUnitOnChain(unitId, bloodGroup, componentType, collectionTimestamp, expiryTimestamp, dataHash, privateKey) {
  return queueTx(async () => {
    const signer = getSigner(privateKey);
    const contract = getContractWithSigner(signer);
    const nonce = await getNextNonce(signer);
    const overrides = nonce !== undefined ? { nonce } : {};
    try {
      const tx = await contract.registerBloodUnit(
        unitId,
        bloodGroup,
        componentType,
        Math.floor(collectionTimestamp / 1000),
        Math.floor(expiryTimestamp / 1000),
        dataHash,
        overrides
      );
      const receipt = await tx.wait(1);
      return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
    } catch (err) {
      resetNonce(signer.address);
      throw err;
    }
  });
}

async function updateScreeningOnChain(unitId, screeningStatusCode, remarks, dataHash, privateKey) {
  return queueTx(async () => {
    const signer = getSigner(privateKey);
    const contract = getContractWithSigner(signer);
    const nonce = await getNextNonce(signer);
    const overrides = nonce !== undefined ? { nonce } : {};
    try {
      const tx = await contract.updateScreeningStatus(unitId, screeningStatusCode, remarks, dataHash, overrides);
      const receipt = await tx.wait(1);
      return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
    } catch (err) {
      resetNonce(signer.address);
      throw err;
    }
  });
}

async function reserveBloodUnitOnChain(unitId, hospitalAddress, requestId, dataHash, privateKey) {
  return queueTx(async () => {
    const signer = getSigner(privateKey);
    const contract = getContractWithSigner(signer);
    const nonce = await getNextNonce(signer);
    const overrides = nonce !== undefined ? { nonce } : {};
    try {
      const tx = await contract.reserveBloodUnit(unitId, hospitalAddress, requestId, dataHash, overrides);
      const receipt = await tx.wait(1);
      return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
    } catch (err) {
      resetNonce(signer.address);
      throw err;
    }
  });
}

async function dispatchBloodUnitOnChain(unitId, destinationAddress, shipmentRef, dataHash, privateKey) {
  return queueTx(async () => {
    const signer = getSigner(privateKey);
    const contract = getContractWithSigner(signer);
    const nonce = await getNextNonce(signer);
    const overrides = nonce !== undefined ? { nonce } : {};
    try {
      const tx = await contract.dispatchBloodUnit(unitId, destinationAddress, shipmentRef, dataHash, overrides);
      const receipt = await tx.wait(1);
      return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
    } catch (err) {
      resetNonce(signer.address);
      throw err;
    }
  });
}

async function receiveBloodUnitOnChain(unitId, dataHash, privateKey) {
  return queueTx(async () => {
    const signer = getSigner(privateKey);
    const contract = getContractWithSigner(signer);
    const nonce = await getNextNonce(signer);
    const overrides = nonce !== undefined ? { nonce } : {};
    try {
      const tx = await contract.receiveBloodUnit(unitId, dataHash, overrides);
      const receipt = await tx.wait(1);
      return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
    } catch (err) {
      resetNonce(signer.address);
      throw err;
    }
  });
}

async function transfuseBloodUnitOnChain(unitId, patientRefHash, dataHash, privateKey) {
  return queueTx(async () => {
    const signer = getSigner(privateKey);
    const contract = getContractWithSigner(signer);
    const nonce = await getNextNonce(signer);
    const overrides = nonce !== undefined ? { nonce } : {};
    try {
      const tx = await contract.transfuseBloodUnit(unitId, patientRefHash, dataHash, overrides);
      const receipt = await tx.wait(1);
      return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
    } catch (err) {
      resetNonce(signer.address);
      throw err;
    }
  });
}

async function recordExpiryOnChain(unitId, dataHash, privateKey) {
  return queueTx(async () => {
    const signer = getSigner(privateKey);
    const contract = getContractWithSigner(signer);
    const nonce = await getNextNonce(signer);
    const overrides = nonce !== undefined ? { nonce } : {};
    try {
      const tx = await contract.recordExpiry(unitId, dataHash, overrides);
      const receipt = await tx.wait(1);
      return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
    } catch (err) {
      resetNonce(signer.address);
      throw err;
    }
  });
}

async function discardBloodUnitOnChain(unitId, reason, dataHash, privateKey) {
  return queueTx(async () => {
    const signer = getSigner(privateKey);
    const contract = getContractWithSigner(signer);
    const nonce = await getNextNonce(signer);
    const overrides = nonce !== undefined ? { nonce } : {};
    try {
      const tx = await contract.discardBloodUnit(unitId, reason, dataHash, overrides);
      const receipt = await tx.wait(1);
      return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
    } catch (err) {
      resetNonce(signer.address);
      throw err;
    }
  });
}

async function createEmergencyTransferOnChain(transferId, unitId, supplyingHospitalAddress, urgency, requestingHospitalAddress, privateKey) {
  let reqHospital = requestingHospitalAddress;
  let pk = privateKey;
  if (typeof reqHospital === 'string' && reqHospital.length === 66 && !reqHospital.startsWith('0x0000')) {
    pk = reqHospital;
    reqHospital = null;
  }

  return queueTx(async () => {
    const signer = getSigner(pk);
    const contract = getContractWithSigner(signer);
    const nonce = await getNextNonce(signer);
    const overrides = nonce !== undefined ? { nonce } : {};
    try {
      let tx;
      if (reqHospital && typeof contract['createEmergencyTransfer(string,string,address,address,string)'] === 'function') {
        tx = await contract['createEmergencyTransfer(string,string,address,address,string)'](
          transferId,
          unitId,
          reqHospital,
          supplyingHospitalAddress,
          urgency,
          overrides
        );
      } else {
        tx = await contract['createEmergencyTransfer(string,string,address,string)'](
          transferId,
          unitId,
          supplyingHospitalAddress,
          urgency,
          overrides
        );
      }
      const receipt = await tx.wait(1);
      return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
    } catch (err) {
      resetNonce(signer.address);
      throw err;
    }
  });
}

async function completeEmergencyTransferOnChain(transferId, dataHash, privateKey) {
  return queueTx(async () => {
    const signer = getSigner(privateKey);
    const contract = getContractWithSigner(signer);
    const nonce = await getNextNonce(signer);
    const overrides = nonce !== undefined ? { nonce } : {};
    try {
      const tx = await contract.completeEmergencyTransfer(transferId, dataHash, overrides);
      const receipt = await tx.wait(1);
      return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
    } catch (err) {
      resetNonce(signer.address);
      throw err;
    }
  });
}

async function getBloodUnitFromChain(unitId) {
  if (!contractInstance) initBlockchain();
  if (!contractInstance) return null;
  try {
    const raw = await contractInstance.getBloodUnit(unitId);
    return {
      unitId: raw[0],
      bloodGroup: raw[1],
      componentType: raw[2],
      collectionTimestamp: Number(raw[3]) * 1000,
      expiryTimestamp: Number(raw[4]) * 1000,
      screeningStatus: Number(raw[5]),
      status: Number(raw[6]),
      currentCustodian: raw[7],
      bloodBank: raw[8],
      hospital: raw[9],
      dataHash: raw[10],
    };
  } catch (err) {
    return null;
  }
}

async function getUnitEventsFromChain(unitId) {
  if (!contractInstance) initBlockchain();
  if (!contractInstance) return [];
  try {
    const events = await contractInstance.getUnitEvents(unitId);
    return events.map((e) => ({
      unitId: e.unitId,
      eventType: e.eventType,
      status: Number(e.status),
      actor: e.actor,
      timestamp: Number(e.timestamp) * 1000,
      remarks: e.remarks,
      dataHash: e.dataHash,
    }));
  } catch (err) {
    return [];
  }
}

async function getContractEvents(limit = 100) {
  if (!contractInstance) initBlockchain();
  if (!contractInstance) return [];
  try {
    const events = await contractInstance.queryFilter('*', 0, 'latest');
    return events.slice(-limit).reverse().map((e) => ({
      eventName: e.fragment ? e.fragment.name : e.eventName || 'Event',
      txHash: e.transactionHash,
      blockNumber: e.blockNumber,
      unitId: (e.args && e.args.unitId) || null,
      actor: (e.args && (e.args.actor || e.args.hospital || e.args.bloodBank || e.args.from || e.args.requestingHospital)) || null,
      dataHash: (e.args && e.args.dataHash) || null,
      timestamp: Date.now(),
      args: e.args ? (e.args.toObject ? e.args.toObject() : e.args) : {},
    }));
  } catch (err) {
    console.warn('[Blockchain] Error querying contract events:', err.message);
    return [];
  }
}

async function verifyDataIntegrityOnChain(unitId, expectedHash) {
  if (!contractInstance) initBlockchain();
  if (!contractInstance) return false;
  try {
    return await contractInstance.verifyDataIntegrity(unitId, expectedHash);
  } catch (err) {
    return false;
  }
}

async function isBlockchainConnected() {
  try {
    if (!provider) initBlockchain();
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    return {
      connected: true,
      chainId: Number(network.chainId),
      blockNumber,
      contractAddress,
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message,
    };
  }
}

/**
 * Ensures that a blood unit is properly registered and synced on the smart contract
 * up to the requested target status before downstream actions are executed.
 */
async function ensureUnitOnChain(unit, targetState = 'available', extraParams = {}) {
  if (!contractInstance) initBlockchain();
  if (!contractInstance) return null;

  try {
    let onChain = await getBloodUnitFromChain(unit.unitId);

    // 1. If not registered on-chain, register it
    if (!onChain) {
      const colTs = new Date(unit.collectionDate || Date.now()).getTime();
      const expTs = new Date(unit.expiryDate || (Date.now() + 35 * 86400000)).getTime();
      const initialHash = unit.dataHash || '0x' + '0'.repeat(64);
      await registerBloodUnitOnChain(
        unit.unitId,
        unit.bloodGroup || 'O+',
        unit.componentType || 'Whole Blood',
        colTs,
        expTs,
        initialHash
      );
      onChain = await getBloodUnitFromChain(unit.unitId);
    }

    if (!onChain) return null;

    // UnitStatus: 0: Collected, 1: PendingScreening, 2: Approved, 3: Available, 4: Reserved, 5: Dispatched, 6: Received, 7: Transfused
    if (['available', 'reserved', 'dispatched', 'received', 'transfused'].includes(targetState) && onChain.status < 3) {
      if (unit.screeningStatus === 'passed' || targetState !== 'collected') {
        await updateScreeningOnChain(unit.unitId, 1, 'Screening verified', unit.dataHash || onChain.dataHash);
        onChain = await getBloodUnitFromChain(unit.unitId);
      }
    }

    if (['reserved', 'dispatched', 'received', 'transfused'].includes(targetState) && onChain.status === 3) {
      const hospitalAddr = extraParams.hospitalWallet || (unit.reservedHospital && unit.reservedHospital.walletAddress) || '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
      const reqId = extraParams.requestId || unit.hospitalRequestId || 'REQ-INITIAL';
      await reserveBloodUnitOnChain(unit.unitId, hospitalAddr, reqId, unit.dataHash || onChain.dataHash);
      onChain = await getBloodUnitFromChain(unit.unitId);
    }

    if (['dispatched', 'received', 'transfused'].includes(targetState) && onChain.status === 4) {
      const destAddr = extraParams.destinationAddress || (unit.reservedHospital && unit.reservedHospital.walletAddress) || '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
      const shipRef = (unit.shipmentDetails && unit.shipmentDetails.shipmentRef) || 'SHIP-AUTO-SYNC';
      await dispatchBloodUnitOnChain(unit.unitId, destAddr, shipRef, unit.dataHash || onChain.dataHash);
      onChain = await getBloodUnitFromChain(unit.unitId);
    }

    if (['received', 'transfused'].includes(targetState) && onChain.status === 5) {
      await receiveBloodUnitOnChain(unit.unitId, unit.dataHash || onChain.dataHash);
      onChain = await getBloodUnitFromChain(unit.unitId);
    }

    if (targetState === 'transfused' && onChain.status === 6) {
      const pHash = unit.patientRefHash || '0x' + '1'.repeat(40);
      await transfuseBloodUnitOnChain(unit.unitId, pHash, unit.dataHash || onChain.dataHash);
      onChain = await getBloodUnitFromChain(unit.unitId);
    }

    return onChain;
  } catch (err) {
    console.warn(`[Blockchain] Note during ensureUnitOnChain (${unit.unitId}): ${err.message}`);
    return null;
  }
}

/**
 * Ensures an emergency transfer request is registered on-chain before completing it.
 */
async function ensureTransferOnChain(transfer, supplyingHospitalAddress, urgency) {
  if (!contractInstance) initBlockchain();
  if (!contractInstance) return null;
  try {
    const raw = await contractInstance.emergencyTransfers(transfer.transferId);
    if (Number(raw[4]) === 0) {
      const BloodUnit = require('../models/BloodUnit');
      const unit = await BloodUnit.findOne({ unitId: transfer.unitId });
      if (unit) {
        await ensureUnitOnChain(unit, 'received', { hospitalWallet: supplyingHospitalAddress });
      }
      return await createEmergencyTransferOnChain(
        transfer.transferId,
        transfer.unitId,
        supplyingHospitalAddress,
        urgency || transfer.urgency || 'CRITICAL',
        transfer.requestingHospitalWallet || '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
      );
    }
    return { txHash: null, alreadyExisted: true };
  } catch (err) {
    console.warn(`[Blockchain] Note during ensureTransferOnChain (${transfer.transferId}): ${err.message}`);
    return null;
  }
}

module.exports = {
  initBlockchain,
  getSigner,
  registerBloodBankOnChain,
  registerHospitalOnChain,
  registerBloodUnitOnChain,
  updateScreeningOnChain,
  reserveBloodUnitOnChain,
  dispatchBloodUnitOnChain,
  receiveBloodUnitOnChain,
  transfuseBloodUnitOnChain,
  recordExpiryOnChain,
  discardBloodUnitOnChain,
  createEmergencyTransferOnChain,
  completeEmergencyTransferOnChain,
  getBloodUnitFromChain,
  getUnitEventsFromChain,
  getContractEvents,
  verifyDataIntegrityOnChain,
  isBlockchainConnected,
  ensureUnitOnChain,
  ensureTransferOnChain,
};
