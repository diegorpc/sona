import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  Alert,
  TouchableOpacity,
  Image,
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
  IconButton,
} from 'react-native-paper';
import { CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import SubsonicAPI from '../services/SubsonicAPI';
import AudioPlayer from '../services/AudioPlayer';
import CacheService from '../services/CacheService';
import ArtworkCache from '../services/ArtworkCache';
import SongCache from '../services/SongCache';
import { DEFAULT_SETTINGS, getAppSettings, saveAppSettings } from '../services/AppSettings';
import { getPinnedPlaylistIds, setPinnedPlaylistIds, MAX_PINNED } from '../services/PinnedPlaylists';
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
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [showServerDialog, setShowServerDialog] = useState(false);
  const [newServerUrl, setNewServerUrl] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [metaCacheStats, setMetaCacheStats] = useState(null);
  const [musicCacheStats, setMusicCacheStats] = useState(null);
  const [maxMetaCacheSize, setMaxMetaCacheSize] = useState(50);
  const [maxMusicCacheSize, setMaxMusicCacheSize] = useState(2048);
  // null | 'metadata' | 'music'
  const [cacheDialog, setCacheDialog] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [pinnedIds, setPinnedIds] = useState([]);

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
    loadPlaylistPins();
  }, []);

  const loadPlaylistPins = async () => {
    try {
      const [resp, pinned] = await Promise.all([
        SubsonicAPI.getPlaylists().catch(() => null),
        getPinnedPlaylistIds(),
      ]);
      const list = resp?.playlist || [];
      setPlaylists(list);
      // Drop pins whose playlist was deleted — but only when the fetch succeeded,
      // so a failed request doesn't wipe valid pins.
      if (list.length > 0) {
        const existing = new Set(list.map(p => String(p.id)));
        const valid = pinned.filter(id => existing.has(id));
        if (valid.length !== pinned.length) {
          setPinnedIds(await setPinnedPlaylistIds(valid));
          return;
        }
      }
      setPinnedIds(pinned);
    } catch (error) {
      console.error('Error loading playlist pins:', error);
    }
  };

  const togglePin = async (playlistId) => {
    const key = String(playlistId);
    let next;
    if (pinnedIds.includes(key)) {
      next = pinnedIds.filter(id => id !== key);
    } else {
      if (pinnedIds.length >= MAX_PINNED) {
        Alert.alert('Pin limit reached', `You can pin up to ${MAX_PINNED} playlists. Unpin one first.`);
        return;
      }
      next = [...pinnedIds, key];
    }
    setPinnedIds(await setPinnedPlaylistIds(next));
  };

  // Pinned playlists first (in pin order), then the rest alphabetically.
  const sortedPlaylists = useMemo(() => {
    const byId = new Map(playlists.map(p => [String(p.id), p]));
    const pinned = pinnedIds.map(id => byId.get(String(id))).filter(Boolean);
    const pinnedSet = new Set(pinned.map(p => String(p.id)));
    const rest = playlists
      .filter(p => !pinnedSet.has(String(p.id)))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }));
    return [...pinned, ...rest];
  }, [playlists, pinnedIds]);

  const loadCacheStats = async () => {
    try {
      await CacheService.initialize();
      const [jsonStats, artStats, musicStats] = await Promise.all([
        CacheService.getStats(),
        ArtworkCache.getStats(),
        SongCache.getStats(),
      ]);
      // Metadata + artwork share one budget; combine them for display
      const combinedBytes = jsonStats.totalSizeBytes + artStats.totalSizeBytes;
      setMetaCacheStats({
        totalSizeMB: (combinedBytes / (1024 * 1024)).toFixed(2),
        totalSizeBytes: combinedBytes,
        maxSizeMB: jsonStats.maxSizeMB,
        entryCount: jsonStats.entryCount + artStats.entryCount,
      });
      setMaxMetaCacheSize(jsonStats.maxSizeMB);
      setMusicCacheStats(musicStats);
      setMaxMusicCacheSize(musicStats.maxSizeMB);
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
      setSettings(await getAppSettings());
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      await saveAppSettings(newSettings);
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

  const clearMetadataCache = async () => {
    Alert.alert(
      'Clear Metadata Cache',
      `This will clear ${metaCacheStats?.totalSizeMB || 0} MB of cached metadata and artwork. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all([CacheService.clearAll(), ArtworkCache.clearAll()]);
              await loadCacheStats();
              Alert.alert('Success', 'Metadata cache cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cache');
              console.error('Error clearing cache:', error);
            }
          },
        },
      ]
    );
  };

  const clearMusicCache = async () => {
    Alert.alert(
      'Clear Music Cache',
      `This will delete ${musicCacheStats?.totalSizeMB || 0} MB of cached songs. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await SongCache.clearAll();
              await loadCacheStats();
              Alert.alert('Success', 'Music cache cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear cache');
              console.error('Error clearing music cache:', error);
            }
          },
        },
      ]
    );
  };

  const handleMaxCacheSizeChange = async (kind, newSize) => {
    try {
      if (kind === 'music') {
        await SongCache.setMaxSize(newSize);
      } else {
        await CacheService.setMaxSize(newSize);
        // Shrinking the shared budget may require evicting artwork too
        await ArtworkCache.pruneToBudget();
      }
      await loadCacheStats();
      setCacheDialog(null);
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
    if (currentTrack?.coverArt) return ArtworkCache.getArtworkSource(currentTrack.coverArt, 600, DEFAULT_ART);
    if (currentTrack?.albumId) return ArtworkCache.getArtworkSource(currentTrack.albumId, 600, DEFAULT_ART);
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
            title="Original quality streaming"
            description="Stream untouched files. Off: transcode to MP3 320 kbps to save data"
            left={props => <List.Icon {...props} icon="high-definition" />}
            right={() => (
              <Switch
                value={settings.originalQualityStreaming}
                onValueChange={(value) => handleSettingChange('originalQualityStreaming', value)}
              />
            )}
          />
          <Divider />
          <List.Item
            title="Original quality caching"
            description="Cache untouched files. Off: cached songs are transcoded to MP3 320 kbps"
            left={props => <List.Icon {...props} icon="download" />}
            right={() => (
              <Switch
                value={settings.originalQualityCaching}
                onValueChange={(value) => handleSettingChange('originalQualityCaching', value)}
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
          <Text style={styles.sectionTitle}>Home Playlists</Text>
          <Text style={styles.sectionDescription}>
            Pin playlists to keep them in the Home grid. Pinned playlists always show first; the remaining slots fill automatically with recently-listened ones.
          </Text>
          <Text style={styles.pinCountHint}>{pinnedIds.length} / {MAX_PINNED} pinned</Text>
          {sortedPlaylists.length === 0 ? (
            <Text style={styles.sectionDescription}>No playlists found.</Text>
          ) : (
            sortedPlaylists.map((pl, idx) => {
              const isPinned = pinnedIds.includes(String(pl.id));
              const coverSource = pl.coverArt ? ArtworkCache.getArtworkSource(pl.coverArt, 150) : null;
              return (
                <React.Fragment key={pl.id}>
                  {idx > 0 && <Divider />}
                  <List.Item
                    title={pl.name}
                    titleNumberOfLines={1}
                    description={pl.songCount != null ? `${pl.songCount} songs` : undefined}
                    onPress={() => togglePin(pl.id)}
                    left={() =>
                      coverSource
                        ? <Image source={coverSource} style={styles.playlistThumb} resizeMode="cover" />
                        : <List.Icon icon="playlist-music" />
                    }
                    right={() => (
                      <IconButton
                        icon={isPinned ? 'pin' : 'pin-outline'}
                        size={22}
                        iconColor={isPinned ? theme.colors.primary : theme.colors.onSurfaceVariant}
                        onPress={() => togglePin(pl.id)}
                        accessibilityLabel={isPinned ? `Unpin ${pl.name}` : `Pin ${pl.name}`}
                      />
                    )}
                  />
                </React.Fragment>
              );
            })
          )}
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

  const renderCacheCard = (title, description, stats, maxSize, onSetMax, onClear) => (
    <Card style={styles.card}>
      <Card.Content>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionDescription}>{description}</Text>
        {stats && (
          <>
            <View style={styles.cacheStatsContainer}>
              <View style={styles.cacheStatRow}>
                <Text style={styles.cacheStatLabel}>Usage</Text>
                <Text style={styles.cacheStatValue}>
                  {stats.totalSizeMB} MB / {stats.maxSizeMB} MB
                </Text>
              </View>
              <ProgressBar
                progress={Math.min(stats.totalSizeBytes / (stats.maxSizeMB * 1024 * 1024), 1)}
                color={theme.colors.primary}
                style={styles.progressBar}
              />
              <View style={styles.cacheStatRow}>
                <Text style={styles.cacheStatLabel}>Cached Items</Text>
                <Text style={styles.cacheStatValue}>{stats.entryCount}</Text>
              </View>
            </View>
            <Divider style={styles.divider} />
          </>
        )}
        <List.Item
          title="Maximum Size"
          description={`Currently set to ${maxSize} MB`}
          left={props => <List.Icon {...props} icon="database" />}
          onPress={onSetMax}
        />
        <Divider />
        <List.Item
          title="Clear Cache"
          description={stats ? `Clear ${stats.totalSizeMB} MB of cached data` : 'Clear all cached data'}
          left={props => <List.Icon {...props} icon="delete-sweep" />}
          onPress={onClear}
        />
      </Card.Content>
    </Card>
  );

  const renderStorageTab = () => (
    <>
      {renderCacheCard(
        'Metadata & Artwork Cache',
        'Library data and cover art kept for instant page loads.',
        metaCacheStats,
        maxMetaCacheSize,
        () => setCacheDialog('metadata'),
        clearMetadataCache
      )}
      {renderCacheCard(
        'Music Cache',
        'Downloaded songs for instant, offline-capable playback.',
        musicCacheStats,
        maxMusicCacheSize,
        () => setCacheDialog('music'),
        clearMusicCache
      )}

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

            <Dialog visible={cacheDialog !== null} onDismiss={() => setCacheDialog(null)}>
              <Dialog.Title>
                {cacheDialog === 'music' ? 'Maximum Music Cache Size' : 'Maximum Metadata Cache Size'}
              </Dialog.Title>
              <Dialog.Content>
                <Text style={styles.dialogDescription}>
                  {cacheDialog === 'music'
                    ? 'Set the maximum storage used for cached songs.'
                    : 'Set the maximum storage used for cached library data and cover art.'}
                </Text>
                <View style={styles.sliderContainer}>
                  <Text style={styles.sliderLabel}>
                    {cacheDialog === 'music' ? maxMusicCacheSize : maxMetaCacheSize} MB
                  </Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={cacheDialog === 'music' ? 100 : 10}
                    maximumValue={cacheDialog === 'music' ? 20000 : 500}
                    step={cacheDialog === 'music' ? 100 : 10}
                    value={cacheDialog === 'music' ? maxMusicCacheSize : maxMetaCacheSize}
                    onValueChange={cacheDialog === 'music' ? setMaxMusicCacheSize : setMaxMetaCacheSize}
                    minimumTrackTintColor={theme.colors.primary}
                    maximumTrackTintColor={theme.colors.outline}
                    thumbTintColor={theme.colors.primary}
                  />
                  <View style={styles.sliderLabels}>
                    <Text style={styles.sliderLabelSmall}>{cacheDialog === 'music' ? '100 MB' : '10 MB'}</Text>
                    <Text style={styles.sliderLabelSmall}>{cacheDialog === 'music' ? '20 GB' : '500 MB'}</Text>
                  </View>
                </View>
              </Dialog.Content>
              <Dialog.Actions>
                <Button onPress={() => setCacheDialog(null)}>Cancel</Button>
                <Button
                  onPress={() =>
                    handleMaxCacheSizeChange(
                      cacheDialog,
                      cacheDialog === 'music' ? maxMusicCacheSize : maxMetaCacheSize
                    )
                  }
                >
                  Apply
                </Button>
              </Dialog.Actions>
            </Dialog>
          </Portal>

          <View style={styles.scrollFooter} />
        </ScrollView>
      </View>
    </ScreenBackground>
  );
}
