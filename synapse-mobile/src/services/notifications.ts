/**
 * Notifications Service
 * Handles push notifications setup and management
 */

import messaging from '@react-native-firebase/messaging';
import PushNotification from 'react-native-push-notification';
import {Platform} from 'react-native';
import {Notification, NotificationType} from '@types/index';
import {store} from '@store/index';
import {addNotification} from '@store/slices/notificationsSlice';
import {updateNodeStatus} from '@store/slices/nodesSlice';
import {addReward} from '@store/slices/earningsSlice';
import {receiveMessage} from '@store/slices/chatSlice';
import {logService} from './logService';

class NotificationsService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Request permission
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        logService.info('Push notifications authorized');
        await this.getToken();
        this.setupNotificationChannels();
        this.setupMessageHandlers();
      } else {
        logService.warn('Push notifications not authorized');
      }

      this.initialized = true;
    } catch (error) {
      logService.error('Failed to initialize notifications', error);
      throw error;
    }
  }

  async getToken(): Promise<string | null> {
    try {
      const token = await messaging().getToken();
      logService.info('FCM Token obtained', {token: token.substring(0, 20) + '...'});
      // Send token to your backend
      return token;
    } catch (error) {
      logService.error('Failed to get FCM token', error);
      return null;
    }
  }

  private setupNotificationChannels(): void {
    if (Platform.OS === 'android') {
      PushNotification.createChannel(
        {
          channelId: 'synapse-general',
          channelName: 'General Notifications',
          importance: 4,
          vibrate: true,
        },
        created => logService.info(`Notification channel created: ${created}`),
      );

      PushNotification.createChannel(
        {
          channelId: 'synapse-alerts',
          channelName: 'Alerts',
          importance: 5,
          vibrate: true,
        },
        created => logService.info(`Alert channel created: ${created}`),
      );

      PushNotification.createChannel(
        {
          channelId: 'synapse-rewards',
          channelName: 'Rewards',
          importance: 4,
          vibrate: false,
        },
        created => logService.info(`Rewards channel created: ${created}`),
      );
    }
  }

  private setupMessageHandlers(): void {
    // Foreground messages
    messaging().onMessage(async remoteMessage => {
      logService.info('Foreground message received', remoteMessage);
      this.handleNotification(remoteMessage);
    });

    // Background messages
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      logService.info('Background message received', remoteMessage);
      this.handleNotification(remoteMessage);
    });

    // Notification opened app
    messaging().onNotificationOpenedApp(remoteMessage => {
      logService.info('Notification opened app', remoteMessage);
      this.handleNotificationOpened(remoteMessage);
    });

    // Check if app was opened from notification
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          logService.info('App opened from notification', remoteMessage);
          this.handleNotificationOpened(remoteMessage);
        }
      });

    // Token refresh
    messaging().onTokenRefresh(token => {
      logService.info('FCM Token refreshed', {token: token.substring(0, 20) + '...'});
      // Send new token to backend
    });
  }

  private handleNotification(remoteMessage: any): void {
    const notification = this.parseNotification(remoteMessage);

    // Add to store
    store.dispatch(addNotification(notification));

    // Handle specific notification types
    switch (notification.type) {
      case 'node_offline':
        store.dispatch(
          updateNodeStatus({
            nodeId: notification.data?.nodeId,
            status: 'offline',
          }),
        );
        break;
      case 'reward_received':
        store.dispatch(
          addReward({
            amount: notification.data?.amount,
            timestamp: notification.timestamp,
          }),
        );
        break;
      case 'chat_message':
        store.dispatch(
          receiveMessage({
            roomId: notification.data?.roomId,
            message: notification.data?.message,
          }),
        );
        break;
    }

    // Show local notification
    this.showLocalNotification(notification);
  }

  private handleNotificationOpened(remoteMessage: any): void {
    const data = remoteMessage.data;
    // Navigate based on notification type
    // This would integrate with navigation service
    logService.info('Handle notification opened', data);
  }

  private parseNotification(remoteMessage: any): Notification {
    const data = remoteMessage.data || {};
    return {
      id: remoteMessage.messageId || Date.now().toString(),
      title: remoteMessage.notification?.title || 'Synapse',
      body: remoteMessage.notification?.body || '',
      type: (data.type as NotificationType) || 'system_update',
      data,
      timestamp: new Date().toISOString(),
      isRead: false,
      priority: data.priority || 'normal',
    };
  }

  private showLocalNotification(notification: Notification): void {
    const channelId = this.getChannelIdForType(notification.type);

    PushNotification.localNotification({
      channelId,
      title: notification.title,
      message: notification.body,
      playSound: true,
      soundName: 'default',
      userInfo: notification.data,
    });
  }

  private getChannelIdForType(type: NotificationType): string {
    switch (type) {
      case 'node_offline':
      case 'emergency':
        return 'synapse-alerts';
      case 'reward_received':
        return 'synapse-rewards';
      default:
        return 'synapse-general';
    }
  }

  async subscribeToTopic(topic: string): Promise<void> {
    try {
      await messaging().subscribeToTopic(topic);
      logService.info(`Subscribed to topic: ${topic}`);
    } catch (error) {
      logService.error(`Failed to subscribe to topic ${topic}`, error);
    }
  }

  async unsubscribeFromTopic(topic: string): Promise<void> {
    try {
      await messaging().unsubscribeFromTopic(topic);
      logService.info(`Unsubscribed from topic: ${topic}`);
    } catch (error) {
      logService.error(`Failed to unsubscribe from topic ${topic}`, error);
    }
  }
}

export const notificationsService = new NotificationsService();
export const initializePushNotifications = () =>
  notificationsService.initialize();
