// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BloodSupplyChain
 * @notice Decentralized supply chain tracker for blood units from donor collection to patient transfusion or disposal.
 * @dev Based on "Blockchain in Blood Bank Supply Management" by Sanyukta Shreshtha, Siddharth Rajput, Dr. Archana Singh.
 */
contract BloodSupplyChain {
    address public admin;

    enum UnitStatus {
        Collected,         // 0
        PendingScreening,  // 1
        Approved,          // 2
        Available,         // 3
        Reserved,          // 4
        Dispatched,        // 5
        Received,          // 6
        Transfused,        // 7
        Quarantined,       // 8
        Expired,           // 9
        Discarded          // 10
    }

    enum ScreeningStatus {
        Pending, // 0
        Passed,  // 1
        Failed   // 2
    }

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

    // Storage Mappings
    mapping(address => BloodBank) public bloodBanks;
    mapping(address => Hospital) public hospitals;
    mapping(string => BloodUnit) private bloodUnits;
    mapping(string => SupplyChainEvent[]) private unitEvents;
    mapping(string => EmergencyTransfer) public emergencyTransfers;
    string[] private allUnitIds;

    // Events
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
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
    event EmergencyRequestCreated(string indexed transferId, string indexed unitId, address indexed requestingHospital, address supplyingHospital, string urgency);
    event BloodTransferCompleted(string indexed transferId, string indexed unitId, address indexed receivingHospital, uint256 completionTimestamp);

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
            "Caller is not an authorized blood bank or hospital"
        );
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    // --- Admin & Registration ---

    function transferAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid new admin address");
        emit AdminTransferred(admin, _newAdmin);
        admin = _newAdmin;
    }

    function registerBloodBank(address _bbAddress, string calldata _name, string calldata _licenseNumber, bool _isAuthorized) external onlyAdmin {
        require(_bbAddress != address(0), "Invalid address");
        bloodBanks[_bbAddress] = BloodBank(_name, _licenseNumber, _isAuthorized, true);
        emit BloodBankRegistered(_bbAddress, _name, _licenseNumber);
    }

    function setBloodBankAuthorization(address _bbAddress, bool _isAuthorized) external onlyAdmin {
        require(bloodBanks[_bbAddress].exists, "Blood bank not registered");
        bloodBanks[_bbAddress].isAuthorized = _isAuthorized;
        emit BloodBankAuthorizationChanged(_bbAddress, _isAuthorized);
    }

    function registerHospital(address _hospAddress, string calldata _name, string calldata _licenseNumber, bool _isAuthorized) external onlyAdmin {
        require(_hospAddress != address(0), "Invalid address");
        hospitals[_hospAddress] = Hospital(_name, _licenseNumber, _isAuthorized, true);
        emit HospitalRegistered(_hospAddress, _name, _licenseNumber);
    }

    function setHospitalAuthorization(address _hospAddress, bool _isAuthorized) external onlyAdmin {
        require(hospitals[_hospAddress].exists, "Hospital not registered");
        hospitals[_hospAddress].isAuthorized = _isAuthorized;
        emit HospitalAuthorizationChanged(_hospAddress, _isAuthorized);
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

        BloodUnit memory newUnit = BloodUnit({
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
            exists: true
        });

        bloodUnits[_unitId] = newUnit;
        allUnitIds.push(_unitId);

        _recordEvent(_unitId, "BloodUnitRegistered", UnitStatus.Collected, msg.sender, "Collected and initial registration", _dataHash);
        emit BloodUnitRegistered(_unitId, _bloodGroup, _componentType, msg.sender, _expiryTimestamp, _dataHash);
    }

    function updateScreeningStatus(
        string calldata _unitId,
        ScreeningStatus _screeningStatus,
        string calldata _remarks,
        string calldata _dataHash
    ) external onlyAuthorizedBloodBank {
        BloodUnit storage unit = bloodUnits[_unitId];
        require(unit.exists, "Unit does not exist");
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
    ) external onlyAuthorizedBloodBank {
        BloodUnit storage unit = bloodUnits[_unitId];
        require(unit.exists, "Unit does not exist");
        require(unit.status == UnitStatus.Available, "Only available units can be reserved");
        require(unit.screeningStatus == ScreeningStatus.Passed, "Unit must pass screening before reservation");
        require(block.timestamp < unit.expiryTimestamp, "Cannot reserve expired blood unit");
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
    ) external onlyAuthorizedParticipant {
        BloodUnit storage unit = bloodUnits[_unitId];
        require(unit.exists, "Unit does not exist");
        require(unit.currentCustodian == msg.sender || msg.sender == admin, "Caller is not current custodian");
        require(unit.status == UnitStatus.Reserved || unit.status == UnitStatus.Received, "Unit not eligible for dispatch");
        require(block.timestamp < unit.expiryTimestamp, "Cannot dispatch expired unit");

        unit.status = UnitStatus.Dispatched;
        unit.dataHash = _dataHash;

        _recordEvent(_unitId, "BloodUnitDispatched", UnitStatus.Dispatched, msg.sender, string.concat("Dispatched: ", _shipmentRef), _dataHash);
        emit BloodUnitDispatched(_unitId, msg.sender, _destination, _shipmentRef, _dataHash);
    }

    function receiveBloodUnit(
        string calldata _unitId,
        string calldata _dataHash
    ) external onlyAuthorizedHospital {
        BloodUnit storage unit = bloodUnits[_unitId];
        require(unit.exists, "Unit does not exist");
        require(unit.status == UnitStatus.Dispatched, "Unit must be in dispatched state");
        require(unit.hospital == msg.sender || msg.sender == admin, "Caller is not designated hospital");

        unit.status = UnitStatus.Received;
        unit.currentCustodian = (msg.sender == admin && unit.hospital != address(0)) ? unit.hospital : msg.sender;
        unit.dataHash = _dataHash;

        _recordEvent(_unitId, "BloodUnitReceived", UnitStatus.Received, unit.currentCustodian, "Received by hospital", _dataHash);
        emit BloodUnitReceived(_unitId, unit.currentCustodian, block.timestamp, _dataHash);
    }

    function transfuseBloodUnit(
        string calldata _unitId,
        string calldata _patientRefHash,
        string calldata _dataHash
    ) external onlyAuthorizedHospital {
        BloodUnit storage unit = bloodUnits[_unitId];
        require(unit.exists, "Unit does not exist");
        require(unit.status == UnitStatus.Received, "Unit must be received by hospital before transfusion");
        require(unit.currentCustodian == msg.sender || msg.sender == admin || unit.hospital == msg.sender, "Caller is not current custodian");
        require(block.timestamp <= unit.expiryTimestamp, "Cannot transfuse expired unit");

        unit.status = UnitStatus.Transfused;
        unit.dataHash = _dataHash;

        address actor = (msg.sender == admin && unit.currentCustodian != address(0)) ? unit.currentCustodian : msg.sender;
        _recordEvent(_unitId, "BloodUnitTransfused", UnitStatus.Transfused, actor, string.concat("Transfused to patient ref hash: ", _patientRefHash), _dataHash);
        emit BloodUnitTransfused(_unitId, actor, _patientRefHash, block.timestamp, _dataHash);
    }

    function recordExpiry(
        string calldata _unitId,
        string calldata _dataHash
    ) external onlyAuthorizedParticipant {
        BloodUnit storage unit = bloodUnits[_unitId];
        require(unit.exists, "Unit does not exist");
        require(
            unit.status != UnitStatus.Transfused && unit.status != UnitStatus.Discarded,
            "Cannot expire transfused or discarded unit"
        );
        require(block.timestamp >= unit.expiryTimestamp, "Unit has not reached expiry timestamp");

        unit.status = UnitStatus.Expired;
        unit.dataHash = _dataHash;

        _recordEvent(_unitId, "BloodUnitExpired", UnitStatus.Expired, msg.sender, "Unit expired", _dataHash);
        emit BloodUnitExpired(_unitId, msg.sender, block.timestamp, _dataHash);
    }

    function discardBloodUnit(
        string calldata _unitId,
        string calldata _reason,
        string calldata _dataHash
    ) external onlyAuthorizedParticipant {
        BloodUnit storage unit = bloodUnits[_unitId];
        require(unit.exists, "Unit does not exist");
        require(unit.status != UnitStatus.Transfused, "Cannot discard transfused unit");
        require(unit.currentCustodian == msg.sender || msg.sender == admin || unit.hospital == msg.sender, "Caller is not current custodian");

        unit.status = UnitStatus.Discarded;
        unit.dataHash = _dataHash;

        address actor = (msg.sender == admin && unit.currentCustodian != address(0)) ? unit.currentCustodian : msg.sender;
        _recordEvent(_unitId, "BloodUnitDiscarded", UnitStatus.Discarded, actor, _reason, _dataHash);
        emit BloodUnitDiscarded(_unitId, actor, _reason, block.timestamp, _dataHash);
    }

    // --- Emergency Inter-Hospital Transfer ---

    function createEmergencyTransfer(
        string calldata _transferId,
        string calldata _unitId,
        address _requestingHospital,
        address _supplyingHospital,
        string calldata _urgency
    ) public onlyAuthorizedHospital {
        require(!emergencyTransfers[_transferId].isCompleted && emergencyTransfers[_transferId].requestTimestamp == 0, "Transfer ID already exists");
        BloodUnit storage unit = bloodUnits[_unitId];
        require(unit.exists, "Unit does not exist");
        require(unit.status == UnitStatus.Received, "Unit must be stored in supplying hospital");
        require(
            unit.currentCustodian == _supplyingHospital ||
            unit.hospital == _supplyingHospital ||
            msg.sender == admin ||
            unit.currentCustodian == admin,
            "Supplying hospital is not current custodian"
        );
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
        require(transfer.requestTimestamp > 0, "Transfer request does not exist");
        require(!transfer.isCompleted, "Transfer already completed");
        require(transfer.requestingHospital == msg.sender || msg.sender == admin, "Only requesting hospital can complete receipt");

        transfer.isCompleted = true;
        transfer.completionTimestamp = block.timestamp;

        address receivingHospital = transfer.requestingHospital;
        if (receivingHospital == address(0)) {
            receivingHospital = msg.sender;
        }

        BloodUnit storage unit = bloodUnits[transfer.unitId];
        unit.status = UnitStatus.Received;
        unit.currentCustodian = receivingHospital;
        unit.hospital = receivingHospital;
        unit.dataHash = _dataHash;

        _recordEvent(transfer.unitId, "BloodTransferCompleted", UnitStatus.Received, receivingHospital, string.concat("Emergency transfer completed: ", _transferId), _dataHash);
        emit BloodTransferCompleted(_transferId, transfer.unitId, receivingHospital, block.timestamp);
    }

    // --- View & Query Functions ---

    function getBloodUnit(string calldata _unitId) external view returns (
        string memory unitId,
        string memory bloodGroup,
        string memory componentType,
        uint256 collectionTimestamp,
        uint256 expiryTimestamp,
        ScreeningStatus screeningStatus,
        UnitStatus status,
        address currentCustodian,
        address bloodBank,
        address hospital,
        string memory dataHash
    ) {
        BloodUnit memory unit = bloodUnits[_unitId];
        require(unit.exists, "Unit does not exist");
        return (
            unit.unitId,
            unit.bloodGroup,
            unit.componentType,
            unit.collectionTimestamp,
            unit.expiryTimestamp,
            unit.screeningStatus,
            unit.status,
            unit.currentCustodian,
            unit.bloodBank,
            unit.hospital,
            unit.dataHash
        );
    }

    function getUnitEvents(string calldata _unitId) external view returns (SupplyChainEvent[] memory) {
        require(bloodUnits[_unitId].exists, "Unit does not exist");
        return unitEvents[_unitId];
    }

    function getTotalUnitsCount() external view returns (uint256) {
        return allUnitIds.length;
    }

    function getAllUnitIds() external view returns (string[] memory) {
        return allUnitIds;
    }

    function verifyDataIntegrity(string calldata _unitId, string calldata _expectedHash) external view returns (bool) {
        if (!bloodUnits[_unitId].exists) return false;
        return keccak256(bytes(bloodUnits[_unitId].dataHash)) == keccak256(bytes(_expectedHash));
    }

    // --- Internal Helpers ---

    function _recordEvent(
        string memory _unitId,
        string memory _eventType,
        UnitStatus _status,
        address _actor,
        string memory _remarks,
        string memory _dataHash
    ) internal {
        unitEvents[_unitId].push(SupplyChainEvent({
            unitId: _unitId,
            eventType: _eventType,
            status: _status,
            actor: _actor,
            timestamp: block.timestamp,
            remarks: _remarks,
            dataHash: _dataHash
        }));
    }
}
