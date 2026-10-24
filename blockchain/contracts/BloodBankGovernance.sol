// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BloodBankGovernance
 * @notice On-chain governance for blood bank network policy changes.
 *         Authorized participants submit proposals (e.g. add hospital, change expiry policy,
 *         update screening protocol). Proposals pass by weighted vote and are executed on-chain.
 */
contract BloodBankGovernance {

    address public admin;

    enum ProposalType {
        AddBloodBank,
        RemoveBloodBank,
        AddHospital,
        RemoveHospital,
        UpdateExpiryPolicy,
        UpdateScreeningProtocol,
        UpdateEmergencyThreshold,
        UpdateRewardRate,
        TransferAdmin,
        Custom
    }

    enum ProposalStatus {
        Active,
        Passed,
        Rejected,
        Executed,
        Cancelled,
        Expired
    }

    struct Voter {
        uint256 weight;
        bool    registered;
        uint256 registeredAt;
        uint256 totalVotesCast;
    }

    struct Vote {
        address voter;
        bool    inFavor;
        uint256 weight;
        uint256 timestamp;
        string  comment;
    }

    struct Proposal {
        uint256        proposalId;
        ProposalType   proposalType;
        ProposalStatus status;
        address        proposer;
        string         title;
        string         description;
        bytes          callData;
        address        targetContract;
        uint256        votesFor;
        uint256        votesAgainst;
        uint256        totalVoters;
        uint256        createdAt;
        uint256        votingDeadline;
        uint256        executedAt;
        bool           executed;
    }

    struct PolicyRecord {
        string  policyKey;
        uint256 value;
        string  description;
        uint256 updatedAt;
        address updatedBy;
    }

    mapping(uint256 => Proposal)              public proposals;
    mapping(uint256 => Vote[])                private _proposalVotes;
    mapping(uint256 => mapping(address => bool)) private _hasVoted;
    mapping(address => Voter)                 public voters;
    mapping(string  => PolicyRecord)          public policies;

    address[] private _allVoters;
    uint256[] private _allProposalIds;

    uint256 public totalProposals;
    uint256 public totalExecuted;
    uint256 public totalRejected;
    uint256 public quorumPercent;
    uint256 public passingPercent;
    uint256 public votingPeriod;

    event ProposalCreated(uint256 indexed proposalId, ProposalType proposalType, address indexed proposer, string title, uint256 deadline);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool inFavor, uint256 weight, uint256 timestamp);
    event ProposalStatusChanged(uint256 indexed proposalId, ProposalStatus status, uint256 timestamp);
    event ProposalExecuted(uint256 indexed proposalId, address indexed executor, uint256 timestamp);
    event VoterRegistered(address indexed voter, uint256 weight, uint256 timestamp);
    event VoterWeightUpdated(address indexed voter, uint256 oldWeight, uint256 newWeight, uint256 timestamp);
    event PolicyUpdated(string indexed policyKey, uint256 oldValue, uint256 newValue, address indexed updatedBy, uint256 timestamp);
    event QuorumUpdated(uint256 oldQuorum, uint256 newQuorum, uint256 timestamp);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Governance: caller is not admin");
        _;
    }

    modifier onlyRegisteredVoter() {
        require(voters[msg.sender].registered, "Governance: caller is not a registered voter");
        _;
    }

    modifier proposalExists(uint256 proposalId) {
        require(proposalId < totalProposals, "Governance: proposal does not exist");
        _;
    }

    constructor(uint256 _quorumPercent, uint256 _passingPercent, uint256 _votingPeriodDays) {
        require(_quorumPercent <= 100, "Governance: quorum > 100");
        require(_passingPercent <= 100, "Governance: passing > 100");
        admin          = msg.sender;
        quorumPercent  = _quorumPercent;
        passingPercent = _passingPercent;
        votingPeriod   = _votingPeriodDays * 1 days;

        // Register deployer as voter with weight 3
        _registerVoter(msg.sender, 3);

        // Initialize default policies
        _setPolicy("MIN_DONATION_INTERVAL_DAYS", 56, "Minimum days between whole blood donations");
        _setPolicy("MAX_UNITS_PER_REQUEST",       10, "Maximum blood units per hospital request");
        _setPolicy("EMERGENCY_TRANSFER_TIMEOUT",  24, "Hours before emergency transfer auto-expires");
        _setPolicy("SCREENING_VALIDITY_DAYS",      7, "Days screening result remains valid");
        _setPolicy("REWARD_TOKENS_PER_DONATION", 100, "Donor reward tokens per donation");
        _setPolicy("COLD_CHAIN_MAX_EXCURSIONS",    3, "Max temperature excursions before shipment fails");
    }

    // ── Voter Management ──────────────────────────────────────────────────

    function registerVoter(address voter, uint256 weight) external onlyAdmin {
        require(voter != address(0), "Governance: zero address");
        require(weight > 0 && weight <= 10, "Governance: weight must be 1-10");
        require(!voters[voter].registered, "Governance: voter already registered");
        _registerVoter(voter, weight);
    }

    function updateVoterWeight(address voter, uint256 newWeight) external onlyAdmin {
        require(voters[voter].registered, "Governance: voter not registered");
        require(newWeight > 0 && newWeight <= 10, "Governance: weight must be 1-10");
        uint256 oldWeight = voters[voter].weight;
        voters[voter].weight = newWeight;
        emit VoterWeightUpdated(voter, oldWeight, newWeight, block.timestamp);
    }

    function deregisterVoter(address voter) external onlyAdmin {
        require(voters[voter].registered, "Governance: voter not registered");
        voters[voter].registered = false;
    }

    // ── Proposal Lifecycle ────────────────────────────────────────────────

    function createProposal(
        ProposalType  _type,
        string calldata _title,
        string calldata _description,
        address       _targetContract,
        bytes calldata _callData
    ) external onlyRegisteredVoter returns (uint256 proposalId) {
        proposalId = totalProposals;

        proposals[proposalId] = Proposal({
            proposalId:     proposalId,
            proposalType:   _type,
            status:         ProposalStatus.Active,
            proposer:       msg.sender,
            title:          _title,
            description:    _description,
            callData:       _callData,
            targetContract: _targetContract,
            votesFor:       0,
            votesAgainst:   0,
            totalVoters:    0,
            createdAt:      block.timestamp,
            votingDeadline: block.timestamp + votingPeriod,
            executedAt:     0,
            executed:       false
        });

        _allProposalIds.push(proposalId);
        totalProposals++;

        emit ProposalCreated(proposalId, _type, msg.sender, _title, block.timestamp + votingPeriod);
    }

    function castVote(
        uint256 proposalId,
        bool inFavor,
        string calldata comment
    ) external onlyRegisteredVoter proposalExists(proposalId) {
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.Active, "Governance: proposal not active");
        require(block.timestamp <= p.votingDeadline, "Governance: voting period ended");
        require(!_hasVoted[proposalId][msg.sender], "Governance: already voted");

        uint256 weight = voters[msg.sender].weight;
        _hasVoted[proposalId][msg.sender] = true;
        voters[msg.sender].totalVotesCast++;

        if (inFavor) {
            p.votesFor += weight;
        } else {
            p.votesAgainst += weight;
        }
        p.totalVoters++;

        _proposalVotes[proposalId].push(Vote({
            voter:     msg.sender,
            inFavor:   inFavor,
            weight:    weight,
            timestamp: block.timestamp,
            comment:   comment
        }));

        emit VoteCast(proposalId, msg.sender, inFavor, weight, block.timestamp);
    }

    function finalizeProposal(uint256 proposalId) external proposalExists(proposalId) {
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.Active, "Governance: proposal not active");
        require(block.timestamp > p.votingDeadline, "Governance: voting still ongoing");

        uint256 totalWeight = p.votesFor + p.votesAgainst;
        uint256 totalVoterWeight = _getTotalVoterWeight();

        // Check quorum
        if (totalVoterWeight == 0 || (totalWeight * 100) / totalVoterWeight < quorumPercent) {
            p.status = ProposalStatus.Rejected;
            totalRejected++;
            emit ProposalStatusChanged(proposalId, ProposalStatus.Rejected, block.timestamp);
            return;
        }

        // Check passing threshold
        if (totalWeight == 0 || (p.votesFor * 100) / totalWeight >= passingPercent) {
            p.status = ProposalStatus.Passed;
            emit ProposalStatusChanged(proposalId, ProposalStatus.Passed, block.timestamp);
        } else {
            p.status = ProposalStatus.Rejected;
            totalRejected++;
            emit ProposalStatusChanged(proposalId, ProposalStatus.Rejected, block.timestamp);
        }
    }

    function executeProposal(uint256 proposalId) external onlyAdmin proposalExists(proposalId) {
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.Passed, "Governance: proposal has not passed");
        require(!p.executed, "Governance: already executed");

        p.executed    = true;
        p.executedAt  = block.timestamp;
        p.status      = ProposalStatus.Executed;
        totalExecuted++;

        if (p.targetContract != address(0) && p.callData.length > 0) {
            (bool success, ) = p.targetContract.call(p.callData);
            require(success, "Governance: proposal execution call failed");
        }

        emit ProposalExecuted(proposalId, msg.sender, block.timestamp);
        emit ProposalStatusChanged(proposalId, ProposalStatus.Executed, block.timestamp);
    }

    function cancelProposal(uint256 proposalId) external proposalExists(proposalId) {
        Proposal storage p = proposals[proposalId];
        require(p.proposer == msg.sender || msg.sender == admin, "Governance: not authorized");
        require(p.status == ProposalStatus.Active, "Governance: proposal not active");
        p.status = ProposalStatus.Cancelled;
        emit ProposalStatusChanged(proposalId, ProposalStatus.Cancelled, block.timestamp);
    }

    // ── Policy Management ─────────────────────────────────────────────────

    function updatePolicy(string calldata key, uint256 newValue) external onlyAdmin {
        uint256 oldValue = policies[key].value;
        _setPolicy(key, newValue, policies[key].description);
        emit PolicyUpdated(key, oldValue, newValue, msg.sender, block.timestamp);
    }

    function getPolicy(string calldata key) external view returns (uint256 value, string memory description, uint256 updatedAt) {
        PolicyRecord memory p = policies[key];
        return (p.value, p.description, p.updatedAt);
    }

    // ── Governance Config ─────────────────────────────────────────────────

    function updateQuorum(uint256 newQuorum) external onlyAdmin {
        require(newQuorum <= 100, "Governance: quorum > 100");
        uint256 old = quorumPercent;
        quorumPercent = newQuorum;
        emit QuorumUpdated(old, newQuorum, block.timestamp);
    }

    function updatePassingPercent(uint256 newPercent) external onlyAdmin {
        require(newPercent <= 100, "Governance: percent > 100");
        passingPercent = newPercent;
    }

    function updateVotingPeriod(uint256 newPeriodDays) external onlyAdmin {
        require(newPeriodDays > 0, "Governance: period must be > 0");
        votingPeriod = newPeriodDays * 1 days;
    }

    // ── View Functions ────────────────────────────────────────────────────

    function getProposalVotes(uint256 proposalId) external view returns (Vote[] memory) {
        return _proposalVotes[proposalId];
    }

    function hasVoted(uint256 proposalId, address voter) external view returns (bool) {
        return _hasVoted[proposalId][voter];
    }

    function getAllProposalIds() external view returns (uint256[] memory) {
        return _allProposalIds;
    }

    function getAllVoters() external view returns (address[] memory) {
        return _allVoters;
    }

    function getGovernanceStats() external view returns (
        uint256 total,
        uint256 executed,
        uint256 rejected,
        uint256 active,
        uint256 voterCount,
        uint256 quorum,
        uint256 passing
    ) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < totalProposals; i++) {
            if (proposals[i].status == ProposalStatus.Active) activeCount++;
        }
        return (totalProposals, totalExecuted, totalRejected, activeCount, _allVoters.length, quorumPercent, passingPercent);
    }

    function isProposalExpired(uint256 proposalId) external view proposalExists(proposalId) returns (bool) {
        return block.timestamp > proposals[proposalId].votingDeadline &&
               proposals[proposalId].status == ProposalStatus.Active;
    }

    // ── Internal ──────────────────────────────────────────────────────────

    function _registerVoter(address voter, uint256 weight) internal {
        voters[voter] = Voter({ weight: weight, registered: true, registeredAt: block.timestamp, totalVotesCast: 0 });
        _allVoters.push(voter);
        emit VoterRegistered(voter, weight, block.timestamp);
    }

    function _setPolicy(string memory key, uint256 value, string memory description) internal {
        policies[key] = PolicyRecord({ policyKey: key, value: value, description: description, updatedAt: block.timestamp, updatedBy: msg.sender });
    }

    function _getTotalVoterWeight() internal view returns (uint256 total) {
        for (uint256 i = 0; i < _allVoters.length; i++) {
            if (voters[_allVoters[i]].registered) {
                total += voters[_allVoters[i]].weight;
            }
        }
    }
}
