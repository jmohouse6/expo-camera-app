# Camera App

A React Native camera app built with Expo and react-native-vision-camera.

## Features

- Camera access with permissions
- Microphone recording support
- Cross-platform (iOS & Android)

## Setup

1. Install dependencies:
   ```bash
   yarn install
   ```

2. Prebuild native code:
   ```bash
   npx expo prebuild
   ```

3. Run on iOS:
   ```bash
   yarn ios
   ```

4. Run on Android:
   ```bash
   yarn android
   ```

## Tech Stack

- **Expo SDK 53**
- **React Native 0.76.5**
- **react-native-vision-camera** for camera functionality
- **Yarn** for package management

## Permissions

The app requests the following permissions:
- Camera access for taking photos/videos
- Microphone access for audio recording

## Development

Start the development server:
```bash
yarn start
```

This will open the Expo developer tools in your browser where you can scan the QR code with the Expo Go app on your device.
