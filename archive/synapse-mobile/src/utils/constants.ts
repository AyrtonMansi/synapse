/**
 * Constants
 */

export const APP_NAME = 'Synapse Mobile';
export const APP_VERSION = '1.0.0';

// API Endpoints
export const API = {
  BASE_URL: 'https://api.synapse.network/v1',
  WS_URL: 'wss://ws.synapse.network',
};

// Colors
export const COLORS = {
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  secondary: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  success: '#10B981',
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
};

// Node Status Colors
export const NODE_STATUS_COLORS = {
  online: '#10B981',
  offline: '#EF4444',
  syncing: '#F59E0B',
  error: '#DC2626',
  maintenance: '#6B7280',
};

// Notification Types
export const NOTIFICATION_TYPES = {
  NODE_OFFLINE: 'node_offline',
  NODE_SYNCED: 'node_synced',
  REWARD_RECEIVED: 'reward_received',
  SYSTEM_UPDATE: 'system_update',
  CHAT_MESSAGE: 'chat_message',
  FORUM_REPLY: 'forum_reply',
  ANNOUNCEMENT: 'announcement',
  EMERGENCY: 'emergency',
};

// Storage Keys
export const STORAGE_KEYS = {
  AUTH: '@auth',
  SETTINGS: '@settings',
  WALLET: '@wallet',
  NODES: '@nodes',
  EARNINGS: '@earnings',
  NOTIFICATIONS: '@notifications',
};

// Time constants
export const TIME = {
  SECOND: 1000,
  MINUTE: 60000,
  HOUR: 3600000,
  DAY: 86400000,
  WEEK: 604800000,
};

// Chart config
export const CHART_CONFIG = {
  backgroundColor: '#FFFFFF',
  backgroundGradientFrom: '#FFFFFF',
  backgroundGradientTo: '#FFFFFF',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
  style: {
    borderRadius: 16,
  },
  propsForDots: {
    r: '4',
    strokeWidth: '2',
    stroke: '#6366F1',
  },
};
