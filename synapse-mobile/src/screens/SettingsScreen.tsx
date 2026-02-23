/**
 * Settings Screen
 * App and node settings
 */

import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {RootState} from '@store/index';
import {
  updateNotificationSettings,
  updateSecuritySettings,
  updateNodeSettings,
} from '@store/slices/settingsSlice';

const SettingsScreen: React.FC = () => {
  const dispatch = useDispatch();
  const {settings} = useSelector((state: RootState) => state.settings);

  const toggleNotification = (key: keyof typeof settings.notifications) => {
    dispatch(
      updateNotificationSettings({
        [key]: !settings.notifications[key],
      }),
    );
  };

  const toggleSecurity = (key: keyof typeof settings.security) => {
    dispatch(
      updateSecuritySettings({
        [key]: !settings.security[key],
      }),
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.card}>
          <SettingSwitch
            icon="bell-outline"
            title="Push Notifications"
            value={settings.notifications.pushEnabled}
            onToggle={() => toggleNotification('pushEnabled')}
          />
          <SettingSwitch
            icon="email-outline"
            title="Email Notifications"
            value={settings.notifications.emailEnabled}
            onToggle={() => toggleNotification('emailEnabled')}
          />
          <SettingSwitch
            icon="server-network"
            title="Node Offline Alerts"
            value={settings.notifications.nodeOffline}
            onToggle={() => toggleNotification('nodeOffline')}
          />
          <SettingSwitch
            icon="cash"
            title="Reward Notifications"
            value={settings.notifications.rewards}
            onToggle={() => toggleNotification('rewards')}
          />
          <SettingSwitch
            icon="chat-outline"
            title="Chat Messages"
            value={settings.notifications.chatMessages}
            onToggle={() => toggleNotification('chatMessages')}
          />
          <SettingSwitch
            icon="bullhorn-outline"
            title="Announcements"
            value={settings.notifications.announcements}
            onToggle={() => toggleNotification('announcements')}
          />
        </View>
      </View>

      {/* Security Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.card}>
          <SettingSwitch
            icon="fingerprint"
            title="Biometric Authentication"
            value={settings.security.biometricEnabled}
            onToggle={() => toggleSecurity('biometricEnabled')}
          />
          <SettingSwitch
            icon="lock-outline"
            title="Require Auth for Transactions"
            value={settings.security.requireAuthForTransactions}
            onToggle={() => toggleSecurity('requireAuthForTransactions')}
          />
          <SettingSwitch
            icon="eye-outline"
            title="Show Balances"
            value={settings.security.showBalances}
            onToggle={() => toggleSecurity('showBalances')}
          />
        </View>
      </View>

      {/* Node Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Node Settings</Text>
        <View style={styles.card}>
          <SettingSwitch
            icon="restart"
            title="Auto Restart on Crash"
            value={settings.node.autoRestart}
            onToggle={() => dispatch(updateNodeSettings({autoRestart: !settings.node.autoRestart}))}
          />
          <SettingSwitch
            icon="update"
            title="Auto Update"
            value={settings.node.autoUpdate}
            onToggle={() => dispatch(updateNodeSettings({autoUpdate: !settings.node.autoUpdate}))}
          />
        </View>
      </View>

      {/* Appearance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.card}>
          <SettingOption
            icon="theme-light-dark"
            title="Theme"
            value={settings.theme}
            onPress={() => {}}
          />
          <SettingOption
            icon="translate"
            title="Language"
            value={settings.language === 'en' ? 'English' : settings.language}
            onPress={() => {}}
          />
        </View>
      </View>

      {/* Advanced */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Advanced</Text>
        <View style={styles.card}>
          <SettingOption
            icon="database-outline"
            title="Clear Cache"
            value=""
            onPress={() => {}}
          />
          <SettingOption
            icon="file-export-outline"
            title="Export Logs"
            value=""
            onPress={() => {}}
          />
        </View>
      </View>
    </ScrollView>
  );
};

const SettingSwitch: React.FC<{
  icon: string;
  title: string;
  value: boolean;
  onToggle: () => void;
}> = ({icon, title, value, onToggle}) => (
  <View style={styles.settingRow}>
    <View style={styles.settingLeft}>
      <View style={styles.iconContainer}>
        <Icon name={icon} size={20} color="#6366F1" />
      </View>
      <Text style={styles.settingTitle}>{title}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onToggle}
      trackColor={{false: '#E5E7EB', true: '#C7D2FE'}}
      thumbColor={value ? '#6366F1' : '#FFFFFF'}
    />
  </View>
);

const SettingOption: React.FC<{
  icon: string;
  title: string;
  value: string;
  onPress: () => void;
}> = ({icon, title, value, onPress}) => (
  <TouchableOpacity style={styles.settingRow} onPress={onPress}>
    <View style={styles.settingLeft}>
      <View style={styles.iconContainer}>
        <Icon name={icon} size={20} color="#6366F1" />
      </View>
      <Text style={styles.settingTitle}>{title}</Text>
    </View>
    <View style={styles.settingRight}>
      {value && <Text style={styles.settingValue}>{value}</Text>}
      <Icon name="chevron-right" size={20} color="#9CA3AF" />
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingTitle: {
    fontSize: 16,
    color: '#111827',
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  settingValue: {
    fontSize: 14,
    color: '#6B7280',
  },
});

export default SettingsScreen;
