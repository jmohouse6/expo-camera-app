import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export class NotificationService {
  static async requestPermissions() {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert(
          'Notifications Disabled',
          'Enable notifications in Settings to receive overtime alerts and reminders.'
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  static async scheduleOvertimeAlert(hoursWorked, type = 'approaching') {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return;

      const settings = await this.getNotificationSettings();
      if (!settings.overtimeAlerts) return;

      let title, body;

      switch (type) {
        case 'approaching':
          title = '⏰ Approaching Overtime';
          body = `You've worked ${hoursWorked.toFixed(1)} hours today. Overtime starts at 8 hours.`;
          break;
        case 'overtime':
          title = '💰 Overtime Started';
          body = `You're now in overtime! ${(hoursWorked - 8).toFixed(1)} hours at 1.5x rate.`;
          break;
        case 'double_time':
          title = '🚨 Double Time!';
          body = `You've worked ${hoursWorked.toFixed(1)} hours! Now earning 2x rate.`;
          break;
        case 'meal_break':
          title = '🍽️ Meal Break Required';
          body = `You've worked ${hoursWorked.toFixed(1)} hours. California law requires a meal break for 5+ hour shifts.`;
          break;
        case 'rest_break':
          title = '☕ Rest Break Reminder';
          body = `Time for a 10-minute rest break! You've worked ${hoursWorked.toFixed(1)} hours.`;
          break;
        default:
          return;
      }

      // Cancel any existing overtime notifications
      await this.cancelNotificationsByTag('overtime');

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          vibrate: [0, 250, 250, 250],
          data: {
            type: 'overtime_alert',
            hoursWorked,
            alertType: type,
          },
        },
        trigger: null, // Show immediately
        identifier: `overtime_${type}_${Date.now()}`,
      });

      console.log(`Overtime alert scheduled: ${type} - ${hoursWorked} hours`);
    } catch (error) {
      console.error('Error scheduling overtime alert:', error);
    }
  }

  static async schedulePhotoReminder(delayMinutes = 5) {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return;

      const settings = await this.getNotificationSettings();
      if (!settings.photoReminders) return;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📸 Photo Reminder',
          body: 'Don\'t forget to take a photo for your timecard entry!',
          sound: true,
          data: {
            type: 'photo_reminder',
          },
        },
        trigger: {
          seconds: delayMinutes * 60,
        },
        identifier: `photo_reminder_${Date.now()}`,
      });

      console.log(`Photo reminder scheduled for ${delayMinutes} minutes`);
    } catch (error) {
      console.error('Error scheduling photo reminder:', error);
    }
  }

  static async scheduleDailyApprovalReminder() {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return;

      // Schedule for 6 PM daily
      const now = new Date();
      const reminderTime = new Date();
      reminderTime.setHours(18, 0, 0, 0);

      // If it's already past 6 PM today, schedule for tomorrow
      if (now > reminderTime) {
        reminderTime.setDate(reminderTime.getDate() + 1);
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📋 Submit Timecard',
          body: 'Remember to submit your timecard for supervisor approval.',
          sound: true,
          data: {
            type: 'daily_approval_reminder',
          },
        },
        trigger: {
          date: reminderTime,
          repeats: true,
        },
        identifier: 'daily_approval_reminder',
      });

      console.log('Daily approval reminder scheduled');
    } catch (error) {
      console.error('Error scheduling daily approval reminder:', error);
    }
  }

  static async scheduleClockOutReminder(delayHours = 8.5) {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return;

      const settings = await this.getNotificationSettings();
      if (!settings.overtimeAlerts) return;

      // Cancel existing clock out reminders
      await this.cancelNotificationsByTag('clock_out');

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🏁 Clock Out Reminder',
          body: 'You\'ve been clocked in for a while. Don\'t forget to clock out!',
          sound: true,
          data: {
            type: 'clock_out_reminder',
          },
        },
        trigger: {
          seconds: delayHours * 60 * 60,
        },
        identifier: `clock_out_reminder_${Date.now()}`,
      });

      console.log(`Clock out reminder scheduled for ${delayHours} hours`);
    } catch (error) {
      console.error('Error scheduling clock out reminder:', error);
    }
  }

  static async cancelNotificationsByTag(tag) {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const toCancel = scheduledNotifications.filter(notification =>
        notification.identifier.includes(tag)
      );

      for (const notification of toCancel) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }

      console.log(`Cancelled ${toCancel.length} notifications with tag: ${tag}`);
    } catch (error) {
      console.error('Error cancelling notifications:', error);
    }
  }

  static async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('All notifications cancelled');
    } catch (error) {
      console.error('Error cancelling all notifications:', error);
    }
  }

  static async getNotificationSettings() {
    try {
      const settings = await AsyncStorage.getItem('userSettings');
      if (settings) {
        return JSON.parse(settings);
      }

      // Default settings
      return {
        overtimeAlerts: true,
        photoReminders: true,
        dailyReminders: true,
        clockOutReminders: true,
      };
    } catch (error) {
      console.error('Error getting notification settings:', error);
      return {
        overtimeAlerts: true,
        photoReminders: true,
        dailyReminders: true,
        clockOutReminders: true,
      };
    }
  }

  static async updateNotificationSettings(settings) {
    try {
      await AsyncStorage.setItem('userSettings', JSON.stringify(settings));
      
      // If notifications are disabled, cancel all scheduled notifications
      if (!settings.overtimeAlerts) {
        await this.cancelNotificationsByTag('overtime');
        await this.cancelNotificationsByTag('clock_out');
      }
      
      if (!settings.photoReminders) {
        await this.cancelNotificationsByTag('photo_reminder');
      }
      
      if (!settings.dailyReminders) {
        await this.cancelNotificationsByTag('daily_approval');
      }

      console.log('Notification settings updated');
    } catch (error) {
      console.error('Error updating notification settings:', error);
    }
  }

  static async showLocalNotification(title, body, data = {}) {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return;

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          data,
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error('Error showing local notification:', error);
    }
  }

  static async setupNotificationListeners() {
    try {
      // Listen for notifications received while app is foregrounded
      const notificationListener = Notifications.addNotificationReceivedListener(notification => {
        console.log('Notification received:', notification);
      });

      // Listen for user interactions with notifications
      const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Notification response:', response);
        
        const data = response.notification.request.content.data;
        
        // Handle different notification types
        switch (data.type) {
          case 'overtime_alert':
            // Could navigate to timeclock screen
            break;
          case 'photo_reminder':
            // Could open camera
            break;
          case 'daily_approval_reminder':
            // Could navigate to history screen
            break;
          default:
            break;
        }
      });

      return {
        notificationListener,
        responseListener,
      };
    } catch (error) {
      console.error('Error setting up notification listeners:', error);
      return null;
    }
  }

  static async getBadgeCount() {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error('Error getting badge count:', error);
      return 0;
    }
  }

  static async setBadgeCount(count) {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  }

  static async clearBadge() {
    try {
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      console.error('Error clearing badge:', error);
    }
  }

  // Utility method to check if user is approaching overtime
  static shouldNotifyOvertime(currentHours, lastNotificationHours = 0) {
    // Notify at 7 hours (approaching), 8 hours (overtime), and 12 hours (double time)
    const thresholds = [7, 8, 12];
    
    for (const threshold of thresholds) {
      if (currentHours >= threshold && lastNotificationHours < threshold) {
        return {
          shouldNotify: true,
          type: threshold === 7 ? 'approaching' : threshold === 8 ? 'overtime' : 'double_time',
        };
      }
    }

    return { shouldNotify: false };
  }

  // Utility method to check if user needs meal break reminder
  static shouldNotifyMealBreak(hoursWorked, hasHadMealBreak = false) {
    return hoursWorked >= 5 && !hasHadMealBreak;
  }

  // Utility method to check if user needs rest break reminder
  static shouldNotifyRestBreak(hoursSinceLastBreak) {
    return hoursSinceLastBreak >= 4;
  }
}