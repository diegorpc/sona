import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  Animated,
  SectionList,
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
import { expandPlayerOverlay } from '../services/PlayerOverlayController';
import { usePlayer } from '../contexts/PlayerContext';
import { useTheme } from '../contexts/ThemeContext';
import { createStyles } from '../styles/AlbumScreen.styles';
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

// ─── Album track row — no art thumbnail ───────────────────────────
const SongItem = memo(({ item, index, onPress, onLongPress, onMenuPress, onAddLast, isPlaying, theme }) => {
  const styles = createStyles(theme);

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
  prev.theme === next.theme
);

export default function AlbumScreen({ route, navigation }) {
  const { album } = route.params;
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { playerState: { currentTrack }, insertIntoPriorityQueue, appendToContextQueue } = usePlayer();
  const [albumData, setAlbumData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [menuSong, setMenuSong] = useState(null);

  const loadAlbumData = async () => {
    try {
      setIsLoading(true);
      const data = await SubsonicAPI.getAlbum(album.id);
      setAlbumData(data);
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

  const coverArtUrl = useMemo(() => {
    const art = album.coverArt || albumData?.coverArt;
    return art ? SubsonicAPI.getCoverArtUrl(art, 600) : null;
  }, [album.coverArt, albumData?.coverArt]);

  const backgroundArt = useMemo(() => {
    if (coverArtUrl) return { uri: coverArtUrl };
    if (currentTrack?.coverArt) return { uri: SubsonicAPI.getCoverArtUrl(currentTrack.coverArt, 600) };
    return DEFAULT_ART;
  }, [coverArtUrl, currentTrack?.coverArt]);

  const [artDisplaySize, setArtDisplaySize] = useState({ width: ART_SIZE, height: ART_SIZE });
  const handleArtLoad = useCallback((e) => {
    const { width: w, height: h } = e.nativeEvent.source;
    if (!w || !h) return;
    const ratio = w / h;
    setArtDisplaySize(ratio >= 1
      ? { width: ART_SIZE, height: Math.round(ART_SIZE / ratio) }
      : { width: Math.round(ART_SIZE * ratio), height: ART_SIZE }
    );
  }, []);

  const handleAddLast = useCallback((song) => {
    appendToContextQueue(song);
  }, [appendToContextQueue]);

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
        onPress: () => appendToContextQueue(menuSong),
      },
      {
        key: 'download',
        label: 'Download',
        icon: 'download',
        disabled: true,
        onPress: () => {},
      },
    ];
  }, [menuSong, albumData, handleSongPress, navigation, insertIntoPriorityQueue, appendToContextQueue]);

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
      />
    );
  }, [currentTrack?.id, handleSongPress, albumData, theme, handleAddLast]);

  const keyExtractor = useCallback((item, index) => item.id || `song-${index}`, []);

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
            onLoad={handleArtLoad}
          />
        </View>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.albumName} numberOfLines={2}>{album.name}</Text>
        {album.artist && (
          <TouchableOpacity
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
                <View key={`genre-${i}`} style={styles.badge}>
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
          <TouchableOpacity style={styles.iconCircle} activeOpacity={0.7}>
            <MaterialIcons name="add" size={20} color={theme.colors.onSurface} style={{ opacity: 0.6 }} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.divider} />
    </View>
  ), [album, albumData, backgroundArt, navigation, theme, playAlbum, getTotalDuration, discCount, artDisplaySize, handleArtLoad]);

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
        onClose={() => setMenuSong(null)}
        options={menuOptions}
      />
    </ScreenBackground>
  );
}
