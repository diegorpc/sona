import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Image,
  ImageBackground,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import SubsonicAPI from '../services/SubsonicAPI';
import AudioPlayer from '../services/AudioPlayer';
import PlaylistCollage from '../components/PlaylistCollage';
import { expandPlayerOverlay } from '../services/PlayerOverlayController';
import { usePlayer } from '../contexts/PlayerContext';
import { useTheme } from '../contexts/ThemeContext';
import { createStyles } from '../styles/PlaylistScreen.styles';

const DEFAULT_ART = require('../../assets/default-album.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ART_SIZE = Math.min(220, SCREEN_WIDTH - 140);
const THUMB_SIZE = 44;

// ─── Song row with art thumbnail ──────────────────────────────────
const SongItem = memo(({ item, index, onPress, onMenuPress, isPlaying }) => {
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

  const [thumbSize, setThumbSize] = useState({ width: THUMB_SIZE, height: THUMB_SIZE });
  useEffect(() => { setThumbSize({ width: THUMB_SIZE, height: THUMB_SIZE }); }, [coverArtUrl]);
  const handleThumbLoad = useCallback((e) => {
    const { width: w, height: h } = e.nativeEvent.source;
    if (!w || !h) return;
    const ratio = w / h;
    setThumbSize(ratio >= 1
      ? { width: THUMB_SIZE, height: Math.round(THUMB_SIZE / ratio) }
      : { width: Math.round(THUMB_SIZE * ratio), height: THUMB_SIZE }
    );
  }, []);

  return (
    <TouchableOpacity
      style={[styles.songItem, isPlaying && styles.songItemPlaying]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Liked status */}
      <View style={styles.heartWrapper}>
        <MaterialIcons
          name={item.starred ? 'favorite' : 'favorite-border'}
          size={14}
          style={item.starred ? styles.heartIcon : styles.heartIconUnstarred}
        />
      </View>

      {/* Track number or now-playing indicator */}
      <View style={styles.trackNumberWrapper}>
        {isPlaying
          ? <MaterialIcons name="play-arrow" size={14} color={theme.colors.primary} style={styles.nowPlayingIcon} />
          : <Text style={styles.trackNumber}>{index + 1}</Text>
        }
      </View>

      {/* Art thumbnail — fixed container keeps rows aligned */}
      <View style={styles.songImageContainer}>
        <Image
          source={coverArtUrl ? { uri: coverArtUrl } : DEFAULT_ART}
          style={{ width: thumbSize.width, height: thumbSize.height, borderRadius: 5 }}
          defaultSource={DEFAULT_ART}
          onLoad={handleThumbLoad}
        />
      </View>

      {/* Info */}
      <View style={styles.songInfo}>
        <Text
          style={[styles.songTitle, isPlaying && styles.songTitlePlaying]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        {item.artist && (
          <Text
            style={[styles.songArtist, isPlaying && styles.songArtistPlaying]}
            numberOfLines={1}
          >
            {item.artist}
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
  prev.isPlaying === next.isPlaying &&
  Boolean(prev.item.starred) === Boolean(next.item.starred)
);

export default function PlaylistScreen({ route, navigation }) {
  const { playlist } = route.params;
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { playerState: { currentTrack } } = usePlayer();
  const [playlistData, setPlaylistData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // Cover art — use playlist art
  const coverArtUrl = useMemo(() => {
    return SubsonicAPI.getCoverArtUrl(playlist.coverArt, 600);
  }, [playlist]);

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
    if (ratio >= 1) {
      setArtDisplaySize({ width: ART_SIZE, height: Math.round(ART_SIZE / ratio) });
    } else {
      setArtDisplaySize({ width: Math.round(ART_SIZE * ratio), height: ART_SIZE });
    }
  }, []);

  const renderItem = useCallback(({ item, index }) => {
    const isPlaying = currentTrack?.id === item.id;
    return (
      <SongItem
        item={item}
        index={index}
        isPlaying={isPlaying}
        onPress={() => handleSongPress(item, index)}
        onMenuPress={() => {/* TODO: context menu */}}
      />
    );
  }, [currentTrack?.id, handleSongPress]);

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
      {/* Rounded glowing media art */}
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

      {/* Title block */}
      <View style={styles.titleBlock}>
        <Text style={styles.playlistName} numberOfLines={2}>{playlist.name}</Text>
        {playlist.comment ? (
          <Text style={styles.playlistDescription} numberOfLines={2}>{playlist.comment}</Text>
        ) : null}
        {/* Neutral badge chips */}
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

        {/* Play area */}
        <View style={styles.playAreaRow}>
          {/* Wide Play pill */}
          <TouchableOpacity style={styles.playPill} onPress={playPlaylist} activeOpacity={0.8}>
            <MaterialIcons name="play-arrow" size={18} color={theme.colors.onPrimary} />
            <Text style={styles.playPillText}>Play</Text>
          </TouchableOpacity>
          {/* Shuffle circle */}
          <TouchableOpacity style={styles.iconCircle} activeOpacity={0.7}>
            <MaterialIcons name="shuffle" size={20} color={theme.colors.onSurface} style={{ opacity: 0.6 }} />
          </TouchableOpacity>
          {/* Like circle */}
          <TouchableOpacity style={styles.iconCircle} activeOpacity={0.7}>
            <MaterialIcons name="favorite-border" size={19} color={theme.colors.onSurface} style={{ opacity: 0.6 }} />
          </TouchableOpacity>
          {/* Add circle */}
          <TouchableOpacity style={styles.iconCircle} activeOpacity={0.7}>
            <MaterialIcons name="add" size={20} color={theme.colors.onSurface} style={{ opacity: 0.6 }} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.divider} />
    </View>
  ), [playlist, playlistData, backgroundArt, navigation, theme, playPlaylist, getTotalDuration, artDisplaySize, handleArtLoad]);

  if (isLoading) {
    return (
      <ImageBackground source={backgroundArt} style={styles.backgroundImage} resizeMode="cover">
        <BlurView intensity={65} tint="dark" style={styles.blurOverlay}>
          {StickyHeader}
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading playlist…</Text>
          </View>
        </BlurView>
      </ImageBackground>
    );
  }

  if (!playlistData) {
    return (
      <ImageBackground source={backgroundArt} style={styles.backgroundImage} resizeMode="cover">
        <BlurView intensity={65} tint="dark" style={styles.blurOverlay}>
          {StickyHeader}
          <View style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={64} color={theme.colors.error} />
            <Text style={styles.errorText}>Failed to load playlist</Text>
            <Text style={styles.errorSubtext}>Please try again later</Text>
          </View>
        </BlurView>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={backgroundArt} style={styles.backgroundImage} resizeMode="cover">
      <BlurView intensity={65} tint="dark" style={styles.blurOverlay}>
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
      </BlurView>
    </ImageBackground>
  );
}
