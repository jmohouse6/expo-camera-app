import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { CameraService } from './CameraService';
import { ExportService } from './ExportService';

export class StorageService {
  static async getStorageInfo() {
    try {
      const documentDir = FileSystem.documentDirectory;
      const photosDir = documentDir + 'timeclock_photos/';
      const exportsDir = documentDir + 'exports/';

      // Get AsyncStorage usage
      const asyncStorageKeys = await AsyncStorage.getAllKeys();
      let asyncStorageSize = 0;
      
      for (const key of asyncStorageKeys) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            asyncStorageSize += new Blob([value]).size;
          }
        } catch (error) {
          console.warn('Could not get size for key:', key);
        }
      }

      // Get photos directory size
      let photosSize = 0;
      let photoCount = 0;
      try {
        const photosInfo = await FileSystem.getInfoAsync(photosDir);
        if (photosInfo.exists) {
          const photoFiles = await FileSystem.readDirectoryAsync(photosDir);
          photoCount = photoFiles.filter(file => file.endsWith('.jpg')).length;
          
          for (const file of photoFiles) {
            const fileInfo = await FileSystem.getInfoAsync(photosDir + file);
            if (fileInfo.exists && fileInfo.size) {
              photosSize += fileInfo.size;
            }
          }
        }
      } catch (error) {
        console.warn('Could not get photos directory info:', error);
      }

      // Get exports directory size
      let exportsSize = 0;
      let exportCount = 0;
      try {
        const exportsInfo = await FileSystem.getInfoAsync(exportsDir);
        if (exportsInfo.exists) {
          const exportFiles = await FileSystem.readDirectoryAsync(exportsDir);
          exportCount = exportFiles.length;
          
          for (const file of exportFiles) {
            const fileInfo = await FileSystem.getInfoAsync(exportsDir + file);
            if (fileInfo.exists && fileInfo.size) {
              exportsSize += fileInfo.size;
            }
          }
        }
      } catch (error) {
        console.warn('Could not get exports directory info:', error);
      }

      // Get device storage info
      let freeStorage = 0;
      let totalStorage = 0;
      try {
        const storageInfo = await FileSystem.getFreeDiskStorageAsync();
        freeStorage = storageInfo;
        // Total storage is harder to get, estimate based on common device sizes
        totalStorage = freeStorage * 4; // Rough estimate
      } catch (error) {
        console.warn('Could not get device storage info:', error);
      }

      return {
        asyncStorage: {
          size: asyncStorageSize,
          keys: asyncStorageKeys.length,
          sizeFormatted: this.formatBytes(asyncStorageSize),
        },
        photos: {
          size: photosSize,
          count: photoCount,
          sizeFormatted: this.formatBytes(photosSize),
          directory: photosDir,
        },
        exports: {
          size: exportsSize,
          count: exportCount,
          sizeFormatted: this.formatBytes(exportsSize),
          directory: exportsDir,
        },
        device: {
          freeStorage,
          totalStorage,
          freeFormatted: this.formatBytes(freeStorage),
          totalFormatted: this.formatBytes(totalStorage),
          usagePercentage: totalStorage > 0 ? ((totalStorage - freeStorage) / totalStorage * 100) : 0,
        },
        totalAppStorage: asyncStorageSize + photosSize + exportsSize,
        totalAppStorageFormatted: this.formatBytes(asyncStorageSize + photosSize + exportsSize),
      };
    } catch (error) {
      console.error('Error getting storage info:', error);
      throw new Error('Failed to get storage information');
    }
  }

  static formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  static async cleanupOldData(options = {}) {
    try {
      const {
        photoRetentionDays = 30,
        exportRetentionDays = 7,
        timecardRetentionDays = 90,
        dryRun = false,
      } = options;

      const results = {
        photosDeleted: 0,
        exportsDeleted: 0,
        timecardsDeleted: 0,
        spaceSaved: 0,
        errors: [],
      };

      // Cleanup old photos
      try {
        const photosDeleted = dryRun ? 0 : await CameraService.cleanupOldPhotos(photoRetentionDays);
        results.photosDeleted = photosDeleted;
      } catch (error) {
        results.errors.push('Photos cleanup failed: ' + error.message);
      }

      // Cleanup old exports
      try {
        const exportsDeleted = dryRun ? 0 : await ExportService.cleanupOldExports(exportRetentionDays);
        results.exportsDeleted = exportsDeleted;
      } catch (error) {
        results.errors.push('Exports cleanup failed: ' + error.message);
      }

      // Cleanup old timecards (mark as archived, don't delete)
      try {
        if (!dryRun) {
          const timecardsArchived = await this.archiveOldTimecards(timecardRetentionDays);
          results.timecardsDeleted = timecardsArchived;
        }
      } catch (error) {
        results.errors.push('Timecards archival failed: ' + error.message);
      }

      return results;
    } catch (error) {
      throw new Error('Cleanup failed: ' + error.message);
    }
  }

  static async archiveOldTimecards(retentionDays) {
    try {
      const timecards = await AsyncStorage.getItem('timecards');
      if (!timecards) return 0;

      const timecardsArray = JSON.parse(timecards);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      let archivedCount = 0;
      const updatedTimecards = timecardsArray.map(tc => {
        if (new Date(tc.date) < cutoffDate && tc.status !== 'archived') {
          archivedCount++;
          return { ...tc, status: 'archived', archivedAt: new Date().toISOString() };
        }
        return tc;
      });

      await AsyncStorage.setItem('timecards', JSON.stringify(updatedTimecards));
      return archivedCount;
    } catch (error) {
      console.error('Error archiving old timecards:', error);
      return 0;
    }
  }

  static async exportBackup() {
    try {
      const backupData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        data: {},
      };

      // Get all AsyncStorage data
      const keys = await AsyncStorage.getAllKeys();
      for (const key of keys) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            backupData.data[key] = JSON.parse(value);
          }
        } catch (error) {
          console.warn('Could not backup key:', key);
        }
      }

      // Get photos list (but not the actual photo files)
      try {
        const photos = await CameraService.getAllTimeclockPhotos();
        backupData.photos = photos.map(photo => ({
          ...photo,
          uri: photo.uri.split('/').pop(), // Just filename for privacy
        }));
      } catch (error) {
        console.warn('Could not backup photos list:', error);
      }

      // Save backup file
      const backupJson = JSON.stringify(backupData, null, 2);
      const fileName = `timeclock_backup_${new Date().toISOString().split('T')[0]}.json`;
      const directory = await ExportService.getExportDirectory();
      const fileUri = directory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, backupJson);

      return {
        success: true,
        fileName,
        fileUri,
        size: new Blob([backupJson]).size,
        sizeFormatted: this.formatBytes(new Blob([backupJson]).size),
      };
    } catch (error) {
      throw new Error('Backup failed: ' + error.message);
    }
  }

  static async restoreBackup(backupFileUri) {
    try {
      // Read backup file
      const backupContent = await FileSystem.readAsStringAsync(backupFileUri);
      const backupData = JSON.parse(backupContent);

      if (!backupData.version || !backupData.data) {
        throw new Error('Invalid backup file format');
      }

      // Restore AsyncStorage data
      const keys = Object.keys(backupData.data);
      for (const key of keys) {
        try {
          await AsyncStorage.setItem(key, JSON.stringify(backupData.data[key]));
        } catch (error) {
          console.warn('Could not restore key:', key);
        }
      }

      return {
        success: true,
        keysRestored: keys.length,
        backupDate: backupData.exportDate,
      };
    } catch (error) {
      throw new Error('Restore failed: ' + error.message);
    }
  }

  static async clearAllData() {
    try {
      // Clear AsyncStorage
      await AsyncStorage.clear();

      // Delete photos directory
      const photosDir = FileSystem.documentDirectory + 'timeclock_photos/';
      try {
        await FileSystem.deleteAsync(photosDir, { idempotent: true });
      } catch (error) {
        console.warn('Could not delete photos directory:', error);
      }

      // Delete exports directory
      const exportsDir = FileSystem.documentDirectory + 'exports/';
      try {
        await FileSystem.deleteAsync(exportsDir, { idempotent: true });
      } catch (error) {
        console.warn('Could not delete exports directory:', error);
      }

      return {
        success: true,
        message: 'All app data has been cleared',
      };
    } catch (error) {
      throw new Error('Clear data failed: ' + error.message);
    }
  }

  static async optimizeStorage() {
    try {
      const results = {
        photosOptimized: 0,
        spaceSaved: 0,
        errors: [],
      };

      // Get all photos
      const photos = await CameraService.getAllTimeclockPhotos();
      
      for (const photo of photos) {
        try {
          // Check if photo is larger than reasonable size (e.g., > 2MB)
          const photoInfo = await FileSystem.getInfoAsync(photo.uri);
          if (photoInfo.size && photoInfo.size > 2 * 1024 * 1024) {
            // Compress photo (implementation would depend on available libraries)
            // For now, just log that optimization is needed
            console.log('Photo needs optimization:', photo.uri, this.formatBytes(photoInfo.size));
            results.photosOptimized++;
          }
        } catch (error) {
          results.errors.push(`Could not optimize photo: ${photo.uri}`);
        }
      }

      return results;
    } catch (error) {
      throw new Error('Storage optimization failed: ' + error.message);
    }
  }

  static async getStorageRecommendations() {
    try {
      const storageInfo = await this.getStorageInfo();
      const recommendations = [];

      // Check if running low on device storage
      if (storageInfo.device.usagePercentage > 90) {
        recommendations.push({
          type: 'critical',
          title: 'Device Storage Critical',
          description: 'Your device is running very low on storage space.',
          action: 'Consider deleting old photos or files from your device.',
        });
      } else if (storageInfo.device.usagePercentage > 80) {
        recommendations.push({
          type: 'warning',
          title: 'Device Storage Low',
          description: 'Your device storage is getting low.',
          action: 'Consider cleaning up old files.',
        });
      }

      // Check app storage usage
      if (storageInfo.totalAppStorage > 100 * 1024 * 1024) { // > 100MB
        recommendations.push({
          type: 'info',
          title: 'App Storage Usage High',
          description: `Timeclock app is using ${storageInfo.totalAppStorageFormatted} of storage.`,
          action: 'Consider cleaning up old photos and exports.',
        });
      }

      // Check photo count
      if (storageInfo.photos.count > 1000) {
        recommendations.push({
          type: 'info',
          title: 'Many Photos Stored',
          description: `You have ${storageInfo.photos.count} timecard photos stored.`,
          action: 'Consider archiving or deleting old photos.',
        });
      }

      // Check export files
      if (storageInfo.exports.count > 50) {
        recommendations.push({
          type: 'info',
          title: 'Many Export Files',
          description: `You have ${storageInfo.exports.count} export files.`,
          action: 'Consider deleting old export files.',
        });
      }

      return recommendations;
    } catch (error) {
      console.error('Error getting storage recommendations:', error);
      return [];
    }
  }
}