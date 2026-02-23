/**
 * Background Sync Service
 * Handles background tasks and data synchronization
 */

import BackgroundFetch from 'react-native-background-fetch';
import NetInfo from '@react-native-community/netinfo';
import {store} from '@store/index';
import {setOnlineStatus, syncPendingActions} from '@store/slices/syncSlice';
import {fetchNodes} from '@store/slices/nodesSlice';
import {fetchEarnings} from '@store/slices/earningsSlice';
import {fetchChatRooms} from '@store/slices/chatSlice';
import {logService} from './logService';

class BackgroundSyncService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Configure background fetch
      await BackgroundFetch.configure(
        {
          minimumFetchInterval: 15, // 15 minutes
          stopOnTerminate: false,
          enableHeadless: true,
          startOnBoot: true,
          requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
        },
        this.onBackgroundFetch.bind(this),
        this.onBackgroundFetchTimeout.bind(this),
      );

      // Set up network listener
      NetInfo.addEventListener(state => {
        const isOnline = state.isConnected ?? false;
        store.dispatch(setOnlineStatus(isOnline));

        if (isOnline) {
          // Trigger sync when coming back online
          this.syncData();
        }
      });

      logService.info('Background sync service initialized');
      this.initialized = true;
    } catch (error) {
      logService.error('Failed to initialize background sync', error);
    }
  }

  private async onBackgroundFetch(taskId: string): Promise<void> {
    logService.info('Background fetch started', {taskId});

    try {
      await this.syncData();
      BackgroundFetch.finish(taskId);
    } catch (error) {
      logService.error('Background fetch failed', error);
      BackgroundFetch.finish(taskId);
    }
  }

  private onBackgroundFetchTimeout(taskId: string): void {
    logService.warn('Background fetch timeout', {taskId});
    BackgroundFetch.finish(taskId);
  }

  async syncData(): Promise<void> {
    const state = store.getState();
    const {walletAddress} = state.auth;

    if (!walletAddress) {
      logService.info('Skipping sync - no wallet connected');
      return;
    }

    try {
      // Sync pending actions
      if (state.sync.pendingActions.length > 0) {
        await store.dispatch(syncPendingActions());
      }

      // Sync nodes
      await store.dispatch(fetchNodes());

      // Sync earnings
      await store.dispatch(fetchEarnings({walletAddress}));

      // Sync chat rooms
      await store.dispatch(fetchChatRooms());

      logService.info('Background sync completed');
    } catch (error) {
      logService.error('Background sync failed', error);
    }
  }

  async scheduleImmediateSync(): Promise<void> {
    try {
      await BackgroundFetch.scheduleTask({
        taskId: 'com.synapse.immediate-sync',
        delay: 0,
        periodic: false,
        forceAlarmManager: true,
      });
    } catch (error) {
      logService.error('Failed to schedule immediate sync', error);
    }
  }

  async start(): Promise<void> {
    try {
      const status = await BackgroundFetch.start();
      logService.info('Background fetch started', {status});
    } catch (error) {
      logService.error('Failed to start background fetch', error);
    }
  }

  async stop(): Promise<void> {
    try {
      await BackgroundFetch.stop();
      logService.info('Background fetch stopped');
    } catch (error) {
      logService.error('Failed to stop background fetch', error);
    }
  }

  getStatus(): Promise<number> {
    return BackgroundFetch.status();
  }
}

export const backgroundSyncService = new BackgroundSyncService();
export const initializeBackgroundSync = () =>
  backgroundSyncService.initialize();
