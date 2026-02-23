/**
 * Wallet Connection Component
 * Handles wallet connection with proper validation and error handling
 */

import React, { useState, useEffect } from 'react';
import { useConnect, useDisconnect, useAccount, useChainId, useSwitchChain } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { mainnet, sepolia } from 'wagmi/chains';
import { getContractAddresses, areContractsDeployed } from '../utils/contracts';

interface WalletConnectProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
}

export const WalletConnect: React.FC<WalletConnectProps> = ({ 
  onConnect, 
  onDisconnect 
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { connect, connectors, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  useEffect(() => {
    if (isConnected && address) {
      // Validate chain has deployed contracts
      if (!areContractsDeployed(chainId)) {
        setError(`Contracts not deployed on chain ${chainId}. Please switch networks.`);
        return;
      }
      
      onConnect?.(address);
      setError(null);
    }
  }, [isConnected, address, chainId, onConnect]);

  useEffect(() => {
    if (connectError) {
      setError(connectError.message);
      setIsConnecting(false);
    }
  }, [connectError]);

  const handleConnect = async (connector: any) => {
    setIsConnecting(true);
    setError(null);
    
    try {
      await connect({ connector });
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    onDisconnect?.();
    setError(null);
  };

  const handleSwitchChain = async (targetChainId: number) => {
    try {
      await switchChain({ chainId: targetChainId });
    } catch (err: any) {
      setError(err.message || 'Failed to switch chain');
    }
  };

  // Get available chains
  const supportedChains = [
    { id: sepolia.id, name: 'Sepolia Testnet' },
    { id: mainnet.id, name: 'Ethereum Mainnet' },
    { id: 133, name: 'HashKey Chain' },
  ];

  if (isConnected && address) {
    return (
      <div className="wallet-connected">
        <div className="wallet-info">
          <span className="address">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
          <span className="chain-badge">
            Chain {chainId}
          </span>
          {areContractsDeployed(chainId) ? (
            <span className="status-badge deployed">✓ Contracts</span>
          ) : (
            <span className="status-badge not-deployed">⚠ No Contracts</span>
          )}
        </div>
        
        {!areContractsDeployed(chainId) && (
          <div className="chain-warning">
            <p>No contracts deployed on this chain.</p>
            <div className="chain-options">
              {supportedChains.map(chain => (
                chain.id !== chainId && (
                  <button
                    key={chain.id}
                    onClick={() => handleSwitchChain(chain.id)}
                    className="chain-button"
                  >
                    Switch to {chain.name}
                  </button>
                )
              ))}
            </div>
          </div>
        )}
        
        <button 
          onClick={handleDisconnect}
          className="disconnect-button"
        >
          Disconnect
        </button>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="wallet-connect">
      <h3>Connect Wallet</h3>
      
      <div className="connector-buttons">
        {connectors.map((connector) => (
          <button
            key={connector.uid}
            onClick={() => handleConnect(connector)}
            disabled={isConnecting || !connector.ready}
            className="connect-button"
          >
            {isConnecting ? 'Connecting...' : connector.name}
            {!connector.ready && ' (unsupported)'}
          </button>
        ))}
      </div>
      
      <div className="supported-chains">
        <p>Supported Networks:</p>
        <ul>
          {supportedChains.map(chain => (
            <li key={chain.id}>
              {chain.name} (Chain ID: {chain.id})
              {areContractsDeployed(chain.id) && ' ✓'}
            </li>
          ))}
        </ul>
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  );
};

export default WalletConnect;
