import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import {
  View,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Animated,
  RefreshControl,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ScreenBackground from '../components/ScreenBackground';
import CachedImage from '../components/CachedImage';
import SubsonicAPI from '../services/SubsonicAPI';
import ArtworkCache from '../services/ArtworkCache';
import CacheService from '../services/CacheService';
import { getPlaylistPlayTimes } from '../services/RecentPlaylists';
import { getPinnedPlaylistIds, buildHomePlaylists } from '../services/PinnedPlaylists';
import { getRandomAlbums } from '../services/RandomAlbums';
import { usePlayer } from '../contexts/PlayerContext';
import { useTheme } from '../contexts/ThemeContext';
import { createStyles } from '../styles/HomeScreen.styles';

const DEFAULT_ART = require('../../assets/default-album.png');

const ALBUM_SECTIONS = [
  { key: 'recent', title: 'Recently Played', sort: 'recent' },
  { key: 'newest', title: 'Recently Added', sort: 'newest' },
  { key: 'released', title: 'Recently Released', sort: 'dateReleased' },
  { key: 'random', title: 'Random', sort: 'random' },
];

const PLAYLIST_GRID_COUNT = 6;
const ALBUM_SECTION_COUNT = 20;

const AlbumCard = memo(function AlbumCard({ album, styles, onPress }) {
  return (
    <TouchableOpacity style={styles.albumCard} activeOpacity={0.7} onPress={() => onPress(album)}>
      <CachedImage
        coverArtId={album.coverArt || album.id}
        size={300}
        fallbackSource={DEFAULT_ART}
        style={styles.albumCardImage}
        resizeMode="cover"
        defaultSource={DEFAULT_ART}
      />
      <Text style={styles.albumCardTitle} numberOfLines={1}>{album.name}</Text>
      {album.artist ? <Text style={styles.albumCardArtist} numberOfLines={1}>{album.artist}</Text> : null}
      {album.year ? <Text style={styles.albumCardYear} numberOfLines={1}>{album.year}</Text> : null}
    </TouchableOpacity>
  );
});

const PlaylistChip = memo(function PlaylistChip({ playlist, styles, onPress }) {
  return (
    <TouchableOpacity style={styles.playlistChip} activeOpacity={0.7} onPress={() => onPress(playlist)}>
      <CachedImage
        coverArtId={playlist.coverArt}
        size={150}
        fallbackSource={DEFAULT_ART}
        style={styles.playlistChipImage}
        resizeMode="cover"
        defaultSource={DEFAULT_ART}
      />
      <Text style={styles.playlistChipText} numberOfLines={2}>{playlist.name}</Text>
    </TouchableOpacity>
  );
});

export default function HomeScreen({ navigation }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { playerState: { currentTrack } } = usePlayer();

  const [recentPlaylists, setRecentPlaylists] = useState([]);
  const [sections, setSections] = useState({ recent: [], newest: [], released: [], random: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const listOpacity = useRef(new Animated.Value(0)).current;

  const loadAlbums = useCallback(async () => {
    const currentYear = new Date().getFullYear();
    const [recent, newest, released, random] = await Promise.all([
      SubsonicAPI.getAlbumList('recent', ALBUM_SECTION_COUNT).catch(() => []),
      SubsonicAPI.getAlbumList('newest', ALBUM_SECTION_COUNT).catch(() => []),
      // byYear with fromYear > toYear returns newest-released first
      SubsonicAPI.getAlbumList('byYear', ALBUM_SECTION_COUNT, 0, { fromYear: currentYear, toYear: 0 }).catch(() => []),
      // Shared, persisted random ordering (same as Library); reset only via Library's refresh.
      getRandomAlbums().then(a => a.slice(0, ALBUM_SECTION_COUNT)).catch(() => []),
    ]);
    setSections({ recent, newest, released, random });
    CacheService.set('home_albums', { recent, newest, released, random });
  }, []);

  // Pinned playlists first (set in Settings), then recently-listened fallback fills
  // remaining slots up to 6. Deleted pins drop out and revert to the fallback.
  const loadPlaylists = useCallback(async () => {
    const [resp, playTimes, pinnedIds] = await Promise.all([
      SubsonicAPI.getPlaylists().catch(() => null),
      getPlaylistPlayTimes(),
      getPinnedPlaylistIds(),
    ]);
    // Fall back to the cached list when the fetch fails
    const all = resp?.playlist
      || (await CacheService.getAsync('home_playlists').catch(() => null))
      || [];
    if (resp?.playlist) CacheService.set('home_playlists', resp.playlist);
    setRecentPlaylists(buildHomePlaylists(all, pinnedIds, playTimes, PLAYLIST_GRID_COUNT));
  }, []);

  useEffect(() => {
    let active = true;
    const reveal = () => {
      setIsLoading(false);
      requestAnimationFrame(() => {
        Animated.timing(listOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    };
    (async () => {
      // Cached-first: paint immediately with the last session's data, then
      // refresh from the network in the background.
      const cached = await CacheService.getAsync('home_albums').catch(() => null);
      if (active && cached) {
        setSections(prev => ({ ...prev, ...cached }));
        reveal();
      }
      try {
        await SubsonicAPI.loadConfiguration();
        await loadAlbums();
      } finally {
        if (active) reveal();
      }
    })();
    return () => { active = false; };
  }, [loadAlbums, listOpacity]);

  // Recently-listened ordering and the shared random set can change while the app
  // is used (e.g. a reset from Library); refresh both on every focus.
  useFocusEffect(
    useCallback(() => {
      loadPlaylists().catch(() => {});
      getRandomAlbums()
        .then(a => setSections(prev => ({ ...prev, random: a.slice(0, ALBUM_SECTION_COUNT) })))
        .catch(() => {});
    }, [loadPlaylists])
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([loadAlbums(), loadPlaylists()]);
    setIsRefreshing(false);
  }, [loadAlbums, loadPlaylists]);

  const goToAlbum = useCallback((album) => navigation.push('Album', { album }), [navigation]);
  const goToPlaylist = useCallback((playlist) => navigation.push('Playlist', { playlist }), [navigation]);

  const seeAllAlbums = useCallback((sort) => {
    navigation.navigate('Library', { screen: 'LibraryHome', params: { initialTab: 'albums', initialSort: sort } });
  }, [navigation]);
  const seeAllPlaylists = useCallback(() => {
    navigation.navigate('Library', { screen: 'LibraryHome', params: { initialTab: 'playlists', initialSort: 'recentlyListened' } });
  }, [navigation]);

  const renderAlbumCard = useCallback(
    ({ item }) => <AlbumCard album={item} styles={styles} onPress={goToAlbum} />,
    [styles, goToAlbum]
  );

  const backgroundArt = useMemo(() => {
    if (currentTrack?.coverArt) return ArtworkCache.getArtworkSource(currentTrack.coverArt, 600, DEFAULT_ART);
    if (currentTrack?.albumId) return ArtworkCache.getArtworkSource(currentTrack.albumId, 600, DEFAULT_ART);
    return DEFAULT_ART;
  }, [currentTrack?.coverArt, currentTrack?.albumId]);

  const renderWithBackdrop = useCallback(
    content => (
      <ScreenBackground source={backgroundArt} backgroundStyle={styles.backgroundImage} blurStyle={styles.blurOverlay}>
        {content}
      </ScreenBackground>
    ),
    [backgroundArt, styles]
  );

  if (isLoading) {
    return renderWithBackdrop(
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return renderWithBackdrop(
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Home</Text>
      </View>

      <Animated.View style={{ flex: 1, opacity: listOpacity }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
          }
        >
          {recentPlaylists.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Playlists</Text>
                <TouchableOpacity
                  style={styles.seeAllButton}
                  onPress={seeAllPlaylists}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.seeAllText}>See All</Text>
                  <MaterialIcons name="chevron-right" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.playlistGrid}>
                {recentPlaylists.map(pl => (
                  <PlaylistChip key={pl.id} playlist={pl} styles={styles} onPress={goToPlaylist} />
                ))}
              </View>
            </>
          )}

          {ALBUM_SECTIONS.map(section => {
            const data = sections[section.key];
            if (!data || data.length === 0) return null;
            return (
              <View key={section.key}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <TouchableOpacity
                    style={styles.seeAllButton}
                    onPress={() => seeAllAlbums(section.sort)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.seeAllText}>See All</Text>
                    <MaterialIcons name="chevron-right" size={20} color={theme.colors.primary} />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={data}
                  renderItem={renderAlbumCard}
                  keyExtractor={(item, index) => `${section.key}-${item.id ?? index}`}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.albumRow}
                />
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
