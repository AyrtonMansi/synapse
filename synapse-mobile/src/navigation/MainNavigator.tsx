/**
 * Main Navigator
 * Main app tab navigation
 */

import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {MainTabParamList} from '@types/index';
import DashboardScreen from '@screens/DashboardScreen';
import NodesScreen from '@screens/NodesScreen';
import EarningsScreen from '@screens/EarningsScreen';
import SocialScreen from '@screens/SocialScreen';
import ProfileScreen from '@screens/ProfileScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

const MainNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({focused, color, size}) => {
          let iconName: string;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'view-dashboard' : 'view-dashboard-outline';
              break;
            case 'Nodes':
              iconName = focused ? 'server' : 'server-outline';
              break;
            case 'Earnings':
              iconName = focused ? 'cash-multiple' : 'cash';
              break;
            case 'Social':
              iconName = focused ? 'chat' : 'chat-outline';
              break;
            case 'Profile':
              iconName = focused ? 'account' : 'account-outline';
              break;
            default:
              iconName = 'circle';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#6B7280',
        headerShown: false,
      })}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Nodes" component={NodesScreen} />
      <Tab.Screen name="Earnings" component={EarningsScreen} />
      <Tab.Screen name="Social" component={SocialScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export default MainNavigator;
