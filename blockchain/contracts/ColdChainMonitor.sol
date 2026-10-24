// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ColdChainMonitor
 * @notice Records and verifies cold chain temperature compliance for blood unit transport.
 *         Blood components require strict temperature ranges: Red Blood Cells (1-6°C),
 *         Platelets (20-24°C), Fresh Frozen Plasma (-18°C or below).
 *         Temperature excursions are flagged as compliance violations on-chain.
 */
contract ColdChainMonitor {

    address public admin;

    // Temperature stored as int16 in tenths of a degree Celsius (e.g. 45 = 4.5°C)
    int16 public constant RBC_TEMP_MIN      =  10;  //  1.0°C
    int16 public constant RBC_TEMP_MAX      =  60;  //  6.0°C
    int16 public constant PLATELET_TEMP_MIN = 200;  // 20.0°C
    int16 public constant PLATELET_TEMP_MAX = 240;  // 24.0°C
    int16 public constant FFP_TEMP_MAX      = -180; // -18.0°C

    enum ComponentType { RBC, Platelet, FFP, WholeBlood, Cryoprecipitate }
    enum ShipmentStatus { Created, InTransit, Delivered, Aborted, ComplianceFailed }

    struct TemperatureReading {
        int16   temperature;   // tenths of °C
        uint256 timestamp;
        address recorder;
        bool    inRange;
        string  sensorId;
    }

    struct Shipment {
        string         shipmentId;
        string         unitId;
        ComponentType  componentType;
        address        origin;
        address        destination;
        ShipmentStatus status;
        uint256        departureTimestamp;
        uint256        arrivalTimestamp;
        uint256        totalReadings;
        uint256        excursionCount;
        bool           compliancePassed;
        bool           exists;
    }

    struct ComplianceReport {
        string  shipmentId;
        uint256 totalReadings;
        uint256 excursions;
        int16   minTempRecorded;
        int16   maxTempRecorded;
        bool    passed;
        uint256 generatedAt;
    }

    mapping(string => Shipment) public shipments;
    mapping(string => TemperatureReading[]) private _readings;
    mapping(string => ComplianceReport) public complianceReports;
    mapping(address => bool) public authorizedSensors;
    mapping(address => string[]) private _originShipments;
    mapping(address => string[]) private _destinationShipments;

    string[] private _allShipmentIds;
    uint256 public totalShipments;
    uint256 public totalExcursions;
    uint256 public totalCompliantShipments;

    event ShipmentCreated(string indexed shipmentId, string indexed unitId, ComponentType componentType, address origin, address destination, uint256 timestamp);
    event TemperatureRecorded(string indexed shipmentId, int16 temperature, bool inRange, string sensorId, uint256 timestamp);
    event TemperatureExcursion(string indexed shipmentId, string indexed unitId, int16 temperature, int16 minAllowed, int16 maxAllowed, uint256 timestamp);
    event ShipmentDelivered(string indexed shipmentId, bool compliancePassed, uint256 excursions, uint256 timestamp);
    event ShipmentAborted(string indexed shipmentId, string reason, uint256 timestamp);
    event ComplianceReportGenerated(string indexed shipmentId, bool passed, uint256 excursions, uint256 timestamp);
    event SensorAuthorizationChanged(address indexed sensor, bool authorized, uint256 timestamp);

    modifier onlyAdmin() {
        require(msg.sender == admin, "ColdChain: caller is not admin");
        _;
    }

    modifier onlyAuthorizedSensor() {
        require(authorizedSensors[msg.sender] || msg.sender == admin, "ColdChain: caller is not authorized sensor");
        _;
    }

    modifier shipmentExists(string calldata _shipmentId) {
        require(shipments[_shipmentId].exists, "ColdChain: shipment does not exist");
        _;
    }

    constructor() {
        admin = msg.sender;
        authorizedSensors[msg.sender] = true;
    }

    function setSensorAuthorization(address sensor, bool authorized) external onlyAdmin {
        require(sensor != address(0), "ColdChain: zero address");
        authorizedSensors[sensor] = authorized;
        emit SensorAuthorizationChanged(sensor, authorized, block.timestamp);
    }

    function createShipment(
        string calldata _shipmentId,
        string calldata _unitId,
        ComponentType _componentType,
        address _destination
    ) external {
        require(!shipments[_shipmentId].exists, "ColdChain: shipment ID already exists");
        require(_destination != address(0), "ColdChain: invalid destination");

        shipments[_shipmentId] = Shipment({
            shipmentId: _shipmentId,
            unitId: _unitId,
            componentType: _componentType,
            origin: msg.sender,
            destination: _destination,
            status: ShipmentStatus.Created,
            departureTimestamp: 0,
            arrivalTimestamp: 0,
            totalReadings: 0,
            excursionCount: 0,
            compliancePassed: true,
            exists: true
        });

        _allShipmentIds.push(_shipmentId);
        _originShipments[msg.sender].push(_shipmentId);
        _destinationShipments[_destination].push(_shipmentId);
        totalShipments++;

        emit ShipmentCreated(_shipmentId, _unitId, _componentType, msg.sender, _destination, block.timestamp);
    }

    function startTransit(string calldata _shipmentId) external shipmentExists(_shipmentId) {
        Shipment storage s = shipments[_shipmentId];
        require(s.origin == msg.sender || msg.sender == admin, "ColdChain: not shipment origin");
        require(s.status == ShipmentStatus.Created, "ColdChain: shipment not in Created state");
        s.status = ShipmentStatus.InTransit;
        s.departureTimestamp = block.timestamp;
    }

    function recordTemperature(
        string calldata _shipmentId,
        int16 _temperature,
        string calldata _sensorId
    ) external onlyAuthorizedSensor shipmentExists(_shipmentId) {
        Shipment storage s = shipments[_shipmentId];
        require(s.status == ShipmentStatus.InTransit, "ColdChain: shipment not in transit");

        bool inRange = _isInRange(_temperature, s.componentType);

        _readings[_shipmentId].push(TemperatureReading({
            temperature: _temperature,
            timestamp: block.timestamp,
            recorder: msg.sender,
            inRange: inRange,
            sensorId: _sensorId
        }));

        s.totalReadings++;

        if (!inRange) {
            s.excursionCount++;
            s.compliancePassed = false;
            totalExcursions++;
            (int16 minAllowed, int16 maxAllowed) = _getAllowedRange(s.componentType);
            emit TemperatureExcursion(_shipmentId, s.unitId, _temperature, minAllowed, maxAllowed, block.timestamp);
        }

        emit TemperatureRecorded(_shipmentId, _temperature, inRange, _sensorId, block.timestamp);
    }

    function recordBatchTemperatures(
        string calldata _shipmentId,
        int16[] calldata _temperatures,
        string[] calldata _sensorIds
    ) external onlyAuthorizedSensor shipmentExists(_shipmentId) {
        require(_temperatures.length == _sensorIds.length, "ColdChain: array length mismatch");
        Shipment storage s = shipments[_shipmentId];
        require(s.status == ShipmentStatus.InTransit, "ColdChain: shipment not in transit");

        for (uint256 i = 0; i < _temperatures.length; i++) {
            bool inRange = _isInRange(_temperatures[i], s.componentType);
            _readings[_shipmentId].push(TemperatureReading({
                temperature: _temperatures[i],
                timestamp: block.timestamp,
                recorder: msg.sender,
                inRange: inRange,
                sensorId: _sensorIds[i]
            }));
            s.totalReadings++;
            if (!inRange) {
                s.excursionCount++;
                s.compliancePassed = false;
                totalExcursions++;
                (int16 minAllowed, int16 maxAllowed) = _getAllowedRange(s.componentType);
                emit TemperatureExcursion(_shipmentId, s.unitId, _temperatures[i], minAllowed, maxAllowed, block.timestamp);
            }
            emit TemperatureRecorded(_shipmentId, _temperatures[i], inRange, _sensorIds[i], block.timestamp);
        }
    }

    function confirmDelivery(string calldata _shipmentId) external shipmentExists(_shipmentId) {
        Shipment storage s = shipments[_shipmentId];
        require(s.destination == msg.sender || msg.sender == admin, "ColdChain: not shipment destination");
        require(s.status == ShipmentStatus.InTransit, "ColdChain: shipment not in transit");

        s.status = s.compliancePassed ? ShipmentStatus.Delivered : ShipmentStatus.ComplianceFailed;
        s.arrivalTimestamp = block.timestamp;

        if (s.compliancePassed) totalCompliantShipments++;

        _generateComplianceReport(_shipmentId);
        emit ShipmentDelivered(_shipmentId, s.compliancePassed, s.excursionCount, block.timestamp);
    }

    function abortShipment(string calldata _shipmentId, string calldata _reason) external shipmentExists(_shipmentId) {
        Shipment storage s = shipments[_shipmentId];
        require(s.origin == msg.sender || msg.sender == admin, "ColdChain: not authorized to abort");
        require(s.status == ShipmentStatus.InTransit || s.status == ShipmentStatus.Created, "ColdChain: cannot abort in current state");
        s.status = ShipmentStatus.Aborted;
        emit ShipmentAborted(_shipmentId, _reason, block.timestamp);
    }

    function getTemperatureReadings(string calldata _shipmentId) external view returns (TemperatureReading[] memory) {
        require(shipments[_shipmentId].exists, "ColdChain: shipment does not exist");
        return _readings[_shipmentId];
    }

    function getShipmentsByOrigin(address origin) external view returns (string[] memory) {
        return _originShipments[origin];
    }

    function getShipmentsByDestination(address destination) external view returns (string[] memory) {
        return _destinationShipments[destination];
    }

    function getAllShipmentIds() external view returns (string[] memory) {
        return _allShipmentIds;
    }

    function getColdChainStats() external view returns (
        uint256 total,
        uint256 excursions,
        uint256 compliant,
        uint256 complianceRate
    ) {
        uint256 rate = totalShipments > 0 ? (totalCompliantShipments * 100) / totalShipments : 0;
        return (totalShipments, totalExcursions, totalCompliantShipments, rate);
    }

    function _isInRange(int16 temp, ComponentType componentType) internal pure returns (bool) {
        if (componentType == ComponentType.RBC || componentType == ComponentType.WholeBlood) {
            return temp >= RBC_TEMP_MIN && temp <= RBC_TEMP_MAX;
        } else if (componentType == ComponentType.Platelet) {
            return temp >= PLATELET_TEMP_MIN && temp <= PLATELET_TEMP_MAX;
        } else if (componentType == ComponentType.FFP || componentType == ComponentType.Cryoprecipitate) {
            return temp <= FFP_TEMP_MAX;
        }
        return false;
    }

    function _getAllowedRange(ComponentType componentType) internal pure returns (int16 minTemp, int16 maxTemp) {
        if (componentType == ComponentType.RBC || componentType == ComponentType.WholeBlood) {
            return (RBC_TEMP_MIN, RBC_TEMP_MAX);
        } else if (componentType == ComponentType.Platelet) {
            return (PLATELET_TEMP_MIN, PLATELET_TEMP_MAX);
        } else {
            return (type(int16).min, FFP_TEMP_MAX);
        }
    }

    function _generateComplianceReport(string memory _shipmentId) internal {
        TemperatureReading[] storage readings = _readings[_shipmentId];
        Shipment storage s = shipments[_shipmentId];

        int16 minTemp = type(int16).max;
        int16 maxTemp = type(int16).min;

        for (uint256 i = 0; i < readings.length; i++) {
            if (readings[i].temperature < minTemp) minTemp = readings[i].temperature;
            if (readings[i].temperature > maxTemp) maxTemp = readings[i].temperature;
        }

        complianceReports[_shipmentId] = ComplianceReport({
            shipmentId: _shipmentId,
            totalReadings: s.totalReadings,
            excursions: s.excursionCount,
            minTempRecorded: readings.length > 0 ? minTemp : int16(0),
            maxTempRecorded: readings.length > 0 ? maxTemp : int16(0),
            passed: s.compliancePassed,
            generatedAt: block.timestamp
        });

        emit ComplianceReportGenerated(_shipmentId, s.compliancePassed, s.excursionCount, block.timestamp);
    }
}
