/**
 * Biometric Service
 * Handles fingerprint/face authentication
 */

import ReactNativeBiometrics, {BiometryTypes} from 'react-native-biometrics';
import {logService} from './logService';

interface BiometricResult {
  success: boolean;
  error?: string;
}

class BiometricService {
  private rnBiometrics: ReactNativeBiometrics;

  constructor() {
    this.rnBiometrics = new ReactNativeBiometrics();
  }

  async isAvailable(): Promise<{
    available: boolean;
    biometryType: string | null;
  }> {
    try {
      const {available, biometryType} =
        await this.rnBiometrics.isSensorAvailable();
      return {available, biometryType};
    } catch (error) {
      logService.error('Biometric availability check failed', error);
      return {available: false, biometryType: null};
    }
  }

  async authenticate(promptMessage: string): Promise<BiometricResult> {
    try {
      const {available} = await this.isAvailable();

      if (!available) {
        return {
          success: false,
          error: 'Biometric authentication is not available on this device',
        };
      }

      const {success} = await this.rnBiometrics.simplePrompt({
        promptMessage,
        cancelButtonText: 'Cancel',
      });

      if (success) {
        logService.info('Biometric authentication successful');
        return {success: true};
      } else {
        return {
          success: false,
          error: 'Biometric authentication was cancelled',
        };
      }
    } catch (error: any) {
      logService.error('Biometric authentication failed', error);
      return {
        success: false,
        error: error.message || 'Authentication failed',
      };
    }
  }

  async createKeys(): Promise<{publicKey: string} | null> {
    try {
      const {publicKey} = await this.rnBiometrics.createKeys();
      return {publicKey};
    } catch (error) {
      logService.error('Failed to create biometric keys', error);
      return null;
    }
  }

  async biometricKeysExist(): Promise<boolean> {
    try {
      const {keysExist} = await this.rnBiometrics.biometricKeysExist();
      return keysExist;
    } catch (error) {
      logService.error('Failed to check biometric keys', error);
      return false;
    }
  }

  async deleteKeys(): Promise<boolean> {
    try {
      const {keysDeleted} = await this.rnBiometrics.deleteKeys();
      return keysDeleted;
    } catch (error) {
      logService.error('Failed to delete biometric keys', error);
      return false;
    }
  }

  async createSignature(payload: string): Promise<{signature: string} | null> {
    try {
      const {success, signature} = await this.rnBiometrics.createSignature({
        promptMessage: 'Sign in',
        payload,
      });

      if (success && signature) {
        return {signature};
      }
      return null;
    } catch (error) {
      logService.error('Failed to create biometric signature', error);
      return null;
    }
  }
}

export const biometricService = new BiometricService();
