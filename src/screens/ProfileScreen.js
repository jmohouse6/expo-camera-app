import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Text,
  List,
  Avatar,
  Divider,
  Switch,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { AuthService } from '../services/AuthService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProfileScreen({ onLogout }) {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({
    locationTracking: true,
    photoReminders: true,
    overtimeAlerts: true,
    autoJobDetection: true,
  });

  useEffect(() => {
    loadUserData();
    loadSettings();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AuthService.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('userSettings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      await AsyncStorage.setItem('userSettings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const handleSettingChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await AuthService.logout();
              onLogout();
            } catch (error) {
              Alert.alert('Error', 'Failed to logout');
            }
          },
        },
      ]
    );
  };

  const clearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all your timeclock data, photos, and settings. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Data',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                'timecards',
                'userSettings',
                'jobSites',
              ]);
              Alert.alert('Success', 'All data has been cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data');
            }
          },
        },
      ]
    );
  };

  const getRoleDisplay = (role) => {
    const roleMap = {
      'employee': 'Employee',
      'supervisor': 'Supervisor',
      'admin': 'Administrator',
    };
    return roleMap[role] || role;
  };

  const getRoleIcon = (role) => {
    const iconMap = {
      'employee': 'person',
      'supervisor': 'supervisor-account',
      'admin': 'admin-panel-settings',
    };
    return iconMap[role] || 'person';
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Profile Card */}
        <Card style={styles.profileCard}>
          <Card.Content>
            <View style={styles.profileHeader}>
              <Avatar.Icon
                size={64}
                icon={getRoleIcon(user.role)}
                style={styles.avatar}
              />
              <View style={styles.profileInfo}>
                <Title style={styles.userName}>{user.name}</Title>
                <Paragraph style={styles.userEmail}>{user.email}</Paragraph>
                <Text style={styles.userRole}>{getRoleDisplay(user.role)}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Settings Card */}
        <Card style={styles.settingsCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Settings</Title>
            
            <List.Item
              title="Location Tracking"
              description="Allow automatic job site detection"
              left={() => <Icon name="location-on" size={24} color="#6200EE" />}
              right={() => (
                <Switch
                  value={settings.locationTracking}
                  onValueChange={(value) => handleSettingChange('locationTracking', value)}
                />
              )}
            />
            
            <List.Item
              title="Photo Reminders"
              description="Get reminders to take timeclock photos"
              left={() => <Icon name="camera-alt" size={24} color="#6200EE" />}
              right={() => (
                <Switch
                  value={settings.photoReminders}
                  onValueChange={(value) => handleSettingChange('photoReminders', value)}
                />
              )}
            />
            
            <List.Item
              title="Overtime Alerts"
              description="Notify when approaching overtime"
              left={() => <Icon name="access-time" size={24} color="#6200EE" />}
              right={() => (
                <Switch
                  value={settings.overtimeAlerts}
                  onValueChange={(value) => handleSettingChange('overtimeAlerts', value)}
                />
              )}
            />
            
            <List.Item
              title="Auto Job Detection"
              description="Automatically select nearby job sites"
              left={() => <Icon name="work" size={24} color="#6200EE" />}
              right={() => (
                <Switch
                  value={settings.autoJobDetection}
                  onValueChange={(value) => handleSettingChange('autoJobDetection', value)}
                />
              )}
            />
          </Card.Content>
        </Card>

        {/* App Info Card */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>App Information</Title>
            
            <List.Item
              title="Version"
              description="1.0.0"
              left={() => <Icon name="info" size={24} color="#6200EE" />}
            />
            
            <List.Item
              title="California Labor Law Compliance"
              description="Daily 8-hour overtime, weekly 40-hour overtime"
              left={() => <Icon name="gavel" size={24} color="#6200EE" />}
            />
            
            <List.Item
              title="Data Storage"
              description="All data stored locally on device"
              left={() => <Icon name="storage" size={24} color="#6200EE" />}
            />
          </Card.Content>
        </Card>

        {/* Actions Card */}
        <Card style={styles.actionsCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Actions</Title>
            
            <Button
              mode="outlined"
              onPress={() => Alert.alert('Export Data', 'Export feature coming soon!')}
              style={styles.actionButton}
              icon="download"
            >
              Export Timecard Data
            </Button>
            
            <Button
              mode="outlined"
              onPress={() => Alert.alert('Backup', 'Backup feature coming soon!')}
              style={styles.actionButton}
              icon="backup"
            >
              Backup Data
            </Button>
            
            <Button
              mode="outlined"
              onPress={clearAllData}
              style={[styles.actionButton, styles.dangerButton]}
              icon="delete-forever"
              textColor="#F44336"
            >
              Clear All Data
            </Button>
            
            <Divider style={styles.divider} />
            
            <Button
              mode="contained"
              onPress={handleLogout}
              style={[styles.actionButton, styles.logoutButton]}
              icon="logout"
            >
              Logout
            </Button>
          </Card.Content>
        </Card>

        {/* Legal Info */}
        <Card style={styles.legalCard}>
          <Card.Content>
            <Paragraph style={styles.legalText}>
              This app is designed to comply with California labor laws including:
              {'\n'}• Daily overtime after 8 hours (1.5x rate)
              {'\n'}• Double time after 12 hours daily (2.0x rate)
              {'\n'}• Weekly overtime after 40 hours (1.5x rate)
              {'\n'}• Meal break requirements for 5+ hour shifts
              {'\n'}• Rest break requirements for 4+ hour shifts
            </Paragraph>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  profileCard: {
    marginBottom: 16,
    elevation: 4,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: '#6200EE',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  userEmail: {
    color: '#666',
    marginTop: 4,
  },
  userRole: {
    color: '#6200EE',
    fontWeight: 'bold',
    marginTop: 4,
  },
  settingsCard: {
    marginBottom: 16,
    elevation: 2,
  },
  infoCard: {
    marginBottom: 16,
    elevation: 2,
  },
  actionsCard: {
    marginBottom: 16,
    elevation: 2,
  },
  legalCard: {
    marginBottom: 16,
    elevation: 1,
    backgroundColor: '#FFF9C4',
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 8,
    color: '#333',
  },
  actionButton: {
    marginBottom: 12,
  },
  dangerButton: {
    borderColor: '#F44336',
  },
  logoutButton: {
    backgroundColor: '#F44336',
  },
  divider: {
    marginVertical: 16,
  },
  legalText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
});