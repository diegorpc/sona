import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  Alert,
  TouchableOpacity,
  Animated,
  Easing,
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
  ProgressBar,
} from 'react-native-paper';
import { CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import SubsonicAPI from '../services/SubsonicAPI';
import AudioPlayer from '../services/AudioPlayer';
import CacheService from '../services/CacheService';
import ScreenBackground from '../components/ScreenBackground';
import { useTheme } from '../contexts/ThemeContext';
import { usePlayer } from '../contexts/PlayerContext';
import { accentPalettes } from '../theme/theme';
import { createStyles } from '../styles/SettingsScreen.styles';

const DEFAULT_ART = require('../../assets/default-album.png');

const TABS = [
  { key: 'appearance', label: 'Appearance' },
  { key: 'general', label: 'General' },
  { key: 'server', label: 'Server' },
  { key: 'storage', label: 'Storage' },
];

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedText = Animated.createAnimatedComponent(Text);

const CHIP_REORDER_DURATION = 620;
const CHIP_FADE_OUT_DURATION = 200;
const CHIP_FADE_IN_DURATION = 240;

const buildChipOrder = (selectedKey) => {
  const selected = TABS.find(t => t.key === selectedKey);
  if (!selected) return TABS;
  return [selected, ...TABS.filter(t => t.key !== selectedKey)];
};

export default function SettingsScreen({ navigation }) {
  const { theme, accentColor, changeAccentColor } = useTheme();
  const styles = createStyles(theme);
  const { playerState: { currentTrack } } = usePlayer();
  const [activeTab, setActiveTab] = useState('appearance');
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
  const [cacheStats, setCacheStats] = useState(null);
  const [maxCacheSize, setMaxCacheSize] = useState(500);
  const [showCacheDialog, setShowCacheDialog] = useState(false);

  const chipHighlightAnimations = useRef(
    TABS.reduce((acc, { key }) => {
      acc[key] = new Animated.Value(key === 'appearance' ? 1 : 0);
      return acc;
    }, {})
  ).current;
  const previousActiveTabRef = useRef('appearance');
  const [chipDisplayOrder, setChipDisplayOrder] = useState(() => buildChipOrder('appearance'));
  const chipAnimations = useRef(
    TABS.reduce((acc, { key }) => { acc[key] = new Animated.Value(0); return acc; }, {})
  ).current;
  const chipLayoutsRef = useRef({});
  const pendingChipAnimation = useRef(null);

  useEffect(() => {
    loadServerInfo();
    loadSettings();
    loadCacheStats();
  }, []);

  const loadCacheStats = async () => {
    try {
      await CacheService.initialize();
      const stats = await CacheService.getStats();
      setCacheStats(stats);
      setMaxCacheSize(stats.maxSizeMB);
    } catch (error) {
      console.error('Error loading cache stats:', error);
    }
  };

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
        setSettings(prev => ({ ...prev, ...JSON.parse(savedSettings) }));
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
    saveSettings({ ...settings, [key]: value });
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
                CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] })
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
      `This will clear ${cacheStats?.totalSizeMB || 0} MB of cached data. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await CacheService.clearAll();
              await loadCacheStats();
              Alert.alert('Success', 'Cache cleared successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cache');
              console.error('Error clearing cache:', error);
            }
          },
        },
      ]
    );
  };

  const handleMaxCacheSizeChange = async (newSize) => {
    try {
      await CacheService.setMaxSize(newSize);
      setMaxCacheSize(newSize);
      await loadCacheStats();
      setShowCacheDialog(false);
      Alert.alert('Success', `Maximum cache size set to ${newSize} MB`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update cache size');
      console.error('Error updating cache size:', error);
    }
  };

  const handleChipLayout = useCallback((key) => (event) => {
    const { x } = event.nativeEvent.layout;
    chipLayoutsRef.current[key] = { x };
    const pending = pendingChipAnimation.current;
    if (pending && key in pending) {
      const delta = pending[key] ? pending[key].x - x : 0;
      chipAnimations[key].setValue(delta);
      Animated.timing(chipAnimations[key], {
        toValue: 0,
        duration: CHIP_REORDER_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      delete pending[key];
    }
  }, [chipAnimations]);

  const handleTabPress = useCallback((key) => {
    if (key === activeTab) return;

    const previousLayouts = { ...chipLayoutsRef.current };
    pendingChipAnimation.current = previousLayouts;

    const prev = previousActiveTabRef.current;
    const prevAnim = chipHighlightAnimations[prev];
    const nextAnim = chipHighlightAnimations[key];

    prevAnim?.stopAnimation();
    nextAnim?.stopAnimation();

    Animated.parallel([
      Animated.timing(prevAnim, {
        toValue: 0,
        duration: CHIP_FADE_OUT_DURATION,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(nextAnim, {
        toValue: 1,
        duration: CHIP_FADE_IN_DURATION,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();

    previousActiveTabRef.current = key;
    setActiveTab(key);
    setChipDisplayOrder(buildChipOrder(key));
  }, [activeTab, chipHighlightAnimations, chipAnimations]);

  const backgroundArt = useMemo(() => {
    if (currentTrack?.coverArt) return { uri: SubsonicAPI.getCoverArtUrl(currentTrack.coverArt, 600) };
    if (currentTrack?.albumId) return { uri: SubsonicAPI.getCoverArtUrl(currentTrack.albumId, 600) };
    return DEFAULT_ART;
  }, [currentTrack?.coverArt, currentTrack?.albumId]);

  const renderAppearanceTab = () => (
    <Card style={styles.card}>
      <Card.Content>
        <Text style={styles.sectionTitle}>Accent Color</Text>
        <Text style={styles.sectionDescription}>
          Select an accent color from a curated palette
        </Text>
        <View style={styles.accentColorGrid}>
          {Object.entries(accentPalettes).map(([key, palette]) => (
            <TouchableOpacity
              key={key}
              style={[styles.accentColorOption, accentColor === key && styles.accentColorSelected]}
              onPress={() => changeAccentColor(key)}
            >
              <View style={[styles.accentColorSwatch, { backgroundColor: palette.primary }]} />
              <Text style={styles.accentColorName}>{palette.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card.Content>
    </Card>
  );

  const renderGeneralTab = () => (
    <>
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
    </>
  );

  const renderServerTab = () => (
    <>
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
          <Button mode="outlined" onPress={() => setShowServerDialog(true)} style={styles.button}>
            Update Server Settings
          </Button>
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
    </>
  );

  const renderStorageTab = () => (
    <>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Storage & Cache</Text>
          {cacheStats && (
            <>
              <View style={styles.cacheStatsContainer}>
                <View style={styles.cacheStatRow}>
                  <Text style={styles.cacheStatLabel}>Cache Usage</Text>
                  <Text style={styles.cacheStatValue}>
                    {cacheStats.totalSizeMB} MB / {cacheStats.maxSizeMB} MB
                  </Text>
                </View>
                <ProgressBar
                  progress={Math.min(cacheStats.totalSizeBytes / (cacheStats.maxSizeMB * 1024 * 1024), 1)}
                  color={theme.colors.primary}
                  style={styles.progressBar}
                />
                <View style={styles.cacheStatRow}>
                  <Text style={styles.cacheStatLabel}>Cached Items</Text>
                  <Text style={styles.cacheStatValue}>{cacheStats.entryCount}</Text>
                </View>
              </View>
              <Divider style={styles.divider} />
            </>
          )}
          <List.Item
            title="Maximum Cache Size"
            description={`Currently set to ${maxCacheSize} MB`}
            left={props => <List.Icon {...props} icon="database" />}
            onPress={() => setShowCacheDialog(true)}
          />
          <Divider />
          <List.Item
            title="Clear Cache"
            description={cacheStats ? `Clear ${cacheStats.totalSizeMB} MB of cached data` : 'Clear all cached data'}
            left={props => <List.Icon {...props} icon="delete-sweep" />}
            onPress={clearCache}
          />
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Downloads</Text>
          <List.Item
            title="Wi-Fi download only"
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
    </>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'appearance': return renderAppearanceTab();
      case 'general': return renderGeneralTab();
      case 'server': return renderServerTab();
      case 'storage': return renderStorageTab();
      default: return renderAppearanceTab();
    }
  };

  return (
    <ScreenBackground source={backgroundArt} backgroundStyle={styles.backgroundImage} blurStyle={styles.blurOverlay}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentInsetAdjustmentBehavior="never"
            style={styles.chipScrollContainer}
            contentContainerStyle={styles.chipContainer}
          >
            {chipDisplayOrder.map(({ key, label }) => {
              const highlightValue = chipHighlightAnimations[key];
              const backgroundColor = highlightValue.interpolate({
                inputRange: [0, 1],
                outputRange: [theme.colors.surfaceVariant, theme.colors.secondary],
                extrapolate: 'clamp',
              });
              const textColor = highlightValue.interpolate({
                inputRange: [0, 1],
                outputRange: [theme.colors.onSurfaceVariant, theme.colors.onSecondary],
                extrapolate: 'clamp',
              });
              return (
                <Animated.View
                  key={key}
                  onLayout={handleChipLayout(key)}
                  style={{
                    transform: [{ translateX: chipAnimations[key] }],
                    zIndex: activeTab === key ? 2 : 1,
                  }}
                >
                  <AnimatedTouchableOpacity
                    onPress={() => handleTabPress(key)}
                    style={[styles.bubbleChip, { backgroundColor }]}
                    activeOpacity={0.8}
                  >
                    <AnimatedText style={[styles.bubbleChipText, { color: textColor }]}>
                      {label}
                    </AnimatedText>
                  </AnimatedTouchableOpacity>
                </Animated.View>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {renderActiveTab()}

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

            <Dialog visible={showCacheDialog} onDismiss={() => setShowCacheDialog(false)}>
              <Dialog.Title>Maximum Cache Size</Dialog.Title>
              <Dialog.Content>
                <Text style={styles.dialogDescription}>
                  Set the maximum amount of storage the app can use for caching library data.
                </Text>
                <View style={styles.sliderContainer}>
                  <Text style={styles.sliderLabel}>{maxCacheSize} MB</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={100}
                    maximumValue={20000}
                    step={50}
                    value={maxCacheSize}
                    onValueChange={setMaxCacheSize}
                    minimumTrackTintColor={theme.colors.primary}
                    maximumTrackTintColor={theme.colors.outline}
                    thumbTintColor={theme.colors.primary}
                  />
                  <View style={styles.sliderLabels}>
                    <Text style={styles.sliderLabelSmall}>100 MB</Text>
                    <Text style={styles.sliderLabelSmall}>20 GB</Text>
                  </View>
                </View>
              </Dialog.Content>
              <Dialog.Actions>
                <Button onPress={() => setShowCacheDialog(false)}>Cancel</Button>
                <Button onPress={() => handleMaxCacheSizeChange(maxCacheSize)}>Apply</Button>
              </Dialog.Actions>
            </Dialog>
          </Portal>

          <View style={styles.scrollFooter} />
        </ScrollView>
      </View>
    </ScreenBackground>
  );
}
