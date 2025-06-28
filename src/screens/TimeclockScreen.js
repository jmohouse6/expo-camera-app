import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Text,
  Chip,
  Surface,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { format } from 'date-fns';

import { TimeclockService } from '../services/TimeclockService';
import { LocationService } from '../services/LocationService';
import { CameraService } from '../services/CameraService';
import { AuthService } from '../services/AuthService';

export default function TimeclockScreen() {
  const [currentUser, setCurrentUser] = useState(null);
  const [clockedIn, setClockedIn] = useState(false);
  const [currentJob, setCurrentJob] = useState(null);
  const [currentTask, setCurrentTask] = useState(null);
  const [todayHours, setTodayHours] = useState(0);
  const [weekHours, setWeekHours] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [lastClockTime, setLastClockTime] = useState(null);
  const [overtimeStatus, setOvertimeStatus] = useState(null);
  const [location, setLocation] = useState(null);

  useEffect(() => {
    loadUserData();
    loadTodayStatus();
    getCurrentLocation();
  }, []);

  const loadUserData = async () => {
    try {
      const user = await AuthService.getCurrentUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadTodayStatus = async () => {
    try {
      const status = await TimeclockService.getTodayStatus();
      setClockedIn(status.clockedIn);
      setCurrentJob(status.currentJob);
      setCurrentTask(status.currentTask);
      setTodayHours(status.todayHours);
      setWeekHours(status.weekHours);
      setLastClockTime(status.lastClockTime);
      setOvertimeStatus(status.overtimeStatus);
    } catch (error) {
      console.error('Error loading today status:', error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const loc = await LocationService.getCurrentLocation();
      setLocation(loc);
      
      // Auto-detect job site based on location
      const nearbyJob = await LocationService.findNearbyJobSite(loc);
      if (nearbyJob && !currentJob) {
        setCurrentJob(nearbyJob);
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const handleClockInOut = async () => {
    if (!currentJob) {
      Alert.alert('No Job Selected', 'Please select a job site before clocking in.');
      return;
    }

    setIsLoading(true);
    try {
      // Take photo first
      const photo = await CameraService.takeTimeclockPhoto({
        type: clockedIn ? 'clock_out' : 'clock_in',
        job: currentJob,
        task: currentTask,
        location: location,
      });

      if (!photo) {
        setIsLoading(false);
        return; // User cancelled photo
      }

      // Process clock in/out
      if (clockedIn) {
        await TimeclockService.clockOut({
          job: currentJob,
          task: currentTask,
          photo: photo,
          location: location,
        });
        setClockedIn(false);
      } else {
        await TimeclockService.clockIn({
          job: currentJob,
          task: currentTask,
          photo: photo,
          location: location,
        });
        setClockedIn(true);
      }

      await loadTodayStatus();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to clock in/out');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLunchBreak = async (type) => {
    setIsLoading(true);
    try {
      const photo = await CameraService.takeTimeclockPhoto({
        type: type,
        job: currentJob,
        task: currentTask,
        location: location,
      });

      if (!photo) {
        setIsLoading(false);
        return;
      }

      await TimeclockService.recordLunchBreak({
        type: type,
        job: currentJob,
        task: currentTask,
        photo: photo,
        location: location,
      });

      await loadTodayStatus();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to record lunch break');
    } finally {
      setIsLoading(false);
    }
  };

  const getOvertimeColor = () => {
    if (!overtimeStatus) return '#4CAF50';
    if (overtimeStatus.type === 'approaching') return '#FF9800';
    if (overtimeStatus.type === 'overtime') return '#F44336';
    if (overtimeStatus.type === 'double_time') return '#9C27B0';
    return '#4CAF50';
  };

  const getOvertimeText = () => {
    if (!overtimeStatus) return 'Regular Time';
    return overtimeStatus.message || 'Regular Time';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Title style={styles.title}>Timeclock</Title>
          <Text style={styles.dateText}>{format(new Date(), 'EEEE, MMMM d, yyyy')}</Text>
        </View>

        {/* Current Status Card */}
        <Card style={styles.statusCard}>
          <Card.Content>
            <View style={styles.statusHeader}>
              <Icon 
                name={clockedIn ? 'work' : 'work-off'} 
                size={24} 
                color={clockedIn ? '#4CAF50' : '#757575'} 
              />
              <Title style={[styles.statusTitle, { color: clockedIn ? '#4CAF50' : '#757575' }]}>
                {clockedIn ? 'Clocked In' : 'Clocked Out'}
              </Title>
            </View>
            
            {lastClockTime && (
              <Paragraph style={styles.lastClockText}>
                Last action: {format(new Date(lastClockTime), 'h:mm a')}
              </Paragraph>
            )}

            {currentJob && (
              <View style={styles.jobInfo}>
                <Chip icon="location-on" style={styles.jobChip}>
                  {currentJob.name}
                </Chip>
                {currentTask && (
                  <Chip icon="assignment" style={styles.taskChip}>
                    {currentTask.name}
                  </Chip>
                )}
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Hours Summary Card */}
        <Card style={styles.hoursCard}>
          <Card.Content>
            <Title style={styles.hoursTitle}>Hours Summary</Title>
            <View style={styles.hoursRow}>
              <View style={styles.hoursItem}>
                <Text style={styles.hoursValue}>{todayHours.toFixed(1)}</Text>
                <Text style={styles.hoursLabel}>Today</Text>
              </View>
              <View style={styles.hoursItem}>
                <Text style={styles.hoursValue}>{weekHours.toFixed(1)}</Text>
                <Text style={styles.hoursLabel}>This Week</Text>
              </View>
            </View>
            
            <Surface style={[styles.overtimeStatus, { backgroundColor: getOvertimeColor() + '20' }]}>
              <Text style={[styles.overtimeText, { color: getOvertimeColor() }]}>
                {getOvertimeText()}
              </Text>
            </Surface>
          </Card.Content>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            mode="contained"
            onPress={handleClockInOut}
            loading={isLoading}
            disabled={isLoading}
            style={[styles.clockButton, { backgroundColor: clockedIn ? '#F44336' : '#4CAF50' }]}
            contentStyle={styles.clockButtonContent}
            icon={clockedIn ? 'logout' : 'login'}
          >
            {clockedIn ? 'Clock Out' : 'Clock In'}
          </Button>

          {clockedIn && (
            <View style={styles.lunchButtons}>
              <Button
                mode="outlined"
                onPress={() => handleLunchBreak('lunch_out')}
                disabled={isLoading}
                style={styles.lunchButton}
                icon="restaurant"
              >
                Lunch Out
              </Button>
              <Button
                mode="outlined"
                onPress={() => handleLunchBreak('lunch_in')}
                disabled={isLoading}
                style={styles.lunchButton}
                icon="restaurant-menu"
              >
                Lunch In
              </Button>
            </View>
          )}
        </View>

        {/* Location Info */}
        {location && (
          <Card style={styles.locationCard}>
            <Card.Content>
              <Title style={styles.locationTitle}>Current Location</Title>
              <Paragraph>
                Lat: {location.latitude.toFixed(6)}, Lng: {location.longitude.toFixed(6)}
              </Paragraph>
              {location.address && (
                <Paragraph>{location.address}</Paragraph>
              )}
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#6200EE',
  },
  dateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  statusCard: {
    marginBottom: 16,
    elevation: 4,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusTitle: {
    marginLeft: 8,
    fontSize: 20,
  },
  lastClockText: {
    color: '#666',
    marginBottom: 12,
  },
  jobInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  jobChip: {
    marginRight: 8,
  },
  taskChip: {
    marginRight: 8,
  },
  hoursCard: {
    marginBottom: 16,
    elevation: 4,
  },
  hoursTitle: {
    fontSize: 18,
    marginBottom: 16,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  hoursItem: {
    alignItems: 'center',
  },
  hoursValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6200EE',
  },
  hoursLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  overtimeStatus: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  overtimeText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionButtons: {
    marginBottom: 16,
  },
  clockButton: {
    marginBottom: 16,
  },
  clockButtonContent: {
    paddingVertical: 12,
  },
  lunchButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  lunchButton: {
    flex: 1,
  },
  locationCard: {
    elevation: 2,
  },
  locationTitle: {
    fontSize: 16,
    marginBottom: 8,
  },
});