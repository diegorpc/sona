import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  SectionList,
  TouchableOpacity,
  Image,
  ImageBackground,
  RefreshControl,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import SubsonicAPI from '../services/SubsonicAPI';
import AudioPlayer from '../services/AudioPlayer';
import { expandPlayerOverlay } from '../services/PlayerOverlayController';
import { usePlayer } from '../contexts/PlayerContext';
import { useTheme } from '../contexts/ThemeContext';
import { createStyles } from '../styles/AlbumScreen.styles';

const DEFAULT_ART = require('../../assets/default-album.png');

// ─── Album track row — no art thumbnail ───────────────────────────
const SongItem = memo(({ item, index, onPress, onMenuPress, isPlaying }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

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
      {/* Liked status */}
      <View style={styles.heartWrapper}>
        <MaterialIcons
          name={item.starred ? 'favorite' : 'favorite-border'}
          size={14}
          style={item.starred ? styles.heartIcon : styles.heartIconUnstarred}
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

export default function AlbumScreen({ route, navigation }) {
  const { album } = route.params;
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { playerState: { currentTrack } } = usePlayer();
  const [albumData, setAlbumData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => { loadAlbumData(); }, []);

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
      if (!discMap.has(discNum)) {
        discMap.set(discNum, []);
      }
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
    const discs = new Set(albumData.song.map(s => s.discNumber || 1));
    return discs.size;
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

  const renderSectionHeader = useCallback(({ section: { title } }) => {
    if (!title) return null;
    return (
      <View style={styles.discHeader}>
        <Text style={styles.discHeaderText}>{title}</Text>
      </View>
    );
  }, [theme]);

  const renderItem = useCallback(({ item, index, section }) => {
    const globalIndex = albumData?.song?.findIndex(s => s.id === item.id) ?? index;
    const isPlaying = currentTrack?.id === item.id;
    return (
      <SongItem
        item={item}
        index={index}
        isPlaying={isPlaying}
        onPress={() => handleSongPress(item, globalIndex)}
        onMenuPress={() => {/* TODO */}}
      />
    );
  }, [currentTrack?.id, handleSongPress, albumData]);

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
        <View style={styles.artShadow}>
          <Image source={backgroundArt} style={styles.artImage} resizeMode="cover" defaultSource={DEFAULT_ART} />
        </View>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.albumName} numberOfLines={2}>{album.name}</Text>
        {album.artist && (
          <Text style={styles.albumArtist} numberOfLines={1}>{album.artist}</Text>
        )}
        {/* Accent badge chips */}
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
          {album.genre && <View style={styles.badge}><Text style={styles.badgeText}>{album.genre}</Text></View>}
        </View>

        {/* Play area */}
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
  ), [album, albumData, backgroundArt, navigation, theme, playAlbum, getTotalDuration, discCount]);

  if (isLoading) {
    return (
      <ImageBackground source={backgroundArt} style={styles.backgroundImage} resizeMode="cover">
        <BlurView intensity={65} tint="dark" style={styles.blurOverlay}>
          {StickyHeader}
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading album…</Text>
          </View>
        </BlurView>
      </ImageBackground>
    );
  }

  if (!albumData) {
    return (
      <ImageBackground source={backgroundArt} style={styles.backgroundImage} resizeMode="cover">
        <BlurView intensity={65} tint="dark" style={styles.blurOverlay}>
          {StickyHeader}
          <View style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={64} color={theme.colors.error} />
            <Text style={styles.errorText}>Failed to load album</Text>
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
      </BlurView>
    </ImageBackground>
  );
}
