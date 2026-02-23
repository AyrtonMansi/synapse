/**
 * Sync Slice
 * Manages offline state and background synchronization
 */

import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {SyncState, PendingAction} from '@types/index';

const initialState: SyncState = {
  isOnline: true,
  lastSyncTime: null,
  pendingActions: [],
  syncStatus: 'idle',
};

// Async thunks
export const syncPendingActions = createAsyncThunk(
  'sync/pendingActions',
  async (_, {getState, rejectWithValue}) => {
    try {
      // Process pending actions when coming back online
      return true;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
    setSyncStatus: (
      state,
      action: PayloadAction<'idle' | 'syncing' | 'error'>,
    ) => {
      state.syncStatus = action.payload;
    },
    updateLastSyncTime: (state, action: PayloadAction<string>) => {
      state.lastSyncTime = action.payload;
    },
    addPendingAction: (state, action: PayloadAction<Omit<PendingAction, 'id' | 'timestamp' | 'retryCount'>>) => {
      const newAction: PendingAction = {
        ...action.payload,
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };
      state.pendingActions.push(newAction);
    },
    removePendingAction: (state, action: PayloadAction<string>) => {
      state.pendingActions = state.pendingActions.filter(
        a => a.id !== action.payload,
      );
    },
    incrementRetryCount: (state, action: PayloadAction<string>) => {
      const action = state.pendingActions.find(a => a.id === action.payload);
      if (action) {
        action.retryCount += 1;
      }
    },
    clearPendingActions: state => {
      state.pendingActions = [];
    },
  },
  extraReducers: builder => {
    builder
      .addCase(syncPendingActions.pending, state => {
        state.syncStatus = 'syncing';
      })
      .addCase(syncPendingActions.fulfilled, state => {
        state.syncStatus = 'idle';
        state.lastSyncTime = new Date().toISOString();
        state.pendingActions = [];
      })
      .addCase(syncPendingActions.rejected, state => {
        state.syncStatus = 'error';
      });
  },
});

export const {
  setOnlineStatus,
  setSyncStatus,
  updateLastSyncTime,
  addPendingAction,
  removePendingAction,
  incrementRetryCount,
  clearPendingActions,
} = syncSlice.actions;

export default syncSlice.reducer;
