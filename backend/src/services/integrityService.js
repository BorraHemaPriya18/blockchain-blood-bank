const crypto = require('crypto');

/**
 * Computes deterministic canonical SHA-256 hash of a blood unit's core tracking state.
 * Off-chain metadata changes or direct DB tampering will immediately invalidate this hash.
 */
function computeUnitHash(unit) {
  const canonicalPayload = {
    unitId: String(unit.unitId || '').trim(),
    bloodGroup: String(unit.bloodGroup || '').trim(),
    componentType: String(unit.componentType || '').trim(),
    collectionDate: unit.collectionDate ? new Date(unit.collectionDate).toISOString() : '',
    expiryDate: unit.expiryDate ? new Date(unit.expiryDate).toISOString() : '',
    screeningStatus: String(unit.screeningStatus || '').toLowerCase().trim(),
    status: String(unit.status || '').toLowerCase().trim(),
    custodian: String(
      (unit.currentCustodian && (unit.currentCustodian.walletAddress || unit.currentCustodian.name)) || ''
    ).trim(),
  };

  const serialized = JSON.stringify(canonicalPayload, Object.keys(canonicalPayload).sort());
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

/**
 * Computes a patient reference pseudonymization hash.
 * Ensures no patient PII is stored in raw form on the blockchain.
 */
function computePatientRefHash(patientRefId) {
  return crypto.createHash('sha256').update(String(patientRefId || '')).digest('hex');
}

/**
 * Verifies whether the calculated hash of the DB unit record matches the recorded on-chain hash.
 */
function verifyIntegrity(unitDoc, recordedOnChainHash) {
  const currentDbHash = computeUnitHash(unitDoc);
  const isValid = currentDbHash.toLowerCase() === String(recordedOnChainHash || '').toLowerCase();
  return {
    isValid,
    currentDbHash,
    recordedOnChainHash,
  };
}

module.exports = {
  computeUnitHash,
  computePatientRefHash,
  verifyIntegrity,
};
