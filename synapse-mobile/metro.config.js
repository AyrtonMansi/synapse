/**
 * Metro configuration for React Native
 */
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const config = {
  resolver: {
    alias: {
      '@': './src',
      '@components': './src/components',
      '@screens': './src/screens',
      '@services': './src/services',
      '@store': './src/store',
      '@utils': './src/utils',
      '@hooks': './src/hooks',
      '@navigation': './src/navigation',
      '@types': './src/types',
      '@assets': './src/assets',
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
