/**
 * Profile Screen
 * User profile and account management
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {RootState} from '@store/index';
import {disconnectWallet, clearAuth} from '@store/slices/authSlice';
import {resetSettings} from '@store/slices/settingsSlice';
import {biometricService} from '@services/biometricService';

const ProfileScreen: React.FC<{navigation: any}> = ({navigation}) => {
  const dispatch = useDispatch();
  const {user, walletAddress} = useSelector((state: RootState) => state.auth);
  const {data: earnings} = useSelector((state: RootState) => state.earnings);
  const {nodes} = useSelector((state: RootState) => state.nodes);

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Wallet',
      'Are you sure you want to disconnect your wallet?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await biometricService.deleteKeys();
            dispatch(disconnectWallet());
          },
        },
      ],
    );
  };

  const handleReset = () => {
    Alert.alert(
      'Reset App Data',
      'This will clear all app data including settings. Are you sure?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            dispatch(resetSettings());
            dispatch(clearAuth());
          },
        },
      ],
    );
  };

  const menuItems = [
    {
      icon: 'account-cog',
      title: 'Account Settings',
      onPress: () => navigation.navigate('Settings'),
    },
    {
      icon: 'bell-outline',
      title: 'Notifications',
      onPress: () => {},
    },
    {
      icon: 'shield-check-outline',
      title: 'Security',
      onPress: () => {},
    },
    {
      icon: 'help-circle-outline',
      title: 'Help & Support',
      onPress: () => {},
    },
    {
      icon: 'information-outline',
      title: 'About',
      onPress: () => {},
    },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {walletAddress ? walletAddress.slice(2, 4).toUpperCase() : '?'}
          </Text>
        </View>
        <Text style={styles.walletAddress}>
          {walletAddress
            ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`
            : 'Not Connected'}
        </Text>
        <Text style={styles.joinDate}>Member since January 2024</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{nodes.length}</Text>
          <Text style={styles.statLabel}>Nodes</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {Math.floor((earnings?.totalEarned || 0)).toLocaleString()}
          </Text>
          <Text style={styles.statLabel}>SYN Earned</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>142</Text>
          <Text style={styles.statLabel}>Messages</Text>
        </View>
      </View>

      {/* Menu */}
      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={item.onPress}>
            <View style={styles.menuIcon}>
              <Icon name={item.icon} size={24} color="#6366F1" />
            </View>
            <Text style={styles.menuTitle}>{item.title}</Text>
            <Icon name="chevron-right" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Danger Zone */}
      <View style={styles.dangerZone}>
        <Text style={styles.dangerTitle}>Danger Zone</Text>
        <TouchableOpacity
          style={styles.dangerButton}
          onPress={handleDisconnect}>
          <Icon name="logout" size={20} color="#EF4444" />
          <Text style={styles.dangerText}>Disconnect Wallet</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dangerButton}
          onPress={handleReset}>
          <Icon name="delete-outline" size={20} color="#EF4444" />
          <Text style={styles.dangerText}>Reset App Data</Text>
        </TouchableOpacity>
      </View>

      {/* Version */}
      <Text style={styles.version}>Version 1.0.0 (Build 100)</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    padding: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  walletAddress: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  joinDate: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    padding: 20,
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTitle: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    marginLeft: 12,
  },
  dangerZone: {
    backgroundColor: '#FFFFFF',
    marginTop: 24,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 12,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  dangerText: {
    fontSize: 15,
    color: '#EF4444',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
    marginVertical: 24,
  },
});

export default ProfileScreen;
