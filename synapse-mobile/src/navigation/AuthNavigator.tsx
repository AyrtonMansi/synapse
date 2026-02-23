/**
 * Auth Navigator
 * Authentication flow navigation
 */

import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';

import WelcomeScreen from '@screens/WelcomeScreen';
import ConnectWalletScreen from '@screens/ConnectWalletScreen';
import BiometricSetupScreen from '@screens/BiometricSetupScreen';

const Stack = createStackNavigator();

const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen
        name="ConnectWallet"
        component={ConnectWalletScreen}
        options={{headerShown: true, title: 'Connect Wallet'}}
      />
      <Stack.Screen
        name="BiometricSetup"
        component={BiometricSetupScreen}
        options={{headerShown: true, title: 'Security Setup'}}
      />
    </Stack.Navigator>
  );
};

export default AuthNavigator;
