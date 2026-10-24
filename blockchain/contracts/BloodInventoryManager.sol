// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BloodInventoryManager
 * @notice Full inventory management system for blood banks.
 *         Tracks stock levels per blood group and component type,
 *         manages reorder thresholds, shortage alerts, and cross-bank transfers.
 */
contract BloodInventoryManager {

    address public admin;

    enum ComponentType { RBC, Platelet, FFP, WholeBlood, Cryoprecipitate, Granulocyte }
    enum AlertLevel    { None, Low, Critical, Emergency }
    enum StockEventType {
        Received, Dispatched, Reserved, Released, Expired,
        Discarded, Transferred, Adjusted, Snapshot
    }

    struct StockLevel {
        uint256 available;
        uint256 reserved;
        uint256 inTransit;
        uint256 quarantined;
        uint256 totalReceived;
        uint256 totalDispatched;
        uint256 totalExpired;
        uint256 totalDiscarded;
        uint256 lastUpdated;
    }

    struct ReorderPolicy {
        uint256 minimumStock;
        uint256 reorderPoint;
        uint256 reorderQuantity;
        uint256 criticalThreshold;
        bool    autoAlertEnabled;
        uint256 updatedAt;
    }

    struct StockEvent {
        uint256       eventId;
        address       bloodBank;
        string        bloodGroup;
        ComponentType componentType;
        StockEventType eventType;
        uint256       quantity;
        int256        delta;
        string        referenceId;
        address       actor;
        uint256       timestamp;
        string        notes;
    }

    struct ShortageAlert {
        uint256    alertId;
        address    bloodBank;
        string     bloodGroup;
        ComponentType componentType;
        AlertLevel level;
        uint256    currentStock;
        uint256    minimumRequired;
        uint256    raisedAt;
        bool       resolved;
        uint256    resolvedAt;
    }

    struct CrossBankTransferRequest {
        uint256   requestId;
        address   requestingBank;
        address   supplyingBank;
        string    bloodGroup;
        ComponentType componentType;
        uint256   quantity;
        bool      approved;
        bool      fulfilled;
        bool      rejected;
        uint256   requestedAt;
        uint256   processedAt;
        string    urgencyNote;
    }

    struct BloodBankProfile {
        string  name;
        string  region;
        bool    active;
        uint256 registeredAt;
        uint256 totalStockEvents;
        uint256 totalAlertsRaised;
        uint256 totalTransfersIn;
        uint256 totalTransfersOut;
    }

    // bloodBank => bloodGroup => componentType => StockLevel
    mapping(address => mapping(string => mapping(ComponentType => StockLevel))) private _stock;
    // bloodBank => bloodGroup => componentType => ReorderPolicy
    mapping(address => mapping(string => mapping(ComponentType => ReorderPolicy))) private _policies;

    mapping(address => BloodBankProfile) public bloodBankProfiles;
    mapping(address => bool)             public registeredBanks;

    StockEvent[]              private _stockEvents;
    ShortageAlert[]           private _alerts;
    CrossBankTransferRequest[] private _transferRequests;

    mapping(address => uint256[]) private _bankEventIds;
    mapping(address => uint256[]) private _bankAlertIds;
    mapping(address => uint256[]) private _bankTransferRequestIds;

    address[] private _allBanks;
    uint256 public totalStockEvents;
    uint256 public totalAlerts;
    uint256 public totalTransferRequests;
    uint256 public totalActiveAlerts;

    string[] private _bloodGroups;
    mapping(string => bool) private _bloodGroupExists;

    event BloodBankRegistered(address indexed bank, string name, string region, uint256 timestamp);
    event StockUpdated(address indexed bank, string bloodGroup, ComponentType componentType, StockEventType eventType, uint256 quantity, int256 delta, uint256 timestamp);
    event ShortageAlertRaised(uint256 indexed alertId, address indexed bank, string bloodGroup, ComponentType componentType, AlertLevel level, uint256 currentStock, uint256 timestamp);
    event ShortageAlertResolved(uint256 indexed alertId, address indexed bank, uint256 timestamp);
    event ReorderPolicyUpdated(address indexed bank, string bloodGroup, ComponentType componentType, uint256 minimumStock, uint256 reorderPoint, uint256 timestamp);
    event CrossBankTransferRequested(uint256 indexed requestId, address indexed requestingBank, address indexed supplyingBank, string bloodGroup, uint256 quantity, uint256 timestamp);
    event CrossBankTransferApproved(uint256 indexed requestId, address indexed supplyingBank, uint256 timestamp);
    event CrossBankTransferFulfilled(uint256 indexed requestId, uint256 timestamp);
    event CrossBankTransferRejected(uint256 indexed requestId, address indexed supplyingBank, uint256 timestamp);
    event StockAdjusted(address indexed bank, string bloodGroup, ComponentType componentType, int256 delta, string reason, uint256 timestamp);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Inventory: not admin");
        _;
    }

    modifier onlyRegisteredBank() {
        require(registeredBanks[msg.sender] || msg.sender == admin, "Inventory: not registered bank");
        _;
    }

    modifier bankExists(address bank) {
        require(registeredBanks[bank], "Inventory: bank not registered");
        _;
    }

    constructor() {
        admin = msg.sender;
        _initBloodGroups();
    }

    function _initBloodGroups() internal {
        string[8] memory groups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
        for (uint256 i = 0; i < 8; i++) {
            _bloodGroups.push(groups[i]);
            _bloodGroupExists[groups[i]] = true;
        }
    }

    // ── Bank Registration ─────────────────────────────────────────────────

    function registerBloodBank(address bank, string calldata name, string calldata region) external onlyAdmin {
        require(bank != address(0), "Inventory: zero address");
        require(!registeredBanks[bank], "Inventory: already registered");
        registeredBanks[bank] = true;
        bloodBankProfiles[bank] = BloodBankProfile({
            name: name, region: region, active: true,
            registeredAt: block.timestamp, totalStockEvents: 0,
            totalAlertsRaised: 0, totalTransfersIn: 0, totalTransfersOut: 0
        });
        _allBanks.push(bank);
        emit BloodBankRegistered(bank, name, region, block.timestamp);
    }

    function setBloodBankActive(address bank, bool active) external onlyAdmin bankExists(bank) {
        bloodBankProfiles[bank].active = active;
    }

    // ── Reorder Policy ────────────────────────────────────────────────────

    function setReorderPolicy(
        string calldata bloodGroup,
        ComponentType componentType,
        uint256 minimumStock,
        uint256 reorderPoint,
        uint256 reorderQuantity,
        uint256 criticalThreshold,
        bool autoAlertEnabled
    ) external onlyRegisteredBank {
        require(_bloodGroupExists[bloodGroup], "Inventory: invalid blood group");
        _policies[msg.sender][bloodGroup][componentType] = ReorderPolicy({
            minimumStock: minimumStock,
            reorderPoint: reorderPoint,
            reorderQuantity: reorderQuantity,
            criticalThreshold: criticalThreshold,
            autoAlertEnabled: autoAlertEnabled,
            updatedAt: block.timestamp
        });
        emit ReorderPolicyUpdated(msg.sender, bloodGroup, componentType, minimumStock, reorderPoint, block.timestamp);
    }

    // ── Stock Operations ──────────────────────────────────────────────────

    function receiveStock(
        string calldata bloodGroup,
        ComponentType componentType,
        uint256 quantity,
        string calldata referenceId,
        string calldata notes
    ) external onlyRegisteredBank {
        require(quantity > 0, "Inventory: quantity must be > 0");
        require(_bloodGroupExists[bloodGroup], "Inventory: invalid blood group");

        StockLevel storage s = _stock[msg.sender][bloodGroup][componentType];
        s.available     += quantity;
        s.totalReceived += quantity;
        s.lastUpdated    = block.timestamp;

        _recordStockEvent(msg.sender, bloodGroup, componentType, StockEventType.Received, quantity, int256(quantity), referenceId, notes);
        _checkAndRaiseAlert(msg.sender, bloodGroup, componentType);
        emit StockUpdated(msg.sender, bloodGroup, componentType, StockEventType.Received, quantity, int256(quantity), block.timestamp);
    }

    function dispatchStock(
        string calldata bloodGroup,
        ComponentType componentType,
        uint256 quantity,
        string calldata referenceId,
        string calldata notes
    ) external onlyRegisteredBank {
        StockLevel storage s = _stock[msg.sender][bloodGroup][componentType];
        require(s.available >= quantity, "Inventory: insufficient available stock");

        s.available       -= quantity;
        s.totalDispatched += quantity;
        s.lastUpdated      = block.timestamp;

        _recordStockEvent(msg.sender, bloodGroup, componentType, StockEventType.Dispatched, quantity, -int256(quantity), referenceId, notes);
        _checkAndRaiseAlert(msg.sender, bloodGroup, componentType);
        emit StockUpdated(msg.sender, bloodGroup, componentType, StockEventType.Dispatched, quantity, -int256(quantity), block.timestamp);
    }

    function reserveStock(
        string calldata bloodGroup,
        ComponentType componentType,
        uint256 quantity,
        string calldata referenceId
    ) external onlyRegisteredBank {
        StockLevel storage s = _stock[msg.sender][bloodGroup][componentType];
        require(s.available >= quantity, "Inventory: insufficient available stock");

        s.available -= quantity;
        s.reserved  += quantity;
        s.lastUpdated = block.timestamp;

        _recordStockEvent(msg.sender, bloodGroup, componentType, StockEventType.Reserved, quantity, 0, referenceId, "Reserved for request");
        emit StockUpdated(msg.sender, bloodGroup, componentType, StockEventType.Reserved, quantity, 0, block.timestamp);
    }

    function releaseReservation(
        string calldata bloodGroup,
        ComponentType componentType,
        uint256 quantity,
        string calldata referenceId
    ) external onlyRegisteredBank {
        StockLevel storage s = _stock[msg.sender][bloodGroup][componentType];
        require(s.reserved >= quantity, "Inventory: insufficient reserved stock");

        s.reserved  -= quantity;
        s.available += quantity;
        s.lastUpdated = block.timestamp;

        _recordStockEvent(msg.sender, bloodGroup, componentType, StockEventType.Released, quantity, 0, referenceId, "Reservation released");
        emit StockUpdated(msg.sender, bloodGroup, componentType, StockEventType.Released, quantity, 0, block.timestamp);
    }

    function recordExpiry(
        string calldata bloodGroup,
        ComponentType componentType,
        uint256 quantity,
        string calldata referenceId
    ) external onlyRegisteredBank {
        StockLevel storage s = _stock[msg.sender][bloodGroup][componentType];
        require(s.available >= quantity, "Inventory: insufficient available stock");

        s.available    -= quantity;
        s.totalExpired += quantity;
        s.lastUpdated   = block.timestamp;

        _recordStockEvent(msg.sender, bloodGroup, componentType, StockEventType.Expired, quantity, -int256(quantity), referenceId, "Units expired");
        _checkAndRaiseAlert(msg.sender, bloodGroup, componentType);
        emit StockUpdated(msg.sender, bloodGroup, componentType, StockEventType.Expired, quantity, -int256(quantity), block.timestamp);
    }

    function recordDiscard(
        string calldata bloodGroup,
        ComponentType componentType,
        uint256 quantity,
        string calldata referenceId,
        string calldata reason
    ) external onlyRegisteredBank {
        StockLevel storage s = _stock[msg.sender][bloodGroup][componentType];
        require(s.available + s.quarantined >= quantity, "Inventory: insufficient stock");

        if (s.quarantined >= quantity) {
            s.quarantined -= quantity;
        } else {
            uint256 fromAvailable = quantity - s.quarantined;
            s.quarantined = 0;
            s.available  -= fromAvailable;
        }
        s.totalDiscarded += quantity;
        s.lastUpdated     = block.timestamp;

        _recordStockEvent(msg.sender, bloodGroup, componentType, StockEventType.Discarded, quantity, -int256(quantity), referenceId, reason);
        emit StockUpdated(msg.sender, bloodGroup, componentType, StockEventType.Discarded, quantity, -int256(quantity), block.timestamp);
    }

    function adjustStock(
        string calldata bloodGroup,
        ComponentType componentType,
        int256 delta,
        string calldata reason
    ) external onlyAdmin {
        StockLevel storage s = _stock[msg.sender][bloodGroup][componentType];
        if (delta > 0) {
            s.available += uint256(delta);
        } else {
            uint256 reduction = uint256(-delta);
            require(s.available >= reduction, "Inventory: adjustment would underflow");
            s.available -= reduction;
        }
        s.lastUpdated = block.timestamp;
        _recordStockEvent(msg.sender, bloodGroup, componentType, StockEventType.Adjusted, delta > 0 ? uint256(delta) : uint256(-delta), delta, "ADJUST", reason);
        emit StockAdjusted(msg.sender, bloodGroup, componentType, delta, reason, block.timestamp);
    }

    // ── Cross-Bank Transfers ──────────────────────────────────────────────

    function requestCrossBankTransfer(
        address supplyingBank,
        string calldata bloodGroup,
        ComponentType componentType,
        uint256 quantity,
        string calldata urgencyNote
    ) external onlyRegisteredBank bankExists(supplyingBank) returns (uint256 requestId) {
        require(supplyingBank != msg.sender, "Inventory: cannot request from self");
        require(quantity > 0, "Inventory: quantity must be > 0");

        requestId = totalTransferRequests;
        _transferRequests.push(CrossBankTransferRequest({
            requestId: requestId,
            requestingBank: msg.sender,
            supplyingBank: supplyingBank,
            bloodGroup: bloodGroup,
            componentType: componentType,
            quantity: quantity,
            approved: false,
            fulfilled: false,
            rejected: false,
            requestedAt: block.timestamp,
            processedAt: 0,
            urgencyNote: urgencyNote
        }));

        _bankTransferRequestIds[msg.sender].push(requestId);
        _bankTransferRequestIds[supplyingBank].push(requestId);
        totalTransferRequests++;

        emit CrossBankTransferRequested(requestId, msg.sender, supplyingBank, bloodGroup, quantity, block.timestamp);
    }

    function approveCrossBankTransfer(uint256 requestId) external onlyRegisteredBank {
        CrossBankTransferRequest storage req = _transferRequests[requestId];
        require(req.supplyingBank == msg.sender, "Inventory: not supplying bank");
        require(!req.approved && !req.rejected, "Inventory: already processed");

        StockLevel storage s = _stock[msg.sender][req.bloodGroup][req.componentType];
        require(s.available >= req.quantity, "Inventory: insufficient stock to approve");

        req.approved     = true;
        req.processedAt  = block.timestamp;
        s.available     -= req.quantity;
        s.inTransit     += req.quantity;
        s.lastUpdated    = block.timestamp;

        bloodBankProfiles[msg.sender].totalTransfersOut++;
        emit CrossBankTransferApproved(requestId, msg.sender, block.timestamp);
    }

    function fulfillCrossBankTransfer(uint256 requestId) external onlyRegisteredBank {
        CrossBankTransferRequest storage req = _transferRequests[requestId];
        require(req.requestingBank == msg.sender, "Inventory: not requesting bank");
        require(req.approved && !req.fulfilled, "Inventory: not approved or already fulfilled");

        StockLevel storage supplierStock = _stock[req.supplyingBank][req.bloodGroup][req.componentType];
        supplierStock.inTransit -= req.quantity;
        supplierStock.lastUpdated = block.timestamp;

        StockLevel storage receiverStock = _stock[msg.sender][req.bloodGroup][req.componentType];
        receiverStock.available     += req.quantity;
        receiverStock.totalReceived += req.quantity;
        receiverStock.lastUpdated    = block.timestamp;

        req.fulfilled   = true;
        req.processedAt = block.timestamp;
        bloodBankProfiles[msg.sender].totalTransfersIn++;

        _recordStockEvent(msg.sender, req.bloodGroup, req.componentType, StockEventType.Transferred, req.quantity, int256(req.quantity), "XFER", "Cross-bank transfer received");
        _checkAndRaiseAlert(msg.sender, req.bloodGroup, req.componentType);
        emit CrossBankTransferFulfilled(requestId, block.timestamp);
    }

    function rejectCrossBankTransfer(uint256 requestId) external onlyRegisteredBank {
        CrossBankTransferRequest storage req = _transferRequests[requestId];
        require(req.supplyingBank == msg.sender, "Inventory: not supplying bank");
        require(!req.approved && !req.rejected, "Inventory: already processed");
        req.rejected    = true;
        req.processedAt = block.timestamp;
        emit CrossBankTransferRejected(requestId, msg.sender, block.timestamp);
    }

    // ── Alert Management ──────────────────────────────────────────────────

    function resolveAlert(uint256 alertId) external onlyRegisteredBank {
        require(alertId < totalAlerts, "Inventory: alert does not exist");
        ShortageAlert storage alert = _alerts[alertId];
        require(alert.bloodBank == msg.sender || msg.sender == admin, "Inventory: not authorized");
        require(!alert.resolved, "Inventory: already resolved");
        alert.resolved   = true;
        alert.resolvedAt = block.timestamp;
        if (totalActiveAlerts > 0) totalActiveAlerts--;
        emit ShortageAlertResolved(alertId, msg.sender, block.timestamp);
    }

    // ── View Functions ────────────────────────────────────────────────────

    function getStockLevel(address bank, string calldata bloodGroup, ComponentType componentType)
        external view returns (StockLevel memory)
    {
        return _stock[bank][bloodGroup][componentType];
    }

    function getReorderPolicy(address bank, string calldata bloodGroup, ComponentType componentType)
        external view returns (ReorderPolicy memory)
    {
        return _policies[bank][bloodGroup][componentType];
    }

    function getStockEvent(uint256 eventId) external view returns (StockEvent memory) {
        require(eventId < totalStockEvents, "Inventory: event does not exist");
        return _stockEvents[eventId];
    }

    function getBankEventIds(address bank) external view returns (uint256[] memory) {
        return _bankEventIds[bank];
    }

    function getBankAlerts(address bank) external view returns (uint256[] memory) {
        return _bankAlertIds[bank];
    }

    function getAlert(uint256 alertId) external view returns (ShortageAlert memory) {
        require(alertId < totalAlerts, "Inventory: alert does not exist");
        return _alerts[alertId];
    }

    function getTransferRequest(uint256 requestId) external view returns (CrossBankTransferRequest memory) {
        require(requestId < totalTransferRequests, "Inventory: request does not exist");
        return _transferRequests[requestId];
    }

    function getBankTransferRequests(address bank) external view returns (uint256[] memory) {
        return _bankTransferRequestIds[bank];
    }

    function getAllBanks() external view returns (address[] memory) {
        return _allBanks;
    }

    function getBloodGroups() external view returns (string[] memory) {
        return _bloodGroups;
    }

    function getTotalAvailableByGroup(address bank, string calldata bloodGroup)
        external view returns (uint256 total)
    {
        for (uint256 i = 0; i < 6; i++) {
            total += _stock[bank][bloodGroup][ComponentType(i)].available;
        }
    }

    function getInventoryStats(address bank) external view returns (
        uint256 totalAvailable,
        uint256 totalReserved,
        uint256 totalInTransit,
        uint256 totalQuarantined,
        uint256 allTimeReceived,
        uint256 allTimeDispatched,
        uint256 allTimeExpired,
        uint256 allTimeDiscarded
    ) {
        for (uint256 g = 0; g < _bloodGroups.length; g++) {
            for (uint256 c = 0; c < 6; c++) {
                StockLevel memory s = _stock[bank][_bloodGroups[g]][ComponentType(c)];
                totalAvailable    += s.available;
                totalReserved     += s.reserved;
                totalInTransit    += s.inTransit;
                totalQuarantined  += s.quarantined;
                allTimeReceived   += s.totalReceived;
                allTimeDispatched += s.totalDispatched;
                allTimeExpired    += s.totalExpired;
                allTimeDiscarded  += s.totalDiscarded;
            }
        }
    }

    function getSystemInventoryStats() external view returns (
        uint256 banks,
        uint256 events,
        uint256 alerts,
        uint256 activeAlerts,
        uint256 transferRequests
    ) {
        return (_allBanks.length, totalStockEvents, totalAlerts, totalActiveAlerts, totalTransferRequests);
    }

    // ── Internal ──────────────────────────────────────────────────────────

    function _recordStockEvent(
        address bank,
        string memory bloodGroup,
        ComponentType componentType,
        StockEventType eventType,
        uint256 quantity,
        int256 delta,
        string memory referenceId,
        string memory notes
    ) internal {
        uint256 eventId = totalStockEvents;
        _stockEvents.push(StockEvent({
            eventId: eventId, bloodBank: bank, bloodGroup: bloodGroup,
            componentType: componentType, eventType: eventType,
            quantity: quantity, delta: delta, referenceId: referenceId,
            actor: msg.sender, timestamp: block.timestamp, notes: notes
        }));
        _bankEventIds[bank].push(eventId);
        bloodBankProfiles[bank].totalStockEvents++;
        totalStockEvents++;
    }

    function _checkAndRaiseAlert(address bank, string memory bloodGroup, ComponentType componentType) internal {
        ReorderPolicy memory policy = _policies[bank][bloodGroup][componentType];
        if (!policy.autoAlertEnabled) return;

        StockLevel memory s = _stock[bank][bloodGroup][componentType];
        AlertLevel level = AlertLevel.None;

        if (s.available == 0) {
            level = AlertLevel.Emergency;
        } else if (s.available <= policy.criticalThreshold) {
            level = AlertLevel.Critical;
        } else if (s.available <= policy.minimumStock) {
            level = AlertLevel.Low;
        }

        if (level == AlertLevel.None) return;

        uint256 alertId = totalAlerts;
        _alerts.push(ShortageAlert({
            alertId: alertId, bloodBank: bank, bloodGroup: bloodGroup,
            componentType: componentType, level: level,
            currentStock: s.available, minimumRequired: policy.minimumStock,
            raisedAt: block.timestamp, resolved: false, resolvedAt: 0
        }));
        _bankAlertIds[bank].push(alertId);
        bloodBankProfiles[bank].totalAlertsRaised++;
        totalAlerts++;
        totalActiveAlerts++;

        emit ShortageAlertRaised(alertId, bank, bloodGroup, componentType, level, s.available, block.timestamp);
    }
}
