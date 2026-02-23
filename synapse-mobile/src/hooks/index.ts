/**
 * Custom Hooks
 */

import {useEffect, useState, useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import NetInfo from '@react-native-community/netinfo';
import {RootState} from '@store/index';
import {setOnlineStatus} from '@store/slices/syncSlice';

// Hook for network connectivity
export const useNetworkStatus = () => {
  const dispatch = useDispatch();
  const {isOnline} = useSelector((state: RootState) => state.sync);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected ?? false;
      dispatch(setOnlineStatus(online));
    });

    return () => unsubscribe();
  }, [dispatch]);

  return isOnline;
};

// Hook for debouncing
export const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

// Hook for refresh control
export const useRefresh = (onRefresh: () => Promise<void>) => {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  }, [onRefresh]);

  return {refreshing, handleRefresh};
};

// Hook for app state
export const useAppState = () => {
  const [appState, setAppState] = useState('active');

  useEffect(() => {
    // In real implementation, use AppState from react-native
    return () => {};
  }, []);

  return appState;
};

// Hook for secure storage
export const useSecureStorage = () => {
  const getItem = async (key: string) => {
    // Implementation would use EncryptedStorage
    return null;
  };

  const setItem = async (key: string, value: string) => {
    // Implementation would use EncryptedStorage
  };

  const removeItem = async (key: string) => {
    // Implementation would use EncryptedStorage
  };

  return {getItem, setItem, removeItem};
};

export default {
  useNetworkStatus,
  useDebounce,
  useRefresh,
  useAppState,
  useSecureStorage,
};
