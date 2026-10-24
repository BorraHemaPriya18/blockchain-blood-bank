// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DonorScreeningRegistry
 * @notice On-chain registry for donor health screening questionnaires, serology test results,
 *         deferral records, and eligibility reinstatement. All PII stays off-chain;
 *         only cryptographic donor reference IDs and result hashes are stored.
 */
contract DonorScreeningRegistry {

    address public admin;

    enum SerologyTest {
        HIV,
        HepatitisBSurface,
        HepatitisCVirus,
        Syphilis,
        MalariaAntigen,
        HTLV,
        WestNileVirus,
        ChagasDisease,
        ZikaVirus,
        CMV
    }

    enum TestResult    { Pending, Reactive, NonReactive, Indeterminate, Invalid }
    enum DeferralType  { Temporary, Permanent }
    enum DeferralReason {
        RecentIllness,
        RecentSurgery,
        RecentTattooOrPiercing,
        RecentTravel,
        LowHemoglobin,
        HighBloodPressure,
        LowBodyWeight,
        RecentMedication,
        ReactiveSerologyTest,
        RecentPregnancy,
        RecentDonation,
        BehavioralRisk,
        AutoimmuneCondition,
        ChronicDisease,
        Other
    }

    struct SerologyResult {
        uint256      resultId;
        string       donorRefId;
        SerologyTest test;
        TestResult   result;
        string       labRefId;
        address      lab;
        uint256      testedAt;
        uint256      reportedAt;
        string       dataHash;
        bool         confirmed;
    }

    struct ScreeningQuestionnaire {
        uint256  questionnaireId;
        string   donorRefId;
        bool     recentIllness;
        bool     recentSurgery;
        bool     recentTattoo;
        bool     recentTravel;
        bool     currentMedication;
        bool     recentPregnancy;
        bool     chronicCondition;
        bool     behavioralRisk;
        uint256  hemoglobinLevel;   // g/dL * 10 (e.g. 135 = 13.5 g/dL)
        uint256  bloodPressureSys;  // mmHg
        uint256  bloodPressureDia;  // mmHg
        uint256  weightKg;          // kg * 10
        uint256  pulseRate;         // bpm
        bool     passed;
        address  screener;
        uint256  screenedAt;
        string   notes;
        string   dataHash;
    }

    struct DeferralRecord {
        uint256        deferralId;
        string         donorRefId;
        DeferralType   deferralType;
        DeferralReason reason;
        string         details;
        address        deferredBy;
        uint256        deferredAt;
        uint256        deferralEndDate;
        bool           lifted;
        address        liftedBy;
        uint256        liftedAt;
        string         liftNotes;
        string         dataHash;
    }

    struct DonorEligibilityStatus {
        string   donorRefId;
        bool     eligible;
        bool     hasPermanentDeferral;
        uint256  activeDeferrals;
        uint256  totalDonations;
        uint256  totalDeferrals;
        uint256  lastScreenedAt;
        uint256  lastDonationAt;
        uint256  nextEligibleAt;
    }

    struct LabProfile {
        string  name;
        string  accreditationNumber;
        bool    active;
        uint256 registeredAt;
        uint256 totalTestsProcessed;
    }

    mapping(uint256 => SerologyResult)          public serologyResults;
    mapping(uint256 => ScreeningQuestionnaire)  public questionnaires;
    mapping(uint256 => DeferralRecord)          public deferralRecords;
    mapping(address => LabProfile)              public labProfiles;
    mapping(string  => DonorEligibilityStatus)  public donorEligibility;

    mapping(string  => uint256[]) private _donorSerologyResults;
    mapping(string  => uint256[]) private _donorQuestionnaires;
    mapping(string  => uint256[]) private _donorDeferrals;
    mapping(address => bool)      public  authorizedLabs;
    mapping(address => bool)      public  authorizedScreeners;
    mapping(address => uint256[]) private _labResults;

    uint256 public totalSerologyResults;
    uint256 public totalQuestionnaires;
    uint256 public totalDeferrals;
    uint256 public totalActiveDeferrals;
    uint256 public totalPermanentDeferrals;
    uint256 public totalReactiveResults;

    // Screening thresholds
    uint256 public constant MIN_HEMOGLOBIN_MALE   = 130; // 13.0 g/dL
    uint256 public constant MIN_HEMOGLOBIN_FEMALE = 120; // 12.0 g/dL
    uint256 public constant MAX_BLOOD_PRESSURE_SYS = 180;
    uint256 public constant MIN_BLOOD_PRESSURE_SYS = 90;
    uint256 public constant MAX_BLOOD_PRESSURE_DIA = 100;
    uint256 public constant MIN_WEIGHT_KG          = 500; // 50.0 kg
    uint256 public constant MIN_PULSE              = 50;
    uint256 public constant MAX_PULSE              = 100;

    event SerologyResultRecorded(uint256 indexed resultId, string indexed donorRefId, SerologyTest test, TestResult result, uint256 timestamp);
    event SerologyResultConfirmed(uint256 indexed resultId, address indexed confirmedBy, uint256 timestamp);
    event QuestionnaireSubmitted(uint256 indexed questionnaireId, string indexed donorRefId, bool passed, address screener, uint256 timestamp);
    event DonorDeferred(uint256 indexed deferralId, string indexed donorRefId, DeferralType deferralType, DeferralReason reason, uint256 deferralEndDate, uint256 timestamp);
    event DeferralLifted(uint256 indexed deferralId, string indexed donorRefId, address liftedBy, uint256 timestamp);
    event DonorEligibilityChanged(string indexed donorRefId, bool eligible, uint256 timestamp);
    event LabRegistered(address indexed lab, string name, string accreditationNumber, uint256 timestamp);
    event ScreenerAuthorized(address indexed screener, bool authorized, uint256 timestamp);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Screening: not admin");
        _;
    }

    modifier onlyAuthorizedLab() {
        require(authorizedLabs[msg.sender] || msg.sender == admin, "Screening: not authorized lab");
        _;
    }

    modifier onlyAuthorizedScreener() {
        require(authorizedScreeners[msg.sender] || msg.sender == admin, "Screening: not authorized screener");
        _;
    }

    constructor() {
        admin = msg.sender;
        authorizedScreeners[msg.sender] = true;
    }

    // ── Lab & Screener Management ─────────────────────────────────────────

    function registerLab(address lab, string calldata name, string calldata accreditationNumber) external onlyAdmin {
        require(lab != address(0), "Screening: zero address");
        labProfiles[lab] = LabProfile({ name: name, accreditationNumber: accreditationNumber, active: true, registeredAt: block.timestamp, totalTestsProcessed: 0 });
        authorizedLabs[lab] = true;
        emit LabRegistered(lab, name, accreditationNumber, block.timestamp);
    }

    function setLabActive(address lab, bool active) external onlyAdmin {
        labProfiles[lab].active = active;
        authorizedLabs[lab] = active;
    }

    function setScreenerAuthorization(address screener, bool authorized) external onlyAdmin {
        require(screener != address(0), "Screening: zero address");
        authorizedScreeners[screener] = authorized;
        emit ScreenerAuthorized(screener, authorized, block.timestamp);
    }

    // ── Serology Testing ──────────────────────────────────────────────────

    function recordSerologyResult(
        string calldata donorRefId,
        SerologyTest test,
        TestResult result,
        string calldata labRefId,
        string calldata dataHash
    ) external onlyAuthorizedLab returns (uint256 resultId) {
        require(bytes(donorRefId).length > 0, "Screening: empty donor ref");

        resultId = totalSerologyResults;
        serologyResults[resultId] = SerologyResult({
            resultId: resultId,
            donorRefId: donorRefId,
            test: test,
            result: result,
            labRefId: labRefId,
            lab: msg.sender,
            testedAt: block.timestamp,
            reportedAt: block.timestamp,
            dataHash: dataHash,
            confirmed: false
        });

        _donorSerologyResults[donorRefId].push(resultId);
        _labResults[msg.sender].push(resultId);
        labProfiles[msg.sender].totalTestsProcessed++;
        totalSerologyResults++;

        if (result == TestResult.Reactive) {
            totalReactiveResults++;
            _deferDonorInternal(donorRefId, DeferralType.Temporary, DeferralReason.ReactiveSerologyTest,
                "Reactive serology result - pending confirmation", block.timestamp + 90 days, dataHash);
        }

        emit SerologyResultRecorded(resultId, donorRefId, test, result, block.timestamp);
    }

    function confirmSerologyResult(uint256 resultId) external onlyAdmin {
        require(resultId < totalSerologyResults, "Screening: result does not exist");
        require(!serologyResults[resultId].confirmed, "Screening: already confirmed");
        serologyResults[resultId].confirmed = true;

        // If confirmed reactive, escalate to permanent deferral for certain tests
        SerologyResult memory res = serologyResults[resultId];
        if (res.result == TestResult.Reactive) {
            if (res.test == SerologyTest.HIV || res.test == SerologyTest.HTLV || res.test == SerologyTest.ChagasDisease) {
                _deferDonorInternal(res.donorRefId, DeferralType.Permanent, DeferralReason.ReactiveSerologyTest,
                    "Confirmed reactive - permanent deferral", type(uint256).max, res.dataHash);
                totalPermanentDeferrals++;
            }
        }

        emit SerologyResultConfirmed(resultId, msg.sender, block.timestamp);
    }

    function recordBatchSerologyResults(
        string[] calldata donorRefIds,
        SerologyTest[] calldata tests,
        TestResult[] calldata results,
        string[] calldata labRefIds,
        string[] calldata dataHashes
    ) external onlyAuthorizedLab {
        require(
            donorRefIds.length == tests.length &&
            tests.length == results.length &&
            results.length == labRefIds.length &&
            labRefIds.length == dataHashes.length,
            "Screening: array length mismatch"
        );
        for (uint256 i = 0; i < donorRefIds.length; i++) {
            uint256 resultId = totalSerologyResults;
            serologyResults[resultId] = SerologyResult({
                resultId: resultId, donorRefId: donorRefIds[i], test: tests[i],
                result: results[i], labRefId: labRefIds[i], lab: msg.sender,
                testedAt: block.timestamp, reportedAt: block.timestamp,
                dataHash: dataHashes[i], confirmed: false
            });
            _donorSerologyResults[donorRefIds[i]].push(resultId);
            _labResults[msg.sender].push(resultId);
            labProfiles[msg.sender].totalTestsProcessed++;
            totalSerologyResults++;
            if (results[i] == TestResult.Reactive) totalReactiveResults++;
            emit SerologyResultRecorded(resultId, donorRefIds[i], tests[i], results[i], block.timestamp);
        }
    }

    // ── Screening Questionnaire ───────────────────────────────────────────

    function submitQuestionnaire(
        string calldata donorRefId,
        bool recentIllness,
        bool recentSurgery,
        bool recentTattoo,
        bool recentTravel,
        bool currentMedication,
        bool recentPregnancy,
        bool chronicCondition,
        bool behavioralRisk,
        uint256 hemoglobinLevel,
        uint256 bloodPressureSys,
        uint256 bloodPressureDia,
        uint256 weightKg,
        uint256 pulseRate,
        string calldata notes,
        string calldata dataHash
    ) external onlyAuthorizedScreener returns (uint256 questionnaireId) {
        bool passed = _evaluateQuestionnaire(
            recentIllness, recentSurgery, recentTattoo, recentTravel,
            currentMedication, recentPregnancy, chronicCondition, behavioralRisk,
            hemoglobinLevel, bloodPressureSys, bloodPressureDia, weightKg, pulseRate
        );

        questionnaireId = totalQuestionnaires;
        questionnaires[questionnaireId] = ScreeningQuestionnaire({
            questionnaireId: questionnaireId, donorRefId: donorRefId,
            recentIllness: recentIllness, recentSurgery: recentSurgery,
            recentTattoo: recentTattoo, recentTravel: recentTravel,
            currentMedication: currentMedication, recentPregnancy: recentPregnancy,
            chronicCondition: chronicCondition, behavioralRisk: behavioralRisk,
            hemoglobinLevel: hemoglobinLevel, bloodPressureSys: bloodPressureSys,
            bloodPressureDia: bloodPressureDia, weightKg: weightKg, pulseRate: pulseRate,
            passed: passed, screener: msg.sender, screenedAt: block.timestamp,
            notes: notes, dataHash: dataHash
        });

        _donorQuestionnaires[donorRefId].push(questionnaireId);
        donorEligibility[donorRefId].lastScreenedAt = block.timestamp;
        totalQuestionnaires++;

        if (!passed) {
            _deferDonorInternal(donorRefId, DeferralType.Temporary, DeferralReason.Other,
                "Failed pre-donation health questionnaire", block.timestamp + 30 days, dataHash);
        } else {
            _updateEligibility(donorRefId);
        }

        emit QuestionnaireSubmitted(questionnaireId, donorRefId, passed, msg.sender, block.timestamp);
    }

    // ── Deferral Management ───────────────────────────────────────────────

    function deferDonor(
        string calldata donorRefId,
        DeferralType deferralType,
        DeferralReason reason,
        string calldata details,
        uint256 deferralEndDate,
        string calldata dataHash
    ) external onlyAuthorizedScreener {
        _deferDonorInternal(donorRefId, deferralType, reason, details, deferralEndDate, dataHash);
        if (deferralType == DeferralType.Permanent) totalPermanentDeferrals++;
    }

    function liftDeferral(
        uint256 deferralId,
        string calldata liftNotes
    ) external onlyAuthorizedScreener {
        require(deferralId < totalDeferrals, "Screening: deferral does not exist");
        DeferralRecord storage rec = deferralRecords[deferralId];
        require(!rec.lifted, "Screening: deferral already lifted");
        require(rec.deferralType != DeferralType.Permanent, "Screening: cannot lift permanent deferral");

        rec.lifted   = true;
        rec.liftedBy = msg.sender;
        rec.liftedAt = block.timestamp;
        rec.liftNotes = liftNotes;

        DonorEligibilityStatus storage status = donorEligibility[rec.donorRefId];
        if (status.activeDeferrals > 0) status.activeDeferrals--;
        if (totalActiveDeferrals > 0) totalActiveDeferrals--;

        _updateEligibility(rec.donorRefId);
        emit DeferralLifted(deferralId, rec.donorRefId, msg.sender, block.timestamp);
    }

    // ── View Functions ────────────────────────────────────────────────────

    function getDonorSerologyResults(string calldata donorRefId) external view returns (uint256[] memory) {
        return _donorSerologyResults[donorRefId];
    }

    function getDonorQuestionnaires(string calldata donorRefId) external view returns (uint256[] memory) {
        return _donorQuestionnaires[donorRefId];
    }

    function getDonorDeferrals(string calldata donorRefId) external view returns (uint256[] memory) {
        return _donorDeferrals[donorRefId];
    }

    function getLabResults(address lab) external view returns (uint256[] memory) {
        return _labResults[lab];
    }

    function isDonorEligible(string calldata donorRefId) external view returns (bool) {
        DonorEligibilityStatus memory status = donorEligibility[donorRefId];
        if (status.hasPermanentDeferral) return false;
        if (status.activeDeferrals > 0) return false;
        return status.eligible;
    }

    function getScreeningStats() external view returns (
        uint256 serologyTests,
        uint256 reactiveResults,
        uint256 questionnairesTotal,
        uint256 deferrals,
        uint256 activeDeferrals,
        uint256 permanentDeferrals,
        uint256 reactiveRate
    ) {
        uint256 rate = totalSerologyResults > 0
            ? (totalReactiveResults * 100) / totalSerologyResults
            : 0;
        return (
            totalSerologyResults, totalReactiveResults, totalQuestionnaires,
            totalDeferrals, totalActiveDeferrals, totalPermanentDeferrals, rate
        );
    }

    function verifyResultIntegrity(uint256 resultId, string calldata expectedHash)
        external view returns (bool)
    {
        require(resultId < totalSerologyResults, "Screening: result does not exist");
        return keccak256(bytes(serologyResults[resultId].dataHash)) == keccak256(bytes(expectedHash));
    }

    // ── Internal ──────────────────────────────────────────────────────────

    function _deferDonorInternal(
        string memory donorRefId,
        DeferralType deferralType,
        DeferralReason reason,
        string memory details,
        uint256 deferralEndDate,
        string memory dataHash
    ) internal {
        uint256 deferralId = totalDeferrals;
        deferralRecords[deferralId] = DeferralRecord({
            deferralId: deferralId, donorRefId: donorRefId,
            deferralType: deferralType, reason: reason, details: details,
            deferredBy: msg.sender, deferredAt: block.timestamp,
            deferralEndDate: deferralEndDate, lifted: false,
            liftedBy: address(0), liftedAt: 0, liftNotes: "", dataHash: dataHash
        });

        _donorDeferrals[donorRefId].push(deferralId);
        DonorEligibilityStatus storage status = donorEligibility[donorRefId];
        status.donorRefId = donorRefId;
        status.activeDeferrals++;
        status.totalDeferrals++;
        status.eligible = false;
        if (deferralType == DeferralType.Permanent) status.hasPermanentDeferral = true;

        totalDeferrals++;
        totalActiveDeferrals++;

        emit DonorDeferred(deferralId, donorRefId, deferralType, reason, deferralEndDate, block.timestamp);
        emit DonorEligibilityChanged(donorRefId, false, block.timestamp);
    }

    function _updateEligibility(string memory donorRefId) internal {
        DonorEligibilityStatus storage status = donorEligibility[donorRefId];
        bool nowEligible = !status.hasPermanentDeferral && status.activeDeferrals == 0;
        if (status.eligible != nowEligible) {
            status.eligible = nowEligible;
            emit DonorEligibilityChanged(donorRefId, nowEligible, block.timestamp);
        }
    }

    function _evaluateQuestionnaire(
        bool recentIllness, bool recentSurgery, bool recentTattoo, bool recentTravel,
        bool currentMedication, bool recentPregnancy, bool chronicCondition, bool behavioralRisk,
        uint256 hemoglobin, uint256 bpSys, uint256 bpDia, uint256 weight, uint256 pulse
    ) internal pure returns (bool) {
        if (recentIllness || recentSurgery || chronicCondition || behavioralRisk) return false;
        if (recentPregnancy) return false;
        if (hemoglobin < MIN_HEMOGLOBIN_FEMALE) return false;
        if (bpSys > MAX_BLOOD_PRESSURE_SYS || bpSys < MIN_BLOOD_PRESSURE_SYS) return false;
        if (bpDia > MAX_BLOOD_PRESSURE_DIA) return false;
        if (weight < MIN_WEIGHT_KG) return false;
        if (pulse < MIN_PULSE || pulse > MAX_PULSE) return false;
        // recentTattoo, recentTravel, currentMedication are warnings but not automatic disqualifiers
        return true;
    }
}
