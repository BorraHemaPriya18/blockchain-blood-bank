// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BloodBankAccessControl
 * @notice Granular role-based access control for the blood bank supply chain.
 *         Roles: ADMIN, BLOOD_BANK_STAFF, LAB_TECHNICIAN, HOSPITAL_STAFF, AUDITOR, DISPATCHER
 */
contract BloodBankAccessControl {

    bytes32 public constant ROLE_ADMIN           = keccak256("ADMIN");
    bytes32 public constant ROLE_BLOOD_BANK      = keccak256("BLOOD_BANK_STAFF");
    bytes32 public constant ROLE_LAB_TECH        = keccak256("LAB_TECHNICIAN");
    bytes32 public constant ROLE_HOSPITAL        = keccak256("HOSPITAL_STAFF");
    bytes32 public constant ROLE_AUDITOR         = keccak256("AUDITOR");
    bytes32 public constant ROLE_DISPATCHER      = keccak256("DISPATCHER");

    struct RoleData {
        mapping(address => bool) members;
        bytes32 adminRole;
    }

    struct RoleAssignment {
        address account;
        bytes32 role;
        uint256 grantedAt;
        address grantedBy;
        bool active;
    }

    mapping(bytes32 => RoleData) private _roles;
    mapping(address => bytes32[]) private _accountRoles;
    mapping(bytes32 => address[]) private _roleMembers;
    RoleAssignment[] private _roleHistory;

    uint256 public totalRoleAssignments;
    uint256 public totalRoleRevocations;

    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender, uint256 timestamp);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender, uint256 timestamp);
    event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole);

    modifier onlyRole(bytes32 role) {
        require(hasRole(role, msg.sender), "AccessControl: caller does not have required role");
        _;
    }

    modifier onlyRoleOrAdmin(bytes32 role) {
        require(hasRole(role, msg.sender) || hasRole(ROLE_ADMIN, msg.sender), "AccessControl: insufficient permissions");
        _;
    }

    constructor() {
        _roles[ROLE_ADMIN].adminRole = ROLE_ADMIN;
        _roles[ROLE_BLOOD_BANK].adminRole = ROLE_ADMIN;
        _roles[ROLE_LAB_TECH].adminRole = ROLE_ADMIN;
        _roles[ROLE_HOSPITAL].adminRole = ROLE_ADMIN;
        _roles[ROLE_AUDITOR].adminRole = ROLE_ADMIN;
        _roles[ROLE_DISPATCHER].adminRole = ROLE_BLOOD_BANK;

        _grantRole(ROLE_ADMIN, msg.sender);
    }

    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role].members[account];
    }

    function getRoleAdmin(bytes32 role) public view returns (bytes32) {
        return _roles[role].adminRole;
    }

    function grantRole(bytes32 role, address account) external onlyRole(getRoleAdmin(role)) {
        require(account != address(0), "AccessControl: cannot grant role to zero address");
        _grantRole(role, account);
    }

    function revokeRole(bytes32 role, address account) external onlyRole(getRoleAdmin(role)) {
        require(account != address(0), "AccessControl: cannot revoke role from zero address");
        _revokeRole(role, account);
    }

    function renounceRole(bytes32 role) external {
        _revokeRole(role, msg.sender);
    }

    function setRoleAdmin(bytes32 role, bytes32 adminRole) external onlyRole(ROLE_ADMIN) {
        bytes32 previousAdminRole = _roles[role].adminRole;
        _roles[role].adminRole = adminRole;
        emit RoleAdminChanged(role, previousAdminRole, adminRole);
    }

    function grantMultipleRoles(bytes32[] calldata roles, address account) external onlyRole(ROLE_ADMIN) {
        require(account != address(0), "AccessControl: zero address");
        for (uint256 i = 0; i < roles.length; i++) {
            _grantRole(roles[i], account);
        }
    }

    function revokeAllRoles(address account) external onlyRole(ROLE_ADMIN) {
        bytes32[] memory accountRoleList = _accountRoles[account];
        for (uint256 i = 0; i < accountRoleList.length; i++) {
            if (_roles[accountRoleList[i]].members[account]) {
                _revokeRole(accountRoleList[i], account);
            }
        }
    }

    function getRoleMembers(bytes32 role) external view returns (address[] memory) {
        return _roleMembers[role];
    }

    function getAccountRoles(address account) external view returns (bytes32[] memory) {
        return _accountRoles[account];
    }

    function getRoleMemberCount(bytes32 role) external view returns (uint256) {
        return _roleMembers[role].length;
    }

    function isBloodBankStaff(address account) external view returns (bool) {
        return hasRole(ROLE_BLOOD_BANK, account);
    }

    function isLabTechnician(address account) external view returns (bool) {
        return hasRole(ROLE_LAB_TECH, account);
    }

    function isHospitalStaff(address account) external view returns (bool) {
        return hasRole(ROLE_HOSPITAL, account);
    }

    function isAuditor(address account) external view returns (bool) {
        return hasRole(ROLE_AUDITOR, account);
    }

    function isDispatcher(address account) external view returns (bool) {
        return hasRole(ROLE_DISPATCHER, account);
    }

    function isAdmin(address account) external view returns (bool) {
        return hasRole(ROLE_ADMIN, account);
    }

    function getAccessControlStats() external view returns (
        uint256 assignments,
        uint256 revocations,
        uint256 adminCount,
        uint256 bloodBankCount,
        uint256 hospitalCount,
        uint256 labTechCount,
        uint256 auditorCount,
        uint256 dispatcherCount
    ) {
        return (
            totalRoleAssignments,
            totalRoleRevocations,
            _roleMembers[ROLE_ADMIN].length,
            _roleMembers[ROLE_BLOOD_BANK].length,
            _roleMembers[ROLE_HOSPITAL].length,
            _roleMembers[ROLE_LAB_TECH].length,
            _roleMembers[ROLE_AUDITOR].length,
            _roleMembers[ROLE_DISPATCHER].length
        );
    }

    function _grantRole(bytes32 role, address account) internal {
        if (!_roles[role].members[account]) {
            _roles[role].members[account] = true;
            _roleMembers[role].push(account);
            _accountRoles[account].push(role);
            totalRoleAssignments++;
            _roleHistory.push(RoleAssignment({
                account: account,
                role: role,
                grantedAt: block.timestamp,
                grantedBy: msg.sender,
                active: true
            }));
            emit RoleGranted(role, account, msg.sender, block.timestamp);
        }
    }

    function _revokeRole(bytes32 role, address account) internal {
        if (_roles[role].members[account]) {
            _roles[role].members[account] = false;
            totalRoleRevocations++;
            emit RoleRevoked(role, account, msg.sender, block.timestamp);
        }
    }
}
