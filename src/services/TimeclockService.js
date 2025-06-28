import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, parseISO } from 'date-fns';

export class TimeclockService {
  static async getTodayStatus() {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const timecards = await this.getTimecards();
      const todayTimecards = timecards.filter(tc => tc.date === today);
      
      // Check if currently clocked in
      const lastEntry = todayTimecards[todayTimecards.length - 1];
      const clockedIn = lastEntry && lastEntry.type === 'clock_in';
      
      // Calculate today's hours
      const todayHours = this.calculateDayHours(todayTimecards);
      
      // Calculate week hours
      const weekHours = await this.calculateWeekHours();
      
      // Get current job/task from last clock in
      let currentJob = null;
      let currentTask = null;
      if (clockedIn && lastEntry) {
        currentJob = lastEntry.job;
        currentTask = lastEntry.task;
      }
      
      // Calculate overtime status
      const overtimeStatus = this.calculateOvertimeStatus(todayHours, weekHours);
      
      return {
        clockedIn,
        currentJob,
        currentTask,
        todayHours,
        weekHours,
        lastClockTime: lastEntry ? lastEntry.timestamp : null,
        overtimeStatus,
      };
    } catch (error) {
      console.error('Error getting today status:', error);
      return {
        clockedIn: false,
        currentJob: null,
        currentTask: null,
        todayHours: 0,
        weekHours: 0,
        lastClockTime: null,
        overtimeStatus: null,
      };
    }
  }

  static async clockIn({ job, task, photo, location }) {
    try {
      const timecard = {
        id: Date.now().toString(),
        type: 'clock_in',
        timestamp: new Date().toISOString(),
        date: format(new Date(), 'yyyy-MM-dd'),
        job,
        task,
        photo,
        location,
        userId: await this.getCurrentUserId(),
      };

      await this.saveTimecard(timecard);
      return timecard;
    } catch (error) {
      throw new Error('Failed to clock in: ' + error.message);
    }
  }

  static async clockOut({ job, task, photo, location }) {
    try {
      const timecard = {
        id: Date.now().toString(),
        type: 'clock_out',
        timestamp: new Date().toISOString(),
        date: format(new Date(), 'yyyy-MM-dd'),
        job,
        task,
        photo,
        location,
        userId: await this.getCurrentUserId(),
      };

      await this.saveTimecard(timecard);
      return timecard;
    } catch (error) {
      throw new Error('Failed to clock out: ' + error.message);
    }
  }

  static async recordLunchBreak({ type, job, task, photo, location }) {
    try {
      const timecard = {
        id: Date.now().toString(),
        type, // 'lunch_out' or 'lunch_in'
        timestamp: new Date().toISOString(),
        date: format(new Date(), 'yyyy-MM-dd'),
        job,
        task,
        photo,
        location,
        userId: await this.getCurrentUserId(),
      };

      await this.saveTimecard(timecard);
      return timecard;
    } catch (error) {
      throw new Error('Failed to record lunch break: ' + error.message);
    }
  }

  static calculateDayHours(timecards) {
    let totalHours = 0;
    let clockInTime = null;
    let lunchOutTime = null;

    for (const entry of timecards) {
      switch (entry.type) {
        case 'clock_in':
          clockInTime = parseISO(entry.timestamp);
          break;
        case 'clock_out':
          if (clockInTime) {
            const hoursWorked = (parseISO(entry.timestamp) - clockInTime) / (1000 * 60 * 60);
            totalHours += hoursWorked;
            clockInTime = null;
          }
          break;
        case 'lunch_out':
          lunchOutTime = parseISO(entry.timestamp);
          break;
        case 'lunch_in':
          if (lunchOutTime) {
            const lunchHours = (parseISO(entry.timestamp) - lunchOutTime) / (1000 * 60 * 60);
            totalHours -= lunchHours; // Subtract lunch time
            lunchOutTime = null;
          }
          break;
      }
    }

    // If still clocked in, calculate hours up to now
    if (clockInTime) {
      const hoursWorked = (new Date() - clockInTime) / (1000 * 60 * 60);
      totalHours += hoursWorked;
    }

    // If on lunch break, subtract lunch time up to now
    if (lunchOutTime) {
      const lunchHours = (new Date() - lunchOutTime) / (1000 * 60 * 60);
      totalHours -= lunchHours;
    }

    return Math.max(0, totalHours);
  }

  static async calculateWeekHours() {
    try {
      const timecards = await this.getTimecards();
      const weekStart = startOfWeek(new Date());
      const weekEnd = endOfWeek(new Date());
      
      const weekTimecards = timecards.filter(tc => {
        const date = parseISO(tc.date);
        return date >= weekStart && date <= weekEnd;
      });

      // Group by date and calculate daily hours
      const dailyHours = {};
      weekTimecards.forEach(tc => {
        if (!dailyHours[tc.date]) {
          dailyHours[tc.date] = [];
        }
        dailyHours[tc.date].push(tc);
      });

      let totalWeekHours = 0;
      Object.keys(dailyHours).forEach(date => {
        totalWeekHours += this.calculateDayHours(dailyHours[date]);
      });

      return totalWeekHours;
    } catch (error) {
      console.error('Error calculating week hours:', error);
      return 0;
    }
  }

  static calculateOvertimeStatus(todayHours, weekHours) {
    // California labor law: Over 8 hours daily = 1.5x, over 12 hours daily = 2x
    // Over 40 hours weekly = 1.5x (but daily takes precedence)
    
    if (todayHours > 12) {
      return {
        type: 'double_time',
        message: 'Double Time (12+ hours today)',
        dailyOvertime: todayHours - 12,
        rate: 2.0,
      };
    } else if (todayHours > 8) {
      return {
        type: 'overtime',
        message: `Overtime (${(todayHours - 8).toFixed(1)} hours over 8 today)`,
        dailyOvertime: todayHours - 8,
        rate: 1.5,
      };
    } else if (todayHours > 7) {
      return {
        type: 'approaching',
        message: 'Approaching overtime (8 hour limit)',
        dailyOvertime: 0,
        rate: 1.0,
      };
    } else if (weekHours > 40) {
      return {
        type: 'overtime',
        message: `Weekly overtime (${(weekHours - 40).toFixed(1)} hours over 40 this week)`,
        weeklyOvertime: weekHours - 40,
        rate: 1.5,
      };
    }

    return null;
  }

  static async getTimecards() {
    try {
      const timecards = await AsyncStorage.getItem('timecards');
      return timecards ? JSON.parse(timecards) : [];
    } catch (error) {
      console.error('Error getting timecards:', error);
      return [];
    }
  }

  static async saveTimecard(timecard) {
    try {
      const timecards = await this.getTimecards();
      timecards.push(timecard);
      await AsyncStorage.setItem('timecards', JSON.stringify(timecards));
      return timecard;
    } catch (error) {
      throw new Error('Failed to save timecard: ' + error.message);
    }
  }

  static async getTimecardHistory(startDate, endDate) {
    try {
      const timecards = await this.getTimecards();
      const userId = await this.getCurrentUserId();
      
      return timecards.filter(tc => {
        const tcDate = parseISO(tc.date);
        return tc.userId === userId && 
               (!startDate || tcDate >= startDate) && 
               (!endDate || tcDate <= endDate);
      });
    } catch (error) {
      console.error('Error getting timecard history:', error);
      return [];
    }
  }

  static async getCurrentUserId() {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        return user.id;
      }
      return null;
    } catch (error) {
      console.error('Error getting current user ID:', error);
      return null;
    }
  }

  static async submitForApproval(date) {
    try {
      const timecards = await this.getTimecards();
      const dayTimecards = timecards.filter(tc => tc.date === date);
      
      // Mark timecards as submitted
      const updatedTimecards = timecards.map(tc => {
        if (tc.date === date) {
          return { ...tc, status: 'submitted', submittedAt: new Date().toISOString() };
        }
        return tc;
      });

      await AsyncStorage.setItem('timecards', JSON.stringify(updatedTimecards));
      return true;
    } catch (error) {
      throw new Error('Failed to submit for approval: ' + error.message);
    }
  }
}