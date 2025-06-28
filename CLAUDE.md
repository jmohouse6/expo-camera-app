# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a comprehensive Timeclock Application built with Expo and React Native, designed for approximately 50 users to clock in and out of job sites with photo verification. The app complies with California labor laws including daily overtime (8+ hours = 1.5x rate, 12+ hours = 2x rate) and weekly overtime (40+ hours = 1.5x rate).

## Development Commands

**Start development server:**
```bash
yarn start
```

**Run on specific platforms:**
```bash
yarn ios        # Run on iOS simulator/device
yarn android    # Run on Android emulator/device
yarn web        # Run on web (if needed)
```

**Build native code:**
```bash
npx expo prebuild    # Required before running on devices
```

**Package management:**
```bash
yarn install    # Install dependencies
```

## Application Architecture

### Core Features
- **User Authentication**: Role-based access (employee, supervisor, admin)
- **Timeclock Operations**: Clock in/out with mandatory photo capture
- **Location Services**: GPS-based job site detection and validation
- **California Labor Law Compliance**: Automatic overtime calculations
- **Photo Management**: Timestamped photos with metadata for verification
- **Supervisor Approval Workflow**: Daily timecard review and approval
- **Lunch Break Tracking**: Before/after lunch photo requirements

### Navigation Structure
- **Login Screen**: Authentication with demo accounts
- **Main Tab Navigator**:
  - **Timeclock**: Primary clock in/out interface
  - **Jobs**: Job site and task selection
  - **History**: Timecard history and reporting
  - **Profile**: User settings and app information
  - **Supervisor**: Dashboard for supervisors/admins only

### Data Storage
- **Local Storage**: AsyncStorage for timecards, user data, and settings
- **Photo Storage**: Local file system with metadata JSON files
- **Data Structure**: 
  - Timecards: `{ id, type, timestamp, date, job, task, photo, location, userId, status }`
  - Job Sites: `{ id, name, address, location: { lat, lng }, tasks }`
  - Users: `{ id, name, email, role, supervisorId }`

### Service Architecture
- **AuthService**: User authentication and session management
- **TimeclockService**: Core timeclock operations and California law compliance
- **LocationService**: GPS location and job site proximity detection
- **CameraService**: Photo capture with metadata and local storage

## Platform Configuration

**iOS:**
- Bundle ID: `com.anonymous.timeclock`
- Required permissions: Camera, Microphone, Location (always/when in use), Photo Library
- Native iOS project in `ios/` directory

**Android:**
- Package: `com.anonymous.timeclock`
- Required permissions: CAMERA, RECORD_AUDIO, ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, READ/WRITE_EXTERNAL_STORAGE
- Native Android project in `android/` directory

## Key Dependencies

**Core Framework:**
- `expo`: ^53.0.11 - Core Expo SDK
- `react-native`: 0.76.5
- `react`: 18.3.1

**Navigation & UI:**
- `@react-navigation/native`: Navigation framework
- `@react-navigation/stack`: Stack navigation
- `@react-navigation/bottom-tabs`: Tab navigation
- `react-native-paper`: Material Design UI components
- `react-native-vector-icons`: Icon library

**Device Features:**
- `react-native-vision-camera`: Camera functionality
- `expo-image-picker`: Image selection
- `expo-location`: GPS location services
- `expo-file-system`: File management
- `expo-media-library`: Photo library access

**Data & Utilities:**
- `@react-native-async-storage/async-storage`: Local data persistence
- `date-fns`: Date manipulation and formatting

## California Labor Law Compliance

The app implements California's specific labor requirements:

**Daily Overtime Rules:**
- Regular time: 0-8 hours per day
- Overtime (1.5x): 8-12 hours per day
- Double time (2.0x): 12+ hours per day

**Weekly Overtime:**
- Overtime (1.5x): 40+ hours per week (when daily rules don't apply)

**Break Requirements:**
- Meal breaks: Required for shifts 5+ hours
- Rest breaks: Required for shifts 4+ hours

## Development Notes

- Run `npx expo prebuild` when adding native dependencies or changing native configuration
- The app requires camera, location, and photo library permissions on both platforms
- All timecard data is stored locally - consider implementing backend sync for production
- Photo verification is mandatory for all clock in/out operations
- Location validation ensures users are within 100 meters of job sites
- Supervisor role provides access to approval dashboard and team management

## Demo Accounts

The app includes built-in demo accounts for testing:
- **Employee**: employee@company.com / password123
- **Supervisor**: supervisor@company.com / supervisor123  
- **Admin**: admin@company.com / admin123

## File Structure

```
src/
├── screens/           # Main application screens
├── services/          # Business logic and data services
├── components/        # Reusable UI components
├── utils/            # Utility functions
└── types/            # TypeScript type definitions (future)
```