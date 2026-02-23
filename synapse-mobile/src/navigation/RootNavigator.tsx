/**
 * Root Navigator
 * Main navigation configuration
 */

import React, {useEffect} from 'react';
import {useSelector} from 'react-redux';
import {createStackNavigator} from '@react-navigation/stack';
import {RootStackParamList} from '@types/index';
import {RootState} from '@store/index';

import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import WalletConnectScreen from '@screens/WalletConnectScreen';
import NodeDetailsScreen from '@screens/NodeDetailsScreen';
import ChatRoomScreen from '@screens/ChatRoomScreen';
import ForumTopicScreen from '@screens/ForumTopicScreen';
import SettingsScreen from '@screens/SettingsScreen';
import LogsScreen from '@screens/LogsScreen';
import EarningsDetailsScreen from '@screens/EarningsDetailsScreen';

const Stack = createStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  const {isAuthenticated} = useSelector((state: RootState) => state.auth);

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainNavigator} />
          <Stack.Screen
            name="WalletConnect"
            component={WalletConnectScreen}
            options={{presentation: 'modal'}}
          />
          <Stack.Screen
            name="NodeDetails"
            component={NodeDetailsScreen}
            options={{headerShown: true, title: 'Node Details'}}
          />
          <Stack.Screen
            name="ChatRoom"
            component={ChatRoomScreen}
            options={{headerShown: true}}
          />
          <Stack.Screen
            name="ForumTopic"
            component={ForumTopicScreen}
            options={{headerShown: true, title: 'Topic'}}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{headerShown: true, title: 'Settings'}}
          />
          <Stack.Screen
            name="Logs"
            component={LogsScreen}
            options={{headerShown: true, title: 'Node Logs'}}
          />
          <Stack.Screen
            name="EarningsDetails"
            component={EarningsDetailsScreen}
            options={{headerShown: true, title: 'Earnings Details'}}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

export default RootNavigator;
