/**
 * Notifications Slice
 * Manages push notifications and in-app notifications
 */

import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {Notification, NotificationType} from '@types/index';

interface NotificationsState {
  items: Notification[];
  unreadCount: number;
  isLoading: boolean;
}

const initialState: NotificationsState = {
  items: [],
  unreadCount: 0,
  isLoading: false,
};

// Async thunks
export const fetchNotifications = createAsyncThunk(
  'notifications/fetch',
  async (_, {rejectWithValue}) => {
    try {
      // In a real app, this would fetch from an API
      return [] as Notification[];
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification: (state, action: PayloadAction<Notification>) => {
      state.items.unshift(action.payload);
      if (!action.payload.isRead) {
        state.unreadCount += 1;
      }
      // Keep only last 100 notifications
      if (state.items.length > 100) {
        state.items = state.items.slice(0, 100);
      }
    },
    markAsRead: (state, action: PayloadAction<string>) => {
      const notification = state.items.find(n => n.id === action.payload);
      if (notification && !notification.isRead) {
        notification.isRead = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    markAllAsRead: state => {
      state.items.forEach(n => (n.isRead = true));
      state.unreadCount = 0;
    },
    clearNotification: (state, action: PayloadAction<string>) => {
      const index = state.items.findIndex(n => n.id === action.payload);
      if (index !== -1) {
        if (!state.items[index].isRead) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
        state.items.splice(index, 1);
      }
    },
    clearAll: state => {
      state.items = [];
      state.unreadCount = 0;
    },
    clearByType: (state, action: PayloadAction<NotificationType>) => {
      state.items = state.items.filter(n => n.type !== action.payload);
      state.unreadCount = state.items.filter(n => !n.isRead).length;
    },
  },
});

export const {
  addNotification,
  markAsRead,
  markAllAsRead,
  clearNotification,
  clearAll,
  clearByType,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;
