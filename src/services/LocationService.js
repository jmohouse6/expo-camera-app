import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class LocationService {
  static async getCurrentLocation() {
    try {
      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission not granted');
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Try to get address
      let address = null;
      try {
        const addressResult = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        
        if (addressResult.length > 0) {
          const addr = addressResult[0];
          address = `${addr.street || ''} ${addr.city || ''}, ${addr.region || ''} ${addr.postalCode || ''}`.trim();
        }
      } catch (error) {
        console.warn('Could not get address:', error);
      }

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        address,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error('Failed to get location: ' + error.message);
    }
  }

  static async findNearbyJobSite(location) {
    try {
      const jobSites = await this.getJobSites();
      const threshold = 100; // meters

      for (const job of jobSites) {
        if (job.location) {
          const distance = this.calculateDistance(
            location.latitude,
            location.longitude,
            job.location.latitude,
            job.location.longitude
          );

          if (distance <= threshold) {
            return job;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding nearby job site:', error);
      return null;
    }
  }

  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  static async getJobSites() {
    try {
      const jobSites = await AsyncStorage.getItem('jobSites');
      if (jobSites) {
        return JSON.parse(jobSites);
      }

      // Return default job sites if none exist
      const defaultJobSites = [
        {
          id: '1',
          name: 'Downtown Office Building',
          address: '123 Main St, Downtown',
          location: {
            latitude: 37.7749,
            longitude: -122.4194,
          },
          tasks: [
            { id: '1', name: 'General Construction' },
            { id: '2', name: 'Electrical Work' },
            { id: '3', name: 'Plumbing' },
          ],
        },
        {
          id: '2',
          name: 'Residential Complex',
          address: '456 Oak Ave, Suburbs',
          location: {
            latitude: 37.7849,
            longitude: -122.4094,
          },
          tasks: [
            { id: '4', name: 'Framing' },
            { id: '5', name: 'Roofing' },
            { id: '6', name: 'Landscaping' },
          ],
        },
        {
          id: '3',
          name: 'Industrial Warehouse',
          address: '789 Industrial Blvd, Industrial District',
          location: {
            latitude: 37.7649,
            longitude: -122.4294,
          },
          tasks: [
            { id: '7', name: 'Equipment Installation' },
            { id: '8', name: 'Safety Inspection' },
            { id: '9', name: 'Maintenance' },
          ],
        },
      ];

      await this.saveJobSites(defaultJobSites);
      return defaultJobSites;
    } catch (error) {
      console.error('Error getting job sites:', error);
      return [];
    }
  }

  static async saveJobSites(jobSites) {
    try {
      await AsyncStorage.setItem('jobSites', JSON.stringify(jobSites));
    } catch (error) {
      throw new Error('Failed to save job sites: ' + error.message);
    }
  }

  static async addJobSite(jobSite) {
    try {
      const jobSites = await this.getJobSites();
      const newJobSite = {
        ...jobSite,
        id: Date.now().toString(),
      };
      jobSites.push(newJobSite);
      await this.saveJobSites(jobSites);
      return newJobSite;
    } catch (error) {
      throw new Error('Failed to add job site: ' + error.message);
    }
  }

  static async isAtJobSite(jobSiteId, userLocation) {
    try {
      const jobSites = await this.getJobSites();
      const jobSite = jobSites.find(js => js.id === jobSiteId);
      
      if (!jobSite || !jobSite.location) {
        return false;
      }

      const distance = this.calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        jobSite.location.latitude,
        jobSite.location.longitude
      );

      return distance <= 100; // Within 100 meters
    } catch (error) {
      console.error('Error checking job site location:', error);
      return false;
    }
  }

  static async validateLocation(jobSite, userLocation) {
    try {
      const isValid = await this.isAtJobSite(jobSite.id, userLocation);
      
      if (!isValid) {
        const distance = this.calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          jobSite.location.latitude,
          jobSite.location.longitude
        );

        throw new Error(
          `You are ${Math.round(distance)} meters away from ${jobSite.name}. ` +
          'Please move closer to the job site to clock in.'
        );
      }

      return true;
    } catch (error) {
      throw error;
    }
  }
}