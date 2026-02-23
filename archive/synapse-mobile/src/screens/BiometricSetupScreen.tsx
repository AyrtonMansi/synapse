/**
 * Biometric Setup Screen
 * Configure biometric authentication
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import {useDispatch} from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {updateSecuritySettings} from '@store/slices/settingsSlice';
import {biometricService} from '@services/biometricService';
import {logService} from '@services/logService';

const BiometricSetupScreen: React.FC<{navigation: any}> = ({navigation}) => {
  const dispatch = useDispatch();

  const handleEnable = async () => {
    try {
      const result = await biometricService.authenticate(
        'Authenticate to enable biometric login',
      );

      if (result.success) {
        dispatch(updateSecuritySettings({biometricEnabled: true}));
        logService.info('Biometric authentication enabled');
        navigation.navigate('Main');
      }
    } catch (error) {
      logService.error('Failed to enable biometric', error);
    }
  };

  const handleSkip = () => {
    dispatch(updateSecuritySettings({biometricEnabled: false}));
    navigation.navigate('Main');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Icon name="fingerprint" size={80} color="#6366F1" />
        </View>

        <Text style={styles.title}>Enable Biometric Authentication</Text>
        <Text style={styles.subtitle}>
          Use your fingerprint or face recognition to quickly and securely
          access your account
        </Text>

        <View style={styles.benefits}>
          <BenefitItem
            icon="flash"
            title="Quick Access"
            description="Sign in instantly without typing your password"
          />
          <BenefitItem
            icon="shield-check"
            title="Enhanced Security"
            description="Your biometric data never leaves your device"
          />
          <BenefitItem
            icon="lock"
            title="Transaction Protection"
            description="Require biometric for sensitive operations"
          />
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleEnable}>
          <Icon name="fingerprint" size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Enable Biometric</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={handleSkip}>
          <Text style={styles.secondaryButtonText}>Skip for Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const BenefitItem: React.FC<{icon: string; title: string; description: string}> = ({
  icon,
  title,
  description,
}) => (
  <View style={styles.benefitItem}>
    <View style={styles.benefitIcon}>
      <Icon name={icon} size={24} color="#6366F1" />
    </View>
    <View style={styles.benefitText}>
      <Text style={styles.benefitTitle}>{title}</Text>
      <Text style={styles.benefitDescription}>{description}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
  },
  benefits: {
    width: '100%',
    marginTop: 40,
    gap: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  benefitIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitText: {
    flex: 1,
    marginLeft: 16,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  benefitDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#6366F1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    color: '#6B7280',
  },
});

export default BiometricSetupScreen;
