/**
 * Wallet Service
 * Handles wallet connections via WalletConnect v2
 */

import {Core} from '@walletconnect/core';
import {Web3Wallet} from '@walletconnect/web3wallet';
import EncryptedStorage from 'react-native-encrypted-storage';
import {WalletConnection, WalletSession} from '@types/index';
import {logService} from './logService';

const PROJECT_ID = 'YOUR_WALLETCONNECT_PROJECT_ID'; // Replace with actual project ID

class WalletService {
  private web3wallet: any = null;
  private core: any = null;
  private activeSession: any = null;

  async initialize() {
    try {
      this.core = new Core({
        projectId: PROJECT_ID,
      });

      this.web3wallet = await Web3Wallet.init({
        core: this.core,
        metadata: {
          name: 'Synapse Mobile',
          description: 'Synapse Network Node Management',
          url: 'https://synapse.network',
          icons: ['https://synapse.network/icon.png'],
        },
      });

      // Listen for session events
      this.web3wallet.on('session_proposal', this.onSessionProposal.bind(this));
      this.web3wallet.on('session_request', this.onSessionRequest.bind(this));
      this.web3wallet.on('session_delete', this.onSessionDelete.bind(this));

      logService.info('Wallet service initialized');
    } catch (error) {
      logService.error('Failed to initialize wallet service', error);
      throw error;
    }
  }

  async connect(uri?: string): Promise<WalletConnection> {
    try {
      if (!this.web3wallet) {
        await this.initialize();
      }

      if (uri) {
        // Pair with existing session
        await this.web3wallet.core.pairing.pair({uri});
      }

      // Get active sessions
      const sessions = Object.values(this.web3wallet.getActiveSessions());
      if (sessions.length > 0) {
        this.activeSession = sessions[0];
        const address = this.getAddressFromSession(this.activeSession);
        return {
          address,
          chainId: this.activeSession.namespaces.eip155.chains[0].split(':')[1],
          provider: 'walletconnect',
          sessionTopic: this.activeSession.topic,
        };
      }

      // If no session exists, we need to show QR code for pairing
      throw new Error('No active session found. Please scan QR code to connect.');
    } catch (error) {
      logService.error('Wallet connection failed', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.activeSession) {
        await this.web3wallet.disconnectSession({
          topic: this.activeSession.topic,
          reason: {code: 6000, message: 'User disconnected'},
        });
        this.activeSession = null;
      }

      // Clear stored wallet data
      await EncryptedStorage.removeItem('wallet_session');
      logService.info('Wallet disconnected');
    } catch (error) {
      logService.error('Failed to disconnect wallet', error);
      throw error;
    }
  }

  async getBalance(address: string): Promise<string> {
    try {
      // Implementation would use ethers.js or similar
      // to fetch balance from blockchain
      return '0';
    } catch (error) {
      logService.error('Failed to get balance', error);
      throw error;
    }
  }

  async signMessage(message: string): Promise<string> {
    if (!this.activeSession) {
      throw new Error('No active session');
    }

    const address = this.getAddressFromSession(this.activeSession);
    const chainId = this.activeSession.namespaces.eip155.chains[0];

    const request = {
      topic: this.activeSession.topic,
      chainId,
      request: {
        method: 'personal_sign',
        params: [message, address],
      },
    };

    return await this.web3wallet.request(request);
  }

  async sendTransaction(tx: any): Promise<string> {
    if (!this.activeSession) {
      throw new Error('No active session');
    }

    const chainId = this.activeSession.namespaces.eip155.chains[0];

    const request = {
      topic: this.activeSession.topic,
      chainId,
      request: {
        method: 'eth_sendTransaction',
        params: [tx],
      },
    };

    return await this.web3wallet.request(request);
  }

  private async onSessionProposal(proposal: any) {
    logService.info('Session proposal received', proposal);
    // In a real app, show UI to user to approve/reject
  }

  private async onSessionRequest(request: any) {
    logService.info('Session request received', request);
    // Handle session requests
  }

  private async onSessionDelete(event: any) {
    logService.info('Session deleted', event);
    this.activeSession = null;
  }

  private getAddressFromSession(session: any): string {
    const accounts = session.namespaces.eip155.accounts;
    if (accounts && accounts.length > 0) {
      return accounts[0].split(':')[2];
    }
    throw new Error('No accounts found in session');
  }

  getActiveSession(): WalletSession | null {
    if (!this.activeSession) return null;
    return {
      topic: this.activeSession.topic,
      peer: this.activeSession.peer.metadata,
      namespaces: this.activeSession.namespaces,
    };
  }

  isConnected(): boolean {
    return !!this.activeSession;
  }
}

export const walletService = new WalletService();
