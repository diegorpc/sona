import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  Animated,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import ScreenBackground from '../components/ScreenBackground';
import SongMenu from '../components/SongMenu';

import SubsonicAPI from '../services/SubsonicAPI';
import AudioPlayer from '../services/AudioPlayer';
import { recordPlaylistPlayed } from '../services/RecentPlaylists';
import PlaylistCollage from '../components/PlaylistCollage';
import { expandPlayerOverlay } from '../services/PlayerOverlayController';
import { usePlayer } from '../contexts/PlayerContext';
import { useTheme } from '../contexts/ThemeContext';
import { createStyles } from '../styles/PlaylistScreen.styles';
import { createStyles as createMenuStyles } from '../styles/SongMenu.styles';

const DEFAULT_ART = require('../../assets/default-album.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ART_SIZE = Math.min(220, SCREEN_WIDTH - 140);
const SWIPE_ACTION_WIDTH = 80;

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

// ─── Song row with art thumbnail ──────────────────────────────────
const SongItem = memo(({ item, index, onPress, onLongPress, onMenuPress, onAddLast, isPlaying, theme }) => {
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

  const swipeRef = React.useRef(null);
  const renderRightActions = useCallback((progress) => <SwipeAddLast progress={progress} theme={theme} />, [theme]);
  const handleSwipeOpen = useCallback(() => {
    onAddLast(item);
    swipeRef.current?.close();
  }, [item, onAddLast]);

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      onSwipeableOpen={handleSwipeOpen}
      rightThreshold={60}
      overshootRight={false}
      friction={2}
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
            name={item.starred ? 'favorite' : null}
            size={14}
            style={item.starred ? styles.heartIcon : null}
          />
        </View>

        <View style={styles.trackNumberWrapper}>
          {isPlaying
            ? <MaterialIcons name="play-arrow" size={14} color={theme.colors.primary} style={styles.nowPlayingIcon} />
            : <Text style={styles.trackNumber}>{index + 1}</Text>
          }
        </View>

        <View style={styles.songImageContainer}>
          <Image
            source={coverArtUrl ? { uri: coverArtUrl } : DEFAULT_ART}
            style={styles.songImage}
            resizeMode="contain"
            defaultSource={DEFAULT_ART}
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
  const { playerState: { currentTrack }, insertIntoPriorityQueue, appendToContextQueue } = usePlayer();
  const [playlistData, setPlaylistData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [menuSong, setMenuSong] = useState(null);
  const [menuSongIndex, setMenuSongIndex] = useState(null);

  useEffect(() => { loadPlaylistData(); }, []);

  const loadPlaylistData = async () => {
    try {
      setIsLoading(true);
      const data = await SubsonicAPI.getPlaylist(playlist.id);
      setPlaylistData(data);
    } catch (e) {
      console.error('Error loading playlist:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadPlaylistData();
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

  const coverArtUrl = useMemo(() => {
    return SubsonicAPI.getCoverArtUrl(playlist.coverArt, 600);
  }, [playlist]);

  const backgroundArt = useMemo(() => {
    if (coverArtUrl) return { uri: coverArtUrl };
    if (currentTrack?.coverArt) return { uri: SubsonicAPI.getCoverArtUrl(currentTrack.coverArt, 600) };
    return DEFAULT_ART;
  }, [coverArtUrl, currentTrack?.coverArt]);

  const [artSizeReady, setArtSizeReady] = useState(false);
  const [artDisplaySize, setArtDisplaySize] = useState({ width: ART_SIZE, height: ART_SIZE });
  useEffect(() => {
    if (!coverArtUrl) { setArtSizeReady(true); return; }
    setArtSizeReady(false);
    setArtDisplaySize({ width: ART_SIZE, height: ART_SIZE });
    let cancelled = false;
    Image.getSize(
      coverArtUrl,
      (w, h) => {
        if (cancelled) return;
        if (w && h) {
          const ratio = w / h;
          setArtDisplaySize(ratio >= 1
            ? { width: ART_SIZE, height: Math.round(ART_SIZE / ratio) }
            : { width: Math.round(ART_SIZE * ratio), height: ART_SIZE }
          );
        }
        setArtSizeReady(true);
      },
      () => { if (!cancelled) setArtSizeReady(true); }
    );
    return () => { cancelled = true; };
  }, [coverArtUrl]);

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
      />
    );
  }, [currentTrack?.id, handleSongPress, theme, handleOpenMenu, handleAddLast]);

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
          <Image
            source={backgroundArt}
            style={[styles.artImage, artDisplaySize]}
            resizeMode="cover"
            defaultSource={DEFAULT_ART}
          />
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
  ), [playlist, playlistData, backgroundArt, theme, playPlaylist, getTotalDuration, artDisplaySize]);

  if (isLoading || !artSizeReady) {
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
          removeClippedSubviews
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
