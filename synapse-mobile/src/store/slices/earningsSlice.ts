/**
 * Earnings Slice
 * Manages earnings data and rewards tracking
 */

import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {EarningsData, DailyEarning, MonthlyEarning} from '@types/index';
import {earningsService} from '@services/earningsService';

interface EarningsState {
  data: EarningsData | null;
  isLoading: boolean;
  error: string | null;
  claimInProgress: boolean;
}

const initialState: EarningsState = {
  data: null,
  isLoading: false,
  error: null,
  claimInProgress: false,
};

// Async thunks
export const fetchEarnings = createAsyncThunk(
  'earnings/fetchEarnings',
  async (
    {walletAddress, currency}: {walletAddress: string; currency?: string},
    {rejectWithValue},
  ) => {
    try {
      const earnings = await earningsService.getEarnings(
        walletAddress,
        currency,
      );
      return earnings;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const fetchDailyEarnings = createAsyncThunk(
  'earnings/fetchDaily',
  async (
    {
      walletAddress,
      days,
    }: {walletAddress: string; days?: number},
    {rejectWithValue},
  ) => {
    try {
      const earnings = await earningsService.getDailyEarnings(
        walletAddress,
        days,
      );
      return earnings;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const fetchMonthlyEarnings = createAsyncThunk(
  'earnings/fetchMonthly',
  async (
    {
      walletAddress,
      months,
    }: {walletAddress: string; months?: number},
    {rejectWithValue},
  ) => {
    try {
      const earnings = await earningsService.getMonthlyEarnings(
        walletAddress,
        months,
      );
      return earnings;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const claimRewards = createAsyncThunk(
  'earnings/claimRewards',
  async (
    {walletAddress, amount}: {walletAddress: string; amount?: number},
    {rejectWithValue},
  ) => {
    try {
      const result = await earningsService.claimRewards(walletAddress, amount);
      return result;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

const earningsSlice = createSlice({
  name: 'earnings',
  initialState,
  reducers: {
    setEarnings: (state, action: PayloadAction<EarningsData>) => {
      state.data = action.payload;
    },
    updatePendingRewards: (state, action: PayloadAction<number>) => {
      if (state.data) {
        state.data.pendingRewards = action.payload;
      }
    },
    addReward: (
      state,
      action: PayloadAction<{amount: number; timestamp: string}>,
    ) => {
      if (state.data) {
        state.data.pendingRewards += action.payload.amount;
        state.data.totalEarned += action.payload.amount;

        // Update today's earning
        const today = new Date().toISOString().split('T')[0];
        const todayEarning = state.data.dailyEarnings.find(
          e => e.date === today,
        );
        if (todayEarning) {
          todayEarning.amount += action.payload.amount;
        } else {
          state.data.dailyEarnings.unshift({
            date: today,
            amount: action.payload.amount,
            nodes: state.data.dailyEarnings[0]?.nodes || 1,
          });
        }
      }
    },
    clearError: state => {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchEarnings.pending, state => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchEarnings.fulfilled, (state, action) => {
        state.data = action.payload;
        state.isLoading = false;
      })
      .addCase(fetchEarnings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(claimRewards.pending, state => {
        state.claimInProgress = true;
      })
      .addCase(claimRewards.fulfilled, (state, action) => {
        state.claimInProgress = false;
        if (state.data) {
          state.data.claimedRewards += action.payload.amountClaimed;
          state.data.pendingRewards -= action.payload.amountClaimed;
        }
      })
      .addCase(claimRewards.rejected, (state, action) => {
        state.claimInProgress = false;
        state.error = action.payload as string;
      });
  },
});

export const {setEarnings, updatePendingRewards, addReward, clearError} =
  earningsSlice.actions;

export default earningsSlice.reducer;
