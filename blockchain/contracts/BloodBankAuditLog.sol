// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BloodBankAuditLog
 * @notice Immutable, append-only on-chain audit trail for all critical blood bank operations.
 *         Each log entry is permanently recorded with actor, action, entity reference, and SHA-256 data hash.
 */
contract BloodBankAuditLog {

    address public immutable owner;

    enum ActionCategory {
        DonorManagement,
        BloodUnitLifecycle,
        ScreeningAndQC,
        InventoryManagement,
        HospitalRequest,
        EmergencyTransfer,
        ColdChainDispatch,
        PatientTransfusion,
        ExpiryAndDisposal,
        IntegrityVerification,
        AccessControl,
        SystemConfiguration
    }

    enum SeverityLevel {
        Info,
        Warning,
        Critical
    }

    struct AuditEntry {
        uint256 entryId;
        address actor;
        ActionCategory category;
        SeverityLevel severity;
        string action;
        string entityId;
        string entityType;
        string dataHash;
        string ipfsRef;
        uint256 blockNumber;
        uint256 timestamp;
        bool flagged;
    }

    struct IntegrityAlert {
        uint256 alertId;
        string entityId;
        string entityType;
        string expectedHash;
        string actualHash;
        address detectedBy;
        uint256 timestamp;
        bool resolved;
        string resolutionNote;
    }

    AuditEntry[] private _auditLog;
    IntegrityAlert[] private _integrityAlerts;

    mapping(address => uint256[]) private _actorEntries;
    mapping(string => uint256[]) private _entityEntries;
    mapping(ActionCategory => uint256[]) private _categoryEntries;
    mapping(address => bool) public authorizedLoggers;

    uint256 public totalEntries;
    uint256 public totalAlerts;
    uint256 public totalFlaggedEntries;

    event AuditEntryRecorded(
        uint256 indexed entryId,
        address indexed actor,
        ActionCategory indexed category,
        string action,
        string entityId,
        uint256 timestamp
    );

    event IntegrityAlertRaised(
        uint256 indexed alertId,
        string indexed entityId,
        address indexed detectedBy,
        string expectedHash,
        string actualHash,
        uint256 timestamp
    );

    event IntegrityAlertResolved(
        uint256 indexed alertId,
        address indexed resolvedBy,
        string resolutionNote,
        uint256 timestamp
    );

    event AuditEntryFlagged(uint256 indexed entryId, address indexed flaggedBy, uint256 timestamp);
    event LoggerAuthorizationChanged(address indexed logger, bool authorized, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "AuditLog: caller is not owner");
        _;
    }

    modifier onlyAuthorizedLogger() {
        require(authorizedLoggers[msg.sender] || msg.sender == owner, "AuditLog: caller is not authorized logger");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedLoggers[msg.sender] = true;
    }

    function setLoggerAuthorization(address logger, bool authorized) external onlyOwner {
        require(logger != address(0), "AuditLog: zero address");
        authorizedLoggers[logger] = authorized;
        emit LoggerAuthorizationChanged(logger, authorized, block.timestamp);
    }

    function recordEntry(
        ActionCategory _category,
        SeverityLevel _severity,
        string calldata _action,
        string calldata _entityId,
        string calldata _entityType,
        string calldata _dataHash,
        string calldata _ipfsRef
    ) external onlyAuthorizedLogger returns (uint256 entryId) {
        entryId = totalEntries;

        _auditLog.push(AuditEntry({
            entryId: entryId,
            actor: msg.sender,
            category: _category,
            severity: _severity,
            action: _action,
            entityId: _entityId,
            entityType: _entityType,
            dataHash: _dataHash,
            ipfsRef: _ipfsRef,
            blockNumber: block.number,
            timestamp: block.timestamp,
            flagged: false
        }));

        _actorEntries[msg.sender].push(entryId);
        _entityEntries[_entityId].push(entryId);
        _categoryEntries[_category].push(entryId);
        totalEntries++;

        emit AuditEntryRecorded(entryId, msg.sender, _category, _action, _entityId, block.timestamp);
    }

    function recordBatchEntries(
        ActionCategory[] calldata _categories,
        SeverityLevel[] calldata _severities,
        string[] calldata _actions,
        string[] calldata _entityIds,
        string[] calldata _entityTypes,
        string[] calldata _dataHashes
    ) external onlyAuthorizedLogger {
        require(
            _categories.length == _severities.length &&
            _severities.length == _actions.length &&
            _actions.length == _entityIds.length &&
            _entityIds.length == _entityTypes.length &&
            _entityTypes.length == _dataHashes.length,
            "AuditLog: array length mismatch"
        );

        for (uint256 i = 0; i < _categories.length; i++) {
            uint256 entryId = totalEntries;
            _auditLog.push(AuditEntry({
                entryId: entryId,
                actor: msg.sender,
                category: _categories[i],
                severity: _severities[i],
                action: _actions[i],
                entityId: _entityIds[i],
                entityType: _entityTypes[i],
                dataHash: _dataHashes[i],
                ipfsRef: "",
                blockNumber: block.number,
                timestamp: block.timestamp,
                flagged: false
            }));
            _actorEntries[msg.sender].push(entryId);
            _entityEntries[_entityIds[i]].push(entryId);
            _categoryEntries[_categories[i]].push(entryId);
            totalEntries++;
            emit AuditEntryRecorded(entryId, msg.sender, _categories[i], _actions[i], _entityIds[i], block.timestamp);
        }
    }

    function raiseIntegrityAlert(
        string calldata _entityId,
        string calldata _entityType,
        string calldata _expectedHash,
        string calldata _actualHash
    ) external onlyAuthorizedLogger returns (uint256 alertId) {
        alertId = totalAlerts;
        _integrityAlerts.push(IntegrityAlert({
            alertId: alertId,
            entityId: _entityId,
            entityType: _entityType,
            expectedHash: _expectedHash,
            actualHash: _actualHash,
            detectedBy: msg.sender,
            timestamp: block.timestamp,
            resolved: false,
            resolutionNote: ""
        }));
        totalAlerts++;
        emit IntegrityAlertRaised(alertId, _entityId, msg.sender, _expectedHash, _actualHash, block.timestamp);
    }

    function resolveIntegrityAlert(
        uint256 _alertId,
        string calldata _resolutionNote
    ) external onlyOwner {
        require(_alertId < totalAlerts, "AuditLog: alert does not exist");
        require(!_integrityAlerts[_alertId].resolved, "AuditLog: alert already resolved");
        _integrityAlerts[_alertId].resolved = true;
        _integrityAlerts[_alertId].resolutionNote = _resolutionNote;
        emit IntegrityAlertResolved(_alertId, msg.sender, _resolutionNote, block.timestamp);
    }

    function flagEntry(uint256 _entryId) external onlyOwner {
        require(_entryId < totalEntries, "AuditLog: entry does not exist");
        require(!_auditLog[_entryId].flagged, "AuditLog: already flagged");
        _auditLog[_entryId].flagged = true;
        totalFlaggedEntries++;
        emit AuditEntryFlagged(_entryId, msg.sender, block.timestamp);
    }

    function getEntry(uint256 _entryId) external view returns (AuditEntry memory) {
        require(_entryId < totalEntries, "AuditLog: entry does not exist");
        return _auditLog[_entryId];
    }

    function getEntriesByActor(address _actor) external view returns (uint256[] memory) {
        return _actorEntries[_actor];
    }

    function getEntriesByEntity(string calldata _entityId) external view returns (uint256[] memory) {
        return _entityEntries[_entityId];
    }

    function getEntriesByCategory(ActionCategory _category) external view returns (uint256[] memory) {
        return _categoryEntries[_category];
    }

    function getIntegrityAlert(uint256 _alertId) external view returns (IntegrityAlert memory) {
        require(_alertId < totalAlerts, "AuditLog: alert does not exist");
        return _integrityAlerts[_alertId];
    }

    function getRecentEntries(uint256 _count) external view returns (AuditEntry[] memory entries) {
        uint256 count = _count > totalEntries ? totalEntries : _count;
        entries = new AuditEntry[](count);
        for (uint256 i = 0; i < count; i++) {
            entries[i] = _auditLog[totalEntries - 1 - i];
        }
    }

    function getAuditStats() external view returns (
        uint256 entries,
        uint256 alerts,
        uint256 flagged,
        uint256 unresolvedAlerts
    ) {
        uint256 unresolved = 0;
        for (uint256 i = 0; i < totalAlerts; i++) {
            if (!_integrityAlerts[i].resolved) unresolved++;
        }
        return (totalEntries, totalAlerts, totalFlaggedEntries, unresolved);
    }

    function verifyEntryIntegrity(uint256 _entryId, string calldata _expectedHash) external view returns (bool) {
        require(_entryId < totalEntries, "AuditLog: entry does not exist");
        return keccak256(bytes(_auditLog[_entryId].dataHash)) == keccak256(bytes(_expectedHash));
    }
}
