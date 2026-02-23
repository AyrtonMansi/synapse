/**
 * Settings Slice
 * Manages app settings and preferences
 */

import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {AppSettings, NotificationSettings, SecuritySettings, NodeSettings} from '@types/index';
import {settingsService} from '@services/settingsService';

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  error: string | null;
}

const initialState: SettingsState = {
  settings: {
    theme: 'system',
    language: 'en',
    notifications: {
      pushEnabled: true,
      emailEnabled: true,
      nodeOffline: true,
      rewards: true,
      chatMessages: true,
      announcements: true,
      soundEnabled: true,
      vibrationEnabled: true,
    },
    security: {
      biometricEnabled: false,
      autoLockTimeout: 300,
      requireAuthForTransactions: true,
      showBalances: true,
    },
    node: {
      autoRestart: true,
      maxMemoryUsage: 80,
      logLevel: 'info',
      autoUpdate: false,
      backupFrequency: 'weekly',
    },
  },
  isLoading: false,
  error: null,
};

// Async thunks
export const loadSettings = createAsyncThunk(
  'settings/load',
  async (_, {rejectWithValue}) => {
    try {
      const settings = await settingsService.getSettings();
      return settings;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const saveSettings = createAsyncThunk(
  'settings/save',
  async (settings: Partial<AppSettings>, {rejectWithValue}) => {
    try {
      await settingsService.saveSettings(settings);
      return settings;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.settings.theme = action.payload;
    },
    setLanguage: (state, action: PayloadAction<string>) => {
      state.settings.language = action.payload;
    },
    updateNotificationSettings: (
      state,
      action: PayloadAction<Partial<NotificationSettings>>,
    ) => {
      state.settings.notifications = {
        ...state.settings.notifications,
        ...action.payload,
      };
    },
    updateSecuritySettings: (
      state,
      action: PayloadAction<Partial<SecuritySettings>>,
    ) => {
      state.settings.security = {
        ...state.settings.security,
        ...action.payload,
      };
    },
    updateNodeSettings: (
      state,
      action: PayloadAction<Partial<NodeSettings>>,
    ) => {
      state.settings.node = {
        ...state.settings.node,
        ...action.payload,
      };
    },
    resetSettings: state => {
      state.settings = initialState.settings;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(loadSettings.pending, state => {
        state.isLoading = true;
      })
      .addCase(loadSettings.fulfilled, (state, action) => {
        state.settings = {...state.settings, ...action.payload};
        state.isLoading = false;
      })
      .addCase(loadSettings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(saveSettings.fulfilled, (state, action) => {
        state.settings = {...state.settings, ...action.payload};
      });
  },
});

export const {
  setTheme,
  setLanguage,
  updateNotificationSettings,
  updateSecuritySettings,
  updateNodeSettings,
  resetSettings,
} = settingsSlice.actions;

export default settingsSlice.reducer;
