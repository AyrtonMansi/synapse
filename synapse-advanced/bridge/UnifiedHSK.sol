// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title UnifiedHSK
 * @dev Unified HSK token implementation for cross-chain compatibility
 * Implements ERC20Votes for governance and ERC20Permit for gasless approvals
 */
contract UnifiedHSK is ERC20Votes, ERC20Permit, AccessControl {
    
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    
    // Cross-chain metadata
    struct ChainSupply {
        uint256 totalSupply;
        uint256 bridgedIn;
        uint256 bridgedOut;
        bool active;
    }
    
    mapping(uint256 => ChainSupply) public chainSupplies;
    mapping(address => bool) public blacklisted;
    
    uint256 public maxSupply = 1_000_000_000 * 10**18; // 1 billion tokens
    uint256 public constant INITIAL_SUPPLY = 100_000_000 * 10**18; // 100 million
    
    // Supported chains
    uint256[] public supportedChains;
    
    // Events
    event TokensBridgedIn(
        uint256 indexed sourceChain,
        address indexed recipient,
        uint256 amount
    );
    
    event TokensBridgedOut(
        uint256 indexed targetChain,
        address indexed sender,
        uint256 amount
    );
    
    event ChainAdded(uint256 indexed chainId);
    event ChainRemoved(uint256 indexed chainId);
    event BlacklistUpdated(address indexed account, bool blacklisted);
    
    modifier notBlacklisted(address _account) {
        require(!blacklisted[_account], "Account blacklisted");
        _;
    }
    
    constructor() 
        ERC20("HyperSynapse", "HSK") 
        ERC20Permit("HyperSynapse")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        
        // Mint initial supply
        _mint(msg.sender, INITIAL_SUPPLY);
        
        // Initialize supported chains - Ethereum <> Arbitrum only
        _addChain(1);      // Ethereum Mainnet
        _addChain(42161);  // Arbitrum One
    }
    
    /**
     * @dev Mint tokens (for bridge in or initial distribution)
     */
    function mint(
        address _to,
        uint256 _amount,
        uint256 _sourceChain
    ) external onlyRole(MINTER_ROLE) notBlacklisted(_to) {
        require(totalSupply() + _amount <= maxSupply, "Exceeds max supply");
        
        _mint(_to, _amount);
        
        // Update chain supply tracking
        ChainSupply storage supply = chainSupplies[_sourceChain];
        supply.totalSupply += _amount;
        supply.bridgedIn += _amount;
        
        emit TokensBridgedIn(_sourceChain, _to, _amount);
    }
    
    /**
     * @dev Burn tokens (for bridge out)
     */
    function burn(
        address _from,
        uint256 _amount,
        uint256 _targetChain
    ) external onlyRole(BURNER_ROLE) {
        _burn(_from, _amount);
        
        // Update chain supply tracking
        ChainSupply storage supply = chainSupplies[_targetChain];
        supply.totalSupply -= _amount;
        supply.bridgedOut += _amount;
        
        emit TokensBridgedOut(_targetChain, _from, _amount);
    }
    
    /**
     * @dev Bridge-specific transfer that bypasses some checks
     */
    function bridgeTransfer(
        address _from,
        address _to,
        uint256 _amount,
        uint256 _targetChain
    ) external onlyRole(BRIDGE_ROLE) {
        _transfer(_from, _to, _amount);
        
        ChainSupply storage supply = chainSupplies[_targetChain];
        supply.bridgedOut += _amount;
        
        emit TokensBridgedOut(_targetChain, _from, _amount);
    }
    
    /**
     * @dev Override transfer to check blacklist
     */
    function transfer(address _to, uint256 _amount) 
        public 
        override 
        notBlacklisted(msg.sender) 
        notBlacklisted(_to) 
        returns (bool) 
    {
        return super.transfer(_to, _amount);
    }
    
    function transferFrom(
        address _from,
        address _to,
        uint256 _amount
    ) 
        public 
        override 
        notBlacklisted(_from) 
        notBlacklisted(_to) 
        returns (bool) 
    {
        return super.transferFrom(_from, _to, _amount);
    }
    
    /**
     * @dev Admin functions
     */
    function addChain(uint256 _chainId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _addChain(_chainId);
    }
    
    function _addChain(uint256 _chainId) internal {
        if (!chainSupplies[_chainId].active) {
            chainSupplies[_chainId] = ChainSupply({
                totalSupply: 0,
                bridgedIn: 0,
                bridgedOut: 0,
                active: true
            });
            supportedChains.push(_chainId);
            emit ChainAdded(_chainId);
        }
    }
    
    function removeChain(uint256 _chainId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        chainSupplies[_chainId].active = false;
        emit ChainRemoved(_chainId);
    }
    
    function setBlacklist(address _account, bool _blacklisted) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        blacklisted[_account] = _blacklisted;
        emit BlacklistUpdated(_account, _blacklisted);
    }
    
    function updateMaxSupply(uint256 _newMaxSupply) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(_newMaxSupply >= totalSupply(), "Below current supply");
        maxSupply = _newMaxSupply;
    }
    
    /**
     * @dev View functions
     */
    function getChainSupply(uint256 _chainId) 
        external 
        view 
        returns (ChainSupply memory) 
    {
        return chainSupplies[_chainId];
    }
    
    function getSupportedChains() external view returns (uint256[] memory) {
        return supportedChains;
    }
    
    function getCirculatingSupply() external view returns (uint256) {
        return totalSupply();
    }
    
    /**
     * @dev Override required functions for ERC20Votes
     */
    function _afterTokenTransfer(
        address _from,
        address _to,
        uint256 _amount
    ) internal override(ERC20, ERC20Votes) {
        super._afterTokenTransfer(_from, _to, _amount);
    }
    
    function _mint(address _to, uint256 _amount) internal override(ERC20, ERC20Votes) {
        super._mint(_to, _amount);
    }
    
    function _burn(address _account, uint256 _amount) internal override(ERC20, ERC20Votes) {
        super._burn(_account, _amount);
    }
}
