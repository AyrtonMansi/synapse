# Synapse Mobile

A React Native mobile application for managing Synapse Network nodes.

## Features

### Core Features
- **Wallet Connection**: Securely connect via WalletConnect v2
- **Node Monitoring**: Real-time node status and metrics
- **Earnings Tracking**: Track rewards and earnings history
- **Push Notifications**: Get notified about important events

### Node Control
- **Start/Stop Node**: Remote node control
- **Emergency Stop**: Force stop in critical situations
- **Settings Management**: Configure node parameters
- **Log Viewer**: View and filter node logs

### Social Features
- **Node Operator Chat**: Real-time chat with operators
- **Community Forums**: Discussion boards and support
- **Help & Support**: Get help from the community
- **Announcements**: Official updates and news

### Technical Features
- **Biometric Authentication**: Face ID / Fingerprint support
- **Offline Mode**: Work offline with sync when online
- **Background Sync**: Keep data fresh automatically
- **Deep Linking**: Handle external links

## Installation

### Prerequisites
- Node.js >= 18
- React Native CLI
- Android Studio (for Android)
- Xcode (for iOS)
- CocoaPods (for iOS)

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd synapse-mobile

# Install dependencies
npm install

# iOS specific
npx pod-install ios

# Android specific
cd android && ./gradlew clean && cd ..
```

### Running

```bash
# Start Metro
npm start

# Run Android
npm run android

# Run iOS
npm run ios
```

## Project Structure

```
synapse-mobile/
├── src/
│   ├── components/       # Reusable components
│   ├── screens/          # Screen components
│   ├── services/         # API and services
│   ├── store/            # Redux store and slices
│   ├── navigation/       # Navigation configuration
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Utility functions
│   └── types/            # TypeScript types
├── android/              # Android native code
├── ios/                  # iOS native code
└── docs/                 # Documentation
```

## Configuration

### Firebase Setup
1. Create a Firebase project
2. Add Android and iOS apps
3. Download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS)
4. Place in respective platform directories

### WalletConnect Setup
1. Get a project ID from WalletConnect Cloud
2. Update `PROJECT_ID` in `src/services/walletService.ts`

## Security

- Encrypted storage for sensitive data
- Biometric authentication support
- Secure wallet connection
- No private keys stored locally

## License

MIT
