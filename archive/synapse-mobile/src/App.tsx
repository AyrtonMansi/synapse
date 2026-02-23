/**
 * Synapse Mobile App
 * React Native Application for Synapse Network Node Management
 */

import React, {useEffect} from 'react';
import {Provider} from 'react-redux';
import {PersistGate} from 'redux-persist/integration/react';
import {NavigationContainer} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import {StyleSheet} from 'react-native';

import RootNavigator from '@navigation/RootNavigator';
import {store, persistor} from '@store/index';
import {initializeDeepLinks} from '@services/deepLinking';
import {initializePushNotifications} from '@services/notifications';
import {initializeBackgroundSync} from '@services/backgroundSync';
import {logService} from '@services/logService';

const App: React.FC = () => {
  useEffect(() => {
    // Initialize services
    const initServices = async () => {
      try {
        await initializeDeepLinks();
        await initializePushNotifications();
        await initializeBackgroundSync();
        logService.info('App initialized successfully');
      } catch (error) {
        logService.error('Failed to initialize app services', error);
      }
    };

    initServices();
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <Provider store={store}>
          <PersistGate loading={null} persistor={persistor}>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </PersistGate>
        </Provider>
        <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
