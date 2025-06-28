import { Camera } from 'react-native-vision-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Alert } from 'react-native';

export class CameraService {
  static async takeTimeclockPhoto({ type, job, task, location }) {
    try {
      // Request permissions
      const { status: cameraStatus } = await Camera.requestCameraPermission();
      const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
        throw new Error('Camera and media library permissions are required');
      }

      // Use ImagePicker for now (can be replaced with react-native-vision-camera later)
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
        exif: true,
      });

      if (result.canceled) {
        return null; // User cancelled
      }

      const photo = result.assets[0];
      
      // Add metadata
      const photoWithMetadata = {
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
        type: type,
        timestamp: new Date().toISOString(),
        location: location,
        job: job,
        task: task,
        exif: photo.exif,
      };

      // Save to device storage
      const savedPhoto = await this.savePhotoWithMetadata(photoWithMetadata);
      
      return savedPhoto;
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Camera Error', error.message || 'Failed to take photo');
      return null;
    }
  }

  static async savePhotoWithMetadata(photo) {
    try {
      // Create unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `timeclock_${photo.type}_${timestamp}.jpg`;
      
      // Define save path
      const directory = FileSystem.documentDirectory + 'timeclock_photos/';
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      const newPath = directory + filename;

      // Copy photo to app directory
      await FileSystem.copyAsync({
        from: photo.uri,
        to: newPath,
      });

      // Save metadata file
      const metadataPath = newPath.replace('.jpg', '_metadata.json');
      const metadata = {
        ...photo,
        uri: newPath,
        originalUri: photo.uri,
        savedAt: new Date().toISOString(),
      };
      
      await FileSystem.writeAsStringAsync(
        metadataPath,
        JSON.stringify(metadata, null, 2)
      );

      // Optionally save to media library
      try {
        await MediaLibrary.saveToLibraryAsync(newPath);
      } catch (error) {
        console.warn('Could not save to media library:', error);
      }

      return {
        ...metadata,
        metadataPath,
      };
    } catch (error) {
      console.error('Error saving photo:', error);
      throw new Error('Failed to save photo: ' + error.message);
    }
  }

  static async getPhotosForTimecard(timecardId) {
    try {
      const directory = FileSystem.documentDirectory + 'timeclock_photos/';
      const files = await FileSystem.readDirectoryAsync(directory);
      
      const photoFiles = files.filter(file => 
        file.includes(timecardId) && file.endsWith('.jpg')
      );

      const photos = [];
      for (const photoFile of photoFiles) {
        const photoPath = directory + photoFile;
        const metadataPath = photoPath.replace('.jpg', '_metadata.json');
        
        try {
          const metadataString = await FileSystem.readAsStringAsync(metadataPath);
          const metadata = JSON.parse(metadataString);
          photos.push(metadata);
        } catch (error) {
          console.warn('Could not read metadata for', photoFile);
          // Include photo without metadata
          photos.push({
            uri: photoPath,
            filename: photoFile,
          });
        }
      }

      return photos;
    } catch (error) {
      console.error('Error getting photos for timecard:', error);
      return [];
    }
  }

  static async getAllTimeclockPhotos() {
    try {
      const directory = FileSystem.documentDirectory + 'timeclock_photos/';
      
      // Check if directory exists
      const dirInfo = await FileSystem.getInfoAsync(directory);
      if (!dirInfo.exists) {
        return [];
      }

      const files = await FileSystem.readDirectoryAsync(directory);
      const photoFiles = files.filter(file => file.endsWith('.jpg'));

      const photos = [];
      for (const photoFile of photoFiles) {
        const photoPath = directory + photoFile;
        const metadataPath = photoPath.replace('.jpg', '_metadata.json');
        
        try {
          const metadataString = await FileSystem.readAsStringAsync(metadataPath);
          const metadata = JSON.parse(metadataString);
          photos.push(metadata);
        } catch (error) {
          // Include photo without metadata
          const photoInfo = await FileSystem.getInfoAsync(photoPath);
          photos.push({
            uri: photoPath,
            filename: photoFile,
            modificationTime: photoInfo.modificationTime,
          });
        }
      }

      // Sort by timestamp
      photos.sort((a, b) => {
        const dateA = new Date(a.timestamp || a.modificationTime || 0);
        const dateB = new Date(b.timestamp || b.modificationTime || 0);
        return dateB - dateA; // Most recent first
      });

      return photos;
    } catch (error) {
      console.error('Error getting all timeclock photos:', error);
      return [];
    }
  }

  static async deletePhoto(photoUri) {
    try {
      // Delete photo file
      await FileSystem.deleteAsync(photoUri, { idempotent: true });
      
      // Delete metadata file
      const metadataPath = photoUri.replace('.jpg', '_metadata.json');
      await FileSystem.deleteAsync(metadataPath, { idempotent: true });
      
      return true;
    } catch (error) {
      console.error('Error deleting photo:', error);
      throw new Error('Failed to delete photo: ' + error.message);
    }
  }

  static async cleanupOldPhotos(daysToKeep = 30) {
    try {
      const photos = await this.getAllTimeclockPhotos();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      let deletedCount = 0;
      for (const photo of photos) {
        const photoDate = new Date(photo.timestamp || photo.modificationTime);
        if (photoDate < cutoffDate) {
          try {
            await this.deletePhoto(photo.uri);
            deletedCount++;
          } catch (error) {
            console.warn('Could not delete old photo:', photo.uri);
          }
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up old photos:', error);
      return 0;
    }
  }

  static getPhotoTypeDisplay(type) {
    const typeMap = {
      'clock_in': 'Clock In',
      'clock_out': 'Clock Out',
      'lunch_out': 'Lunch Break Start',
      'lunch_in': 'Lunch Break End',
    };
    
    return typeMap[type] || type;
  }

  static async compressPhoto(uri, quality = 0.8) {
    try {
      // For now, return original URI
      // In production, you might want to use a compression library
      return uri;
    } catch (error) {
      console.error('Error compressing photo:', error);
      return uri;
    }
  }
}