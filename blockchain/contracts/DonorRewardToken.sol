// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DonorRewardToken
 * @notice ERC-20 compatible reward token issued to voluntary blood donors.
 *         Donors earn tokens per donation. Tokens are non-transferable by default (soulbound)
 *         but can be redeemed for healthcare benefits via authorized redemption partners.
 */
contract DonorRewardToken {

    string public constant name     = "BloodChain Donor Reward";
    string public constant symbol   = "BCDR";
    uint8  public constant decimals = 18;

    uint256 public totalSupply;
    uint256 public constant TOKENS_PER_DONATION    = 100 * 10**18;
    uint256 public constant TOKENS_PER_RARE_DONATE = 250 * 10**18; // O-, AB- rare groups
    uint256 public constant MAX_SUPPLY             = 10_000_000 * 10**18;

    address public immutable minter;
    bool    public transfersEnabled;

    struct DonorAccount {
        uint256 balance;
        uint256 totalEarned;
        uint256 totalRedeemed;
        uint256 donationCount;
        uint256 lastRewardTimestamp;
        bool exists;
    }

    struct RedemptionRecord {
        address donor;
        uint256 amount;
        string  benefitCode;
        address redemptionPartner;
        uint256 timestamp;
    }

    struct RedemptionPartner {
        string  name;
        bool    active;
        uint256 totalRedemptions;
        uint256 registeredAt;
    }

    mapping(address => DonorAccount)    private _accounts;
    mapping(address => mapping(address => uint256)) private _allowances;
    mapping(address => bool)            public  authorizedMinters;
    mapping(address => RedemptionPartner) public redemptionPartners;

    RedemptionRecord[] private _redemptionHistory;
    address[] private _allDonors;
    address[] private _allPartners;

    uint256 public totalRedemptions;
    uint256 public totalDonationsRewarded;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event DonationRewarded(address indexed donor, uint256 amount, uint256 donationCount, uint256 timestamp);
    event TokensRedeemed(address indexed donor, address indexed partner, uint256 amount, string benefitCode, uint256 timestamp);
    event MinterAuthorizationChanged(address indexed minter, bool authorized);
    event PartnerRegistered(address indexed partner, string name, uint256 timestamp);
    event PartnerStatusChanged(address indexed partner, bool active, uint256 timestamp);
    event TransfersToggled(bool enabled, uint256 timestamp);

    modifier onlyMinter() {
        require(msg.sender == minter || authorizedMinters[msg.sender], "DonorToken: caller is not authorized minter");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == minter, "DonorToken: caller is not owner");
        _;
    }

    modifier transfersAllowed() {
        require(transfersEnabled, "DonorToken: token transfers are disabled (soulbound mode)");
        _;
    }

    constructor() {
        minter = msg.sender;
        authorizedMinters[msg.sender] = true;
        transfersEnabled = false;
    }

    // --- ERC-20 Core ---

    function balanceOf(address account) external view returns (uint256) {
        return _accounts[account].balance;
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        require(spender != address(0), "DonorToken: approve to zero address");
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external transfersAllowed returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external transfersAllowed returns (bool) {
        require(_allowances[from][msg.sender] >= amount, "DonorToken: insufficient allowance");
        _allowances[from][msg.sender] -= amount;
        _transfer(from, to, amount);
        return true;
    }

    // --- Reward Minting ---

    function rewardDonation(address donor, bool isRareBloodGroup) external onlyMinter {
        require(donor != address(0), "DonorToken: zero address");
        uint256 rewardAmount = isRareBloodGroup ? TOKENS_PER_RARE_DONATE : TOKENS_PER_DONATION;
        require(totalSupply + rewardAmount <= MAX_SUPPLY, "DonorToken: max supply exceeded");

        if (!_accounts[donor].exists) {
            _accounts[donor].exists = true;
            _allDonors.push(donor);
        }

        _accounts[donor].balance += rewardAmount;
        _accounts[donor].totalEarned += rewardAmount;
        _accounts[donor].donationCount++;
        _accounts[donor].lastRewardTimestamp = block.timestamp;
        totalSupply += rewardAmount;
        totalDonationsRewarded++;

        emit Transfer(address(0), donor, rewardAmount);
        emit DonationRewarded(donor, rewardAmount, _accounts[donor].donationCount, block.timestamp);
    }

    function rewardBatch(address[] calldata donors, bool[] calldata isRare) external onlyMinter {
        require(donors.length == isRare.length, "DonorToken: array length mismatch");
        for (uint256 i = 0; i < donors.length; i++) {
            require(donors[i] != address(0), "DonorToken: zero address in batch");
            uint256 rewardAmount = isRare[i] ? TOKENS_PER_RARE_DONATE : TOKENS_PER_DONATION;
            require(totalSupply + rewardAmount <= MAX_SUPPLY, "DonorToken: max supply exceeded");

            if (!_accounts[donors[i]].exists) {
                _accounts[donors[i]].exists = true;
                _allDonors.push(donors[i]);
            }

            _accounts[donors[i]].balance += rewardAmount;
            _accounts[donors[i]].totalEarned += rewardAmount;
            _accounts[donors[i]].donationCount++;
            _accounts[donors[i]].lastRewardTimestamp = block.timestamp;
            totalSupply += rewardAmount;
            totalDonationsRewarded++;

            emit Transfer(address(0), donors[i], rewardAmount);
            emit DonationRewarded(donors[i], rewardAmount, _accounts[donors[i]].donationCount, block.timestamp);
        }
    }

    // --- Redemption ---

    function registerRedemptionPartner(address partner, string calldata partnerName) external onlyOwner {
        require(partner != address(0), "DonorToken: zero address");
        require(!redemptionPartners[partner].active, "DonorToken: partner already registered");
        redemptionPartners[partner] = RedemptionPartner({
            name: partnerName,
            active: true,
            totalRedemptions: 0,
            registeredAt: block.timestamp
        });
        _allPartners.push(partner);
        emit PartnerRegistered(partner, partnerName, block.timestamp);
    }

    function setPartnerStatus(address partner, bool active) external onlyOwner {
        require(redemptionPartners[partner].registeredAt > 0, "DonorToken: partner not registered");
        redemptionPartners[partner].active = active;
        emit PartnerStatusChanged(partner, active, block.timestamp);
    }

    function redeemTokens(address donor, uint256 amount, string calldata benefitCode) external {
        require(redemptionPartners[msg.sender].active, "DonorToken: caller is not active redemption partner");
        require(_accounts[donor].balance >= amount, "DonorToken: insufficient balance");
        require(amount > 0, "DonorToken: amount must be greater than zero");

        _accounts[donor].balance -= amount;
        _accounts[donor].totalRedeemed += amount;
        totalSupply -= amount;
        redemptionPartners[msg.sender].totalRedemptions++;
        totalRedemptions++;

        _redemptionHistory.push(RedemptionRecord({
            donor: donor,
            amount: amount,
            benefitCode: benefitCode,
            redemptionPartner: msg.sender,
            timestamp: block.timestamp
        }));

        emit Transfer(donor, address(0), amount);
        emit TokensRedeemed(donor, msg.sender, amount, benefitCode, block.timestamp);
    }

    // --- Admin ---

    function setMinterAuthorization(address _minter, bool authorized) external onlyOwner {
        require(_minter != address(0), "DonorToken: zero address");
        authorizedMinters[_minter] = authorized;
        emit MinterAuthorizationChanged(_minter, authorized);
    }

    function toggleTransfers(bool enabled) external onlyOwner {
        transfersEnabled = enabled;
        emit TransfersToggled(enabled, block.timestamp);
    }

    // --- View ---

    function getDonorAccount(address donor) external view returns (
        uint256 balance,
        uint256 totalEarned,
        uint256 totalRedeemed,
        uint256 donationCount,
        uint256 lastRewardTimestamp
    ) {
        DonorAccount memory acc = _accounts[donor];
        return (acc.balance, acc.totalEarned, acc.totalRedeemed, acc.donationCount, acc.lastRewardTimestamp);
    }

    function getRedemptionRecord(uint256 index) external view returns (RedemptionRecord memory) {
        require(index < _redemptionHistory.length, "DonorToken: index out of bounds");
        return _redemptionHistory[index];
    }

    function getAllDonors() external view returns (address[] memory) {
        return _allDonors;
    }

    function getAllPartners() external view returns (address[] memory) {
        return _allPartners;
    }

    function getTokenStats() external view returns (
        uint256 supply,
        uint256 maxSupply,
        uint256 donorsCount,
        uint256 donationsRewarded,
        uint256 redemptionsCount,
        bool transferable
    ) {
        return (totalSupply, MAX_SUPPLY, _allDonors.length, totalDonationsRewarded, totalRedemptions, transfersEnabled);
    }

    // --- Internal ---

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "DonorToken: transfer from zero address");
        require(to != address(0), "DonorToken: transfer to zero address");
        require(_accounts[from].balance >= amount, "DonorToken: insufficient balance");

        _accounts[from].balance -= amount;

        if (!_accounts[to].exists) {
            _accounts[to].exists = true;
            _allDonors.push(to);
        }
        _accounts[to].balance += amount;

        emit Transfer(from, to, amount);
    }
}
