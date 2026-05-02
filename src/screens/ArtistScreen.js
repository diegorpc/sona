import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
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

const TABS = ['Albums', 'Top Songs', 'Favorite Songs'];

// ─── Library-style album row — no play button ─────────────────────
const AlbumRow = memo(({ item, onPress, onMenuPress }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const coverArtUrl = useMemo(() =>
    item.coverArt ? SubsonicAPI.getCoverArtUrl(item.coverArt, 200) : null,
    [item.coverArt]
  );

  const subtitle = [item.year, item.songCount ? `${item.songCount} songs` : null]
    .filter(Boolean).join(' · ');

  return (
    <TouchableOpacity style={styles.albumRow} onPress={onPress} activeOpacity={0.7}>
      <Image
        source={coverArtUrl ? { uri: coverArtUrl } : DEFAULT_ART}
        style={styles.albumArt}
        defaultSource={DEFAULT_ART}
      />
      <View style={styles.albumInfo}>
        <Text style={styles.albumTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.albumSubtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={22} style={styles.albumChevron} />
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
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => { loadArtistData(); }, []);

  const loadArtistData = async () => {
    try {
      setIsLoading(true);
      const data = await SubsonicAPI.getArtist(artist.id);
      setArtistData(data);

      // Load top songs and liked songs for those tabs
      try {
        const starred = await SubsonicAPI.getStarred();
        const artistLiked = (starred?.song || []).filter(
          s => s.artistId === artist.id || s.artist === artist.name
        );
        setLikedSongs(artistLiked);
      } catch (e) {
        // Non-critical
      }
    } catch (e) {
      console.error('Error loading artist:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadArtistData();
    setIsRefreshing(false);
  };

  const handleAlbumPress = useCallback((album) => {
    navigation.navigate('Album', { album });
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

  const renderAlbum = useCallback(({ item }) => (
    <AlbumRow item={item} onPress={() => handleAlbumPress(item)} onMenuPress={() => {/* TODO */}} />
  ), [handleAlbumPress]);

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

  const albumKeyExtractor = useCallback((item) => item.id, []);
  const songKeyExtractor = useCallback((item, index) => item.id || `song-${index}`, []);

  const albumStats = useMemo(() => {
    if (!artistData) return '';
    const albumCount = artistData.albumCount || artistData.album?.length || 0;
    // Try to get song count from albums
    const songCount = artistData.album?.reduce((s, a) => s + (a.songCount || 0), 0) || 0;
    return [
      `${albumCount} album${albumCount !== 1 ? 's' : ''}`,
      songCount > 0 ? `${songCount} songs` : null,
    ].filter(Boolean).join(' · ');
  }, [artistData]);

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

  const activeSongs = activeTab === 1 ? topSongs : likedSongs;

  return (
    <ImageBackground source={backgroundArt} style={styles.backgroundImage} resizeMode="cover">
      <PlatformBlur intensity={65} tint="dark" style={styles.blurOverlay}>
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

          {/* Chip tabs */}
          <View style={styles.chipTabsContainer}>
            {TABS.map((tab, i) => (
              <TouchableOpacity
                key={tab}
                style={[styles.chipTab, activeTab === i && styles.chipTabActive]}
                onPress={() => setActiveTab(i)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipTabText, activeTab === i && styles.chipTabTextActive]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Content */}
          {activeTab === 0 ? (
            <FlatList
              data={artistData.album || []}
              renderItem={renderAlbum}
              keyExtractor={albumKeyExtractor}
              contentContainerStyle={styles.listContainer}
              refreshControl={
                <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[theme.colors.primary]} />
              }
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialIcons name="album" size={64} color={theme.colors.outline} />
                  <Text style={styles.emptyText}>No albums found</Text>
                </View>
              }
            />
          ) : (
            <FlatList
              data={activeSongs}
              renderItem={renderSong(activeSongs)}
              keyExtractor={songKeyExtractor}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialIcons name="music-note" size={64} color={theme.colors.outline} />
                  <Text style={styles.emptyText}>No songs found</Text>
                  <Text style={styles.emptySubtext}>
                    {activeTab === 2 ? 'Like songs from this artist to see them here' : 'No top songs available'}
                  </Text>
                </View>
              }
            />
          )}
          {StickyHeader}
        </View>
      </PlatformBlur>
    </ImageBackground>
  );
}
