/**
 * Deep Linking Service
 * Handles deep links and universal links
 */

import {Linking} from 'react-native';
import {DeepLinkData} from '@types/index';
import {logService} from './logService';

const DEEP_LINK_PREFIXES = [
  'synapse://',
  'https://app.synapse.network',
  'https://synapse.network/app',
];

class DeepLinkService {
  private handlers: Map<string, (data: DeepLinkData) => void> = new Map();

  async initialize(): Promise<void> {
    try {
      // Handle initial deep link (app opened from link)
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        this.handleDeepLink(initialUrl);
      }

      // Listen for deep links while app is running
      Linking.addEventListener('url', ({url}) => {
        this.handleDeepLink(url);
      });

      logService.info('Deep linking service initialized');
    } catch (error) {
      logService.error('Failed to initialize deep linking', error);
    }
  }

  private handleDeepLink(url: string): void {
    try {
      logService.info('Deep link received', {url});
      const data = this.parseDeepLink(url);

      if (data) {
        // Find handler for the path
        const handler = this.handlers.get(data.path);
        if (handler) {
          handler(data);
        } else {
          // Default navigation
          this.navigateToDefault(data);
        }
      }
    } catch (error) {
      logService.error('Failed to handle deep link', error);
    }
  }

  private parseDeepLink(url: string): DeepLinkData | null {
    let path = '';
    let params: Record<string, string> = {};
    let query: Record<string, string> = {};

    try {
      // Handle custom scheme
      if (url.startsWith('synapse://')) {
        const urlParts = url.replace('synapse://', '').split('?');
        const pathAndParams = urlParts[0].split('/');
        path = pathAndParams[0] || 'dashboard';

        // Parse path params
        for (let i = 1; i < pathAndParams.length; i += 2) {
          if (pathAndParams[i + 1]) {
            params[pathAndParams[i]] = decodeURIComponent(pathAndParams[i + 1]);
          }
        }

        // Parse query params
        if (urlParts[1]) {
          query = this.parseQueryString(urlParts[1]);
        }
      }
      // Handle universal links
      else if (url.includes('synapse.network')) {
        const urlObj = new URL(url);
        path = urlObj.pathname.replace('/app/', '').replace('/app', '') || 'dashboard';
        query = this.parseQueryString(urlObj.search.substring(1));
      }

      return {path, params, query};
    } catch (error) {
      logService.error('Failed to parse deep link', error);
      return null;
    }
  }

  private parseQueryString(queryString: string): Record<string, string> {
    const params: Record<string, string> = {};
    const pairs = queryString.split('&');

    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key) {
        params[decodeURIComponent(key)] = decodeURIComponent(value || '');
      }
    }

    return params;
  }

  private navigateToDefault(data: DeepLinkData): void {
    // Default navigation logic
    logService.info('Default navigation', {path: data.path, params: data.params});
  }

  registerHandler(path: string, handler: (data: DeepLinkData) => void): void {
    this.handlers.set(path, handler);
  }

  unregisterHandler(path: string): void {
    this.handlers.delete(path);
  }

  // Helper methods for common deep links
  handleWalletConnect(uri: string): void {
    logService.info('WalletConnect URI received', {uri: uri.substring(0, 50) + '...'});
    // Navigate to wallet connect screen
  }

  handleNodeInvite(nodeId: string, inviteCode: string): void {
    logService.info('Node invite received', {nodeId, inviteCode});
    // Navigate to node setup with invite
  }

  handleRewardClaim(claimId: string): void {
    logService.info('Reward claim received', {claimId});
    // Navigate to earnings screen
  }

  handleChatInvite(roomId: string, inviteToken: string): void {
    logService.info('Chat invite received', {roomId});
    // Navigate to chat room
  }
}

export const deepLinkService = new DeepLinkService();
export const initializeDeepLinks = () => deepLinkService.initialize();
