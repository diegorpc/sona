import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Text,
  List,
  Switch,
  Button,
  Card,
  Divider,
  Dialog,
  Portal,
  TextInput,
} from 'react-native-paper';
import { CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SubsonicAPI from '../services/SubsonicAPI';
import AudioPlayer from '../services/AudioPlayer';
import { theme } from '../theme/theme';

export default function SettingsScreen({ navigation }) {
  const [serverInfo, setServerInfo] = useState(null);
  const [settings, setSettings] = useState({
    autoPlay: true,
    highQuality: false,
    downloadOverWifi: true,
    scrobbling: true,
  });
  const [showServerDialog, setShowServerDialog] = useState(false);
  const [newServerUrl, setNewServerUrl] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    loadServerInfo();
    loadSettings();
  }, []);

  const loadServerInfo = async () => {
    try {
      const config = await AsyncStorage.getItem('serverConfig');
      if (config) {
        const { serverUrl, username } = JSON.parse(config);
        setServerInfo({ serverUrl, username });
        setNewServerUrl(serverUrl);
        setNewUsername(username);
      }
    } catch (error) {
      console.error('Error loading server info:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('appSettings');
      if (savedSettings) {
        setSettings({ ...settings, ...JSON.parse(savedSettings) });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      await AsyncStorage.setItem('appSettings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleSettingChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  };

  const handleServerUpdate = async () => {
    if (!newServerUrl || !newUsername || !newPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      await SubsonicAPI.initialize(newServerUrl, newUsername, newPassword);
      await SubsonicAPI.ping();
      
      setServerInfo({ serverUrl: newServerUrl, username: newUsername });
      setShowServerDialog(false);
      setNewPassword('');
      
      Alert.alert('Success', 'Server settings updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to connect to server. Please check your credentials.');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout? This will clear all your data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await AudioPlayer.stop();
              await SubsonicAPI.logout();
              await AsyncStorage.clear();
              
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                })
              );
            } catch (error) {
              console.error('Error during logout:', error);
            }
          },
        },
      ]
    );
  };

  const clearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached music and images. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: async () => {
            try {
              // Clear specific cache keys
              const keys = await AsyncStorage.getAllKeys();
              const cacheKeys = keys.filter(key => 
                key.startsWith('cache_') || 
                key.startsWith('image_') ||
                key === 'currentTrack' ||
                key === 'currentPlaylist'
              );
              await AsyncStorage.multiRemove(cacheKeys);
              Alert.alert('Success', 'Cache cleared successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cache');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Server</Text>
          {serverInfo && (
            <>
              <List.Item
                title="Server URL"
                description={serverInfo.serverUrl}
                left={props => <List.Icon {...props} icon="server" />}
              />
              <List.Item
                title="Username"
                description={serverInfo.username}
                left={props => <List.Icon {...props} icon="account" />}
              />
            </>
          )}
          <Button
            mode="outlined"
            onPress={() => setShowServerDialog(true)}
            style={styles.button}
          >
            Update Server Settings
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Playback</Text>
          <List.Item
            title="Auto-play next track"
            description="Automatically play the next song in queue"
            left={props => <List.Icon {...props} icon="play-circle" />}
            right={() => (
              <Switch
                value={settings.autoPlay}
                onValueChange={(value) => handleSettingChange('autoPlay', value)}
              />
            )}
          />
          <Divider />
          <List.Item
            title="High quality streaming"
            description="Use higher bitrate for better audio quality"
            left={props => <List.Icon {...props} icon="high-definition" />}
            right={() => (
              <Switch
                value={settings.highQuality}
                onValueChange={(value) => handleSettingChange('highQuality', value)}
              />
            )}
          />
          <Divider />
          <List.Item
            title="Scrobbling"
            description="Track your listening history"
            left={props => <List.Icon {...props} icon="history" />}
            right={() => (
              <Switch
                value={settings.scrobbling}
                onValueChange={(value) => handleSettingChange('scrobbling', value)}
              />
            )}
          />
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Downloads</Text>
          <List.Item
            title="Download over Wi-Fi only"
            description="Only download music when connected to Wi-Fi"
            left={props => <List.Icon {...props} icon="wifi" />}
            right={() => (
              <Switch
                value={settings.downloadOverWifi}
                onValueChange={(value) => handleSettingChange('downloadOverWifi', value)}
              />
            )}
          />
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Storage</Text>
          <List.Item
            title="Clear Cache"
            description="Clear cached music and images"
            left={props => <List.Icon {...props} icon="delete-sweep" />}
            onPress={clearCache}
          />
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>About</Text>
          <List.Item
            title="Sona Music"
            description="Version 1.0.0"
            left={props => <List.Icon {...props} icon="information" />}
          />
          <List.Item
            title="Subsonic API"
            description="Version 1.16.1"
            left={props => <List.Icon {...props} icon="api" />}
          />
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        onPress={handleLogout}
        style={[styles.button, styles.logoutButton]}
        buttonColor={theme.colors.error}
      >
        Logout
      </Button>

      <Portal>
        <Dialog visible={showServerDialog} onDismiss={() => setShowServerDialog(false)}>
          <Dialog.Title>Update Server Settings</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Server URL"
              value={newServerUrl}
              onChangeText={setNewServerUrl}
              mode="outlined"
              style={styles.dialogInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              label="Username"
              value={newUsername}
              onChangeText={setNewUsername}
              mode="outlined"
              style={styles.dialogInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              label="Password"
              value={newPassword}
              onChangeText={setNewPassword}
              mode="outlined"
              style={styles.dialogInput}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowServerDialog(false)}>Cancel</Button>
            <Button onPress={handleServerUpdate}>Update</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  card: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: theme.colors.surface,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 8,
  },
  button: {
    marginTop: 16,
  },
  logoutButton: {
    margin: 16,
    marginTop: 8,
  },
  dialogInput: {
    marginBottom: 16,
  },
});
