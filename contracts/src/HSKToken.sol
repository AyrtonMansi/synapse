// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title HSKToken
 * @dev Synapse network native token for compute mining rewards
 */
contract HSKToken is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    
    // Mining emissions: 1% per year to reward miners
    uint256 public constant EMISSIONS_RATE = 100; // basis points (1%)
    uint256 public constant EMISSIONS_PERIOD = 365 days;
    
    uint256 public lastEmissionTime;
    uint256 public totalMinted;
    uint256 public maxSupply = 1_000_000_000 * 10**18; // 1 billion HSK
    
    // Authorized minters (NodeRewards contract)
    mapping(address => bool) public authorizedMinters;
    
    event MinterAuthorized(address indexed minter);
    event MinterRevoked(address indexed minter);
    event EmissionsMinted(uint256 amount);
    
    modifier onlyMinter() {
        require(authorizedMinters[msg.sender], "HSK: not authorized minter");
        _;
    }
    
    constructor(address initialOwner) 
        ERC20("Synapse", "HSK") 
        ERC20Permit("Synapse")
        Ownable(initialOwner)
    {
        // Initial supply: 100M to treasury
        _mint(initialOwner, 100_000_000 * 10**18);
        lastEmissionTime = block.timestamp;
    }
    
    /**
     * @dev Authorize a contract to mint rewards (e.g., NodeRewards)
     */
    function authorizeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = true;
        emit MinterAuthorized(minter);
    }
    
    function revokeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = false;
        emit MinterRevoked(minter);
    }
    
    /**
     * @dev Mint mining rewards - only authorized minters
     */
    function mintRewards(address to, uint256 amount) external onlyMinter {
        require(totalSupply() + amount <= maxSupply, "HSK: max supply reached");
        _mint(to, amount);
    }
    
    /**
     * @dev Mint periodic emissions for miner incentives
     */
    function mintEmissions() external onlyOwner {
        require(block.timestamp >= lastEmissionTime + EMISSIONS_PERIOD, "HSK: emissions period not elapsed");
        
        uint256 currentSupply = totalSupply();
        uint256 emissionAmount = (currentSupply * EMISSIONS_RATE) / 10000;
        
        require(currentSupply + emissionAmount <= maxSupply, "HSK: would exceed max supply");
        
        _mint(owner(), emissionAmount);
        lastEmissionTime = block.timestamp;
        
        emit EmissionsMinted(emissionAmount);
    }
}
