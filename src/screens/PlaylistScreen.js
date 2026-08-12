import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  Animated,
  FlatList,
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
import CachedImage from '../components/CachedImage';

import SubsonicAPI from '../services/SubsonicAPI';
import AudioPlayer from '../services/AudioPlayer';
import { useArtworkSource, useArtworkImage, useArtworkNonce, bumpArtworkNonce } from '../hooks/useArtwork';
import CacheService from '../services/CacheService';
import { recordPlaylistPlayed } from '../services/RecentPlaylists';
import PlaylistCollage from '../components/PlaylistCollage';
import { expandPlayerOverlay } from '../services/PlayerOverlayController';
import { useCurrentTrack, usePlayerActions } from '../contexts/PlayerContext';
import { useTheme } from '../contexts/ThemeContext';
import { createStyles } from '../styles/PlaylistScreen.styles';
import { createStyles as createMenuStyles } from '../styles/SongMenu.styles';

const DEFAULT_ART = require('../../assets/default-album.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ART_SIZE = Math.min(220, SCREEN_WIDTH - 140);
const SWIPE_ACTION_WIDTH = 80;
const SWIPE_BACK_EDGE_WIDTH = 50;

// a 2x2 collage fallback when the playlist has no dedicated coverArt
function pickCollageIds(entries) {
  const ids = [];
  const seenCoverArt = new Set();
  const seenAlbum = new Set();
  for (const song of entries || []) {
    const coverArtId = song.coverArt;
    const albumId = song.albumId;
    if (coverArtId && !seenCoverArt.has(coverArtId) && (!albumId || !seenAlbum.has(albumId))) {
      seenCoverArt.add(coverArtId);
      if (albumId) seenAlbum.add(albumId);
      ids.push(coverArtId);
      if (ids.length >= 4) break;
    }
  }
  return ids;
}

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

// ─── Song row with art thumbnail ──────────────────────────────────
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
  const renderRightActions = useCallback((progress) => <SwipeAddLast progress={progress} theme={theme} />, [theme]);
  const renderLeftActions = useCallback((progress) => <SwipeFavorite progress={progress} theme={theme} starred={starred} />, [theme, starred]);
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
        {/* Liked status */}
        <View style={styles.heartWrapper}>
          <MaterialIcons
            name={starred ? 'favorite' : null}
            style={starred ? styles.heartIcon : null}
          />
        </View>

        <View style={styles.trackNumberWrapper}>
          {isPlaying && (
            <MaterialIcons name="play-arrow" size={14} color={theme.colors.primary} style={styles.nowPlayingIcon} />
          )}
        </View>

        <View style={styles.songImageContainer}>
          <CachedImage
            coverArtId={item.coverArt}
            fallbackSource={DEFAULT_ART}
            style={styles.songImage}
            resizeMode="contain"
          />
        </View>

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

export default function PlaylistScreen({ route, navigation }) {
  const { playlist } = route.params;
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const currentTrack = useCurrentTrack();
  const { insertIntoPriorityQueue, appendToContextQueue } = usePlayerActions();
  const [playlistData, setPlaylistData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [menuSong, setMenuSong] = useState(null);
  const [menuSongIndex, setMenuSongIndex] = useState(null);
  const artCoverId = playlistData?.coverArt || playlist.coverArt;
  const [artNonce, setArtNonce] = useArtworkNonce(artCoverId);
  const [collageIds, setCollageIds] = useState(null);

  useEffect(() => { loadPlaylistData(); }, []);

  const loadPlaylistData = async ({ refreshArt = false } = {}) => {
    try {
      setIsLoading(true);
      let hadCollage = collageIds !== null;
      // Cached-first: paint immediately, then refresh from the network
      if (!playlistData) {
        const cached = await CacheService.getAsync(`playlist_${playlist.id}`).catch(() => null);
        if (cached) {
          setPlaylistData(cached);
          setIsLoading(false);
        }
        const cachedCollageIds = await CacheService.getAsync(`playlist_${playlist.id}_collageIds`).catch(() => null);
        if (cachedCollageIds) {
          setCollageIds(cachedCollageIds);
          hadCollage = true;
        }
      }
      const data = await SubsonicAPI.getPlaylist(playlist.id);
      setPlaylistData(data);
      CacheService.set(`playlist_${playlist.id}`, data);

      // playlist art is only redownloaded/recomputed on an explicit refresh
      if (data?.coverArt) {
        if (refreshArt) {
          bumpArtworkNonce(data.coverArt).then(setArtNonce);
        }
      } else if (refreshArt || !hadCollage) {
        const ids = pickCollageIds(data?.entry);
        setCollageIds(ids);
        CacheService.set(`playlist_${playlist.id}_collageIds`, ids);
      }
    } catch (e) {
      console.error('Error loading playlist:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadPlaylistData({ refreshArt: true });
    setIsRefreshing(false);
  };

  const handleSongPress = useCallback(async (song, index) => {
    if (!playlistData?.entry) return;
    try {
      recordPlaylistPlayed(playlist);
      await AudioPlayer.playTrack(song, playlistData.entry, index, {
        contextName: playlist.name,
        contextType: 'playlist',
        contextId: playlist.id,
      });
      expandPlayerOverlay();
    } catch (e) {
      console.error('Error playing song:', e);
    }
  }, [playlist, playlistData]);

  const playPlaylist = useCallback(async () => {
    if (!playlistData?.entry?.length) return;
    try {
      recordPlaylistPlayed(playlist);
      await AudioPlayer.playTrack(playlistData.entry[0], playlistData.entry, 0, {
        contextName: playlist.name,
        contextType: 'playlist',
        contextId: playlist.id,
      });
      expandPlayerOverlay();
    } catch (e) {
      console.error('Error playing playlist:', e);
    }
  }, [playlist, playlistData]);

  const getTotalDuration = useCallback(() => {
    if (!playlistData?.entry) return '';
    const total = playlistData.entry.reduce((s, t) => s + (t.duration || 0), 0);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }, [playlistData]);

  const handleOpenMenu = useCallback((song, index) => {
    setMenuSong(song);
    setMenuSongIndex(index);
  }, []);

  const handleAddLast = useCallback((song) => {
    appendToContextQueue(song);
  }, [appendToContextQueue]);

  // Optimistic
  const handleToggleFavorite = useCallback((song) => {
    const wasStarred = Boolean(song.starred);
    const setStarred = (value) => {
      setPlaylistData(prev => {
        if (!prev?.entry) return prev;
        return {
          ...prev,
          entry: prev.entry.map(s => s.id === song.id ? { ...s, starred: value } : s),
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

  const handleRemoveFromPlaylist = useCallback(async () => {
    if (menuSongIndex === null) return;
    try {
      await SubsonicAPI.removeFromPlaylist(playlist.id, menuSongIndex);
      // Optimistically remove from local state
      setPlaylistData(prev => {
        if (!prev?.entry) return prev;
        const updated = [...prev.entry];
        updated.splice(menuSongIndex, 1);
        return { ...prev, entry: updated, songCount: (prev.songCount || 1) - 1 };
      });
    } catch (e) {
      console.error('Error removing from playlist:', e);
    }
  }, [playlist.id, menuSongIndex]);

  // Fall back to the first collage album
  const collageArtId = collageIds && collageIds.length > 0 ? collageIds[0] : null;
  const showCollageGrid = !artCoverId && collageIds && collageIds.length > 1;

  const heroArtId = artCoverId || collageArtId || currentTrack?.coverArt;
  const backgroundArt = useArtworkSource(heroArtId, DEFAULT_ART, artNonce);

  const heroImage = useArtworkImage(showCollageGrid ? null : heroArtId, artNonce);
  const artDisplaySize = useMemo(() => {
    const { width: w, height: h } = heroImage || {};
    if (!w || !h) return { width: ART_SIZE, height: ART_SIZE };
    const ratio = w / h;
    return ratio >= 1
      ? { width: ART_SIZE, height: Math.round(ART_SIZE / ratio) }
      : { width: Math.round(ART_SIZE * ratio), height: ART_SIZE };
  }, [heroImage]);

  const menuOptions = useMemo(() => {
    if (!menuSong) return [];
    return [
      {
        key: 'playFromStart',
        label: 'Play from start',
        icon: 'play-arrow',
        onPress: () => handleSongPress(menuSong, menuSongIndex ?? 0),
      },
      {
        key: 'goToAlbum',
        label: 'Go to album',
        icon: 'album',
        onPress: () => {
          if (menuSong.albumId) {
            navigation.push('Album', {
              album: { id: menuSong.albumId, name: menuSong.album, artist: menuSong.artist, coverArt: menuSong.coverArt },
            });
          }
        },
      },
      {
        key: 'goToArtist',
        label: 'Go to artist',
        icon: 'person',
        onPress: () => {
          if (menuSong.artistId) {
            navigation.push('Artist', { artist: { id: menuSong.artistId, name: menuSong.artist } });
          }
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
        onPress: () => appendToContextQueue(menuSong),
      },
      {
        key: 'download',
        label: 'Download',
        icon: 'download',
        disabled: true,
        onPress: () => {},
      },
      {
        key: 'removeFromPlaylist',
        label: 'Remove from playlist',
        icon: 'remove-circle-outline',
        onPress: handleRemoveFromPlaylist,
      },
    ];
  }, [menuSong, menuSongIndex, handleSongPress, navigation, insertIntoPriorityQueue, appendToContextQueue, handleRemoveFromPlaylist]);

  const renderItem = useCallback(({ item, index }) => {
    const isPlaying = currentTrack?.id === item.id;
    return (
      <SongItem
        item={item}
        index={index}
        isPlaying={isPlaying}
        theme={theme}
        onPress={() => handleSongPress(item, index)}
        onLongPress={() => handleOpenMenu(item, index)}
        onMenuPress={(song) => handleOpenMenu(song, index)}
        onAddLast={handleAddLast}
        onToggleFavorite={handleToggleFavorite}
      />
    );
  }, [currentTrack?.id, handleSongPress, theme, handleOpenMenu, handleAddLast, handleToggleFavorite]);

  const keyExtractor = useCallback((item, index) => item.id || `song-${index}`, []);
  const getItemLayout = useCallback((_, index) => ({ length: 64, offset: 64 * index, index }), []);

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

  const ListHeader = useMemo(() => (
    <View>
      <View style={styles.artContainer}>
        <View style={[styles.artShadow, artDisplaySize]}>
          {showCollageGrid ? (
            <PlaylistCollage
              collageData={{ type: 'collage', coverArtIds: collageIds }}
            />
          ) : (
            <Image
              source={heroImage ?? DEFAULT_ART}
              style={[styles.artImage, artDisplaySize]}
              contentFit="contain"
            />
          )}
        </View>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.playlistName} numberOfLines={2}>{playlist.name}</Text>
        {playlist.comment ? (
          <Text style={styles.playlistDescription} numberOfLines={2}>{playlist.comment}</Text>
        ) : null}
        <View style={styles.badgeRow}>
          {playlistData && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{playlistData.songCount || 0} songs</Text>
            </View>
          )}
          {getTotalDuration() ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{getTotalDuration()}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.playAreaRow}>
          <TouchableOpacity style={styles.playPill} onPress={playPlaylist} activeOpacity={0.8}>
            <MaterialIcons name="play-arrow" size={18} color={theme.colors.onPrimary} />
            <Text style={styles.playPillText}>Play</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconCircle} activeOpacity={0.7}>
            <MaterialIcons name="shuffle" size={20} color={theme.colors.onSurface} style={{ opacity: 0.6 }} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconCircle} activeOpacity={0.7}>
            <MaterialIcons name="favorite-border" size={19} color={theme.colors.onSurface} style={{ opacity: 0.6 }} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconCircle} activeOpacity={0.7}>
            <MaterialIcons name="add" size={20} color={theme.colors.onSurface} style={{ opacity: 0.6 }} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.divider} />
    </View>
  ), [playlist, playlistData, heroImage, theme, playPlaylist, getTotalDuration, artDisplaySize, showCollageGrid, collageIds]);

  if (isLoading) {
    return (
      <ScreenBackground source={backgroundArt} backgroundStyle={styles.backgroundImage} blurStyle={styles.blurOverlay}>
        {StickyHeader}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading playlist…</Text>
        </View>
      </ScreenBackground>
    );
  }

  if (!playlistData) {
    return (
      <ScreenBackground source={backgroundArt} backgroundStyle={styles.backgroundImage} blurStyle={styles.blurOverlay}>
        {StickyHeader}
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color={theme.colors.error} />
          <Text style={styles.errorText}>Failed to load playlist</Text>
          <Text style={styles.errorSubtext}>Please try again later</Text>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground source={backgroundArt} backgroundStyle={styles.backgroundImage} blurStyle={styles.blurOverlay}>
      <View style={styles.container}>
        <FlatList
          data={playlistData.entry || []}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="queue-music" size={64} color={theme.colors.outline} />
              <Text style={styles.emptyText}>No songs in playlist</Text>
            </View>
          }
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[theme.colors.primary]} />
          }
          showsVerticalScrollIndicator={false}
          maxToRenderPerBatch={10}
          initialNumToRender={20}
          windowSize={10}
        />
        {StickyHeader}
      </View>

      <SongMenu
        song={menuSong}
        visible={menuSong !== null}
        onClose={() => { setMenuSong(null); setMenuSongIndex(null); }}
        options={menuOptions}
      />
    </ScreenBackground>
  );
}
