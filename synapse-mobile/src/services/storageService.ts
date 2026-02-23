/**
 * Storage Service
 * Handles encrypted local storage
 */

import EncryptedStorage from 'react-native-encrypted-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {logService} from './logService';

class StorageService {
  // Encrypted storage for sensitive data
  async setSecureItem<T>(key: string, value: T): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await EncryptedStorage.setItem(key, jsonValue);
    } catch (error) {
      logService.error(`Failed to set secure item ${key}`, error);
      throw error;
    }
  }

  async getSecureItem<T>(key: string): Promise<T | null> {
    try {
      const jsonValue = await EncryptedStorage.getItem(key);
      return jsonValue ? JSON.parse(jsonValue) : null;
    } catch (error) {
      logService.error(`Failed to get secure item ${key}`, error);
      return null;
    }
  }

  async removeSecureItem(key: string): Promise<void> {
    try {
      await EncryptedStorage.removeItem(key);
    } catch (error) {
      logService.error(`Failed to remove secure item ${key}`, error);
      throw error;
    }
  }

  async clearSecureStorage(): Promise<void> {
    try {
      await EncryptedStorage.clear();
    } catch (error) {
      logService.error('Failed to clear secure storage', error);
      throw error;
    }
  }

  // Regular storage for non-sensitive data
  async setItem<T>(key: string, value: T): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (error) {
      logService.error(`Failed to set item ${key}`, error);
      throw error;
    }
  }

  async getItem<T>(key: string): Promise<T | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue ? JSON.parse(jsonValue) : null;
    } catch (error) {
      logService.error(`Failed to get item ${key}`, error);
      return null;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      logService.error(`Failed to remove item ${key}`, error);
      throw error;
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      return await AsyncStorage.getAllKeys();
    } catch (error) {
      logService.error('Failed to get all keys', error);
      return [];
    }
  }

  async multiGet<T>(keys: string[]): Promise<[string, T | null][]> {
    try {
      const pairs = await AsyncStorage.multiGet(keys);
      return pairs.map(([key, value]) => [
        key,
        value ? JSON.parse(value) : null,
      ]) as [string, T | null][];
    } catch (error) {
      logService.error('Failed to multi get', error);
      return keys.map(key => [key, null] as [string, T | null]);
    }
  }

  async multiSet(items: [string, any][]): Promise<void> {
    try {
      const serialized = items.map(([key, value]) => [
        key,
        JSON.stringify(value),
      ]) as [string, string][];
      await AsyncStorage.multiSet(serialized);
    } catch (error) {
      logService.error('Failed to multi set', error);
      throw error;
    }
  }

  async multiRemove(keys: string[]): Promise<void> {
    try {
      await AsyncStorage.multiRemove(keys);
    } catch (error) {
      logService.error('Failed to multi remove', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      logService.error('Failed to clear storage', error);
      throw error;
    }
  }
}

export const storageService = new StorageService();
