/**
 * React Native Config
 * Environment configuration
 */

import Config from 'react-native-config';

export const ENV = {
  API_URL: Config.API_URL || 'https://api.synapse.network/v1',
  WS_URL: Config.WS_URL || 'wss://ws.synapse.network',
  WALLET_CONNECT_PROJECT_ID: Config.WALLET_CONNECT_PROJECT_ID || '',
  ENVIRONMENT: Config.ENVIRONMENT || 'development',
  SENTRY_DSN: Config.SENTRY_DSN || '',
};

export default ENV;
