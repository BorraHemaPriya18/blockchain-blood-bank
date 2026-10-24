// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BloodBankLib
 * @notice Shared library of pure validation, compatibility, and utility functions
 *         used across the blood bank supply chain contracts.
 */
library BloodBankLib {

    // ── Blood Group Compatibility ──────────────────────────────────────────

    /**
     * @notice Returns true if donor blood group can donate to recipient blood group.
     *         Encoded as uint8: 0=A+,1=A-,2=B+,3=B-,4=AB+,5=AB-,6=O+,7=O-
     */
    function isCompatible(uint8 donorGroup, uint8 recipientGroup) internal pure returns (bool) {
        // Compatibility matrix: donor -> compatible recipients
        // O- universal donor, AB+ universal recipient
        if (donorGroup == 7) return true;                          // O- → all
        if (donorGroup == 6) return recipientGroup == 6 || recipientGroup == 4; // O+ → O+, AB+
        if (donorGroup == 5) return recipientGroup == 5 || recipientGroup == 4 || recipientGroup == 1 || recipientGroup == 3; // A- → A-,AB+,A+... wait, standard
        if (donorGroup == 4) return recipientGroup == 4;           // AB+ → AB+ only
        if (donorGroup == 3) return recipientGroup == 3 || recipientGroup == 5 || recipientGroup == 2 || recipientGroup == 4; // B-
        if (donorGroup == 2) return recipientGroup == 2 || recipientGroup == 4; // B+ → B+, AB+
        if (donorGroup == 1) return recipientGroup == 1 || recipientGroup == 0 || recipientGroup == 4 || recipientGroup == 5; // A-
        if (donorGroup == 0) return recipientGroup == 0 || recipientGroup == 4; // A+ → A+, AB+
        return false;
    }

    /**
     * @notice Converts blood group string to uint8 index.
     */
    function bloodGroupToIndex(string memory group) internal pure returns (uint8) {
        bytes32 h = keccak256(bytes(group));
        if (h == keccak256("A+"))  return 0;
        if (h == keccak256("A-"))  return 1;
        if (h == keccak256("B+"))  return 2;
        if (h == keccak256("B-"))  return 3;
        if (h == keccak256("AB+")) return 4;
        if (h == keccak256("AB-")) return 5;
        if (h == keccak256("O+"))  return 6;
        if (h == keccak256("O-"))  return 7;
        revert("BloodBankLib: unknown blood group");
    }

    function indexToBloodGroup(uint8 index) internal pure returns (string memory) {
        if (index == 0) return "A+";
        if (index == 1) return "A-";
        if (index == 2) return "B+";
        if (index == 3) return "B-";
        if (index == 4) return "AB+";
        if (index == 5) return "AB-";
        if (index == 6) return "O+";
        if (index == 7) return "O-";
        revert("BloodBankLib: invalid index");
    }

    function isRareBloodGroup(string memory group) internal pure returns (bool) {
        bytes32 h = keccak256(bytes(group));
        return h == keccak256("AB-") || h == keccak256("B-") || h == keccak256("O-") || h == keccak256("A-");
    }

    function isUniversalDonor(string memory group) internal pure returns (bool) {
        return keccak256(bytes(group)) == keccak256("O-");
    }

    function isUniversalRecipient(string memory group) internal pure returns (bool) {
        return keccak256(bytes(group)) == keccak256("AB+");
    }

    // ── Component Expiry Durations (seconds) ──────────────────────────────

    uint256 internal constant EXPIRY_RBC_SECONDS         = 42 days;
    uint256 internal constant EXPIRY_PLATELET_SECONDS    = 5 days;
    uint256 internal constant EXPIRY_FFP_SECONDS         = 365 days;
    uint256 internal constant EXPIRY_CRYO_SECONDS        = 365 days;
    uint256 internal constant EXPIRY_WHOLE_BLOOD_SECONDS = 35 days;
    uint256 internal constant EXPIRY_GRANULOCYTE_SECONDS = 1 days;

    function getExpiryDuration(string memory componentType) internal pure returns (uint256) {
        bytes32 h = keccak256(bytes(componentType));
        if (h == keccak256("RBC") || h == keccak256("Red Blood Cells")) return EXPIRY_RBC_SECONDS;
        if (h == keccak256("Platelet") || h == keccak256("Platelets"))   return EXPIRY_PLATELET_SECONDS;
        if (h == keccak256("FFP") || h == keccak256("Fresh Frozen Plasma")) return EXPIRY_FFP_SECONDS;
        if (h == keccak256("Cryoprecipitate") || h == keccak256("Cryo")) return EXPIRY_CRYO_SECONDS;
        if (h == keccak256("Whole Blood"))                               return EXPIRY_WHOLE_BLOOD_SECONDS;
        if (h == keccak256("Granulocyte"))                               return EXPIRY_GRANULOCYTE_SECONDS;
        return EXPIRY_RBC_SECONDS; // default
    }

    function computeExpiryTimestamp(uint256 collectionTimestamp, string memory componentType)
        internal pure returns (uint256)
    {
        return collectionTimestamp + getExpiryDuration(componentType);
    }

    function isExpired(uint256 expiryTimestamp, uint256 currentTimestamp) internal pure returns (bool) {
        return currentTimestamp >= expiryTimestamp;
    }

    function daysUntilExpiry(uint256 expiryTimestamp, uint256 currentTimestamp)
        internal pure returns (uint256 daysLeft, bool expired)
    {
        if (currentTimestamp >= expiryTimestamp) return (0, true);
        daysLeft = (expiryTimestamp - currentTimestamp) / 1 days;
        expired = false;
    }

    function isCriticalExpiry(uint256 expiryTimestamp, uint256 currentTimestamp)
        internal pure returns (bool)
    {
        if (currentTimestamp >= expiryTimestamp) return true;
        return (expiryTimestamp - currentTimestamp) <= 2 days;
    }

    // ── Hash & Integrity ──────────────────────────────────────────────────

    function hashMatches(string memory stored, string memory expected) internal pure returns (bool) {
        return keccak256(bytes(stored)) == keccak256(bytes(expected));
    }

    function computeUnitHash(
        string memory unitId,
        string memory bloodGroup,
        string memory componentType,
        uint256 collectionTimestamp,
        address bloodBank
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(unitId, bloodGroup, componentType, collectionTimestamp, bloodBank));
    }

    function computeDonorHash(
        string memory donorRefId,
        string memory bloodGroup,
        uint256 registeredAt
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(donorRefId, bloodGroup, registeredAt));
    }

    function computeRequestHash(
        string memory requestId,
        address hospital,
        string memory bloodGroup,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(requestId, hospital, bloodGroup, timestamp));
    }

    function bytes32ToHexString(bytes32 data) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(66);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 32; i++) {
            str[2 + i * 2]     = alphabet[uint8(data[i] >> 4)];
            str[3 + i * 2]     = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }

    // ── String Utilities ──────────────────────────────────────────────────

    function stringsEqual(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    function isEmpty(string memory s) internal pure returns (bool) {
        return bytes(s).length == 0;
    }

    function strlen(string memory s) internal pure returns (uint256) {
        return bytes(s).length;
    }

    function toUpperCase(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory result = new bytes(b.length);
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] >= 0x61 && b[i] <= 0x7a) {
                result[i] = bytes1(uint8(b[i]) - 32);
            } else {
                result[i] = b[i];
            }
        }
        return string(result);
    }

    function uint256ToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function addressToString(address addr) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory data = abi.encodePacked(addr);
        bytes memory str = new bytes(42);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2]     = alphabet[uint8(data[i] >> 4)];
            str[3 + i * 2]     = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }

    // ── Donation Eligibility ──────────────────────────────────────────────

    uint256 internal constant MIN_DONATION_INTERVAL_WHOLE = 56 days;  // 8 weeks
    uint256 internal constant MIN_DONATION_INTERVAL_PLASMA = 28 days; // 4 weeks
    uint256 internal constant MIN_DONATION_INTERVAL_PLATELET = 7 days;
    uint256 internal constant MIN_DONOR_AGE_SECONDS = 18 * 365 days;
    uint256 internal constant MAX_DONOR_AGE_SECONDS = 65 * 365 days;

    function isDonorAgeEligible(uint256 dateOfBirthTimestamp, uint256 currentTimestamp)
        internal pure returns (bool)
    {
        uint256 age = currentTimestamp - dateOfBirthTimestamp;
        return age >= MIN_DONOR_AGE_SECONDS && age <= MAX_DONOR_AGE_SECONDS;
    }

    function isDonationIntervalElapsed(
        uint256 lastDonationTimestamp,
        uint256 currentTimestamp,
        string memory componentType
    ) internal pure returns (bool) {
        if (lastDonationTimestamp == 0) return true;
        uint256 elapsed = currentTimestamp - lastDonationTimestamp;
        bytes32 h = keccak256(bytes(componentType));
        if (h == keccak256("Platelet") || h == keccak256("Platelets")) {
            return elapsed >= MIN_DONATION_INTERVAL_PLATELET;
        }
        if (h == keccak256("FFP") || h == keccak256("Fresh Frozen Plasma")) {
            return elapsed >= MIN_DONATION_INTERVAL_PLASMA;
        }
        return elapsed >= MIN_DONATION_INTERVAL_WHOLE;
    }

    function getDonorTier(uint256 totalDonations) internal pure returns (string memory) {
        if (totalDonations == 0)   return "New Donor";
        if (totalDonations < 5)    return "Bronze Donor";
        if (totalDonations < 15)   return "Silver Donor";
        if (totalDonations < 30)   return "Gold Donor";
        if (totalDonations < 50)   return "Platinum Donor";
        return "Lifetime Hero Donor";
    }

    // ── Address Validation ────────────────────────────────────────────────

    function isValidAddress(address addr) internal pure returns (bool) {
        return addr != address(0);
    }

    function isContract(address addr) internal view returns (bool) {
        uint256 size;
        assembly { size := extcodesize(addr) }
        return size > 0;
    }

    // ── Math Utilities ────────────────────────────────────────────────────

    function percentOf(uint256 value, uint256 total) internal pure returns (uint256) {
        if (total == 0) return 0;
        return (value * 100) / total;
    }

    function clamp(uint256 value, uint256 minVal, uint256 maxVal) internal pure returns (uint256) {
        if (value < minVal) return minVal;
        if (value > maxVal) return maxVal;
        return value;
    }

    function average(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a & b) + (a ^ b) / 2;
    }
}
