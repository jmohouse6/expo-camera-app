import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  Card,
  Title,
  Paragraph,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthService } from '../services/AuthService';

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      const userData = await AuthService.login(email, password);
      onLogin(userData);
    } catch (error) {
      Alert.alert('Login Failed', error.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = (role) => {
    switch (role) {
      case 'employee':
        setEmail('employee@company.com');
        setPassword('password123');
        break;
      case 'supervisor':
        setEmail('supervisor@company.com');
        setPassword('supervisor123');
        break;
      case 'admin':
        setEmail('admin@company.com');
        setPassword('admin123');
        break;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoContainer}>
            <Title style={styles.title}>Timeclock App</Title>
            <Paragraph style={styles.subtitle}>
              Track your work hours with photo verification
            </Paragraph>
          </View>

          <Card style={styles.card}>
            <Card.Content>
              <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
              />

              <TextInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                mode="outlined"
                secureTextEntry
                style={styles.input}
              />

              <Button
                mode="contained"
                onPress={handleLogin}
                loading={loading}
                disabled={loading}
                style={styles.loginButton}
                contentStyle={styles.buttonContent}
              >
                Login
              </Button>
            </Card.Content>
          </Card>

          <Card style={styles.demoCard}>
            <Card.Content>
              <Title style={styles.demoTitle}>Demo Accounts</Title>
              <View style={styles.demoButtons}>
                <Button
                  mode="outlined"
                  onPress={() => fillDemoCredentials('employee')}
                  style={styles.demoButton}
                  compact
                >
                  Employee
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => fillDemoCredentials('supervisor')}
                  style={styles.demoButton}
                  compact
                >
                  Supervisor
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => fillDemoCredentials('admin')}
                  style={styles.demoButton}
                  compact
                >
                  Admin
                </Button>
              </View>
            </Card.Content>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#6200EE',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  card: {
    marginBottom: 20,
    elevation: 4,
  },
  input: {
    marginBottom: 16,
  },
  loginButton: {
    marginTop: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  demoCard: {
    elevation: 2,
  },
  demoTitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  demoButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  demoButton: {
    flex: 1,
    marginHorizontal: 4,
  },
});