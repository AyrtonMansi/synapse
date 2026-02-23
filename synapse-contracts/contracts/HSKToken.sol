// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title HSKToken
 * @notice ERC20 token with vesting, burn functionality, and mining emissions
 * @dev UUPS Upgradeable, no pause functionality, DAO-controlled
 * @dev REMOVED: Pausable functionality for decentralization
 */
contract HSKToken is Initializable, ERC20, ERC20Burnable, ERC20Permit, AccessControl, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");
    bytes32 public constant MINING_ROLE = keccak256("MINING_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    struct VestingSchedule {
        uint256 totalAmount;
        uint256 releasedAmount;
        uint256 startTime;
        uint256 duration;
        uint256 cliffDuration;
        bool revocable;
        bool revoked;
    }

    mapping(address => VestingSchedule) public vestingSchedules;
    mapping(address => bool) public vestingBeneficiaries;
    address[] private _beneficiariesList;

    uint256 public constant MAX_SUPPLY = 100_000_000 * 10 ** 18;
    uint256 public constant INITIAL_SUPPLY = 20_000_000 * 10 ** 18;
    uint256 public constant MINING_EMISSION_RATE = 158548960;
    uint256 public lastMiningBlock;
    uint256 public totalMintedViaMining;
    uint256 public miningCap;

    // Time-locked emergency mode instead of full pause
    bool public emergencyMode;
    uint256 public emergencyModeExpiry;
    uint256 public constant EMERGENCY_DURATION = 7 days;
    
    event VestingScheduleCreated(address indexed beneficiary, uint256 amount, uint256 startTime, uint256 duration, uint256 cliffDuration);
    event TokensReleased(address indexed beneficiary, uint256 amount);
    event VestingRevoked(address indexed beneficiary, uint256 refundAmount);
    event MiningRewardMinted(address indexed to, uint256 amount);
    event MiningCapUpdated(uint256 newCap);
    event EmergencyModeActivated(uint256 expiry);
    event EmergencyModeDeactivated();

    modifier onlyDAO() {
        require(hasRole(DAO_ROLE, msg.sender), "HSKToken: not DAO");
        _;
    }

    modifier onlyMining() {
        require(hasRole(MINING_ROLE, msg.sender), "HSKToken: not mining");
        _;
    }

    modifier notEmergency() {
        require(!emergencyMode || block.timestamp > emergencyModeExpiry, "HSKToken: emergency mode");
        _;
    }

    constructor() ERC20("Synapse", "HSK") ERC20Permit("Synapse") {
        _disableInitializers();
    }

    function initialize(address daoAddress, address miningController) public initializer {
        require(daoAddress != address(0), "HSKToken: zero DAO");
        require(miningController != address(0), "HSKToken: zero mining");

        _grantRole(DEFAULT_ADMIN_ROLE, daoAddress);
        _grantRole(DAO_ROLE, daoAddress);
        _grantRole(MINING_ROLE, miningController);
        _grantRole(UPGRADER_ROLE, daoAddress);

        _mint(daoAddress, INITIAL_SUPPLY);
        lastMiningBlock = block.number;
        miningCap = (MAX_SUPPLY - INITIAL_SUPPLY) / 2;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    function createVestingSchedule(address beneficiary, uint256 amount, uint256 startTime, uint256 duration, uint256 cliffDuration, bool revocable) external onlyDAO notEmergency {
        require(beneficiary != address(0), "HSKToken: zero beneficiary");
        require(amount > 0, "HSKToken: zero amount");
        require(duration > 0, "HSKToken: zero duration");
        require(cliffDuration <= duration, "HSKToken: cliff exceeds duration");
        require(vestingSchedules[beneficiary].totalAmount == 0, "HSKToken: exists");

        vestingSchedules[beneficiary] = VestingSchedule({
            totalAmount: amount,
            releasedAmount: 0,
            startTime: startTime,
            duration: duration,
            cliffDuration: cliffDuration,
            revocable: revocable,
            revoked: false
        });

        vestingBeneficiaries[beneficiary] = true;
        _beneficiariesList.push(beneficiary);
        _transfer(msg.sender, address(this), amount);
        emit VestingScheduleCreated(beneficiary, amount, startTime, duration, cliffDuration);
    }

    function releasableAmount(address beneficiary) public view returns (uint256) {
        VestingSchedule storage schedule = vestingSchedules[beneficiary];
        if (schedule.revoked || schedule.totalAmount == 0) return 0;
        return vestedAmount(beneficiary) - schedule.releasedAmount;
    }

    function vestedAmount(address beneficiary) public view returns (uint256) {
        VestingSchedule storage schedule = vestingSchedules[beneficiary];
        if (schedule.totalAmount == 0 || schedule.revoked) return 0;
        if (block.timestamp < schedule.startTime + schedule.cliffDuration) return 0;
        if (block.timestamp >= schedule.startTime + schedule.duration) return schedule.totalAmount;
        return (schedule.totalAmount * (block.timestamp - schedule.startTime)) / schedule.duration;
    }

    function releaseVestedTokens(address beneficiary) external notEmergency {
        uint256 amount = releasableAmount(beneficiary);
        require(amount > 0, "HSKToken: no tokens");
        vestingSchedules[beneficiary].releasedAmount += amount;
        _transfer(address(this), beneficiary, amount);
        emit TokensReleased(beneficiary, amount);
    }

    function revokeVesting(address beneficiary) external onlyDAO notEmergency {
        VestingSchedule storage schedule = vestingSchedules[beneficiary];
        require(schedule.revocable, "HSKToken: not revocable");
        require(!schedule.revoked, "HSKToken: revoked");
        require(schedule.totalAmount > 0, "HSKToken: no schedule");

        uint256 vested = vestedAmount(beneficiary);
        uint256 refund = schedule.totalAmount - vested;
        schedule.revoked = true;
        schedule.totalAmount = vested;

        if (refund > 0) _transfer(address(this), msg.sender, refund);
        emit VestingRevoked(beneficiary, refund);
    }

    function mintMiningReward(address to, uint256 blocks) external onlyMining notEmergency returns (uint256) {
        require(to != address(0), "HSKToken: zero address");
        require(blocks > 0, "HSKToken: zero blocks");

        uint256 amount = calculateMiningReward(blocks);
        require(totalSupply() + amount <= MAX_SUPPLY, "HSKToken: max supply");
        require(totalMintedViaMining + amount <= miningCap, "HSKToken: mining cap");

        totalMintedViaMining += amount;
        lastMiningBlock = block.number;
        _mint(to, amount);
        emit MiningRewardMinted(to, amount);
        return amount;
    }

    function calculateMiningReward(uint256 blocks) public pure returns (uint256) {
        return blocks * MINING_EMISSION_RATE;
    }

    function setMiningCap(uint256 newCap) external onlyDAO {
        require(newCap <= MAX_SUPPLY - INITIAL_SUPPLY, "HSKToken: cap too high");
        miningCap = newCap;
        emit MiningCapUpdated(newCap);
    }

    function activateEmergencyMode() external onlyDAO {
        require(!emergencyMode, "HSKToken: already active");
        emergencyMode = true;
        emergencyModeExpiry = block.timestamp + EMERGENCY_DURATION;
        emit EmergencyModeActivated(emergencyModeExpiry);
    }

    function deactivateEmergencyMode() external onlyDAO {
        require(emergencyMode, "HSKToken: not active");
        emergencyMode = false;
        emit EmergencyModeDeactivated();
    }

    function transferDAORole(address newDAO) external onlyDAO {
        require(newDAO != address(0), "HSKToken: zero DAO");
        _grantRole(DAO_ROLE, newDAO);
        _grantRole(DEFAULT_ADMIN_ROLE, newDAO);
        _grantRole(UPGRADER_ROLE, newDAO);
        _revokeRole(UPGRADER_ROLE, msg.sender);
        _revokeRole(DAO_ROLE, msg.sender);
        _revokeRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function getBeneficiaries() external view returns (address[] memory) {
        return _beneficiariesList;
    }

    function remainingMiningSupply() external view returns (uint256) {
        return miningCap - totalMintedViaMining;
    }

    function _update(address from, address to, uint256 amount) internal override notEmergency {
        super._update(from, to, amount);
    }
}
