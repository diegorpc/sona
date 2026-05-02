import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import {
  View,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Animated,
  Easing,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenBackground from '../components/ScreenBackground';

import SubsonicAPI from '../services/SubsonicAPI';
import AudioPlayer from '../services/AudioPlayer';
import { expandPlayerOverlay } from '../services/PlayerOverlayController';
import { usePlayer } from '../contexts/PlayerContext';
import { useTheme } from '../contexts/ThemeContext';
import { createStyles } from '../styles/ArtistScreen.styles';

const DEFAULT_ART = require('../../assets/default-album.png');

const TABS = [
  { key: 'albums', label: 'Albums' },
  { key: 'topSongs', label: 'Top Songs' },
  { key: 'favoriteSongs', label: 'Favorite Songs' },
];

const CHIP_REORDER_DURATION = 620;
const CHIP_FADE_OUT_DURATION = 200;
const CHIP_FADE_IN_DURATION = 240;

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedText = Animated.createAnimatedComponent(Text);

const buildChipOrder = (selectedKey) => {
  const selected = TABS.find(t => t.key === selectedKey);
  if (!selected) return TABS;
  return [selected, ...TABS.filter(t => t.key !== selectedKey)];
};

// ─── Album grid card (2x2 grid with large media art) ──────────────
const AlbumCard = memo(({ item, onPress }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const coverArtUrl = useMemo(() =>
    item.coverArt ? SubsonicAPI.getCoverArtUrl(item.coverArt, 400) : null,
    [item.coverArt]
  );

  const subtitle = [item.year, item.songCount ? `${item.songCount} songs` : null]
    .filter(Boolean).join(' · ');

  return (
    <TouchableOpacity style={styles.albumCard} onPress={onPress} activeOpacity={0.7}>
      <Image
        source={coverArtUrl ? { uri: coverArtUrl } : DEFAULT_ART}
        style={styles.albumCardArt}
        defaultSource={DEFAULT_ART}
      />
      <Text style={styles.albumCardTitle} numberOfLines={1}>{item.name}</Text>
      {subtitle ? <Text style={styles.albumCardSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
    </TouchableOpacity>
  );
}, (prev, next) => prev.item.id === next.item.id);

// ─── Top songs / Favorite songs row (with art) ────────────────────
const SongRow = memo(({ item, index, isPlaying, onPress, onMenuPress }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const coverArtUrl = useMemo(() =>
    item.coverArt ? SubsonicAPI.getCoverArtUrl(item.coverArt, 200) : null,
    [item.coverArt]
  );
  const duration = useMemo(() => {
    if (!item.duration) return '';
    const m = Math.floor(item.duration / 60);
    const s = item.duration % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, [item.duration]);

  return (
    <TouchableOpacity
      style={[styles.songItem, isPlaying && styles.songItemPlaying]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.trackNumberWrapper}>
        {isPlaying
          ? <MaterialIcons name="play-arrow" size={14} color={theme.colors.primary} style={styles.nowPlayingIcon} />
          : <Text style={styles.trackNumber}>{index + 1}</Text>
        }
      </View>
      <Image
        source={coverArtUrl ? { uri: coverArtUrl } : DEFAULT_ART}
        style={styles.songImage}
        defaultSource={DEFAULT_ART}
      />
      <View style={styles.songInfo}>
        <Text style={[styles.songTitle, isPlaying && styles.songTitlePlaying]} numberOfLines={1}>
          {item.title}
        </Text>
        {item.album && (
          <Text style={[styles.songArtist, isPlaying && styles.songArtistPlaying]} numberOfLines={1}>
            {item.album}
          </Text>
        )}
      </View>
      {duration ? <Text style={styles.songDuration}>{duration}</Text> : null}
      <TouchableOpacity style={styles.menuButton} onPress={onMenuPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <MaterialIcons name="more-vert" size={18} color={theme.colors.onSurface} style={{ opacity: 0.4 }} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}, (prev, next) =>
  prev.item.id === next.item.id &&
  prev.index === next.index &&
  prev.isPlaying === next.isPlaying
);

export default function ArtistScreen({ route, navigation }) {
  const { artist } = route.params;
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { playerState: { currentTrack } } = usePlayer();
  const [artistData, setArtistData] = useState(null);
  const [topSongs, setTopSongs] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [appearsInAlbums, setAppearsInAlbums] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingTopSongs, setIsLoadingTopSongs] = useState(true);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(true);
  const [activeTab, setActiveTab] = useState('albums');

  // ─── Chip animation state ─────────────────────────────────────
  const chipHighlightAnimations = useRef(
    TABS.reduce((acc, { key }) => {
      acc[key] = new Animated.Value(key === 'albums' ? 1 : 0);
      return acc;
    }, {})
  ).current;
  const previousActiveTabRef = useRef('albums');
  const [chipDisplayOrder, setChipDisplayOrder] = useState(() => buildChipOrder('albums'));
  const chipAnimations = useRef(
    TABS.reduce((acc, { key }) => { acc[key] = new Animated.Value(0); return acc; }, {})
  ).current;
  const chipLayoutsRef = useRef({});
  const pendingChipAnimation = useRef(null);

  useEffect(() => { loadArtistData(); }, []);

  const loadArtistData = async () => {
    let data = null;
    try {
      setIsLoading(true);
      setIsLoadingTopSongs(true);
      setIsLoadingFavorites(true);
      data = await SubsonicAPI.getArtist(artist.id);
      setArtistData(data);
    } catch (e) {
      console.error('Error loading artist:', e);
    } finally {
      setIsLoading(false);
    }

    // Load top songs and starred songs in background — non-blocking
    SubsonicAPI.getTopSongs(artist.name, 50)
      .then(songs => setTopSongs(songs))
      .catch(() => { /* non-critical */ })
      .finally(() => setIsLoadingTopSongs(false));

    SubsonicAPI.getStarred()
      .then(starred => {
        const artistLiked = (starred?.song || []).filter(
          s => s.artistId === artist.id || s.artist === artist.name
        );
        setLikedSongs(artistLiked);
      })
      .catch(() => { /* non-critical */ })
      .finally(() => setIsLoadingFavorites(false));

    // Load "Appears In" albums in background — albums where this artist has
    // a song but is not the album artist.
    if (data) {
      const ownAlbumIds = (data.album || []).map(a => a.id);
      SubsonicAPI.getArtistAppearsIn(artist, ownAlbumIds)
        .then(setAppearsInAlbums)
        .catch(() => { /* non-critical */ });
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadArtistData();
    setIsRefreshing(false);
  };

  const handleAlbumPress = useCallback((album) => {
    navigation.push('Album', { album });
  }, [navigation]);

  const handleSongPress = useCallback(async (song, songs, index) => {
    try {
      await AudioPlayer.playTrack(song, songs, index, {
        contextName: artist.name,
        contextType: 'artist',
        contextId: artist.id,
      });
      expandPlayerOverlay();
    } catch (e) {
      console.error('Error playing song:', e);
    }
  }, [artist]);

  const artistImageUrl = useMemo(() => {
    if (artist.artistImageUrl) return artist.artistImageUrl;
    if (artist.id) return SubsonicAPI.getCoverArtUrl(artist.id, 600);
    return null;
  }, [artist]);

  const backgroundArt = useMemo(() => {
    if (artistImageUrl) return { uri: artistImageUrl };
    if (currentTrack?.coverArt) return { uri: SubsonicAPI.getCoverArtUrl(currentTrack.coverArt, 600) };
    return DEFAULT_ART;
  }, [artistImageUrl, currentTrack?.coverArt]);

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

  const renderSong = useCallback((songs) => ({ item, index }) => {
    const isPlaying = currentTrack?.id === item.id;
    return (
      <SongRow
        item={item}
        index={index}
        isPlaying={isPlaying}
        onPress={() => handleSongPress(item, songs, index)}
        onMenuPress={() => {/* TODO */}}
      />
    );
  }, [currentTrack?.id, handleSongPress]);

  const songKeyExtractor = useCallback((item, index) => item.id || `song-${index}`, []);

  const albumStats = useMemo(() => {
    if (!artistData) return '';
    const albumCount = (artistData.albumCount || artistData.album?.length || 0) + (appearsInAlbums?.length || 0);
    return [
      `In ${albumCount} album${albumCount !== 1 ? 's' : ''}`,
    ].filter(Boolean).join(' · ');
  }, [artistData, appearsInAlbums]);

  const StickyHeader = (
    <View style={styles.stickyHeader} pointerEvents="box-none">
      <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <MaterialIcons name="arrow-back" size={26} style={styles.stickyNavIcon} />
      </TouchableOpacity>
      <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <MaterialIcons name="more-horiz" size={24} style={styles.stickyNavIcon} />
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <ScreenBackground source={backgroundArt} backgroundStyle={styles.backgroundImage} blurStyle={styles.blurOverlay}>
          {StickyHeader}
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading artist…</Text>
          </View>
      </ScreenBackground>
    );
  }

  if (!artistData) {
    return (
      <ScreenBackground source={backgroundArt} backgroundStyle={styles.backgroundImage} blurStyle={styles.blurOverlay}>
          {StickyHeader}
          <View style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={64} color={theme.colors.error} />
            <Text style={styles.errorText}>Failed to load artist</Text>
            <Text style={styles.errorSubtext}>Please try again later</Text>
          </View>
      </ScreenBackground>
    );
  }

  const activeSongs = activeTab === 'topSongs' ? topSongs : likedSongs;
  const isLoadingSongs = activeTab === 'topSongs' ? isLoadingTopSongs : isLoadingFavorites;

  return (
    <ScreenBackground source={backgroundArt} backgroundStyle={styles.backgroundImage} blurStyle={styles.blurOverlay}>
      <View style={styles.container}>
        {/* Rounded glowing artist art */}
        <View style={styles.artContainer}>
          <View style={styles.artShadow}>
            <Image
              source={backgroundArt}
              style={styles.artImage}
              resizeMode="cover"
              defaultSource={DEFAULT_ART}
            />
          </View>
        </View>

        {/* Artist name + stats */}
        <View style={styles.titleBlock}>
          <Text style={styles.artistName} numberOfLines={2}>{artist.name}</Text>
          {albumStats ? <Text style={styles.artistStats}>{albumStats}</Text> : null}
        </View>

        {/* Animated chip tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScrollContainer}
          contentContainerStyle={styles.chipTabsContainer}
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
                  style={[styles.chipTab, { backgroundColor }]}
                  activeOpacity={0.8}
                >
                  <AnimatedText style={[styles.chipTabText, { color: textColor }]}>
                    {label}
                  </AnimatedText>
                </AnimatedTouchableOpacity>
              </Animated.View>
            );
          })}
        </ScrollView>

        {/* Content */}
        {activeTab === 'albums' ? (
          <ScrollView
            key="albums-sections"
            style={{ flex: 1 }}
            contentContainerStyle={styles.albumGridContainer}
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[theme.colors.primary]} />
            }
          >
            {(artistData.album || []).length !== 0 && 
            (<>
              <Text style={styles.sectionHeader}>Albums</Text>
              <View style={styles.albumGridWrap}>
                {(artistData.album || []).map(item => (
                  <AlbumCard key={item.id} item={item} onPress={() => handleAlbumPress(item)} />
                ))}
              </View>
            </>)
            }  
            {appearsInAlbums.length > 0 && (
              <>
                <Text style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>Appears In</Text>
                <View style={styles.albumGridWrap}>
                  {appearsInAlbums.map(item => (
                    <AlbumCard key={item.id} item={item} onPress={() => handleAlbumPress(item)} />
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        ) : isLoadingSongs ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <FlatList
            key="songs-list"
            style={{ flex: 1 }}
            data={activeSongs}
            renderItem={renderSong(activeSongs)}
            keyExtractor={songKeyExtractor}
            contentContainerStyle={styles.listContainer}
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialIcons name="music-note" size={64} color={theme.colors.outline} />
                <Text style={styles.emptyText}>No songs found</Text>
                <Text style={styles.emptySubtext}>
                  {activeTab === 'favoriteSongs' ? 'Like songs from this artist to see them here' : 'No top songs available'}
                </Text>
              </View>
            }
          />
        )}
        {StickyHeader}
      </View>
    </ScreenBackground>
  );
}
