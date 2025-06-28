import AsyncStorage from '@react-native-async-storage/async-storage';

export class AuthService {
  static async login(email, password) {
    try {
      // TODO: Replace with actual API call
      // For now, we'll simulate authentication
      const mockUsers = [
        {
          id: 1,
          email: 'employee@company.com',
          password: 'password123',
          name: 'John Employee',
          role: 'employee',
          supervisorId: 2
        },
        {
          id: 2,
          email: 'supervisor@company.com',
          password: 'supervisor123',
          name: 'Jane Supervisor',
          role: 'supervisor'
        },
        {
          id: 3,
          email: 'admin@company.com',
          password: 'admin123',
          name: 'Admin User',
          role: 'admin'
        }
      ];

      const user = mockUsers.find(u => u.email === email && u.password === password);
      
      if (!user) {
        throw new Error('Invalid credentials');
      }

      const token = `token_${user.id}_${Date.now()}`;
      
      return {
        ...user,
        token,
        password: undefined // Don't return password
      };
    } catch (error) {
      throw error;
    }
  }

  static async logout() {
    try {
      await AsyncStorage.multiRemove(['authToken', 'userData']);
      return true;
    } catch (error) {
      throw error;
    }
  }

  static async getCurrentUser() {
    try {
      const userData = await AsyncStorage.getItem('userData');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      throw error;
    }
  }

  static async isAuthenticated() {
    try {
      const token = await AsyncStorage.getItem('authToken');
      return !!token;
    } catch (error) {
      return false;
    }
  }
}