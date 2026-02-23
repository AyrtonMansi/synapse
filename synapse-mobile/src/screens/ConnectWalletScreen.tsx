/**
 * Connect Wallet Screen
 * Wallet connection via WalletConnect
 */

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useDispatch} from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import QRCode from 'react-native-qrcode-svg'; // Would need to install

import {connectWallet} from '@store/slices/authSlice';
import {walletService} from '@services/walletService';
import {biometricService} from '@services/biometricService';
import {logService} from '@services/logService';

const ConnectWalletScreen: React.FC<{navigation: any}> = ({navigation}) => {
  const dispatch = useDispatch();
  const [isConnecting, setIsConnecting] = useState(false);
  const [qrCodeUri, setQrCodeUri] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    const {available} = await biometricService.isAvailable();
    setBiometricAvailable(available);
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const result = await dispatch(connectWallet()).unwrap();
      logService.info('Wallet connected', {address: result.address});

      if (biometricAvailable) {
        navigation.navigate('BiometricSetup');
      } else {
        // Skip biometric setup if not available
        navigation.navigate('Main');
      }
    } catch (error: any) {
      Alert.alert('Connection Failed', error.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Connect Your Wallet</Text>
        <Text style={styles.subtitle}>
          Connect your wallet to manage nodes and track earnings
        </Text>
      </View>

      <View style={styles.walletOptions}>
        <TouchableOpacity
          style={styles.walletButton}
          onPress={handleConnect}
          disabled={isConnecting}>
          <View style={styles.walletIconContainer}>
            <Icon name="wallet" size={32} color="#6366F1" />
          </View>
          <View style={styles.walletInfo}>
            <Text style={styles.walletName}>WalletConnect</Text>
            <Text style={styles.walletDescription}>
              Connect with any WalletConnect-compatible wallet
            </Text>
          </View>
          {isConnecting ? (
            <ActivityIndicator color="#6366F1" />
          ) : (
            <Icon name="chevron-right" size={24} color="#9CA3AF" />
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.walletButton}>
          <View style={styles.walletIconContainer}>
            <Icon name="ethereum" size={32} color="#627EEA" />
          </View>
          <View style={styles.walletInfo}>
            <Text style={styles.walletName}>MetaMask</Text>
            <Text style={styles.walletDescription}>
              Connect with MetaMask mobile app
            </Text>
          </View>
          <Icon name="chevron-right" size={24} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.walletButton}>
          <View style={styles.walletIconContainer}>
            <Icon name="alpha-r-circle" size={32} color="#3B99FC" />
          </View>
          <View style={styles.walletInfo}>
            <Text style={styles.walletName}>Rainbow</Text>
            <Text style={styles.walletDescription}>
              Connect with Rainbow wallet
            </Text>
          </View>
          <Icon name="chevron-right" size={24} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.walletButton}>
          <View style={styles.walletIconContainer}>
            <Icon name="qrcode-scan" size={32} color="#10B981" />
          </View>
          <View style={styles.walletInfo}>
            <Text style={styles.walletName}>Scan QR Code</Text>
            <Text style={styles.walletDescription}>
              Scan a WalletConnect QR code
            </Text>
          </View>
          <Icon name="chevron-right" size={24} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.securityText}>
          <Icon name="shield-check" size={14} color="#10B981" /> Secure connection via WalletConnect v2
        </Text>
        <Text style={styles.termsText}>
          By connecting, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 24,
  },
  header: {
    marginTop: 24,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
  },
  walletOptions: {
    gap: 12,
  },
  walletButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  walletIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletInfo: {
    flex: 1,
    marginLeft: 16,
  },
  walletName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  walletDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
  },
  securityText: {
    fontSize: 14,
    color: '#6B7280',
  },
  termsText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default ConnectWalletScreen;
