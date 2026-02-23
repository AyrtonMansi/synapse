/**
 * Redux Store Configuration
 * Centralized state management with persistence
 */

import {configureStore, combineReducers} from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

import authReducer from './slices/authSlice';
import nodesReducer from './slices/nodesSlice';
import earningsReducer from './slices/earningsSlice';
import chatReducer from './slices/chatSlice';
import settingsReducer from './slices/settingsSlice';
import notificationsReducer from './slices/notificationsSlice';
import syncReducer from './slices/syncSlice';

const persistConfig = {
  key: 'synapse-mobile-root',
  storage: AsyncStorage,
  whitelist: ['auth', 'settings', 'nodes', 'earnings'],
  blacklist: ['chat', 'notifications'],
};

const rootReducer = combineReducers({
  auth: authReducer,
  nodes: nodesReducer,
  earnings: earningsReducer,
  chat: chatReducer,
  settings: settingsReducer,
  notifications: notificationsReducer,
  sync: syncReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
