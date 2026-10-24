// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BloodSupplyChain
 * @notice Decentralized supply chain tracker for blood units from donor collection to patient transfusion or disposal.
 * @dev Covers donor registration, blood unit lifecycle, hospital requests, emergency transfers, expiry enforcement, and integrity verification.
 */
contract BloodSupplyChain {
    address public admin;

    enum UnitStatus {
        Collected,
        PendingScreening,
        Approved,
        Available,
        Reserved,
        Dispatched,
        Received,
        Transfused,
        Quarantined,
        Expired,
        Discarded
    }

    enum ScreeningStatus {
        Pending,
        Passed,
        Failed
    }

    enum RequestStatus {
        Pending,
        Approved,
        Fulfilled,
        Rejected,
        Cancelled
    }

    enum UrgencyLevel {
        Routine,
        Urgent,
        Critical
    }

    struct BloodBank {
        string name;
        string licenseNumber;
        bool isAuthorized;
        bool exists;
        uint256 totalUnitsRegistered;
        uint256 totalUnitsDispatched;
        uint256 registeredAt;
    }

    struct Hospital {
        string name;
        string licenseNumber;
        bool isAuthorized;
        bool exists;
        uint256 totalRequestsMade;
        uint256 totalUnitsReceived;
        uint256 registeredAt;
    }

    struct Donor {
        string donorRefId;
        string bloodGroup;
        uint256 totalDonations;
        uint256 lastDonationTimestamp;
        bool isEligible;
        bool exists;
        uint256 registeredAt;
    }

    struct BloodUnit {
        string unitId;
        string bloodGroup;
        string componentType;
        uint256 collectionTimestamp;
        uint256 expiryTimestamp;
        ScreeningStatus screeningStatus;
        UnitStatus status;
        address currentCustodian;
        address bloodBank;
        address hospital;
        string donorRefId;
        string dataHash;
        bool exists;
    }

    struct BloodRequest {
        string requestId;
        string bloodGroup;
        string componentType;
        uint256 quantity;
        address requestingHospital;
        address targetBloodBank;
        RequestStatus status;
        UrgencyLevel urgency;
        uint256 requestTimestamp;
        uint256 fulfilledTimestamp;
        string assignedUnitId;
        string dataHash;
        bool exists;
    }

    struct SupplyChainEvent {
        string unitId;
        string eventType;
        UnitStatus status;
        address actor;
        uint256 timestamp;
        string remarks;
        string dataHash;
    }

    struct EmergencyTransfer {
        string transferId;
        string unitId;
        address requestingHospital;
        address supplyingHospital;
        uint256 requestTimestamp;
        uint256 completionTimestamp;
        bool isCompleted;
        string urgency;
    }

    struct InventorySnapshot {
        uint256 totalUnits;
        uint256 availableUnits;
        uint256 reservedUnits;
        uint256 dispatchedUnits;
        uint256 transfusedUnits;
        uint256 expiredUnits;
        uint256 discardedUnits;
        uint256 quarantinedUnits;
        uint256 snapshotTimestamp;
    }

    // Storage
    mapping(address => BloodBank) public bloodBanks;
    mapping(address => Hospital) public hospitals;
    mapping(string => Donor) public donors;
    mapping(string => BloodUnit) private bloodUnits;
    mapping(string => BloodRequest) public bloodRequests;
    mapping(string => SupplyChainEvent[]) private unitEvents;
    mapping(string => EmergencyTransfer) public emergencyTransfers;
    mapping(string => string[]) private donorUnitHistory;
    mapping(address => string[]) private hospitalRequestIds;
    mapping(address => string[]) private bloodBankUnitIds;

    string[] private allUnitIds;
    string[] private allRequestIds;
    string[] private allDonorRefIds;
    address[] private allBloodBankAddresses;
    address[] private allHospitalAddresses;

    // Counters
    uint256 public totalDonationsRecorded;
    uint256 public totalTransfusions;
    uint256 public totalEmergencyTransfers;
    uint256 public totalExpiredUnits;
    uint256 public totalDiscardedUnits;

    // Events
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    event BloodBankRegistered(address indexed bloodBankAddress, string name, string licenseNumber);
    event BloodBankAuthorizationChanged(address indexed bloodBankAddress, bool isAuthorized);
    event HospitalRegistered(address indexed hospitalAddress, string name, string licenseNumber);
    event HospitalAuthorizationChanged(address indexed hospitalAddress, bool isAuthorized);
    event DonorRegistered(string indexed donorRefId, string bloodGroup, uint256 timestamp);
    event DonorEligibilityUpdated(string indexed donorRefId, bool isEligible);
    event DonationRecorded(string indexed donorRefId, string indexed unitId, uint256 timestamp);
    event BloodUnitRegistered(string indexed unitId, string bloodGroup, string componentType, address indexed bloodBank, uint256 expiryTimestamp, string dataHash);
    event ScreeningStatusUpdated(string indexed unitId, ScreeningStatus screeningStatus, UnitStatus unitStatus, address indexed actor, string dataHash);
    event BloodUnitReserved(string indexed unitId, address indexed hospital, string requestId, string dataHash);
    event BloodUnitDispatched(string indexed unitId, address indexed from, address indexed to, string shipmentRef, string dataHash);
    event BloodUnitReceived(string indexed unitId, address indexed hospital, uint256 timestamp, string dataHash);
    event BloodUnitTransfused(string indexed unitId, address indexed hospital, string patientRefHash, uint256 timestamp, string dataHash);
    event BloodUnitExpired(string indexed unitId, address indexed custodian, uint256 timestamp, string dataHash);
    event BloodUnitDiscarded(string indexed unitId, address indexed custodian, string reason, uint256 timestamp, string dataHash);
    event BloodRequestCreated(string indexed requestId, address indexed hospital, string bloodGroup, UrgencyLevel urgency);
    event BloodRequestStatusUpdated(string indexed requestId, RequestStatus status, string assignedUnitId);
    event EmergencyRequestCreated(string indexed transferId, string indexed unitId, address indexed requestingHospital, address supplyingHospital, string urgency);
    event BloodTransferCompleted(string indexed transferId, string indexed unitId, address indexed receivingHospital, uint256 completionTimestamp);
    event IntegrityVerified(string indexed unitId, bool isTamperFree, address indexed verifier, uint256 timestamp);
    event InventorySnapshotRecorded(address indexed bloodBank, uint256 availableUnits, uint256 timestamp);

    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Caller is not the system administrator");
        _;
    }

    modifier onlyAuthorizedBloodBank() {
        require(bloodBanks[msg.sender].isAuthorized || msg.sender == admin, "Caller is not an authorized blood bank");
        _;
    }

    modifier onlyAuthorizedHospital() {
        require(hospitals[msg.sender].isAuthorized || msg.sender == admin, "Caller is not an authorized hospital");
        _;
    }

    modifier onlyAuthorizedParticipant() {
        require(
            msg.sender == admin || bloodBanks[msg.sender].isAuthorized || hospitals[msg.sender].isAuthorized,
            "Caller is not an authorized participant"
        );
        _;
    }

    modifier unitExists(string calldata _unitId) {
        require(bloodUnits[_unitId].exists, "Blood unit does not exist");
        _;
    }

    modifier notExpired(string calldata _unitId) {
        require(block.timestamp < bloodUnits[_unitId].expiryTimestamp, "Blood unit has expired");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    // --- Admin ---

    function transferAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid new admin address");
        emit AdminTransferred(admin, _newAdmin);
        admin = _newAdmin;
    }

    // --- Blood Bank Registration ---

    function registerBloodBank(address _bbAddress, string calldata _name, string calldata _licenseNumber, bool _isAuthorized) external onlyAdmin {
        require(_bbAddress != address(0), "Invalid address");
        bool isNew = !bloodBanks[_bbAddress].exists;
        bloodBanks[_bbAddress] = BloodBank(_name, _licenseNumber, _isAuthorized, true, 0, 0, block.timestamp);
        if (isNew) allBloodBankAddresses.push(_bbAddress);
        emit BloodBankRegistered(_bbAddress, _name, _licenseNumber);
    }

    function setBloodBankAuthorization(address _bbAddress, bool _isAuthorized) external onlyAdmin {
        require(bloodBanks[_bbAddress].exists, "Blood bank not registered");
        bloodBanks[_bbAddress].isAuthorized = _isAuthorized;
        emit BloodBankAuthorizationChanged(_bbAddress, _isAuthorized);
    }

    // --- Hospital Registration ---

    function registerHospital(address _hospAddress, string calldata _name, string calldata _licenseNumber, bool _isAuthorized) external onlyAdmin {
        require(_hospAddress != address(0), "Invalid address");
        bool isNew = !hospitals[_hospAddress].exists;
        hospitals[_hospAddress] = Hospital(_name, _licenseNumber, _isAuthorized, true, 0, 0, block.timestamp);
        if (isNew) allHospitalAddresses.push(_hospAddress);
        emit HospitalRegistered(_hospAddress, _name, _licenseNumber);
    }

    function setHospitalAuthorization(address _hospAddress, bool _isAuthorized) external onlyAdmin {
        require(hospitals[_hospAddress].exists, "Hospital not registered");
        hospitals[_hospAddress].isAuthorized = _isAuthorized;
        emit HospitalAuthorizationChanged(_hospAddress, _isAuthorized);
    }

    // --- Donor Registration ---

    function registerDonor(string calldata _donorRefId, string calldata _bloodGroup) external onlyAuthorizedBloodBank {
        require(bytes(_donorRefId).length > 0, "Donor ref ID cannot be empty");
        require(!donors[_donorRefId].exists, "Donor already registered");
        donors[_donorRefId] = Donor({
            donorRefId: _donorRefId,
            bloodGroup: _bloodGroup,
            totalDonations: 0,
            lastDonationTimestamp: 0,
            isEligible: true,
            exists: true,
            registeredAt: block.timestamp
        });
        allDonorRefIds.push(_donorRefId);
        emit DonorRegistered(_donorRefId, _bloodGroup, block.timestamp);
    }

    function updateDonorEligibility(string calldata _donorRefId, bool _isEligible) external onlyAuthorizedBloodBank {
        require(donors[_donorRefId].exists, "Donor not registered");
        donors[_donorRefId].isEligible = _isEligible;
        emit DonorEligibilityUpdated(_donorRefId, _isEligible);
    }

    function getDonorHistory(string calldata _donorRefId) external view returns (string[] memory) {
        require(donors[_donorRefId].exists, "Donor not registered");
        return donorUnitHistory[_donorRefId];
    }

    // --- Blood Unit Management ---

    function registerBloodUnit(
        string calldata _unitId,
        string calldata _bloodGroup,
        string calldata _componentType,
        uint256 _collectionTimestamp,
        uint256 _expiryTimestamp,
        string calldata _dataHash
    ) external onlyAuthorizedBloodBank {
        require(bytes(_unitId).length > 0, "Unit ID cannot be empty");
        require(!bloodUnits[_unitId].exists, "Blood unit already registered");
        require(_expiryTimestamp > _collectionTimestamp, "Expiry must be after collection");

        bloodUnits[_unitId] = BloodUnit({
            unitId: _unitId,
            bloodGroup: _bloodGroup,
            componentType: _componentType,
            collectionTimestamp: _collectionTimestamp,
            expiryTimestamp: _expiryTimestamp,
            screeningStatus: ScreeningStatus.Pending,
            status: UnitStatus.Collected,
            currentCustodian: msg.sender,
            bloodBank: msg.sender,
            hospital: address(0),
            donorRefId: "",
            dataHash: _dataHash,
            exists: true
        });

        allUnitIds.push(_unitId);
        bloodBankUnitIds[msg.sender].push(_unitId);
        bloodBanks[msg.sender].totalUnitsRegistered++;

        _recordEvent(_unitId, "BloodUnitRegistered", UnitStatus.Collected, msg.sender, "Collected and registered", _dataHash);
        emit BloodUnitRegistered(_unitId, _bloodGroup, _componentType, msg.sender, _expiryTimestamp, _dataHash);
    }

    function registerBloodUnitWithDonor(
        string calldata _unitId,
        string calldata _bloodGroup,
        string calldata _componentType,
        uint256 _collectionTimestamp,
        uint256 _expiryTimestamp,
        string calldata _donorRefId,
        string calldata _dataHash
    ) external onlyAuthorizedBloodBank {
        require(bytes(_unitId).length > 0, "Unit ID cannot be empty");
        require(!bloodUnits[_unitId].exists, "Blood unit already registered");
        require(_expiryTimestamp > _collectionTimestamp, "Expiry must be after collection");

        bloodUnits[_unitId] = BloodUnit({
            unitId: _unitId,
            bloodGroup: _bloodGroup,
            componentType: _componentType,
            collectionTimestamp: _collectionTimestamp,
            expiryTimestamp: _expiryTimestamp,
            screeningStatus: ScreeningStatus.Pending,
            status: UnitStatus.Collected,
            currentCustodian: msg.sender,
            bloodBank: msg.sender,
            hospital: address(0),
            donorRefId: _donorRefId,
            dataHash: _dataHash,
            exists: true
        });

        allUnitIds.push(_unitId);
        bloodBankUnitIds[msg.sender].push(_unitId);
        bloodBanks[msg.sender].totalUnitsRegistered++;

        if (donors[_donorRefId].exists) {
            donors[_donorRefId].totalDonations++;
            donors[_donorRefId].lastDonationTimestamp = block.timestamp;
            donorUnitHistory[_donorRefId].push(_unitId);
            totalDonationsRecorded++;
            emit DonationRecorded(_donorRefId, _unitId, block.timestamp);
        }

        _recordEvent(_unitId, "BloodUnitRegistered", UnitStatus.Collected, msg.sender, "Collected and registered with donor", _dataHash);
        emit BloodUnitRegistered(_unitId, _bloodGroup, _componentType, msg.sender, _expiryTimestamp, _dataHash);
    }

    function updateScreeningStatus(
        string calldata _unitId,
        ScreeningStatus _screeningStatus,
        string calldata _remarks,
        string calldata _dataHash
    ) external onlyAuthorizedBloodBank unitExists(_unitId) {
        BloodUnit storage unit = bloodUnits[_unitId];
        require(
            unit.status == UnitStatus.Collected || unit.status == UnitStatus.PendingScreening,
            "Cannot update screening in current state"
        );

        unit.screeningStatus = _screeningStatus;
        unit.dataHash = _dataHash;

        if (_screeningStatus == ScreeningStatus.Passed) {
            unit.status = UnitStatus.Available;
            _recordEvent(_unitId, "ScreeningPassed", UnitStatus.Available, msg.sender, _remarks, _dataHash);
            emit ScreeningStatusUpdated(_unitId, _screeningStatus, UnitStatus.Available, msg.sender, _dataHash);
        } else if (_screeningStatus == ScreeningStatus.Failed) {
            unit.status = UnitStatus.Quarantined;
            _recordEvent(_unitId, "ScreeningFailed", UnitStatus.Quarantined, msg.sender, _remarks, _dataHash);
            emit ScreeningStatusUpdated(_unitId, _screeningStatus, UnitStatus.Quarantined, msg.sender, _dataHash);
        } else {
            unit.status = UnitStatus.PendingScreening;
            _recordEvent(_unitId, "ScreeningPending", UnitStatus.PendingScreening, msg.sender, _remarks, _dataHash);
            emit ScreeningStatusUpdated(_unitId, _screeningStatus, UnitStatus.PendingScreening, msg.sender, _dataHash);
        }
    }

    function reserveBloodUnit(
        string calldata _unitId,
        address _hospital,
        string calldata _requestId,
        string calldata _dataHash
    ) external onlyAuthorizedBloodBank unitExists(_unitId) notExpired(_unitId) {
        BloodUnit storage unit = bloodUnits[_unitId];
        require(unit.status == UnitStatus.Available, "Only available units can be reserved");
        require(unit.screeningStatus == ScreeningStatus.Passed, "Unit must pass screening before reservation");
        require(hospitals[_hospital].isAuthorized || _hospital == admin, "Destination is not an authorized hospital");

        unit.status = UnitStatus.Reserved;
        unit.hospital = _hospital;
        unit.dataHash = _dataHash;

        _recordEvent(_unitId, "BloodUnitReserved", UnitStatus.Reserved, msg.sender, string.concat("Reserved for request ", _requestId), _dataHash);
        emit BloodUnitReserved(_unitId, _hospital, _requestId, _dataHash);
    }

    function dispatchBloodUnit(
        string calldata _unitId,
        address _destination,
        string calldata _shipmentRef,
        string calldata _dataHash
    ) external onlyAuthorizedParticipant unitExists(_unitId) notExpired(_unitId) {
        BloodUnit storage unit = bloodUnits[_unitId];
        require(unit.currentCustodian == msg.sender || msg.sender == admin, "Caller is not current custodian");
        require(unit.status == UnitStatus.Reserved || unit.status == UnitStatus.Received, "Unit not eligible for dispatch");

        unit.status = UnitStatus.Dispatched;
        unit.dataHash = _dataHash;
        bloodBanks[unit.bloodBank].totalUnitsDispatched++;

        _recordEvent(_unitId, "BloodUnitDispatched", UnitStatus.Dispatched, msg.sender, string.concat("Dispatched: ", _shipmentRef), _dataHash);
        emit BloodUnitDispatched(_unitId, msg.sender, _destination, _shipmentRef, _dataHash);
    }

    function receiveBloodUnit(
        string calldata _unitId,
        string calldata _dataHash
    ) external onlyAuthorizedHospital unitExists(_unitId) {
        BloodUnit storage unit = bloodUnits[_unitId];
        require(unit.status == UnitStatus.Dispatched, "Unit must be in dispatched state");
        require(unit.hospital == msg.sender || msg.sender == admin, "Caller is not designated hospital");

        unit.status = UnitStatus.Received;
        unit.currentCustodian = (msg.sender == admin && unit.hospital != address(0)) ? unit.hospital : msg.sender;
        unit.dataHash = _dataHash;
        hospitals[unit.currentCustodian].totalUnitsReceived++;

        _recordEvent(_unitId, "BloodUnitReceived", UnitStatus.Received, unit.currentCustodian, "Received by hospital", _dataHash);
        emit BloodUnitReceived(_unitId, unit.currentCustodian, block.timestamp, _dataHash);
    }

    function transfuseBloodUnit(
        string calldata _unitId,
        string calldata _patientRefHash,
        string calldata _dataHash
    ) external onlyAuthorizedHospital unitExists(_unitId) {
        BloodUnit storage unit = bloodUnits[_unitId];
        require(unit.status == UnitStatus.Received, "Unit must be received before transfusion");
        require(unit.currentCustodian == msg.sender || msg.sender == admin || unit.hospital == msg.sender, "Caller is not current custodian");
        require(block.timestamp <= unit.expiryTimestamp, "Cannot transfuse expired unit");

        unit.status = UnitStatus.Transfused;
        unit.dataHash = _dataHash;
        totalTransfusions++;

        address actor = (msg.sender == admin && unit.currentCustodian != address(0)) ? unit.currentCustodian : msg.sender;
        _recordEvent(_unitId, "BloodUnitTransfused", UnitStatus.Transfused, actor, string.concat("Transfused to patient: ", _patientRefHash), _dataHash);
        emit BloodUnitTransfused(_unitId, actor, _patientRefHash, block.timestamp, _dataHash);
    }

    function recordExpiry(
        string calldata _unitId,
        string calldata _dataHash
    ) external onlyAuthorizedParticipant unitExists(_unitId) {
        BloodUnit storage unit = bloodUnits[_unitId];
        require(unit.status != UnitStatus.Transfused && unit.status != UnitStatus.Discarded, "Cannot expire transfused or discarded unit");
        require(block.timestamp >= unit.expiryTimestamp, "Unit has not reached expiry timestamp");

        unit.status = UnitStatus.Expired;
        unit.dataHash = _dataHash;
        totalExpiredUnits++;

        _recordEvent(_unitId, "BloodUnitExpired", UnitStatus.Expired, msg.sender, "Unit expired", _dataHash);
        emit BloodUnitExpired(_unitId, msg.sender, block.timestamp, _dataHash);
    }

    function discardBloodUnit(
        string calldata _unitId,
        string calldata _reason,
        string calldata _dataHash
    ) external onlyAuthorizedParticipant unitExists(_unitId) {
        BloodUnit storage unit = bloodUnits[_unitId];
        require(unit.status != UnitStatus.Transfused, "Cannot discard transfused unit");
        require(unit.currentCustodian == msg.sender || msg.sender == admin || unit.hospital == msg.sender, "Caller is not current custodian");

        unit.status = UnitStatus.Discarded;
        unit.dataHash = _dataHash;
        totalDiscardedUnits++;

        address actor = (msg.sender == admin && unit.currentCustodian != address(0)) ? unit.currentCustodian : msg.sender;
        _recordEvent(_unitId, "BloodUnitDiscarded", UnitStatus.Discarded, actor, _reason, _dataHash);
        emit BloodUnitDiscarded(_unitId, actor, _reason, block.timestamp, _dataHash);
    }

    // --- Blood Request Tracking ---

    function createBloodRequest(
        string calldata _requestId,
        string calldata _bloodGroup,
        string calldata _componentType,
        uint256 _quantity,
        address _targetBloodBank,
        UrgencyLevel _urgency,
        string calldata _dataHash
    ) external onlyAuthorizedHospital {
        require(!bloodRequests[_requestId].exists, "Request ID already exists");
        require(_quantity > 0, "Quantity must be greater than zero");

        bloodRequests[_requestId] = BloodRequest({
            requestId: _requestId,
            bloodGroup: _bloodGroup,
            componentType: _componentType,
            quantity: _quantity,
            requestingHospital: msg.sender,
            targetBloodBank: _targetBloodBank,
            status: RequestStatus.Pending,
            urgency: _urgency,
            requestTimestamp: block.timestamp,
            fulfilledTimestamp: 0,
            assignedUnitId: "",
            dataHash: _dataHash,
            exists: true
        });

        allRequestIds.push(_requestId);
        hospitalRequestIds[msg.sender].push(_requestId);
        hospitals[msg.sender].totalRequestsMade++;

        emit BloodRequestCreated(_requestId, msg.sender, _bloodGroup, _urgency);
    }

    function approveBloodRequest(
        string calldata _requestId,
        string calldata _assignedUnitId,
        string calldata _dataHash
    ) external onlyAuthorizedBloodBank {
        BloodRequest storage req = bloodRequests[_requestId];
        require(req.exists, "Request does not exist");
        require(req.status == RequestStatus.Pending, "Request is not pending");
        require(bloodUnits[_assignedUnitId].exists, "Assigned unit does not exist");
        require(bloodUnits[_assignedUnitId].status == UnitStatus.Available, "Assigned unit is not available");

        req.status = RequestStatus.Approved;
        req.assignedUnitId = _assignedUnitId;
        req.dataHash = _dataHash;

        emit BloodRequestStatusUpdated(_requestId, RequestStatus.Approved, _assignedUnitId);
    }

    function fulfillBloodRequest(
        string calldata _requestId,
        string calldata _dataHash
    ) external onlyAuthorizedBloodBank {
        BloodRequest storage req = bloodRequests[_requestId];
        require(req.exists, "Request does not exist");
        require(req.status == RequestStatus.Approved, "Request must be approved first");

        req.status = RequestStatus.Fulfilled;
        req.fulfilledTimestamp = block.timestamp;
        req.dataHash = _dataHash;

        emit BloodRequestStatusUpdated(_requestId, RequestStatus.Fulfilled, req.assignedUnitId);
    }

    function rejectBloodRequest(
        string calldata _requestId,
        string calldata _dataHash
    ) external onlyAuthorizedBloodBank {
        BloodRequest storage req = bloodRequests[_requestId];
        require(req.exists, "Request does not exist");
        require(req.status == RequestStatus.Pending, "Only pending requests can be rejected");

        req.status = RequestStatus.Rejected;
        req.dataHash = _dataHash;

        emit BloodRequestStatusUpdated(_requestId, RequestStatus.Rejected, "");
    }

    function cancelBloodRequest(string calldata _requestId) external onlyAuthorizedHospital {
        BloodRequest storage req = bloodRequests[_requestId];
        require(req.exists, "Request does not exist");
        require(req.requestingHospital == msg.sender || msg.sender == admin, "Not authorized to cancel");
        require(req.status == RequestStatus.Pending, "Only pending requests can be cancelled");

        req.status = RequestStatus.Cancelled;
        emit BloodRequestStatusUpdated(_requestId, RequestStatus.Cancelled, "");
    }

    function getHospitalRequests(address _hospital) external view returns (string[] memory) {
        return hospitalRequestIds[_hospital];
    }

    function getBloodBankUnits(address _bloodBank) external view returns (string[] memory) {
        return bloodBankUnitIds[_bloodBank];
    }

    // --- Emergency Inter-Hospital Transfer ---

    function createEmergencyTransfer(
        string calldata _transferId,
        string calldata _unitId,
        address _requestingHospital,
        address _supplyingHospital,
        string calldata _urgency
    ) public onlyAuthorizedHospital {
        require(emergencyTransfers[_transferId].requestTimestamp == 0, "Transfer ID already exists");
        BloodUnit storage unit = bloodUnits[_unitId];
        require(unit.exists, "Unit does not exist");
        require(unit.status == UnitStatus.Received, "Unit must be stored in supplying hospital");
        require(block.timestamp < unit.expiryTimestamp, "Cannot transfer expired unit");

        address requester = (msg.sender == admin && _requestingHospital != address(0)) ? _requestingHospital : msg.sender;

        emergencyTransfers[_transferId] = EmergencyTransfer({
            transferId: _transferId,
            unitId: _unitId,
            requestingHospital: requester,
            supplyingHospital: _supplyingHospital,
            requestTimestamp: block.timestamp,
            completionTimestamp: 0,
            isCompleted: false,
            urgency: _urgency
        });

        totalEmergencyTransfers++;
        emit EmergencyRequestCreated(_transferId, _unitId, requester, _supplyingHospital, _urgency);
    }

    function createEmergencyTransfer(
        string calldata _transferId,
        string calldata _unitId,
        address _supplyingHospital,
        string calldata _urgency
    ) external onlyAuthorizedHospital {
        createEmergencyTransfer(_transferId, _unitId, msg.sender, _supplyingHospital, _urgency);
    }

    function completeEmergencyTransfer(
        string calldata _transferId,
        string calldata _dataHash
    ) external onlyAuthorizedHospital {
        EmergencyTransfer storage transfer = emergencyTransfers[_transferId];
        require(transfer.requestTimestamp > 0, "Transfer does not exist");
        require(!transfer.isCompleted, "Transfer already completed");
        require(transfer.requestingHospital == msg.sender || msg.sender == admin, "Only requesting hospital can complete");

        transfer.isCompleted = true;
        transfer.completionTimestamp = block.timestamp;

        address receivingHospital = transfer.requestingHospital != address(0) ? transfer.requestingHospital : msg.sender;

        BloodUnit storage unit = bloodUnits[transfer.unitId];
        unit.status = UnitStatus.Received;
        unit.currentCustodian = receivingHospital;
        unit.hospital = receivingHospital;
        unit.dataHash = _dataHash;

        _recordEvent(transfer.unitId, "BloodTransferCompleted", UnitStatus.Received, receivingHospital, string.concat("Emergency transfer completed: ", _transferId), _dataHash);
        emit BloodTransferCompleted(_transferId, transfer.unitId, receivingHospital, block.timestamp);
    }

    // --- Integrity & Verification ---

    function verifyDataIntegrity(string calldata _unitId, string calldata _expectedHash) external returns (bool) {
        if (!bloodUnits[_unitId].exists) return false;
        bool isTamperFree = keccak256(bytes(bloodUnits[_unitId].dataHash)) == keccak256(bytes(_expectedHash));
        emit IntegrityVerified(_unitId, isTamperFree, msg.sender, block.timestamp);
        return isTamperFree;
    }

    function batchVerifyIntegrity(
        string[] calldata _unitIds,
        string[] calldata _expectedHashes
    ) external view returns (bool[] memory results) {
        require(_unitIds.length == _expectedHashes.length, "Array length mismatch");
        results = new bool[](_unitIds.length);
        for (uint256 i = 0; i < _unitIds.length; i++) {
            if (!bloodUnits[_unitIds[i]].exists) {
                results[i] = false;
            } else {
                results[i] = keccak256(bytes(bloodUnits[_unitIds[i]].dataHash)) == keccak256(bytes(_expectedHashes[i]));
            }
        }
    }

    // --- Inventory Snapshot ---

    function recordInventorySnapshot() external onlyAuthorizedBloodBank returns (InventorySnapshot memory snapshot) {
        string[] memory unitIds = bloodBankUnitIds[msg.sender];
        uint256 available; uint256 reserved; uint256 dispatched;
        uint256 transfused; uint256 expired; uint256 discarded; uint256 quarantined;

        for (uint256 i = 0; i < unitIds.length; i++) {
            UnitStatus s = bloodUnits[unitIds[i]].status;
            if (s == UnitStatus.Available) available++;
            else if (s == UnitStatus.Reserved) reserved++;
            else if (s == UnitStatus.Dispatched) dispatched++;
            else if (s == UnitStatus.Transfused) transfused++;
            else if (s == UnitStatus.Expired) expired++;
            else if (s == UnitStatus.Discarded) discarded++;
            else if (s == UnitStatus.Quarantined) quarantined++;
        }

        snapshot = InventorySnapshot({
            totalUnits: unitIds.length,
            availableUnits: available,
            reservedUnits: reserved,
            dispatchedUnits: dispatched,
            transfusedUnits: transfused,
            expiredUnits: expired,
            discardedUnits: discarded,
            quarantinedUnits: quarantined,
            snapshotTimestamp: block.timestamp
        });

        emit InventorySnapshotRecorded(msg.sender, available, block.timestamp);
    }

    // --- View Functions ---

    function getBloodUnit(string calldata _unitId) external view returns (
        string memory unitId, string memory bloodGroup, string memory componentType,
        uint256 collectionTimestamp, uint256 expiryTimestamp,
        ScreeningStatus screeningStatus, UnitStatus status,
        address currentCustodian, address bloodBank, address hospital,
        string memory donorRefId, string memory dataHash
    ) {
        BloodUnit memory unit = bloodUnits[_unitId];
        require(unit.exists, "Unit does not exist");
        return (unit.unitId, unit.bloodGroup, unit.componentType, unit.collectionTimestamp,
            unit.expiryTimestamp, unit.screeningStatus, unit.status, unit.currentCustodian,
            unit.bloodBank, unit.hospital, unit.donorRefId, unit.dataHash);
    }

    function getUnitEvents(string calldata _unitId) external view returns (SupplyChainEvent[] memory) {
        require(bloodUnits[_unitId].exists, "Unit does not exist");
        return unitEvents[_unitId];
    }

    function getTotalUnitsCount() external view returns (uint256) { return allUnitIds.length; }
    function getAllUnitIds() external view returns (string[] memory) { return allUnitIds; }
    function getAllRequestIds() external view returns (string[] memory) { return allRequestIds; }
    function getAllDonorRefIds() external view returns (string[] memory) { return allDonorRefIds; }
    function getAllBloodBankAddresses() external view returns (address[] memory) { return allBloodBankAddresses; }
    function getAllHospitalAddresses() external view returns (address[] memory) { return allHospitalAddresses; }

    function getSystemStats() external view returns (
        uint256 totalUnits, uint256 totalRequests, uint256 totalDonors,
        uint256 transfusions, uint256 emergencies, uint256 expired, uint256 discarded
    ) {
        return (allUnitIds.length, allRequestIds.length, allDonorRefIds.length,
            totalTransfusions, totalEmergencyTransfers, totalExpiredUnits, totalDiscardedUnits);
    }

    function isUnitExpired(string calldata _unitId) external view returns (bool) {
        require(bloodUnits[_unitId].exists, "Unit does not exist");
        return block.timestamp >= bloodUnits[_unitId].expiryTimestamp;
    }

    // --- Internal ---

    function _recordEvent(
        string memory _unitId, string memory _eventType, UnitStatus _status,
        address _actor, string memory _remarks, string memory _dataHash
    ) internal {
        unitEvents[_unitId].push(SupplyChainEvent({
            unitId: _unitId, eventType: _eventType, status: _status,
            actor: _actor, timestamp: block.timestamp, remarks: _remarks, dataHash: _dataHash
        }));
    }
}
