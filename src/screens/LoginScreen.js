import React, { useState, useEffect } from 'react';
import {
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {
  TextInput,
  Button,
  Title,
  Paragraph,
  Card,
  ActivityIndicator,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SubsonicAPI from '../services/SubsonicAPI';
import { theme } from '../theme/theme';
import { styles } from '../styles/LoginScreen.styles';

export default function LoginScreen({ navigation }) {
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = async () => {
    try {
      const serverConfig = await AsyncStorage.getItem('serverConfig');
      if (serverConfig) {
        const { serverUrl: savedUrl, username: savedUsername, password: savedPassword } = JSON.parse(serverConfig);
        setServerUrl(savedUrl || '');
        setUsername(savedUsername || '');
        setPassword(savedPassword || '');
      }
    } catch (error) {
      console.error('Error loading saved credentials:', error);
    }
  };

  const handleLogin = async () => {
    if (!serverUrl || !username || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      await SubsonicAPI.initialize(serverUrl, username, password);
      
      // Test connection
      await SubsonicAPI.ping();
      
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert(
        'Connection Failed',
        'Unable to connect to server. Please check your credentials and server URL.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const formatServerUrl = (url) => {
    // Add protocol if missing
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      return 'https://' + url;
    }
    return url;
  };

  return (
    <LinearGradient
      colors={[theme.colors.background, theme.colors.surface]}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.content}>
            <Title style={styles.title}>Welcome to Sona</Title>
            <Paragraph style={styles.subtitle}>
              Connect to your Subsonic or Navidrome server
            </Paragraph>

            <Card style={styles.card}>
              <Card.Content>
                <TextInput
                  label="Server URL"
                  value={serverUrl}
                  onChangeText={(text) => setServerUrl(formatServerUrl(text))}
                  mode="outlined"
                  style={styles.input}
                  placeholder="https://your-server.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />

                <TextInput
                  label="Username"
                  value={username}
                  onChangeText={setUsername}
                  mode="outlined"
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TextInput
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  mode="outlined"
                  style={styles.input}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Button
                  mode="contained"
                  onPress={handleLogin}
                  style={styles.loginButton}
                  disabled={isLoading}
                  loading={isLoading}
                >
                  {isLoading ? 'Connecting...' : 'Connect'}
                </Button>
              </Card.Content>
            </Card>

            <View style={styles.helpSection}>
              <Paragraph style={styles.helpText}>
                Need help? Make sure your server URL includes the protocol (https://) 
                and that your Subsonic/Navidrome server is accessible.
              </Paragraph>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

