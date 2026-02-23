/**
 * Enhanced Type Definitions for Synapse Mobile App
 * 
 * @module synapse-mobile/types
 * @description Type-safe definitions for mobile application
 * @version 1.1.0
 */

import type { StackScreenProps } from '@react-navigation/stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

// ============================================================================
// BRANDED TYPES (Nominal Typing)
// ============================================================================

/**
 * Branded types for type-safe IDs
 * Prevents mixing different ID types
 */
declare const __brand: unique symbol;
type Brand<B> = { [__brand]: B };
export type Branded<T, B> = T & Brand<B>;

/** User ID - unique identifier for users */
export type UserId = Branded<string, 'UserId'>;

/** Node ID - unique identifier for nodes */
export type NodeId = Branded<string, 'NodeId'>;

/** Wallet Address - Ethereum address */
export type WalletAddress = Branded<string, 'WalletAddress'>;

/** Transaction Hash - blockchain transaction identifier */
export type TransactionHash = Branded<string, 'TransactionHash'>;

/** Chat Message ID */
export type MessageId = Branded<string, 'MessageId'>;

/** Notification ID */
export type NotificationId = Branded<string, 'NotificationId'>;

// ============================================================================
// USER & AUTHENTICATION
// ============================================================================

/**
 * User account information
 */
export interface User {
  /** Unique user identifier */
  readonly id: UserId;
  /** Connected wallet address */
  readonly walletAddress: WalletAddress;
  /** Optional email for notifications */
  readonly email?: string;
  /** Display username */
  readonly username?: string;
  /** Avatar URL */
  readonly avatar?: string;
  /** Account creation timestamp */
  readonly createdAt: string;
  /** Whether biometric auth is enabled */
  readonly isBiometricEnabled: boolean;
  /** Preferred language code */
  readonly preferredLanguage: string;
}

/**
 * Authentication state
 */
export interface AuthState {
  /** Whether user is authenticated */
  readonly isAuthenticated: boolean;
  /** Current user or null */
  readonly user: User | null;
  /** Whether wallet is connected */
  readonly walletConnected: boolean;
  /** Connected wallet address */
  readonly walletAddress: WalletAddress | null;
  /** Biometric prompt visibility */
  readonly isBiometricPromptVisible: boolean;
  /** Pending action after biometric auth */
  readonly pendingBiometricAction: (() => void) | null;
}

// ============================================================================
// WALLET
// ============================================================================

/**
 * Wallet connection details
 */
export interface WalletConnection {
  /** Wallet address */
  readonly address: WalletAddress;
  /** Connected chain ID */
  readonly chainId: number;
  /** Wallet provider name */
  readonly provider: 'walletconnect' | 'metamask' | 'rainbow' | 'trust' | string;
  /** Session topic for WalletConnect */
  readonly sessionTopic?: string;
}

/**
 * Wallet session information
 */
export interface WalletSession {
  /** Session topic identifier */
  readonly topic: string;
  /** Connected peer information */
  readonly peer: {
    readonly name: string;
    readonly url: string;
    readonly icon: string;
  };
  /** Session namespaces */
  readonly namespaces: Record<string, unknown>;
}

// ============================================================================
// NODE MANAGEMENT
// ============================================================================

/**
 * Node operational status
 */
export type NodeStatus = 
  | 'online'      // Node is operational
  | 'offline'     // Node is disconnected
  | 'syncing'     // Node is synchronizing
  | 'error'       // Node has an error
  | 'maintenance'; // Node is under maintenance

/**
 * Node type classification
 */
export type NodeType = 
  | 'validator'   // Validation node
  | 'full'        // Full node
  | 'light'       // Light client
  | 'archive';    // Archive node

/**
 * Geographic location
 */
export interface GeoLocation {
  readonly latitude: number;
  readonly longitude: number;
  readonly city: string;
  readonly country: string;
  readonly region?: string;
}

/**
 * Node hardware specifications
 */
export interface NodeSpecs {
  readonly cpu: string;
  readonly cores: number;
  readonly ram: number; // GB
  readonly storage: number; // GB
  readonly gpu?: string;
}

/**
 * Node information
 */
export interface Node {
  /** Unique node identifier */
  readonly id: NodeId;
  /** Display name */
  readonly name: string;
  /** Current status */
  readonly status: NodeStatus;
  /** Node type */
  readonly type: NodeType;
  /** Software version */
  readonly version: string;
  /** Uptime percentage */
  readonly uptime: number;
  /** Current CPU usage (%) */
  readonly cpuUsage: number;
  /** Current memory usage (%) */
  readonly memoryUsage: number;
  /** Current disk usage (%) */
  readonly diskUsage: number;
  /** Network inbound traffic (bytes) */
  readonly networkIn: number;
  /** Network outbound traffic (bytes) */
  readonly networkOut: number;
  /** Number of connected peers */
  readonly peersConnected: number;
  /** Last synced block number */
  readonly lastSyncedBlock: number;
  /** Total blocks in chain */
  readonly totalBlocks: number;
  /** Geographic location */
  readonly location?: GeoLocation;
  /** Accumulated rewards */
  readonly rewards: number;
  /** Node specifications */
  readonly specs?: NodeSpecs;
  /** Creation timestamp */
  readonly createdAt: string;
  /** Last update timestamp */
  readonly updatedAt: string;
}

// ============================================================================
// EARNINGS
// ============================================================================

/**
 * Daily earning record
 */
export interface DailyEarning {
  /** Date in ISO format */
  readonly date: string;
  /** Amount earned */
  readonly amount: number;
  /** Number of active nodes */
  readonly nodes: number;
}

/**
 * Monthly earning summary
 */
export interface MonthlyEarning {
  /** Month identifier (YYYY-MM) */
  readonly month: string;
  /** Total amount earned */
  readonly amount: number;
  /** Growth percentage from previous month */
  readonly growth: number;
}

/**
 * Complete earnings data
 */
export interface EarningsData {
  /** Total lifetime earnings */
  readonly totalEarned: number;
  /** Unclaimed rewards */
  readonly pendingRewards: number;
  /** Already claimed rewards */
  readonly claimedRewards: number;
  /** Daily breakdown */
  readonly dailyEarnings: readonly DailyEarning[];
  /** Monthly breakdown */
  readonly monthlyEarnings: readonly MonthlyEarning[];
  /** Currency code */
  readonly currency: string;
}

// ============================================================================
// CHAT & SOCIAL
// ============================================================================

/**
 * Message content type
 */
export type MessageType = 'text' | 'image' | 'file' | 'system' | 'announcement';

/**
 * Chat message
 */
export interface ChatMessage {
  /** Unique message identifier */
  readonly id: MessageId;
  /** Sender user ID */
  readonly senderId: UserId;
  /** Sender display name */
  readonly senderName: string;
  /** Sender avatar URL */
  readonly senderAvatar?: string;
  /** Message content */
  readonly content: string;
  /** Message type */
  readonly type: MessageType;
  /** Timestamp */
  readonly timestamp: string;
  /** Whether message has been read */
  readonly isRead: boolean;
  /** ID of message being replied to */
  readonly replyTo?: MessageId;
  /** Attached files (if any) */
  readonly attachments?: readonly Attachment[];
}

/**
 * File attachment
 */
export interface Attachment {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly size: number;
  readonly mimeType: string;
}

/**
 * Chat room type
 */
export type ChatRoomType = 'operator' | 'community' | 'support' | 'announcement';

/**
 * Chat room information
 */
export interface ChatRoom {
  /** Room identifier */
  readonly id: string;
  /** Room name */
  readonly name: string;
  /** Room description */
  readonly description: string;
  /** Room type */
  readonly type: ChatRoomType;
  /** Number of participants */
  readonly participants: number;
  /** Most recent message */
  readonly lastMessage?: ChatMessage;
  /** Unread message count */
  readonly unreadCount: number;
  /** Whether notifications are muted */
  readonly isMuted: boolean;
  /** Room icon URL */
  readonly icon?: string;
  /** Whether user is admin */
  readonly isAdmin?: boolean;
}

/**
 * Forum topic
 */
export interface ForumTopic {
  readonly id: string;
  readonly title: string;
  readonly author: string;
  readonly authorAvatar?: string;
  readonly content: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly replies: number;
  readonly views: number;
  readonly lastActivity: string;
  readonly isPinned: boolean;
  readonly isLocked: boolean;
}

/**
 * Forum reply
 */
export interface ForumReply {
  readonly id: string;
  readonly topicId: string;
  readonly author: string;
  readonly authorAvatar?: string;
  readonly content: string;
  readonly timestamp: string;
  readonly likes: number;
  readonly isAccepted: boolean;
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

/**
 * Notification priority level
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Notification type
 */
export type NotificationType =
  | 'node_offline'
  | 'node_synced'
  | 'node_error'
  | 'reward_received'
  | 'system_update'
  | 'maintenance_scheduled'
  | 'chat_message'
  | 'forum_reply'
  | 'announcement'
  | 'emergency';

/**
 * Push notification
 */
export interface Notification {
  /** Unique notification ID */
  readonly id: NotificationId;
  /** Notification title */
  readonly title: string;
  /** Notification body */
  readonly body: string;
  /** Notification type */
  readonly type: NotificationType;
  /** Additional data */
  readonly data?: Record<string, unknown>;
  /** Timestamp */
  readonly timestamp: string;
  /** Whether notification has been read */
  readonly isRead: boolean;
  /** Priority level */
  readonly priority: NotificationPriority;
}

// ============================================================================
// SETTINGS
// ============================================================================

/**
 * Theme preference
 */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Log level
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Backup frequency
 */
export type BackupFrequency = 'daily' | 'weekly' | 'monthly';

/**
 * Notification settings
 */
export interface NotificationSettings {
  /** Master push notification toggle */
  readonly pushEnabled: boolean;
  /** Email notification toggle */
  readonly emailEnabled: boolean;
  /** Node offline alerts */
  readonly nodeOffline: boolean;
  /** Reward notifications */
  readonly rewards: boolean;
  /** Chat message alerts */
  readonly chatMessages: boolean;
  /** Announcement alerts */
  readonly announcements: boolean;
  /** Sound enabled */
  readonly soundEnabled: boolean;
  /** Vibration enabled */
  readonly vibrationEnabled: boolean;
}

/**
 * Security settings
 */
export interface SecuritySettings {
  /** Biometric authentication enabled */
  readonly biometricEnabled: boolean;
  /** Auto-lock timeout in minutes */
  readonly autoLockTimeout: number;
  /** Require auth for transactions */
  readonly requireAuthForTransactions: boolean;
  /** Show/hide balance amounts */
  readonly showBalances: boolean;
}

/**
 * Node-specific settings
 */
export interface NodeSettings {
  /** Auto-restart on crash */
  readonly autoRestart: boolean;
  /** Maximum memory usage threshold (%) */
  readonly maxMemoryUsage: number;
  /** Log verbosity level */
  readonly logLevel: LogLevel;
  /** Auto-update software */
  readonly autoUpdate: boolean;
  /** Backup frequency */
  readonly backupFrequency: BackupFrequency;
}

/**
 * Complete app settings
 */
export interface AppSettings {
  /** UI theme */
  readonly theme: Theme;
  /** Language code */
  readonly language: string;
  /** Notification preferences */
  readonly notifications: NotificationSettings;
  /** Security preferences */
  readonly security: SecuritySettings;
  /** Node preferences */
  readonly node: NodeSettings;
}

// ============================================================================
// LOGS
// ============================================================================

/**
 * Log entry
 */
export interface LogEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly source: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Node logs collection
 */
export interface NodeLogs {
  readonly nodeId: NodeId;
  readonly entries: readonly LogEntry[];
  readonly totalCount: number;
  readonly hasMore: boolean;
}

// ============================================================================
// API & SYNC
// ============================================================================

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: ApiError;
  readonly meta?: ApiMeta;
}

/**
 * API error details
 */
export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

/**
 * Response metadata
 */
export interface ApiMeta {
  readonly page?: number;
  readonly limit?: number;
  readonly total?: number;
  readonly hasMore?: boolean;
  readonly requestId?: string;
  readonly timestamp?: string;
}

/**
 * Deep link data
 */
export interface DeepLinkData {
  readonly path: string;
  readonly params: Record<string, string>;
  readonly query: Record<string, string>;
}

/**
 * Sync state
 */
export type SyncStatus = 'idle' | 'syncing' | 'error';

/**
 * Pending action for offline queue
 */
export interface PendingAction {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
  readonly timestamp: string;
  readonly retryCount: number;
}

/**
 * Synchronization state
 */
export interface SyncState {
  readonly isOnline: boolean;
  readonly lastSyncTime: string | null;
  readonly pendingActions: readonly PendingAction[];
  readonly syncStatus: SyncStatus;
}

// ============================================================================
// NAVIGATION
// ============================================================================

/**
 * Root stack navigation parameters
 */
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  WalletConnect: { uri?: string };
  NodeDetails: { nodeId: NodeId };
  ChatRoom: { roomId: string; roomName: string };
  ForumTopic: { topicId: string };
  Settings: undefined;
  Logs: { nodeId: NodeId };
  EarningsDetails: undefined;
};

/**
 * Main tab navigation parameters
 */
export type MainTabParamList = {
  Dashboard: undefined;
  Nodes: undefined;
  Earnings: undefined;
  Social: undefined;
  Profile: undefined;
};

/**
 * Type-safe navigation props
 */
export type RootStackScreenProps<T extends keyof RootStackParamList> = 
  StackScreenProps<RootStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = 
  BottomTabScreenProps<MainTabParamList, T>;

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Deep readonly type
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Nullable properties
 */
export type Nullable<T> = { [P in keyof T]: T[P] | null };

/**
 * Partial except specified keys
 */
export type PartialExcept<T, K extends keyof T> = Partial<Omit<T, K>> & Pick<T, K>;

/**
 * Async function return type
 */
export type AsyncReturnType<T extends (...args: unknown[]) => Promise<unknown>> = 
  T extends (...args: unknown[]) => Promise<infer R> ? R : never;
