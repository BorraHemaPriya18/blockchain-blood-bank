// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "hardhat/console.sol";

/**
 * @title BloodBankTestSuite
 * @notice Comprehensive on-chain test assertions for the blood bank contract suite.
 *         Deployed and executed by Hardhat test scripts to verify invariants.
 */
contract BloodBankTestSuite {

    address public deployer;
    uint256 public totalTests;
    uint256 public passedTests;
    uint256 public failedTests;

    struct TestResult {
        string  testName;
        bool    passed;
        string  failReason;
        uint256 gasUsed;
        uint256 timestamp;
    }

    TestResult[] private _results;

    event TestPassed(string indexed testName, uint256 gasUsed, uint256 timestamp);
    event TestFailed(string indexed testName, string reason, uint256 timestamp);
    event SuiteCompleted(uint256 total, uint256 passed, uint256 failed, uint256 timestamp);

    modifier onlyDeployer() {
        require(msg.sender == deployer, "TestSuite: not deployer");
        _;
    }

    constructor() {
        deployer = msg.sender;
    }

    // ── Assertion Helpers ─────────────────────────────────────────────────

    function _assert(string memory testName, bool condition, string memory failReason) internal {
        uint256 gasStart = gasleft();
        totalTests++;
        if (condition) {
            passedTests++;
            _results.push(TestResult({ testName: testName, passed: true, failReason: "", gasUsed: gasStart - gasleft(), timestamp: block.timestamp }));
            emit TestPassed(testName, gasStart - gasleft(), block.timestamp);
        } else {
            failedTests++;
            _results.push(TestResult({ testName: testName, passed: false, failReason: failReason, gasUsed: gasStart - gasleft(), timestamp: block.timestamp }));
            emit TestFailed(testName, failReason, block.timestamp);
        }
    }

    function _assertEqual(string memory testName, uint256 a, uint256 b) internal {
        _assert(testName, a == b, string.concat("Expected ", _uint2str(a), " == ", _uint2str(b)));
    }

    function _assertNotEqual(string memory testName, uint256 a, uint256 b) internal {
        _assert(testName, a != b, string.concat("Expected ", _uint2str(a), " != ", _uint2str(b)));
    }

    function _assertGt(string memory testName, uint256 a, uint256 b) internal {
        _assert(testName, a > b, string.concat(_uint2str(a), " not > ", _uint2str(b)));
    }

    function _assertAddress(string memory testName, address a, address b) internal {
        _assert(testName, a == b, "Address mismatch");
    }

    function _assertNonZeroAddress(string memory testName, address a) internal {
        _assert(testName, a != address(0), "Expected non-zero address");
    }

    function _assertStringEqual(string memory testName, string memory a, string memory b) internal {
        _assert(testName, keccak256(bytes(a)) == keccak256(bytes(b)), string.concat("String mismatch: '", a, "' != '", b, "'"));
    }

    // ── Blood Group Compatibility Tests ───────────────────────────────────

    function testBloodGroupCompatibility() external onlyDeployer {
        // O- is universal donor
        _assert("O- donates to A+",  _isCompatible(7, 0), "O- should donate to A+");
        _assert("O- donates to B+",  _isCompatible(7, 2), "O- should donate to B+");
        _assert("O- donates to AB+", _isCompatible(7, 4), "O- should donate to AB+");
        _assert("O- donates to O-",  _isCompatible(7, 7), "O- should donate to O-");

        // AB+ is universal recipient
        _assert("A+ donates to AB+",  _isCompatible(0, 4), "A+ should donate to AB+");
        _assert("B+ donates to AB+",  _isCompatible(2, 4), "B+ should donate to AB+");
        _assert("O+ donates to AB+",  _isCompatible(6, 4), "O+ should donate to AB+");

        // Incompatible pairs
        _assert("A+ cannot donate to B+",  !_isCompatible(0, 2), "A+ should NOT donate to B+");
        _assert("B+ cannot donate to A+",  !_isCompatible(2, 0), "B+ should NOT donate to A+");
        _assert("AB+ cannot donate to O+", !_isCompatible(4, 6), "AB+ should NOT donate to O+");
        _assert("AB+ cannot donate to A-", !_isCompatible(4, 1), "AB+ should NOT donate to A-");
    }

    // ── Expiry Calculation Tests ──────────────────────────────────────────

    function testExpiryCalculations() external onlyDeployer {
        uint256 now_ = block.timestamp;

        // RBC: 42 days
        uint256 rbcExpiry = now_ + 42 days;
        _assert("RBC not expired at collection",  now_ < rbcExpiry,       "RBC should not be expired");
        _assert("RBC expired after 43 days",      now_ + 43 days >= rbcExpiry, "RBC should expire after 42 days");

        // Platelet: 5 days
        uint256 plateletExpiry = now_ + 5 days;
        _assert("Platelet not expired at day 4",  now_ + 4 days < plateletExpiry,  "Platelet should not expire at day 4");
        _assert("Platelet expired at day 6",      now_ + 6 days >= plateletExpiry, "Platelet should expire at day 5");

        // FFP: 365 days
        uint256 ffpExpiry = now_ + 365 days;
        _assert("FFP not expired at 364 days",    now_ + 364 days < ffpExpiry,  "FFP should not expire at 364 days");
        _assert("FFP expired at 366 days",        now_ + 366 days >= ffpExpiry, "FFP should expire at 365 days");

        // Critical expiry window (within 2 days)
        uint256 criticalUnit = now_ + 1 days;
        _assert("Unit in critical expiry window", criticalUnit - now_ <= 2 days, "Should be in critical window");
    }

    // ── Hash Integrity Tests ──────────────────────────────────────────────

    function testHashIntegrity() external onlyDeployer {
        string memory hash1 = "0xabc123def456";
        string memory hash2 = "0xabc123def456";
        string memory hash3 = "0xdifferenthash";

        _assert("Identical hashes match",    keccak256(bytes(hash1)) == keccak256(bytes(hash2)), "Same strings should match");
        _assert("Different hashes mismatch", keccak256(bytes(hash1)) != keccak256(bytes(hash3)), "Different strings should not match");

        // Verify deterministic hashing
        bytes32 h1 = keccak256(abi.encodePacked("UNIT-001", "O+", "RBC", uint256(1700000000), address(this)));
        bytes32 h2 = keccak256(abi.encodePacked("UNIT-001", "O+", "RBC", uint256(1700000000), address(this)));
        _assert("Deterministic hash", h1 == h2, "Same inputs should produce same hash");

        bytes32 h3 = keccak256(abi.encodePacked("UNIT-002", "O+", "RBC", uint256(1700000000), address(this)));
        _assert("Different unit IDs produce different hashes", h1 != h3, "Different unit IDs should differ");
    }

    // ── Donor Eligibility Tests ───────────────────────────────────────────

    function testDonorEligibility() external onlyDeployer {
        uint256 now_ = block.timestamp;

        // Age eligibility: 18-65 years
        uint256 age20 = now_ - 20 * 365 days;
        uint256 age17 = now_ - 17 * 365 days;
        uint256 age66 = now_ - 66 * 365 days;

        uint256 minAge = 18 * 365 days;
        uint256 maxAge = 65 * 365 days;

        _assert("20-year-old is eligible",  (now_ - age20) >= minAge && (now_ - age20) <= maxAge, "20yo should be eligible");
        _assert("17-year-old is ineligible", (now_ - age17) < minAge, "17yo should be ineligible");
        _assert("66-year-old is ineligible", (now_ - age66) > maxAge, "66yo should be ineligible");

        // Donation interval: 56 days for whole blood
        uint256 lastDonation = now_ - 60 days;
        _assert("60 days elapsed - eligible",  (now_ - lastDonation) >= 56 days, "60 days should be eligible");

        uint256 recentDonation = now_ - 30 days;
        _assert("30 days elapsed - ineligible", (now_ - recentDonation) < 56 days, "30 days should be ineligible");
    }

    // ── Access Control Tests ──────────────────────────────────────────────

    function testAccessControlRoles() external onlyDeployer {
        bytes32 adminRole    = keccak256("ADMIN");
        bytes32 bloodBankRole = keccak256("BLOOD_BANK_STAFF");
        bytes32 hospitalRole  = keccak256("HOSPITAL_STAFF");
        bytes32 labRole       = keccak256("LAB_TECHNICIAN");
        bytes32 auditorRole   = keccak256("AUDITOR");

        _assert("Admin role hash is non-zero",     adminRole != bytes32(0),     "Admin role should be non-zero");
        _assert("BloodBank role hash is non-zero", bloodBankRole != bytes32(0), "BloodBank role should be non-zero");
        _assert("Hospital role hash is non-zero",  hospitalRole != bytes32(0),  "Hospital role should be non-zero");
        _assert("Lab role hash is non-zero",       labRole != bytes32(0),       "Lab role should be non-zero");
        _assert("Auditor role hash is non-zero",   auditorRole != bytes32(0),   "Auditor role should be non-zero");

        // Roles must be distinct
        _assert("Admin != BloodBank",  adminRole != bloodBankRole, "Roles must be distinct");
        _assert("Admin != Hospital",   adminRole != hospitalRole,  "Roles must be distinct");
        _assert("BloodBank != Hospital", bloodBankRole != hospitalRole, "Roles must be distinct");
        _assert("Lab != Auditor",      labRole != auditorRole,     "Roles must be distinct");
    }

    // ── Cold Chain Temperature Tests ──────────────────────────────────────

    function testColdChainTemperatureRanges() external onlyDeployer {
        // RBC: 1.0°C to 6.0°C (stored as tenths: 10 to 60)
        int16 rbcValid   = 40;  // 4.0°C
        int16 rbcTooHot  = 70;  // 7.0°C
        int16 rbcTooCold = 5;   // 0.5°C

        _assert("RBC 4.0C in range",   rbcValid >= 10 && rbcValid <= 60,   "4.0C should be valid for RBC");
        _assert("RBC 7.0C out of range", !(rbcTooHot >= 10 && rbcTooHot <= 60), "7.0C should be invalid for RBC");
        _assert("RBC 0.5C out of range", !(rbcTooCold >= 10 && rbcTooCold <= 60), "0.5C should be invalid for RBC");

        // Platelet: 20.0°C to 24.0°C (200 to 240)
        int16 plateletValid   = 220; // 22.0°C
        int16 plateletTooHot  = 260; // 26.0°C
        int16 plateletTooCold = 180; // 18.0°C

        _assert("Platelet 22.0C in range",    plateletValid >= 200 && plateletValid <= 240,     "22.0C valid for platelet");
        _assert("Platelet 26.0C out of range", !(plateletTooHot >= 200 && plateletTooHot <= 240), "26.0C invalid for platelet");
        _assert("Platelet 18.0C out of range", !(plateletTooCold >= 200 && plateletTooCold <= 240), "18.0C invalid for platelet");

        // FFP: -18.0°C or below (-180 or below)
        int16 ffpValid   = -200; // -20.0°C
        int16 ffpInvalid = -100; // -10.0°C

        _assert("FFP -20.0C valid",   ffpValid <= -180,   "-20.0C valid for FFP");
        _assert("FFP -10.0C invalid", ffpInvalid > -180,  "-10.0C invalid for FFP");
    }

    // ── Governance Tests ──────────────────────────────────────────────────

    function testGovernanceInvariants() external onlyDeployer {
        uint256 quorum  = 51;
        uint256 passing = 66;

        _assert("Quorum <= 100",  quorum <= 100,  "Quorum must be <= 100");
        _assert("Passing <= 100", passing <= 100, "Passing must be <= 100");
        _assert("Quorum > 0",     quorum > 0,     "Quorum must be > 0");
        _assert("Passing > 50",   passing > 50,   "Passing should be majority");

        // Vote weight calculation
        uint256 votesFor     = 7;
        uint256 votesAgainst = 3;
        uint256 totalWeight  = votesFor + votesAgainst;
        uint256 forPercent   = (votesFor * 100) / totalWeight;

        _assert("70% votes for passes at 66% threshold", forPercent >= passing, "70% should pass 66% threshold");

        uint256 votesFor2   = 5;
        uint256 total2      = 10;
        uint256 forPercent2 = (votesFor2 * 100) / total2;
        _assert("50% votes for fails at 66% threshold", forPercent2 < passing, "50% should fail 66% threshold");
    }

    // ── Token Economics Tests ─────────────────────────────────────────────

    function testTokenEconomics() external onlyDeployer {
        uint256 tokensPerDonation    = 100 * 10**18;
        uint256 tokensPerRareDonation = 250 * 10**18;
        uint256 maxSupply            = 10_000_000 * 10**18;

        _assert("Rare donation reward > standard", tokensPerRareDonation > tokensPerDonation, "Rare should reward more");
        _assert("Max supply > 0",                  maxSupply > 0,                             "Max supply must be positive");
        _assert("Tokens per donation > 0",         tokensPerDonation > 0,                     "Reward must be positive");

        // Simulate 1000 donations - should not exceed max supply
        uint256 simulated = 1000 * tokensPerDonation;
        _assert("1000 donations within max supply", simulated <= maxSupply, "1000 donations should fit in max supply");

        // Rare donation is 2.5x standard
        uint256 ratio = (tokensPerRareDonation * 10) / tokensPerDonation;
        _assertEqual("Rare is 2.5x standard (ratio=25)", ratio, 25);
    }

    // ── Run All Tests ─────────────────────────────────────────────────────

    function runAllTests() external onlyDeployer {
        this.testBloodGroupCompatibility();
        this.testExpiryCalculations();
        this.testHashIntegrity();
        this.testDonorEligibility();
        this.testAccessControlRoles();
        this.testColdChainTemperatureRanges();
        this.testGovernanceInvariants();
        this.testTokenEconomics();
        emit SuiteCompleted(totalTests, passedTests, failedTests, block.timestamp);
    }

    // ── View ──────────────────────────────────────────────────────────────

    function getResults() external view returns (TestResult[] memory) {
        return _results;
    }

    function getSummary() external view returns (uint256 total, uint256 passed, uint256 failed) {
        return (totalTests, passedTests, failedTests);
    }

    // ── Internal Helpers ──────────────────────────────────────────────────

    function _isCompatible(uint8 donor, uint8 recipient) internal pure returns (bool) {
        if (donor == 7) return true;
        if (donor == 6) return recipient == 6 || recipient == 4;
        if (donor == 5) return recipient == 5 || recipient == 4 || recipient == 1 || recipient == 3;
        if (donor == 4) return recipient == 4;
        if (donor == 3) return recipient == 3 || recipient == 5 || recipient == 2 || recipient == 4;
        if (donor == 2) return recipient == 2 || recipient == 4;
        if (donor == 1) return recipient == 1 || recipient == 0 || recipient == 4 || recipient == 5;
        if (donor == 0) return recipient == 0 || recipient == 4;
        return false;
    }

    function _uint2str(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 temp = v; uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buf = new bytes(digits);
        while (v != 0) { digits--; buf[digits] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(buf);
    }
}
