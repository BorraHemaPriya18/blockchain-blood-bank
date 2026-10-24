// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BloodSupplyChain
 * @notice Decentralized vein-to-vein blood supply chain tracker.
 * @dev v2.2 - approveBloodRequest atomically reserves unit; updateScreeningStatus
 *      enforces bloodBank ownership; dispatchBloodUnit restricted to Reserved only
 *      with destination validation.
 */
contract BloodSupplyChain {
    address public admin;

    enum UnitStatus {
        Collected, PendingScreening, Approved, Available,
        Reserved, Dispatched, Received, Transfused,
        Quarantined, Expired, Discarded
    }

    enum ScreeningStatus { Pending, Passed, Failed }

    struct BloodBank {
        string name;
        string licenseNumber;
        bool isAuthorized;
        bool exists;
    }

    struct Hospital {
        string name;
        string licenseNumber;
        bool isAuthorized;
        bool exists;
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
        string dataHash;
        bool exists;
        string requestId;
    }

    struct SupplyChainEvent {
        string eventType;
        UnitStatus status;
        address actor;
        uint256 timestamp;
        string dataHash;
    }

    struct BloodRequestRecord {
        string requestId;
        address hospital;
        string bloodGroup;
        string componentType;
        address assignedBloodBank;
        string assignedUnitId;
        bool isApproved;
        bool isFulfilled;
        bool exists;
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

    mapping(address => BloodBank) public bloodBanks;
    mapping(address => Hospital)  public hospitals;
    mapping(string  => BloodUnit) private bloodUnits;
    mapping(string => SupplyChainEvent[]) private unitEvents;
    mapping(string => BloodRequestRecord) public bloodRequests;
    mapping(string => EmergencyTransfer)  public emergencyTransfers;

    string[]  private allUnitIds;
    address[] private allBloodBankAddresses;
    address[] private allHospitalAddresses;

    event BloodBankRegistered(address indexed bloodBankAddress, string name, string licenseNumber);
    event BloodBankAuthorizationChanged(address indexed bloodBankAddress, bool isAuthorized);
    event HospitalRegistered(address indexed hospitalAddress, string name, string licenseNumber);
    event HospitalAuthorizationChanged(address indexed hospitalAddress, bool isAuthorized);
    event BloodUnitRegistered(string indexed unitId, string bloodGroup, string componentType, address indexed bloodBank, uint256 expiryTimestamp, string dataHash);
    event ScreeningStatusUpdated(string indexed unitId, ScreeningStatus screeningStatus, UnitStatus unitStatus, address indexed actor, string dataHash);
    event BloodUnitReserved(string indexed unitId, address indexed hospital, string requestId, string dataHash);
    event BloodUnitDispatched(string indexed unitId, address indexed from, address indexed to, string shipmentRef, string dataHash);
    event BloodUnitReceived(string indexed unitId, address indexed hospital, uint256 timestamp, string dataHash);
    event BloodUnitTransfused(string indexed unitId, address indexed hospital, string patientRefHash, uint256 timestamp, string dataHash);
    event BloodUnitExpired(string indexed unitId, address indexed custodian, uint256 timestamp, string dataHash);
    event BloodUnitDiscarded(string indexed unitId, address indexed custodian, string reason, uint256 timestamp, string dataHash);
    event BloodRequestApproved(string indexed requestId, address indexed hospital, address indexed bloodBank, string bloodGroup, string componentType);
    event BloodRequestFulfilled(string indexed requestId, string indexed unitId, address indexed hospital, address bloodBank);
    event EmergencyRequestCreated(string indexed transferId, string indexed unitId, address indexed requestingHospital, address supplyingHospital, string urgency);
    event BloodTransferCompleted(string indexed transferId, string indexed unitId, address indexed receivingHospital, uint256 completionTimestamp);

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
        require(msg.sender == admin || bloodBanks[msg.sender].isAuthorized || hospitals[msg.sender].isAuthorized, "Not authorized");
        _;
    }

    modifier unitExists(string calldata _unitId) {
        require(bloodUnits[_unitId].exists, "Unit does not exist");
        _;
    }

    modifier notExpired(string calldata _unitId) {
        require(block.timestamp < bloodUnits[_unitId].expiryTimestamp, "Unit has expired");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function registerBloodBank(address _bbAddress, string calldata _name, string calldata _licenseNumber, bool _isAuthorized) external onlyAdmin {
        require(_bbAddress != address(0), "Invalid address");
        bool isNew = !bloodBanks[_bbAddress].exists;
        bloodBanks[_bbAddress] = BloodBank(_name, _licenseNumber, _isAuthorized, true);
        if (isNew) allBloodBankAddresses.push(_bbAddress);
        emit BloodBankRegistered(_bbAddress, _name, _licenseNumber);
    }

    function setBloodBankAuthorization(address _bbAddress, bool _isAuthorized) external onlyAdmin {
        require(bloodBanks[_bbAddress].exists, "Blood bank not registered");
        bloodBanks[_bbAddress].isAuthorized = _isAuthorized;
        emit BloodBankAuthorizationChanged(_bbAddress, _isAuthorized);
    }

    function registerHospital(address _hospAddress, string calldata _name, string calldata _licenseNumber, bool _isAuthorized) external onlyAdmin {
        require(_hospAddress != address(0), "Invalid address");
        bool isNew = !hospitals[_hospAddress].exists;
        hospitals[_hospAddress] = Hospital(_name, _licenseNumber, _isAuthorized, true);
        if (isNew) allHospitalAddresses.push(_hospAddress);
        emit HospitalRegistered(_hospAddress, _name, _licenseNumber);
    }

    function setHospitalAuthorization(address _hospAddress, bool _isAuthorized) external onlyAdmin {
        require(hospitals[_hospAddress].exists, "Hospital not registered");
        hospitals[_hospAddress].isAuthorized = _isAuthorized;
        emit HospitalAuthorizationChanged(_hospAddress, _isAuthorized);
    }

    function registerBloodUnit(
        string calldata _unitId,
        string calldata _bloodGroup,
        string calldata _componentType,
        uint256 _collectionTimestamp,
        uint256 _expiryTimestamp,
        string calldata _dataHash
    ) external onlyAuthorizedBloodBank {
        require(bytes(_unitId).length > 0, "Unit ID empty");
        require(!bloodUnits[_unitId].exists, "Blood unit already registered");
        require(_expiryTimestamp > _collectionTimestamp, "Invalid expiry");

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
            dataHash: _dataHash,
            exists: true,
            requestId: ""
        });

        allUnitIds.push(_unitId);
        _recordEvent(_unitId, "BloodUnitRegistered", UnitStatus.Collected, msg.sender, _dataHash);
        emit BloodUnitRegistered(_unitId, _bloodGroup, _componentType, msg.sender, _expiryTimestamp, _dataHash);
    }

    function updateScreeningStatus(
        string calldata _unitId,
        ScreeningStatus _screeningStatus,
        string calldata,
        string calldata _dataHash
    ) external onlyAuthorizedBloodBank unitExists(_unitId) {
        BloodUnit storage unit = bloodUnits[_unitId];
        require(unit.bloodBank == msg.sender || msg.sender == admin, "Not the owning blood bank");
        require(block.timestamp < unit.expiryTimestamp, "Unit has expired");
        require(unit.status == UnitStatus.Collected || unit.status == UnitStatus.PendingScreening, "Invalid state");

        unit.screeningStatus = _screeningStatus;
        unit.dataHash = _dataHash;

        if (_screeningStatus == ScreeningStatus.Passed) {
            unit.status = UnitStatus.Available;
            _recordEvent(_unitId, "ScreeningPassed", UnitStatus.Available, msg.sender, _dataHash);
            emit ScreeningStatusUpdated(_unitId, _screeningStatus, UnitStatus.Available, msg.sender, _dataHash);
        } else if (_screeningStatus == ScreeningStatus.Failed) {
            unit.status = UnitStatus.Quarantined;
            _recordEvent(_unitId, "ScreeningFailed", UnitStatus.Quarantined, msg.sender, _dataHash);
            emit ScreeningStatusUpdated(_unitId, _screeningStatus, UnitStatus.Quarantined, msg.sender, _dataHash);
        } else {
            unit.status = UnitStatus.PendingScreening;
            _recordEvent(_unitId, "ScreeningPending", UnitStatus.PendingScreening, msg.sender, _dataHash);
            emit ScreeningStatusUpdated(_unitId, _screeningStatus, UnitStatus.PendingScreening, msg.sender, _dataHash);
        }
    }

    struct ReserveParams {
        string requestBloodGroup;
        string requestComponentType;
    }

    function reserveBloodUnit(
        string calldata _unitId,
        address _hospital,
        string calldata _requestId,
        string calldata _dataHash,
        string calldata _requestBloodGroup,
        string calldata _requestComponentType
    ) external onlyAuthorizedBloodBank unitExists(_unitId) notExpired(_unitId) {
        BloodUnit storage unit = bloodUnits[_unitId];
        require(unit.status == UnitStatus.Available, "Only available units can be reserved");
        require(unit.screeningStatus == ScreeningStatus.Passed, "Unit has not passed screening");
        require(hospitals[_hospital].isAuthorized || _hospital == admin, "Hospital is not authorized");
        require(
            keccak256(bytes(unit.bloodGroup)) == keccak256(bytes(_requestBloodGroup)),
            "Unit blood group does not match request"
        );
        require(
            keccak256(bytes(unit.componentType)) == keccak256(bytes(_requestComponentType)),
            "Unit component type does not match request"
        );
        require(unit.bloodBank == msg.sender || msg.sender == admin, "Unit does not belong to this blood bank");

        unit.status = UnitStatus.Reserved;
        unit.hospital = _hospital;
        unit.dataHash = _dataHash;
        unit.requestId = _requestId;

        _recordEvent(_unitId, "BloodUnitReserved", UnitStatus.Reserved, msg.sender, _dataHash);
        emit BloodUnitReserved(_unitId, _hospital, _requestId, _dataHash);
    }

    function dispatchBloodUnit(
        string calldata _unitId,
        address _destination,
        string calldata _shipmentRef,
        string calldata _dataHash
    ) external onlyAuthorizedParticipant unitExists(_unitId) notExpired(_unitId) {
        BloodUnit storage unit = bloodUnits[_unitId];
        require(unit.currentCustodian == msg.sender || msg.sender == admin, "Not custodian");
        require(unit.status == UnitStatus.Reserved, "Unit must be reserved before dispatch");
        require(_destination == unit.hospital, "Destination does not match assigned hospital");
        require(bytes(unit.requestId).length > 0, "Unit is not linked to a request");

        unit.status = UnitStatus.Dispatched;
        unit.dataHash = _dataHash;

        _recordEvent(_unitId, "Dispatched", UnitStatus.Dispatched, msg.sender, _dataHash);
        emit BloodUnitDispatched(_unitId, msg.sender, _destination, _shipmentRef, _dataHash);
    }

    function receiveBloodUnit(
        string calldata _unitId,
        string calldata _dataHash
    ) external onlyAuthorizedHospital unitExists(_unitId) {
        BloodUnit storage unit = bloodUnits[_unitId];
        require(unit.status == UnitStatus.Dispatched, "Not dispatched");
        require(unit.hospital == msg.sender || msg.sender == admin, "Caller is not designated hospital");

        unit.status = UnitStatus.Received;
        unit.currentCustodian = (msg.sender == admin && unit.hospital != address(0)) ? unit.hospital : msg.sender;
        unit.dataHash = _dataHash;

        _recordEvent(_unitId, "Received", UnitStatus.Received, unit.currentCustodian, _dataHash);
        emit BloodUnitReceived(_unitId, unit.currentCustodian, block.timestamp, _dataHash);
    }

    function transfuseBloodUnit(
        string calldata _unitId,
        string calldata _patientRefHash,
        string calldata _dataHash
    ) external onlyAuthorizedHospital unitExists(_unitId) {
        BloodUnit storage unit = bloodUnits[_unitId];
        require(unit.status == UnitStatus.Received, "Not received");
        require(unit.currentCustodian == msg.sender || msg.sender == admin || unit.hospital == msg.sender, "Not custodian");
        require(block.timestamp <= unit.expiryTimestamp, "Expired");

        unit.status = UnitStatus.Transfused;
        unit.dataHash = _dataHash;

        address actor = (msg.sender == admin && unit.currentCustodian != address(0)) ? unit.currentCustodian : msg.sender;
        _recordEvent(_unitId, "Transfused", UnitStatus.Transfused, actor, _dataHash);
        emit BloodUnitTransfused(_unitId, actor, _patientRefHash, block.timestamp, _dataHash);
    }

    function recordExpiry(
        string calldata _unitId,
        string calldata _dataHash
    ) external onlyAuthorizedParticipant unitExists(_unitId) {
        BloodUnit storage unit = bloodUnits[_unitId];
        require(unit.status != UnitStatus.Transfused && unit.status != UnitStatus.Discarded, "Invalid state");
        require(block.timestamp >= unit.expiryTimestamp, "Not yet expired");

        unit.status = UnitStatus.Expired;
        unit.dataHash = _dataHash;

        _recordEvent(_unitId, "Expired", UnitStatus.Expired, msg.sender, _dataHash);
        emit BloodUnitExpired(_unitId, msg.sender, block.timestamp, _dataHash);
    }

    function discardBloodUnit(
        string calldata _unitId,
        string calldata _reason,
        string calldata _dataHash
    ) external onlyAuthorizedParticipant unitExists(_unitId) {
        BloodUnit storage unit = bloodUnits[_unitId];
        require(unit.status != UnitStatus.Transfused, "Already transfused");
        require(unit.currentCustodian == msg.sender || msg.sender == admin || unit.hospital == msg.sender, "Not custodian");

        unit.status = UnitStatus.Discarded;
        unit.dataHash = _dataHash;

        address actor = (msg.sender == admin && unit.currentCustodian != address(0)) ? unit.currentCustodian : msg.sender;
        _recordEvent(_unitId, "Discarded", UnitStatus.Discarded, actor, _dataHash);
        emit BloodUnitDiscarded(_unitId, actor, _reason, block.timestamp, _dataHash);
    }

    function approveBloodRequest(
        string calldata _requestId,
        address _hospital,
        string calldata _bloodGroup,
        string calldata _componentType,
        string calldata _unitId
    ) external onlyAuthorizedBloodBank unitExists(_unitId) notExpired(_unitId) {
        require(bytes(_requestId).length > 0, "Request ID empty");
        require(!bloodRequests[_requestId].exists, "Request already exists");
        require(hospitals[_hospital].isAuthorized, "Hospital is not authorized");
        require(bytes(_bloodGroup).length > 0, "Blood group required");
        require(bytes(_componentType).length > 0, "Component type required");

        BloodUnit storage unit = bloodUnits[_unitId];

        require(unit.status == UnitStatus.Available, "Unit is not available");
        require(unit.screeningStatus == ScreeningStatus.Passed, "Unit has not passed screening");
        require(
            keccak256(bytes(unit.bloodGroup)) == keccak256(bytes(_bloodGroup)),
            "Blood group mismatch"
        );
        require(
            keccak256(bytes(unit.componentType)) == keccak256(bytes(_componentType)),
            "Component type mismatch"
        );
        require(unit.bloodBank == msg.sender || msg.sender == admin, "Unit belongs to another blood bank");
        require(unit.currentCustodian == unit.bloodBank, "Unit is not held by its blood bank");

        // Reserve the unit immediately to prevent duplicate allocation
        unit.status = UnitStatus.Reserved;
        unit.hospital = _hospital;
        unit.requestId = _requestId;

        bloodRequests[_requestId] = BloodRequestRecord({
            requestId: _requestId,
            hospital: _hospital,
            bloodGroup: _bloodGroup,
            componentType: _componentType,
            assignedBloodBank: unit.bloodBank,
            assignedUnitId: _unitId,
            isApproved: true,
            isFulfilled: false,
            exists: true
        });

        _recordEvent(_unitId, "BloodUnitReserved", UnitStatus.Reserved, msg.sender, unit.dataHash);
        emit BloodUnitReserved(_unitId, _hospital, _requestId, unit.dataHash);
        emit BloodRequestApproved(_requestId, _hospital, unit.bloodBank, _bloodGroup, _componentType);
    }

    function fulfillBloodRequest(
        string calldata _requestId
    ) external onlyAuthorizedBloodBank {
        BloodRequestRecord storage req = bloodRequests[_requestId];
        require(req.exists, "Request not approved on-chain");
        require(req.isApproved, "Request is not approved");
        require(!req.isFulfilled, "Request already fulfilled");
        require(req.assignedBloodBank == msg.sender || msg.sender == admin, "Not the assigned blood bank");

        string memory unitId = req.assignedUnitId;
        require(bloodUnits[unitId].exists, "Assigned unit does not exist");

        BloodUnit storage unit = bloodUnits[unitId];

        require(unit.status == UnitStatus.Received, "Unit must be received before fulfillment");
        require(unit.hospital == req.hospital, "Unit was not delivered to the requesting hospital");
        require(unit.currentCustodian == req.hospital, "Unit is not in custody of the requesting hospital");
        require(
            keccak256(bytes(unit.bloodGroup)) == keccak256(bytes(req.bloodGroup)),
            "Unit blood group does not match request"
        );
        require(
            keccak256(bytes(unit.componentType)) == keccak256(bytes(req.componentType)),
            "Unit component type does not match request"
        );
        require(unit.bloodBank == msg.sender || msg.sender == admin, "Unit does not belong to this blood bank");
        require(block.timestamp < unit.expiryTimestamp, "Unit has expired");

        req.isFulfilled = true;

        emit BloodRequestFulfilled(_requestId, unitId, req.hospital, msg.sender);
    }

    function createEmergencyTransfer(
        string calldata _transferId,
        string calldata _unitId,
        address _supplyingHospital,
        string calldata _urgency
    ) external onlyAuthorizedHospital {
        require(emergencyTransfers[_transferId].requestTimestamp == 0, "Transfer ID exists");
        BloodUnit storage unit = bloodUnits[_unitId];
        require(unit.exists, "Unit does not exist");
        require(unit.status == UnitStatus.Received, "Unit not available");
        require(block.timestamp < unit.expiryTimestamp, "Unit expired");

        emergencyTransfers[_transferId] = EmergencyTransfer({
            transferId: _transferId,
            unitId: _unitId,
            requestingHospital: msg.sender,
            supplyingHospital: _supplyingHospital,
            requestTimestamp: block.timestamp,
            completionTimestamp: 0,
            isCompleted: false,
            urgency: _urgency
        });

        emit EmergencyRequestCreated(_transferId, _unitId, msg.sender, _supplyingHospital, _urgency);
    }

    function completeEmergencyTransfer(
        string calldata _transferId,
        string calldata _dataHash
    ) external onlyAuthorizedHospital {
        EmergencyTransfer storage transfer = emergencyTransfers[_transferId];
        require(transfer.requestTimestamp > 0, "Transfer does not exist");
        require(!transfer.isCompleted, "Already completed");
        require(transfer.requestingHospital == msg.sender || msg.sender == admin, "Not authorized");

        transfer.isCompleted = true;
        transfer.completionTimestamp = block.timestamp;

        BloodUnit storage unit = bloodUnits[transfer.unitId];
        unit.status = UnitStatus.Received;
        unit.currentCustodian = transfer.requestingHospital;
        unit.hospital = transfer.requestingHospital;
        unit.dataHash = _dataHash;

        _recordEvent(transfer.unitId, "EmergencyTransfer", UnitStatus.Received, transfer.requestingHospital, _dataHash);
        emit BloodTransferCompleted(_transferId, transfer.unitId, transfer.requestingHospital, block.timestamp);
    }

    function verifyDataIntegrity(string calldata _unitId, string calldata _expectedHash) external view returns (bool) {
        if (!bloodUnits[_unitId].exists) return false;
        return keccak256(bytes(bloodUnits[_unitId].dataHash)) == keccak256(bytes(_expectedHash));
    }

    function getBloodUnit(string calldata _unitId) external view returns (
        string memory unitId, string memory bloodGroup, string memory componentType,
        uint256 collectionTimestamp, uint256 expiryTimestamp,
        ScreeningStatus screeningStatus, UnitStatus status,
        address currentCustodian, address bloodBank, address hospital,
        string memory dataHash
    ) {
        BloodUnit memory unit = bloodUnits[_unitId];
        require(unit.exists, "Blood unit already registered");
        return (unit.unitId, unit.bloodGroup, unit.componentType, unit.collectionTimestamp,
            unit.expiryTimestamp, unit.screeningStatus, unit.status, unit.currentCustodian,
            unit.bloodBank, unit.hospital, unit.dataHash);
    }

    function getUnitEvents(string calldata _unitId) external view returns (SupplyChainEvent[] memory) {
        require(bloodUnits[_unitId].exists, "Unit does not exist");
        return unitEvents[_unitId];
    }

    function getTotalUnitsCount() external view returns (uint256) { return allUnitIds.length; }
    function getAllUnitIds() external view returns (string[] memory) { return allUnitIds; }
    function getAllBloodBankAddresses() external view returns (address[] memory) { return allBloodBankAddresses; }
    function getAllHospitalAddresses() external view returns (address[] memory) { return allHospitalAddresses; }

    function _recordEvent(
        string memory _unitId, string memory _eventType, UnitStatus _status,
        address _actor, string memory _dataHash
    ) internal {
        unitEvents[_unitId].push(SupplyChainEvent({
            eventType: _eventType, status: _status,
            actor: _actor, timestamp: block.timestamp, dataHash: _dataHash
        }));
    }
}
