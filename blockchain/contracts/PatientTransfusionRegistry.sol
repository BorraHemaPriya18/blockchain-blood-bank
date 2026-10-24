// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PatientTransfusionRegistry
 * @notice On-chain registry of anonymized patient transfusion records.
 *         Patient PII is kept off-chain; only cryptographic patient reference hashes
 *         are stored on-chain alongside transfusion outcomes and adverse event reports.
 */
contract PatientTransfusionRegistry {

    address public admin;

    enum TransfusionOutcome {
        Pending,
        Successful,
        AdverseReaction,
        Incomplete,
        Cancelled
    }

    enum ReactionSeverity {
        None,
        Mild,
        Moderate,
        Severe,
        LifeThreatening,
        Fatal
    }

    enum ReactionType {
        None,
        FebrileNonHemolytic,
        AllergicUrticarial,
        AnaphylacticShock,
        AcuteHemolyticReaction,
        DelayedHemolyticReaction,
        TransfusionRelatedAcuteLungInjury,
        TransfusionAssociatedCirculatoryOverload,
        SepticReaction,
        GraftVersusHostDisease,
        PostTransfusionPurpura,
        Other
    }

    enum BloodComponent {
        WholeBlood,
        PackedRBC,
        Platelet,
        FFP,
        Cryoprecipitate,
        Granulocyte,
        AlbuminSolution,
        IVImmunoglobulin
    }

    struct TransfusionRecord {
        uint256           recordId;
        string            patientRefHash;
        string            unitId;
        string            bloodGroup;
        BloodComponent    component;
        address           hospital;
        address           attendingClinician;
        uint256           startTimestamp;
        uint256           endTimestamp;
        uint256           volumeMl;
        TransfusionOutcome outcome;
        ReactionSeverity  reactionSeverity;
        ReactionType      reactionType;
        string            clinicalNotes;
        string            dataHash;
        bool              adverseEventReported;
        bool              exists;
    }

    struct AdverseEventReport {
        uint256          reportId;
        uint256          transfusionRecordId;
        string           patientRefHash;
        string           unitId;
        ReactionType     reactionType;
        ReactionSeverity severity;
        string           symptoms;
        string           interventionTaken;
        string           outcome;
        address          reportedBy;
        address          hospital;
        uint256          onsetTimestamp;
        uint256          reportedTimestamp;
        bool             requiresInvestigation;
        bool             investigated;
        string           investigationNotes;
        uint256          investigatedAt;
    }

    struct CompatibilityCheck {
        uint256  checkId;
        string   patientRefHash;
        string   patientBloodGroup;
        string   donorBloodGroup;
        string   unitId;
        bool     compatible;
        address  verifiedBy;
        uint256  timestamp;
        string   crossMatchResult;
    }

    struct ClinicalianProfile {
        string  name;
        string  licenseNumber;
        string  specialization;
        bool    active;
        uint256 registeredAt;
        uint256 totalTransfusions;
        uint256 totalAdverseEvents;
    }

    mapping(uint256 => TransfusionRecord)  public transfusionRecords;
    mapping(uint256 => AdverseEventReport) public adverseEventReports;
    mapping(uint256 => CompatibilityCheck) public compatibilityChecks;
    mapping(address => ClinicalianProfile) public clinicians;

    mapping(string  => uint256[]) private _patientTransfusions;
    mapping(string  => uint256[]) private _unitTransfusions;
    mapping(address => uint256[]) private _hospitalTransfusions;
    mapping(address => uint256[]) private _clinicianTransfusions;
    mapping(address => uint256[]) private _hospitalAdverseEvents;
    mapping(address => bool)      public  authorizedHospitals;
    mapping(address => bool)      public  authorizedClinicians;

    uint256 public totalTransfusionRecords;
    uint256 public totalAdverseEventReports;
    uint256 public totalCompatibilityChecks;
    uint256 public totalSuccessfulTransfusions;
    uint256 public totalAdverseReactions;

    event TransfusionRecorded(uint256 indexed recordId, string indexed patientRefHash, string indexed unitId, address hospital, uint256 timestamp);
    event TransfusionOutcomeUpdated(uint256 indexed recordId, TransfusionOutcome outcome, ReactionSeverity severity, uint256 timestamp);
    event AdverseEventReported(uint256 indexed reportId, uint256 indexed transfusionRecordId, ReactionType reactionType, ReactionSeverity severity, uint256 timestamp);
    event AdverseEventInvestigated(uint256 indexed reportId, address indexed investigator, uint256 timestamp);
    event CompatibilityCheckRecorded(uint256 indexed checkId, string patientRefHash, string unitId, bool compatible, uint256 timestamp);
    event ClinicianRegistered(address indexed clinician, string name, string licenseNumber, uint256 timestamp);
    event HospitalAuthorizationChanged(address indexed hospital, bool authorized, uint256 timestamp);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Registry: not admin");
        _;
    }

    modifier onlyAuthorizedHospital() {
        require(authorizedHospitals[msg.sender] || msg.sender == admin, "Registry: not authorized hospital");
        _;
    }

    modifier onlyAuthorizedClinician() {
        require(authorizedClinicians[msg.sender] || msg.sender == admin, "Registry: not authorized clinician");
        _;
    }

    constructor() {
        admin = msg.sender;
        authorizedHospitals[msg.sender] = true;
    }

    // ── Authorization ─────────────────────────────────────────────────────

    function setHospitalAuthorization(address hospital, bool authorized) external onlyAdmin {
        require(hospital != address(0), "Registry: zero address");
        authorizedHospitals[hospital] = authorized;
        emit HospitalAuthorizationChanged(hospital, authorized, block.timestamp);
    }

    function registerClinician(
        address clinician,
        string calldata name,
        string calldata licenseNumber,
        string calldata specialization
    ) external onlyAdmin {
        require(clinician != address(0), "Registry: zero address");
        clinicians[clinician] = ClinicalianProfile({
            name: name, licenseNumber: licenseNumber,
            specialization: specialization, active: true,
            registeredAt: block.timestamp, totalTransfusions: 0, totalAdverseEvents: 0
        });
        authorizedClinicians[clinician] = true;
        emit ClinicianRegistered(clinician, name, licenseNumber, block.timestamp);
    }

    function setClinicianActive(address clinician, bool active) external onlyAdmin {
        clinicians[clinician].active = active;
        authorizedClinicians[clinician] = active;
    }

    // ── Compatibility Check ───────────────────────────────────────────────

    function recordCompatibilityCheck(
        string calldata patientRefHash,
        string calldata patientBloodGroup,
        string calldata donorBloodGroup,
        string calldata unitId,
        bool compatible,
        string calldata crossMatchResult
    ) external onlyAuthorizedClinician returns (uint256 checkId) {
        checkId = totalCompatibilityChecks;
        compatibilityChecks[checkId] = CompatibilityCheck({
            checkId: checkId,
            patientRefHash: patientRefHash,
            patientBloodGroup: patientBloodGroup,
            donorBloodGroup: donorBloodGroup,
            unitId: unitId,
            compatible: compatible,
            verifiedBy: msg.sender,
            timestamp: block.timestamp,
            crossMatchResult: crossMatchResult
        });
        totalCompatibilityChecks++;
        emit CompatibilityCheckRecorded(checkId, patientRefHash, unitId, compatible, block.timestamp);
    }

    // ── Transfusion Records ───────────────────────────────────────────────

    function startTransfusion(
        string calldata patientRefHash,
        string calldata unitId,
        string calldata bloodGroup,
        BloodComponent component,
        address attendingClinician,
        uint256 volumeMl,
        string calldata dataHash
    ) external onlyAuthorizedHospital returns (uint256 recordId) {
        require(bytes(patientRefHash).length > 0, "Registry: empty patient ref");
        require(bytes(unitId).length > 0, "Registry: empty unit ID");

        recordId = totalTransfusionRecords;
        transfusionRecords[recordId] = TransfusionRecord({
            recordId: recordId,
            patientRefHash: patientRefHash,
            unitId: unitId,
            bloodGroup: bloodGroup,
            component: component,
            hospital: msg.sender,
            attendingClinician: attendingClinician,
            startTimestamp: block.timestamp,
            endTimestamp: 0,
            volumeMl: volumeMl,
            outcome: TransfusionOutcome.Pending,
            reactionSeverity: ReactionSeverity.None,
            reactionType: ReactionType.None,
            clinicalNotes: "",
            dataHash: dataHash,
            adverseEventReported: false,
            exists: true
        });

        _patientTransfusions[patientRefHash].push(recordId);
        _unitTransfusions[unitId].push(recordId);
        _hospitalTransfusions[msg.sender].push(recordId);
        _clinicianTransfusions[attendingClinician].push(recordId);

        if (clinicians[attendingClinician].registeredAt > 0) {
            clinicians[attendingClinician].totalTransfusions++;
        }

        totalTransfusionRecords++;
        emit TransfusionRecorded(recordId, patientRefHash, unitId, msg.sender, block.timestamp);
    }

    function completeTransfusion(
        uint256 recordId,
        TransfusionOutcome outcome,
        ReactionSeverity reactionSeverity,
        ReactionType reactionType,
        string calldata clinicalNotes,
        string calldata dataHash
    ) external onlyAuthorizedHospital {
        TransfusionRecord storage rec = transfusionRecords[recordId];
        require(rec.exists, "Registry: record does not exist");
        require(rec.hospital == msg.sender || msg.sender == admin, "Registry: not record hospital");
        require(rec.outcome == TransfusionOutcome.Pending, "Registry: already completed");

        rec.outcome          = outcome;
        rec.reactionSeverity = reactionSeverity;
        rec.reactionType     = reactionType;
        rec.clinicalNotes    = clinicalNotes;
        rec.dataHash         = dataHash;
        rec.endTimestamp     = block.timestamp;

        if (outcome == TransfusionOutcome.Successful) {
            totalSuccessfulTransfusions++;
        } else if (outcome == TransfusionOutcome.AdverseReaction) {
            totalAdverseReactions++;
        }

        emit TransfusionOutcomeUpdated(recordId, outcome, reactionSeverity, block.timestamp);
    }

    // ── Adverse Event Reporting ───────────────────────────────────────────

    function reportAdverseEvent(
        uint256 transfusionRecordId,
        ReactionType reactionType,
        ReactionSeverity severity,
        string calldata symptoms,
        string calldata interventionTaken,
        string calldata outcome,
        uint256 onsetTimestamp,
        bool requiresInvestigation
    ) external onlyAuthorizedClinician returns (uint256 reportId) {
        TransfusionRecord storage rec = transfusionRecords[transfusionRecordId];
        require(rec.exists, "Registry: transfusion record does not exist");

        reportId = totalAdverseEventReports;
        adverseEventReports[reportId] = AdverseEventReport({
            reportId: reportId,
            transfusionRecordId: transfusionRecordId,
            patientRefHash: rec.patientRefHash,
            unitId: rec.unitId,
            reactionType: reactionType,
            severity: severity,
            symptoms: symptoms,
            interventionTaken: interventionTaken,
            outcome: outcome,
            reportedBy: msg.sender,
            hospital: rec.hospital,
            onsetTimestamp: onsetTimestamp,
            reportedTimestamp: block.timestamp,
            requiresInvestigation: requiresInvestigation,
            investigated: false,
            investigationNotes: "",
            investigatedAt: 0
        });

        rec.adverseEventReported = true;
        _hospitalAdverseEvents[rec.hospital].push(reportId);

        if (clinicians[msg.sender].registeredAt > 0) {
            clinicians[msg.sender].totalAdverseEvents++;
        }

        totalAdverseEventReports++;
        emit AdverseEventReported(reportId, transfusionRecordId, reactionType, severity, block.timestamp);
    }

    function investigateAdverseEvent(
        uint256 reportId,
        string calldata investigationNotes
    ) external onlyAdmin {
        require(reportId < totalAdverseEventReports, "Registry: report does not exist");
        AdverseEventReport storage report = adverseEventReports[reportId];
        require(!report.investigated, "Registry: already investigated");
        report.investigated      = true;
        report.investigationNotes = investigationNotes;
        report.investigatedAt    = block.timestamp;
        emit AdverseEventInvestigated(reportId, msg.sender, block.timestamp);
    }

    // ── View Functions ────────────────────────────────────────────────────

    function getPatientTransfusions(string calldata patientRefHash) external view returns (uint256[] memory) {
        return _patientTransfusions[patientRefHash];
    }

    function getUnitTransfusions(string calldata unitId) external view returns (uint256[] memory) {
        return _unitTransfusions[unitId];
    }

    function getHospitalTransfusions(address hospital) external view returns (uint256[] memory) {
        return _hospitalTransfusions[hospital];
    }

    function getClinicianTransfusions(address clinician) external view returns (uint256[] memory) {
        return _clinicianTransfusions[clinician];
    }

    function getHospitalAdverseEvents(address hospital) external view returns (uint256[] memory) {
        return _hospitalAdverseEvents[hospital];
    }

    function getRegistryStats() external view returns (
        uint256 totalRecords,
        uint256 successful,
        uint256 adverseReactions,
        uint256 adverseReports,
        uint256 compatibilityChecks,
        uint256 successRate
    ) {
        uint256 rate = totalTransfusionRecords > 0
            ? (totalSuccessfulTransfusions * 100) / totalTransfusionRecords
            : 0;
        return (
            totalTransfusionRecords,
            totalSuccessfulTransfusions,
            totalAdverseReactions,
            totalAdverseEventReports,
            totalCompatibilityChecks,
            rate
        );
    }

    function getHospitalStats(address hospital) external view returns (
        uint256 totalTransfusions,
        uint256 totalAdverseEvents,
        uint256 adverseRate
    ) {
        totalTransfusions  = _hospitalTransfusions[hospital].length;
        totalAdverseEvents = _hospitalAdverseEvents[hospital].length;
        adverseRate = totalTransfusions > 0
            ? (totalAdverseEvents * 100) / totalTransfusions
            : 0;
    }

    function verifyTransfusionIntegrity(uint256 recordId, string calldata expectedHash)
        external view returns (bool)
    {
        require(transfusionRecords[recordId].exists, "Registry: record does not exist");
        return keccak256(bytes(transfusionRecords[recordId].dataHash)) == keccak256(bytes(expectedHash));
    }
}
