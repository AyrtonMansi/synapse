/**
 * Wallet Connect Screen
 * Modal for WalletConnect URI handling
 */

import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const WalletConnectScreen: React.FC<{route: any; navigation: any}> = ({
  route,
  navigation,
}) => {
  const [uri, setUri] = useState(route.params?.uri || '');

  const handleConnect = () => {
    if (!uri.trim()) {
      Alert.alert('Error', 'Please enter a WalletConnect URI');
      return;
    }
    // Handle WalletConnect URI
    Alert.alert('Connecting', 'Processing WalletConnect URI...');
    navigation.goBack();
  };

  const handlePaste = async () => {
    // In a real app, this would use Clipboard.getString()
    setUri('wc:...');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Icon name="qrcode-scan" size={48} color="#6366F1" />
        </View>
        <Text style={styles.title}>WalletConnect</Text>
        <Text style={styles.subtitle}>
          Scan a QR code or paste a WalletConnect URI to connect your wallet
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>WalletConnect URI</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            value={uri}
            onChangeText={setUri}
            placeholder="wc:..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.pasteButton} onPress={handlePaste}>
            <Icon name="content-paste" size={20} color="#6366F1" />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.connectButton, !uri && styles.connectButtonDisabled]}
        onPress={handleConnect}
        disabled={!uri}>
        <Text style={styles.connectButtonText}>Connect Wallet</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>

      <View style={styles.hint}>
        <Icon name="information-outline" size={16} color="#9CA3AF" />
        <Text style={styles.hintText}>
          Make sure you trust the dApp before connecting your wallet
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  inputContainer: {
    marginTop: 40,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingVertical: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pasteButton: {
    padding: 12,
    justifyContent: 'center',
  },
  connectButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  connectButtonDisabled: {
    backgroundColor: '#C7D2FE',
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6B7280',
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 'auto',
    marginBottom: 24,
  },
  hintText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
});

export default WalletConnectScreen;
