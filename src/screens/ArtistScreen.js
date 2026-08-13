import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import {
  View,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Easing,
} from 'react-native';
import { Image } from 'expo-image';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import ScreenBackground from '../components/ScreenBackground';
import CachedImage from '../components/CachedImage';
import SongMenu from '../components/SongMenu';
import AddToPlaylistModal from '../components/AddToPlaylistModal';

import SubsonicAPI from '../services/SubsonicAPI';
import AudioPlayer from '../services/AudioPlayer';
import { useArtworkSource } from '../hooks/useArtwork';
import CacheService from '../services/CacheService';
import { expandPlayerOverlay } from '../services/PlayerOverlayController';
import { useCurrentTrack, usePlayerActions } from '../contexts/PlayerContext';
import { useTheme } from '../contexts/ThemeContext';
import { createStyles } from '../styles/ArtistScreen.styles';
import { createStyles as createMenuStyles } from '../styles/SongMenu.styles';

const DEFAULT_ART = require('../../assets/default-album.png');

const TABS = [
  { key: 'albums', label: 'Albums' },
  { key: 'topSongs', label: 'Top Songs' },
  { key: 'favoriteSongs', label: 'Favorite Songs' },
];

const CHIP_REORDER_DURATION = 620;
const CHIP_FADE_OUT_DURATION = 200;
const CHIP_FADE_IN_DURATION = 240;
// Leftmost strip reserved for the navigator's swipe-back gesture (matches
// gestureResponseDistance in App.js). The negative hitSlop below keeps row
// pans from activating on touches that start inside it.
const SWIPE_BACK_EDGE_WIDTH = 50;

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedText = Animated.createAnimatedComponent(Text);

const buildChipOrder = (selectedKey) => {
  const selected = TABS.find(t => t.key === selectedKey);
  if (!selected) return TABS;
  return [selected, ...TABS.filter(t => t.key !== selectedKey)];
};

// Subsonic's `starred` field (when present) is the date-favorited timestamp.
const getStarredTimestamp = (song) => {
  const value = song?.starred;
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortByRecentlyFavorited = (songs) =>
  [...songs].sort((a, b) => getStarredTimestamp(b) - getStarredTimestamp(a));

const shuffleArray = (array) => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

// ─── Album grid card (2x2 grid with large media art) ──────────────
const AlbumCard = memo(({ item, onPress }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const subtitle = [item.year, item.songCount ? `${item.songCount} songs` : null]
    .filter(Boolean).join(' · ');

  return (
    <TouchableOpacity style={styles.albumCard} onPress={onPress} activeOpacity={0.7}>
      <CachedImage
        coverArtId={item.coverArt || item.id}
        fallbackSource={DEFAULT_ART}
        style={styles.albumCardArt}
      />
      <Text style={styles.albumCardTitle} numberOfLines={1}>{item.name}</Text>
      {subtitle ? <Text style={styles.albumCardSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
    </TouchableOpacity>
  );
}, (prev, next) => prev.item.id === next.item.id);

// ─── Swipe-left "Add last" action ─────────────────────────────────
const SwipeAddLast = memo(({ progress, theme }) => {
  const menuStyles = createMenuStyles(theme);
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [80, 0],
    extrapolate: 'clamp',
  });
  return (
    <View style={menuStyles.swipeAction}>
      <Animated.View style={[menuStyles.swipeActionContent, { transform: [{ translateX }] }]}>
        <MaterialIcons name="queue-music" size={22} color={theme.colors.onPrimary} />
        <Text style={menuStyles.swipeActionLabel}>Add last</Text>
      </Animated.View>
    </View>
  );
});

// ─── Swipe-right "Favorite" action ────────────────────────────────
const SwipeFavorite = memo(({ progress, theme, starred }) => {
  const menuStyles = createMenuStyles(theme);
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 0],
    extrapolate: 'clamp',
  });
  return (
    <View style={menuStyles.swipeAction}>
      <Animated.View style={[menuStyles.swipeActionContent, { backgroundColor: theme.colors.error, transform: [{ translateX }] }]}>
        <MaterialIcons name={starred ? 'favorite' : 'favorite-border'} size={22} color="#fff" />
        <Text style={[menuStyles.swipeActionLabel, { color: '#fff' }]}>{starred ? 'Unfavorite' : 'Favorite'}</Text>
      </Animated.View>
    </View>
  );
});

// ─── Top songs / Favorite songs row (with art) ────────────────────
const SongRow = memo(({ item, index, isPlaying, onPress, onMenuPress, onLongPress, onAddLast, onToggleFavorite }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const swipeRef = useRef(null);
  const starred = Boolean(item.starred);

  const duration = useMemo(() => {
    if (!item.duration) return '';
    const m = Math.floor(item.duration / 60);
    const s = item.duration % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, [item.duration]);

  const renderRightActions = useCallback((progress) => (
    <SwipeAddLast progress={progress} theme={theme} />
  ), [theme]);

  const renderLeftActions = useCallback((progress) => (
    <SwipeFavorite progress={progress} theme={theme} starred={starred} />
  ), [theme, starred]);

  const handleSwipeOpen = useCallback((direction) => {
    if (direction === 'right') {
      onAddLast(item);
    } else {
      onToggleFavorite(item);
    }
    swipeRef.current?.close();
  }, [item, onAddLast, onToggleFavorite]);

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      onSwipeableOpen={handleSwipeOpen}
      rightThreshold={60}
      leftThreshold={60}
      overshootRight={false}
      overshootLeft={false}
      friction={2}
      hitSlop={{ left: -SWIPE_BACK_EDGE_WIDTH }}
    >
      <TouchableOpacity
        style={[styles.songItem, isPlaying && styles.songItemPlaying]}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        activeOpacity={0.7}
      >
        <View style={styles.heartWrapper}>
          <MaterialIcons
            name={starred ? 'favorite' : null}
            style={starred ? styles.heartIcon : null}
          />
        </View>
        <View style={styles.trackNumberWrapper}>
          {isPlaying
            ? <MaterialIcons name="play-arrow" size={14} color={theme.colors.primary} style={styles.nowPlayingIcon} />
            : <Text style={styles.trackNumber}>{index + 1}</Text>
          }
        </View>
        <CachedImage
          coverArtId={item.coverArt}
          fallbackSource={DEFAULT_ART}
          style={styles.songImage}
        />
        <View style={styles.songInfo}>
          <Text style={[styles.songTitle, isPlaying && styles.songTitlePlaying]} numberOfLines={1}>
            {item.title}
          </Text>
          {item.artist && (
            <Text style={[styles.songArtist, isPlaying && styles.songArtistPlaying]} numberOfLines={1}>
              {item.artist}
            </Text>
          )}
        </View>
        {duration ? <Text style={styles.songDuration}>{duration}</Text> : null}
        <TouchableOpacity style={styles.menuButton} onPress={onMenuPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="more-vert" size={18} color={theme.colors.onSurface} style={{ opacity: 0.4 }} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Swipeable>
  );
}, (prev, next) =>
  prev.item.id === next.item.id &&
  prev.index === next.index &&
  prev.isPlaying === next.isPlaying &&
  Boolean(prev.item.starred) === Boolean(next.item.starred)
);

export default function ArtistScreen({ route, navigation }) {
  const { artist } = route.params;
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const currentTrack = useCurrentTrack();
  const { insertIntoPriorityQueue, queueTracksNext, queueTracksLast } = usePlayerActions();
  const [artistData, setArtistData] = useState(null);
  const [topSongs, setTopSongs] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [appearsInAlbums, setAppearsInAlbums] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingTopSongs, setIsLoadingTopSongs] = useState(true);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(true);
  const [activeTab, setActiveTab] = useState('albums');
  const [menuSong, setMenuSong] = useState(null);
  const [addToPlaylistSong, setAddToPlaylistSong] = useState(null);
  // Which of Play/Shuffle/Queue is currently fetching its track list — kept
  // separate per button so, e.g., opening the queue menu doesn't flip the
  // Play pill into its spinner state.
  const [preparingAction, setPreparingAction] = useState(null);
  const [queueSongs, setQueueSongs] = useState(null);

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
      // Cached-first: paint immediately, then refresh from the network
      if (!artistData) {
        const cached = await CacheService.getAsync(`artist_${artist.id}`).catch(() => null);
        if (cached) {
          setArtistData(cached);
          setIsLoading(false);
        }
      }
      data = await SubsonicAPI.getArtist(artist.id);
      setArtistData(data);
      CacheService.set(`artist_${artist.id}`, data);
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
        setLikedSongs(sortByRecentlyFavorited(artistLiked));
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

  const backgroundArt = useArtworkSource(
    artist.id || currentTrack?.coverArt,
    DEFAULT_ART
  );

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

  const handleMenuPress = useCallback((item) => {
    setMenuSong(item);
  }, []);

  const handleLongPressSong = useCallback((item) => {
    setMenuSong(item);
  }, []);

  const handleAddLast = useCallback((item) => {
    insertIntoPriorityQueue(item);
  }, [insertIntoPriorityQueue]);

  // Optimistic: flip the heart immediately, then reconcile with the server;
  // roll back on failure. A song can show up in both Top Songs and Favorite
  // Songs, so both lists are updated to stay consistent.
  const handleToggleFavorite = useCallback((song) => {
    const wasStarred = Boolean(song.starred);
    const setStarred = (value) => {
      const applyTo = (list) => list.map(s => s.id === song.id ? { ...s, starred: value } : s);
      setTopSongs(applyTo);
      setLikedSongs(applyTo);
    };

    setStarred(wasStarred ? undefined : new Date().toISOString());

    const request = wasStarred ? SubsonicAPI.unstar(song.id) : SubsonicAPI.star(song.id);
    request.catch(e => {
      console.error('Error toggling favorite:', e);
      setStarred(wasStarred ? song.starred : undefined);
    });
  }, []);

  // Fetches full track listings for every owned album, then every "Appears
  // In" album, so Play/Shuffle/Queue on the Albums tab plays through the
  // artist's own discography before spilling into guest-appearance tracks.
  const getAlbumsTrackList = useCallback(async () => {
    const albums = [...(artistData?.album || []), ...appearsInAlbums];
    const results = await Promise.all(
      albums.map(a => SubsonicAPI.getAlbum(a.id).catch(() => null))
    );
    return results.flatMap(data => data?.song || []);
  }, [artistData, appearsInAlbums]);

  const getActiveTabSongs = useCallback(() => {
    if (activeTab === 'topSongs') return Promise.resolve(topSongs);
    if (activeTab === 'favoriteSongs') return Promise.resolve(likedSongs);
    return getAlbumsTrackList();
  }, [activeTab, topSongs, likedSongs, getAlbumsTrackList]);

  const handlePlayAll = useCallback(async () => {
    if (preparingAction) return;
    setPreparingAction('play');
    try {
      const songs = await getActiveTabSongs();
      if (!songs.length) return;
      await AudioPlayer.playTrack(songs[0], songs, 0, {
        contextName: artist.name,
        contextType: 'artist',
        contextId: artist.id,
      });
      expandPlayerOverlay();
    } catch (e) {
      console.error('Error playing all songs:', e);
    } finally {
      setPreparingAction(null);
    }
  }, [preparingAction, getActiveTabSongs, artist]);

  const handleShuffleAll = useCallback(async () => {
    if (preparingAction) return;
    setPreparingAction('shuffle');
    try {
      const songs = await getActiveTabSongs();
      if (!songs.length) return;
      const shuffled = shuffleArray(songs);
      await AudioPlayer.playTrack(shuffled[0], shuffled, 0, {
        contextName: artist.name,
        contextType: 'artist',
        contextId: artist.id,
      });
      expandPlayerOverlay();
    } catch (e) {
      console.error('Error shuffling songs:', e);
    } finally {
      setPreparingAction(null);
    }
  }, [preparingAction, getActiveTabSongs, artist]);

  const handleOpenQueueMenu = useCallback(async () => {
    if (preparingAction) return;
    setPreparingAction('queue');
    try {
      const songs = await getActiveTabSongs();
      if (songs.length) setQueueSongs(songs);
    } finally {
      setPreparingAction(null);
    }
  }, [preparingAction, getActiveTabSongs]);

  const queueMenuLabel = activeTab === 'topSongs'
    ? 'Top Songs'
    : activeTab === 'favoriteSongs'
      ? 'Favorite Songs'
      : 'All Albums';

  const queueMenuSong = useMemo(() => ({
    title: queueMenuLabel,
    artist: artist.name,
    coverArt: artist.id,
  }), [queueMenuLabel, artist]);

  const queueMenuOptions = useMemo(() => {
    if (!queueSongs?.length) return [];
    return [
      {
        key: 'queueFirst',
        label: 'Queue first',
        icon: 'queue-play-next',
        onPress: () => queueTracksNext(queueSongs),
      },
      {
        key: 'queueLast',
        label: 'Queue last',
        icon: 'add-to-queue',
        onPress: () => queueTracksLast(queueSongs),
      },
    ];
  }, [queueSongs, queueTracksNext, queueTracksLast]);

  const menuOptions = useMemo(() => {
    if (!menuSong) return [];
    return [
      {
        key: 'goToAlbum',
        label: 'Go to album',
        icon: 'album',
        onPress: () => {
          if (menuSong.albumId) navigation.push('Album', {
            album: { id: menuSong.albumId, name: menuSong.album, artist: menuSong.artist, coverArt: menuSong.coverArt },
          });
        },
      },
      {
        key: 'goToArtist',
        label: 'Go to artist',
        icon: 'person',
        onPress: () => {
          if (menuSong.artistId) navigation.push('Artist', { artist: { id: menuSong.artistId, name: menuSong.artist } });
        },
      },
      {
        key: 'addToPlaylist',
        label: 'Add to playlist',
        icon: 'playlist-add',
        onPress: () => setAddToPlaylistSong(menuSong),
      },
      {
        key: 'addNext',
        label: 'Add next in queue',
        icon: 'queue-play-next',
        onPress: () => insertIntoPriorityQueue(menuSong, 0),
      },
      {
        key: 'addLast',
        label: 'Add last in queue',
        icon: 'add-to-queue',
        onPress: () => insertIntoPriorityQueue(menuSong),
      },
      {
        key: 'download',
        label: 'Download',
        icon: 'download',
        disabled: true,
        onPress: () => {},
      },
    ];
  }, [menuSong, navigation, insertIntoPriorityQueue]);

  const renderSong = useCallback((songs) => ({ item, index }) => {
    const isPlaying = currentTrack?.id === item.id;
    return (
      <SongRow
        item={item}
        index={index}
        isPlaying={isPlaying}
        onPress={() => handleSongPress(item, songs, index)}
        onMenuPress={() => handleMenuPress(item)}
        onLongPress={() => handleLongPressSong(item)}
        onAddLast={handleAddLast}
        onToggleFavorite={handleToggleFavorite}
      />
    );
  }, [currentTrack?.id, handleSongPress, handleMenuPress, handleLongPressSong, handleAddLast, handleToggleFavorite]);

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
      {/* <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <MaterialIcons name="more-horiz" size={24} style={styles.stickyNavIcon} />
      </TouchableOpacity> */}
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
              contentFit="cover"
              placeholder={DEFAULT_ART}
              placeholderContentFit="cover"
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

        {/* Play / shuffle / queue row */}
        <View style={styles.playAreaRow}>
          <TouchableOpacity
            style={styles.playPill}
            onPress={handlePlayAll}
            disabled={preparingAction !== null}
            activeOpacity={0.8}
          >
            <View style={styles.playPillIconSlot}>
              {preparingAction === 'play'
                ? <ActivityIndicator size="small" color={theme.colors.onPrimary} />
                : <MaterialIcons name="play-arrow" size={18} color={theme.colors.onPrimary} />
              }
            </View>
            <Text style={styles.playPillText}>Play</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconCircle}
            onPress={handleShuffleAll}
            disabled={preparingAction !== null}
            activeOpacity={0.7}
          >
            {preparingAction === 'shuffle'
              ? <ActivityIndicator size="small" color={theme.colors.onSurface} />
              : <MaterialIcons name="shuffle" size={20} color={theme.colors.onSurface} style={{ opacity: 0.6 }} />
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconCircle}
            onPress={handleOpenQueueMenu}
            disabled={preparingAction !== null}
            activeOpacity={0.7}
          >
            {preparingAction === 'queue'
              ? <ActivityIndicator size="small" color={theme.colors.onSurface} />
              : <MaterialIcons name="add" size={20} color={theme.colors.onSurface} style={{ opacity: 0.6 }} />
            }
          </TouchableOpacity>
        </View>

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
                  {activeTab === 'favoriteSongs' ? 'Favorite songs from this artist to see them here' : 'No top songs available'}
                </Text>
              </View>
            }
          />
        )}
        {StickyHeader}
      </View>
      <SongMenu
        song={menuSong}
        visible={menuSong !== null}
        onClose={() => setMenuSong(null)}
        options={menuOptions}
      />
      <AddToPlaylistModal
        song={addToPlaylistSong}
        visible={addToPlaylistSong !== null}
        onClose={() => setAddToPlaylistSong(null)}
      />
      <SongMenu
        song={queueMenuSong}
        visible={queueSongs !== null}
        onClose={() => setQueueSongs(null)}
        options={queueMenuOptions}
      />
    </ScreenBackground>
  );
}
