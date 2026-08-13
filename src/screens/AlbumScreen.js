import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  Animated,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import ScreenBackground from '../components/ScreenBackground';
import SongMenu from '../components/SongMenu';

import SubsonicAPI from '../services/SubsonicAPI';
import AudioPlayer from '../services/AudioPlayer';
import { useArtworkSource, useArtworkImage } from '../hooks/useArtwork';
import CacheService from '../services/CacheService';
import { expandPlayerOverlay } from '../services/PlayerOverlayController';
import { useCurrentTrack, usePlayerActions } from '../contexts/PlayerContext';
import { useTheme } from '../contexts/ThemeContext';
import { createStyles } from '../styles/AlbumScreen.styles';
import { createStyles as createMenuStyles } from '../styles/SongMenu.styles';

const DEFAULT_ART = require('../../assets/default-album.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ART_SIZE = Math.min(220, SCREEN_WIDTH - 140);
const SWIPE_ACTION_WIDTH = 80;
const SWIPE_BACK_EDGE_WIDTH = 50;

// ─── Swipe-left "Add last" action ─────────────────────────────────
const SwipeAddLast = memo(({ progress, theme }) => {
  const menuStyles = createMenuStyles(theme);
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [SWIPE_ACTION_WIDTH, 0],
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
    outputRange: [-SWIPE_ACTION_WIDTH, 0],
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

// ─── Album track row — no art thumbnail ───────────────────────────
const SongItem = memo(({ item, index, onPress, onLongPress, onMenuPress, onAddLast, onToggleFavorite, isPlaying, theme }) => {
  const styles = createStyles(theme);
  const starred = Boolean(item.starred);

  const duration = useMemo(() => {
    if (!item.duration) return '';
    const m = Math.floor(item.duration / 60);
    const s = item.duration % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, [item.duration]);

  const swipeRef = React.useRef(null);

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
            : <Text style={styles.trackNumber}>{item.track || index + 1}</Text>
          }
        </View>
        <View style={styles.songInfo}>
          <Text style={[styles.songTitle, isPlaying && styles.songTitlePlaying]} numberOfLines={1}>
            {item.title}
          </Text>
          {item.artist && item.artist !== item.albumArtist && (
            <Text style={[styles.songArtistText, isPlaying && styles.songArtistPlaying]} numberOfLines={1}>
              {item.artist}
            </Text>
          )}
        </View>
        {duration ? <Text style={styles.songDuration}>{duration}</Text> : null}
        <TouchableOpacity style={styles.menuButton} onPress={() => onMenuPress(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="more-vert" size={18} color={theme.colors.onSurface} style={{ opacity: 0.4 }} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Swipeable>
  );
}, (prev, next) =>
  prev.item.id === next.item.id &&
  prev.index === next.index &&
  prev.isPlaying === next.isPlaying &&
  prev.theme === next.theme &&
  Boolean(prev.item.starred) === Boolean(next.item.starred)
);

export default function AlbumScreen({ route, navigation }) {
  const { album } = route.params;
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const currentTrack = useCurrentTrack();
  const { insertIntoPriorityQueue, queueTracksNext, queueTracksLast } = usePlayerActions();
  const [albumData, setAlbumData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [menuSong, setMenuSong] = useState(null);
  const [isQueueMenuVisible, setIsQueueMenuVisible] = useState(false);

  const loadAlbumData = async () => {
    try {
      setIsLoading(true);
      if (!albumData) {
        const cached = await CacheService.getAsync(`album_${album.id}`).catch(() => null);
        if (cached) {
          setAlbumData(cached);
          setIsLoading(false);
        }
      }
      const data = await SubsonicAPI.getAlbum(album.id);
      setAlbumData(data);
      CacheService.set(`album_${album.id}`, data);
    } catch (e) {
      console.error('Error loading album:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadAlbumData(); }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAlbumData();
    setIsRefreshing(false);
  };

  const handleSongPress = useCallback(async (song, index) => {
    if (!albumData?.song) return;
    try {
      await AudioPlayer.playTrack(song, albumData.song, index, {
        contextName: album.name,
        contextType: 'album',
        contextId: album.id,
      });
      expandPlayerOverlay();
    } catch (e) {
      console.error('Error playing song:', e);
    }
  }, [album, albumData]);

  const playAlbum = useCallback(async () => {
    if (!albumData?.song?.length) return;
    try {
      await AudioPlayer.playTrack(albumData.song[0], albumData.song, 0, {
        contextName: album.name,
        contextType: 'album',
        contextId: album.id,
      });
      expandPlayerOverlay();
    } catch (e) {
      console.error('Error playing album:', e);
    }
  }, [album, albumData]);

  const getTotalDuration = useCallback(() => {
    if (!albumData?.song) return '';
    const total = albumData.song.reduce((s, t) => s + (t.duration || 0), 0);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }, [albumData]);

  const discSections = useMemo(() => {
    if (!albumData?.song) return [];
    const discMap = new Map();
    albumData.song.forEach((song) => {
      const discNum = song.discNumber || 1;
      if (!discMap.has(discNum)) discMap.set(discNum, []);
      discMap.get(discNum).push(song);
    });
    return Array.from(discMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([discNum, songs]) => ({
        title: discMap.size > 1 ? `DISC ${discNum}` : null,
        data: songs,
      }));
  }, [albumData]);

  const discCount = useMemo(() => {
    if (!albumData?.song) return 0;
    return new Set(albumData.song.map(s => s.discNumber || 1)).size;
  }, [albumData]);

  const heroArtId = album.coverArt || albumData?.coverArt || currentTrack?.coverArt;
  const backgroundArt = useArtworkSource(heroArtId, DEFAULT_ART);

  const heroImage = useArtworkImage(heroArtId);
  const artDisplaySize = useMemo(() => {
    const { width: w, height: h } = heroImage || {};
    if (!w || !h) return { width: ART_SIZE, height: ART_SIZE };
    const ratio = w / h;
    return ratio >= 1
      ? { width: ART_SIZE, height: Math.round(ART_SIZE / ratio) }
      : { width: Math.round(ART_SIZE * ratio), height: ART_SIZE };
  }, [heroImage]);

  const handleAddLast = useCallback((song) => {
    insertIntoPriorityQueue(song);
  }, [insertIntoPriorityQueue]);

  // Optimistic: flip the heart immediately, then reconcile with the server;
  // roll back on failure so the UI never shows a favorite that didn't stick.
  const handleToggleFavorite = useCallback((song) => {
    const wasStarred = Boolean(song.starred);
    const setStarred = (value) => {
      setAlbumData(prev => {
        if (!prev?.song) return prev;
        return {
          ...prev,
          song: prev.song.map(s => s.id === song.id ? { ...s, starred: value } : s),
        };
      });
    };

    setStarred(wasStarred ? undefined : new Date().toISOString());

    const request = wasStarred ? SubsonicAPI.unstar(song.id) : SubsonicAPI.star(song.id);
    request.catch(e => {
      console.error('Error toggling favorite:', e);
      setStarred(wasStarred ? song.starred : undefined);
    });
  }, []);

  const menuOptions = useMemo(() => {
    if (!menuSong) return [];
    return [
      {
        key: 'playFromStart',
        label: 'Play from start',
        icon: 'play-arrow',
        onPress: () => {
          const idx = albumData?.song?.findIndex(s => s.id === menuSong.id) ?? 0;
          handleSongPress(menuSong, idx);
        },
      },
      {
        key: 'goToArtist',
        label: 'Go to artist',
        icon: 'person',
        onPress: () => {
          const artistId = menuSong.artistId || albumData?.artistId;
          if (artistId) navigation.push('Artist', { artist: { id: artistId, name: menuSong.artist } });
        },
      },
      {
        key: 'addToPlaylist',
        label: 'Add to playlist',
        icon: 'playlist-add',
        disabled: true,
        onPress: () => {},
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
  }, [menuSong, albumData, handleSongPress, navigation, insertIntoPriorityQueue]);

  const queueMenuSong = useMemo(() => ({
    title: album.name,
    artist: album.artist,
    coverArt: album.coverArt || albumData?.coverArt,
  }), [album, albumData]);

  const queueMenuOptions = useMemo(() => {
    if (!albumData?.song?.length) return [];
    return [
      {
        key: 'queueFirst',
        label: 'Queue first',
        icon: 'queue-play-next',
        onPress: () => queueTracksNext(albumData.song),
      },
      {
        key: 'queueLast',
        label: 'Queue last',
        icon: 'add-to-queue',
        onPress: () => queueTracksLast(albumData.song),
      },
    ];
  }, [albumData, queueTracksNext, queueTracksLast]);

  const renderSectionHeader = useCallback(({ section: { title } }) => {
    if (!title) return null;
    return (
      <View style={styles.discHeader}>
        <Text style={styles.discHeaderText}>{title}</Text>
      </View>
    );
  }, [theme]);

  const renderItem = useCallback(({ item, index }) => {
    const globalIndex = albumData?.song?.findIndex(s => s.id === item.id) ?? index;
    const isPlaying = currentTrack?.id === item.id;
    return (
      <SongItem
        item={item}
        index={index}
        isPlaying={isPlaying}
        theme={theme}
        onPress={() => handleSongPress(item, globalIndex)}
        onLongPress={() => setMenuSong(item)}
        onMenuPress={setMenuSong}
        onAddLast={handleAddLast}
        onToggleFavorite={handleToggleFavorite}
      />
    );
  }, [currentTrack?.id, handleSongPress, albumData, theme, handleAddLast, handleToggleFavorite]);

  const keyExtractor = useCallback((item, index) => item.id || `song-${index}`, []);

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

  const ListHeader = useMemo(() => (
    <View>
      <View style={styles.artContainer}>
        <View style={[styles.artShadow, artDisplaySize]}>
          <Image
            source={heroImage ?? DEFAULT_ART}
            style={[styles.artImage, artDisplaySize]}
            contentFit="contain"
          />
        </View>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.albumName}>{album.name}</Text>
        {album.artist && (
          <TouchableOpacity
            style={styles.albumArtistTouchable}
            onPress={() => {
              const artistId = album.artistId || albumData?.artistId;
              if (artistId) navigation.push('Artist', { artist: { id: artistId, name: album.artist } });
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.albumArtist} numberOfLines={1}>{album.artist}</Text>
          </TouchableOpacity>
        )}
        <View style={styles.badgeRow}>
          {album.year && <View style={styles.badge}><Text style={styles.badgeText}>{album.year}</Text></View>}
          {albumData && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{albumData.songCount} songs</Text>
            </View>
          )}
          {getTotalDuration() ? (
            <View style={styles.badge}><Text style={styles.badgeText}>{getTotalDuration()}</Text></View>
          ) : null}
          {discCount > 1 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{discCount} discs</Text></View>
          )}
          {(() => {
            const raw = albumData?.genres ?? (album.genre ? [{ name: album.genre }] : []);
            const list = Array.isArray(raw) ? raw : [raw];
            return list.map((g, i) => {
              const name = typeof g === 'string' ? g : g?.name;
              return name ? (
                <View key={`genre-${i}`} style={[styles.badge, styles.badgeGenre]}>
                  <Text style={styles.badgeText}>{name}</Text>
                </View>
              ) : null;
            });
          })()}
        </View>

        <View style={styles.playAreaRow}>
          <TouchableOpacity style={styles.playPill} onPress={playAlbum} activeOpacity={0.8}>
            <MaterialIcons name="play-arrow" size={18} color={theme.colors.onPrimary} />
            <Text style={styles.playPillText}>Play</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconCircle} activeOpacity={0.7}>
            <MaterialIcons name="shuffle" size={20} color={theme.colors.onSurface} style={{ opacity: 0.6 }} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconCircle} activeOpacity={0.7}>
            <MaterialIcons name="favorite-border" size={19} color={theme.colors.onSurface} style={{ opacity: 0.6 }} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconCircle} onPress={() => setIsQueueMenuVisible(true)} activeOpacity={0.7}>
            <MaterialIcons name="add" size={20} color={theme.colors.onSurface} style={{ opacity: 0.6 }} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.divider} />
    </View>
  ), [album, albumData, heroImage, navigation, theme, playAlbum, getTotalDuration, discCount, artDisplaySize]);

  if (isLoading) {
    return (
      <ScreenBackground source={backgroundArt} backgroundStyle={styles.backgroundImage} blurStyle={styles.blurOverlay}>
        {StickyHeader}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading album…</Text>
        </View>
      </ScreenBackground>
    );
  }

  if (!albumData) {
    return (
      <ScreenBackground source={backgroundArt} backgroundStyle={styles.backgroundImage} blurStyle={styles.blurOverlay}>
        {StickyHeader}
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color={theme.colors.error} />
          <Text style={styles.errorText}>Failed to load album</Text>
          <Text style={styles.errorSubtext}>Please try again later</Text>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground source={backgroundArt} backgroundStyle={styles.backgroundImage} blurStyle={styles.blurOverlay}>
      <View style={styles.container}>
        <SectionList
          sections={discSections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={keyExtractor}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="album" size={64} color={theme.colors.outline} />
              <Text style={styles.emptyText}>No songs in album</Text>
            </View>
          }
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[theme.colors.primary]} />
          }
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          maxToRenderPerBatch={10}
          initialNumToRender={20}
          windowSize={10}
        />
        {StickyHeader}
      </View>

      <SongMenu
        song={menuSong}
        visible={menuSong !== null}
        onClose={() => setMenuSong(null)}
        options={menuOptions}
      />
      <SongMenu
        song={queueMenuSong}
        visible={isQueueMenuVisible}
        onClose={() => setIsQueueMenuVisible(false)}
        options={queueMenuOptions}
      />
    </ScreenBackground>
  );
}
