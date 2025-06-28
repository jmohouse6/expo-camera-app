import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Import screens
import LoginScreen from './src/screens/LoginScreen';
import TimeclockScreen from './src/screens/TimeclockScreen';
import JobSelectionScreen from './src/screens/JobSelectionScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SupervisorDashboard from './src/screens/SupervisorDashboard';
import TimecardHistoryScreen from './src/screens/TimecardHistoryScreen';

// Import services
import { AuthService } from './src/services/AuthService';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Tab Navigator for main app
function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Timeclock') {
            iconName = 'access-time';
          } else if (route.name === 'Jobs') {
            iconName = 'work';
          } else if (route.name === 'History') {
            iconName = 'history';
          } else if (route.name === 'Profile') {
            iconName = 'person';
          } else if (route.name === 'Supervisor') {
            iconName = 'supervisor-account';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6200EE',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Timeclock" component={TimeclockScreen} />
      <Tab.Screen name="Jobs" component={JobSelectionScreen} />
      <Tab.Screen name="History" component={TimecardHistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen 
        name="Supervisor" 
        component={SupervisorDashboard}
        options={{
          tabBarStyle: { display: 'none' } // Hide for non-supervisors
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      const userData = await AsyncStorage.getItem('userData');
      
      if (authToken && userData) {
        const user = JSON.parse(userData);
        setUserRole(user.role);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (userData) => {
    try {
      await AsyncStorage.setItem('authToken', userData.token);
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      setUserRole(userData.role);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error storing auth data:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove(['authToken', 'userData']);
      setIsAuthenticated(false);
      setUserRole(null);
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  };

  if (isLoading) {
    return null; // Loading screen can be added here
  }

  return (
    <SafeAreaProvider>
      <PaperProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {!isAuthenticated ? (
              <Stack.Screen name="Login">
                {props => <LoginScreen {...props} onLogin={handleLogin} />}
              </Stack.Screen>
            ) : (
              <Stack.Screen name="Main">
                {props => <MainTabNavigator {...props} userRole={userRole} onLogout={handleLogout} />}
              </Stack.Screen>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}