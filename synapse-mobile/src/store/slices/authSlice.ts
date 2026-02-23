/**
 * Authentication Slice
 * Manages wallet connection and user authentication state
 */

import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {AuthState, User, WalletConnection} from '@types/index';
import {walletService} from '@services/walletService';
import {biometricService} from '@services/biometricService';
import {storageService} from '@services/storageService';

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  walletConnected: false,
  walletAddress: null,
  isBiometricPromptVisible: false,
  pendingBiometricAction: null,
};

// Async thunks
export const connectWallet = createAsyncThunk(
  'auth/connectWallet',
  async (_, {rejectWithValue}) => {
    try {
      const connection = await walletService.connect();
      return connection;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const disconnectWallet = createAsyncThunk(
  'auth/disconnectWallet',
  async (_, {rejectWithValue}) => {
    try {
      await walletService.disconnect();
      return true;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const authenticateWithBiometrics = createAsyncThunk(
  'auth/authenticateWithBiometrics',
  async (
    {promptMessage, onSuccess}: {promptMessage: string; onSuccess?: () => void},
    {rejectWithValue},
  ) => {
    try {
      const result = await biometricService.authenticate(promptMessage);
      if (result.success && onSuccess) {
        onSuccess();
      }
      return result;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const loadStoredAuth = createAsyncThunk(
  'auth/loadStoredAuth',
  async () => {
    const [user, walletAddress] = await Promise.all([
      storageService.getItem<User>('user'),
      storageService.getItem<string>('walletAddress'),
    ]);
    return {user, walletAddress};
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthenticated: (state, action: PayloadAction<boolean>) => {
      state.isAuthenticated = action.payload;
    },
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
    },
    setWalletConnected: (state, action: PayloadAction<boolean>) => {
      state.walletConnected = action.payload;
    },
    setWalletAddress: (state, action: PayloadAction<string | null>) => {
      state.walletAddress = action.payload;
    },
    showBiometricPrompt: (
      state,
      action: PayloadAction<(() => void) | undefined>,
    ) => {
      state.isBiometricPromptVisible = true;
      state.pendingBiometricAction = action.payload || null;
    },
    hideBiometricPrompt: state => {
      state.isBiometricPromptVisible = false;
      state.pendingBiometricAction = null;
    },
    clearAuth: state => {
      return initialState;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(connectWallet.fulfilled, (state, action) => {
        state.walletConnected = true;
        state.walletAddress = action.payload.address;
        state.isAuthenticated = true;
      })
      .addCase(disconnectWallet.fulfilled, state => {
        return initialState;
      })
      .addCase(loadStoredAuth.fulfilled, (state, action) => {
        if (action.payload.user && action.payload.walletAddress) {
          state.user = action.payload.user;
          state.walletAddress = action.payload.walletAddress;
          state.walletConnected = true;
          state.isAuthenticated = true;
        }
      })
      .addCase(authenticateWithBiometrics.fulfilled, (state, action) => {
        if (action.payload.success && state.pendingBiometricAction) {
          state.pendingBiometricAction();
        }
        state.isBiometricPromptVisible = false;
        state.pendingBiometricAction = null;
      });
  },
});

export const {
  setAuthenticated,
  setUser,
  setWalletConnected,
  setWalletAddress,
  showBiometricPrompt,
  hideBiometricPrompt,
  clearAuth,
} = authSlice.actions;

export default authSlice.reducer;
