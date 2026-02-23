//**
 * Settings Service
 * Handles app settings persistence
 */

import {AppSettings} from '@types/index';
import {storageService} from './storageService';
import {logService} from './logService';

const SETTINGS_KEY = 'app_settings';

class SettingsService {
  async getSettings(): Promise<Partial<AppSettings>> {
    try {
      const settings = await storageService.getItem<AppSettings>(SETTINGS_KEY);
      return settings || {};
    } catch (error) {
      logService.error('Failed to get settings', error);
      return {};
    }
  }

  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    try {
      const current = await this.getSettings();
      const merged = {...current, ...settings};
      await storageService.setItem(SETTINGS_KEY, merged);
      logService.info('Settings saved');
    } catch (error) {
      logService.error('Failed to save settings', error);
      throw error;
    }
  }

  async resetSettings(): Promise<void> {
    try {
      await storageService.removeItem(SETTINGS_KEY);
      logService.info('Settings reset');
    } catch (error) {
      logService.error('Failed to reset settings', error);
      throw error;
    }
  }
}

export const settingsService = new SettingsService();
