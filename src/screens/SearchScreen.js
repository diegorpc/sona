import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  SectionList,
} from 'react-native';
import {
  Text,
  Searchbar,
  ActivityIndicator,
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenBackground from '../components/ScreenBackground';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SubsonicAPI from '../services/SubsonicAPI';
import AudioPlayer from '../services/AudioPlayer';
import { expandPlayerOverlay } from '../services/PlayerOverlayController';
import { usePlayer } from '../contexts/PlayerContext';
import { useTheme } from '../contexts/ThemeContext';
import { createStyles } from '../styles/SearchScreen.styles';

const DEFAULT_ART = require('../../assets/default-album.png');
const RECENT_SEARCHES_KEY = 'sona_recent_searches';
const MAX_RECENT_SEARCHES = 20;

export default function SearchScreen({ navigation }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { playerState: { currentTrack } } = usePlayer();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);

  const saveRecentSearch = useCallback((item, type) => {
    if (!item) return;
    const itemId = item.id || item.name || item.title;
    if (!itemId) return;

    setRecentSearches(prev => {
      const filtered = prev.filter(e => e.storageId !== `${type}-${itemId}`);
      const entry = { storageId: `${type}-${itemId}`, type, item, timestamp: Date.now() };
      const updated = [entry, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated)).catch(console.error);
      return updated;
    });
  }, []);

  const handleSearch = useCallback(async (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    setIsLoading(true);
    try {
      const results = await SubsonicAPI.search(query, 50, 50, 100);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleArtistPress = useCallback((artist) => {
    saveRecentSearch(artist, 'artist');
    navigation.push('Artist', { artist });
  }, [navigation, saveRecentSearch]);

  const handleAlbumPress = useCallback((album) => {
    saveRecentSearch(album, 'album');
    navigation.push('Album', { album });
  }, [navigation, saveRecentSearch]);

  const handleSongPress = useCallback(async (song, songs, index) => {
    try {
      saveRecentSearch(song, 'song');
      await AudioPlayer.playTrack(song, songs, index, {
        contextName: 'Search Results',
        contextType: 'search',
        contextId: 'search',
      });
      expandPlayerOverlay();
    } catch (error) {
      console.error('Error playing song:', error);
    }
  }, [saveRecentSearch]);

  const handlePlaylistPress = useCallback((playlist) => {
    saveRecentSearch(playlist, 'playlist');
    navigation.push('Playlist', { playlist });
  }, [navigation, saveRecentSearch]);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_SEARCHES_KEY)
      .then(stored => {
        if (!stored) return;
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setRecentSearches(parsed);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    let isMounted = true;
    SubsonicAPI.getPlaylists()
      .then(response => {
        if (!isMounted) return;
        const data = Array.isArray(response?.playlist)
          ? response.playlist
          : Array.isArray(response) ? response : [];
        setPlaylists(data);
      })
      .catch(console.error);
    return () => { isMounted = false; };
  }, []);

  const getCoverArtUrl = useCallback((item) => {
    if (item.coverArt) return SubsonicAPI.getCoverArtUrl(item.coverArt, 200);
    return null;
  }, []);

  const getArtistImageUrl = useCallback((item) => {
    if (item.artistImageUrl) return item.artistImageUrl;
    if (item.id) return SubsonicAPI.getCoverArtUrl(item.id, 200);
    return null;
  }, []);

  const formatDuration = useCallback((seconds) => {
    if (!seconds) return '';
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  }, []);

  const filteredResults = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return { artist: [], album: [], song: [], playlist: [] };

    const filterByName = (items, field) => {
      if (!Array.isArray(items)) return [];
      return items.filter(item => typeof item[field] === 'string' && item[field].toLowerCase().includes(query));
    };

    return {
      artist: searchResults ? filterByName(searchResults.artist, 'name') : [],
      album: searchResults ? filterByName(searchResults.album, 'name') : [],
      song: searchResults ? filterByName(searchResults.song, 'title') : [],
      playlist: filterByName(playlists, 'name'),
    };
  }, [searchResults, searchQuery, playlists]);

  const renderArtist = useCallback(({ item }) => {
    const imageUrl = getArtistImageUrl(item);
    return (
      <TouchableOpacity style={styles.flatListItem} onPress={() => handleArtistPress(item)} activeOpacity={0.7}>
        <Image
          source={imageUrl ? { uri: imageUrl } : DEFAULT_ART}
          style={styles.itemImageRound}
          defaultSource={DEFAULT_ART}
        />
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle}>{item.name}</Text>
          <Text style={styles.itemSubtitle}>
            {item.albumCount} album{item.albumCount !== 1 ? 's' : ''}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [handleArtistPress, getArtistImageUrl, styles]);

  const renderAlbum = useCallback(({ item }) => {
    const imageUrl = getCoverArtUrl(item);
    return (
      <TouchableOpacity style={styles.flatListItem} onPress={() => handleAlbumPress(item)} activeOpacity={0.7}>
        <Image
          source={imageUrl ? { uri: imageUrl } : DEFAULT_ART}
          style={styles.itemImage}
          defaultSource={DEFAULT_ART}
        />
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle}>{item.name}</Text>
          <Text style={styles.itemSubtitle}>{item.artist}</Text>
        </View>
      </TouchableOpacity>
    );
  }, [handleAlbumPress, getCoverArtUrl, styles]);

  const renderSong = useCallback(({ item, index, section }) => {
    const imageUrl = getCoverArtUrl(item);
    return (
      <TouchableOpacity
        style={styles.flatListItem}
        onPress={() => handleSongPress(item, section?.data ?? [item], index ?? 0)}
        activeOpacity={0.7}
      >
        <Image
          source={imageUrl ? { uri: imageUrl } : DEFAULT_ART}
          style={styles.itemImage}
          defaultSource={DEFAULT_ART}
        />
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemSubtitle}>{item.artist}</Text>
        </View>
        {item.duration && (
          <View style={styles.itemRightContent}>
            <Text style={styles.itemDuration}>{formatDuration(item.duration)}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [handleSongPress, getCoverArtUrl, formatDuration, styles]);

  const renderPlaylist = useCallback(({ item }) => {
    const imageUrl = getCoverArtUrl(item);
    return (
      <TouchableOpacity style={styles.flatListItem} onPress={() => handlePlaylistPress(item)} activeOpacity={0.7}>
        <Image
          source={imageUrl ? { uri: imageUrl } : DEFAULT_ART}
          style={styles.itemImage}
          defaultSource={DEFAULT_ART}
        />
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle}>{item.name}</Text>
          <Text style={styles.itemSubtitle}>
            {item.songCount || 0} song{(item.songCount || 0) !== 1 ? 's' : ''}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [handlePlaylistPress, getCoverArtUrl, styles]);

  const renderRecentItem = useCallback(({ item, index }) => {
    const actualItem = item.item;
    if (!actualItem) return null;
    switch (item.type) {
      case 'artist': return renderArtist({ item: actualItem });
      case 'album': return renderAlbum({ item: actualItem });
      case 'song': return renderSong({ item: actualItem, index, section: { data: [actualItem] } });
      case 'playlist': return renderPlaylist({ item: actualItem });
      default: return null;
    }
  }, [renderArtist, renderAlbum, renderSong, renderPlaylist]);

  const sections = useMemo(() => {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      if (recentSearches.length === 0) return [];
      const sorted = [...recentSearches].sort((a, b) => b.timestamp - a.timestamp);
      return [{ title: 'Recently Searched', data: sorted, renderItem: renderRecentItem }];
    }

    const { artist = [], album = [], song = [], playlist = [] } = filteredResults;
    const result = [];
    if (artist.length > 0) result.push({ title: 'Artists', data: artist, renderItem: renderArtist });
    if (album.length > 0) result.push({ title: 'Albums', data: album, renderItem: renderAlbum });
    if (song.length > 0) result.push({ title: 'Songs', data: song, renderItem: renderSong });
    if (playlist.length > 0) result.push({ title: 'Playlists', data: playlist, renderItem: renderPlaylist });
    return result;
  }, [filteredResults, renderArtist, renderAlbum, renderSong, renderPlaylist, recentSearches, renderRecentItem, searchQuery]);

  const renderSectionHeader = useCallback(({ section: { title } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  ), [styles]);

  const keyExtractor = useCallback((item, index) => {
    if (item?.storageId) return item.storageId;
    if (item?.id) return `${item.id}`;
    return `${index}`;
  }, []);

  const backgroundArt = useMemo(() => {
    if (currentTrack?.coverArt) return { uri: SubsonicAPI.getCoverArtUrl(currentTrack.coverArt, 600) };
    if (currentTrack?.albumId) return { uri: SubsonicAPI.getCoverArtUrl(currentTrack.albumId, 600) };
    return DEFAULT_ART;
  }, [currentTrack?.albumId, currentTrack?.coverArt]);

  const hasSearchQuery = searchQuery.trim().length > 0;
  const hasSections = sections.length > 0;

  return (
    <ScreenBackground source={backgroundArt} backgroundStyle={styles.backgroundImage} blurStyle={styles.blurOverlay}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Search</Text>
          </View>
        
          <Searchbar
            placeholderTextColor={theme.colors.onSurfaceVariant}
            placeholder="Artists, albums, songs, playlists..."
            onChangeText={handleSearch}
            value={searchQuery}
            style={styles.searchbar}
            inputStyle={styles.searchbarInput}
          />
        </View>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        ) : hasSections ? (
          <SectionList
            sections={sections}
            renderItem={({ item, index, section }) => section.renderItem({ item, index, section })}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.resultsList}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
          />
        ) : hasSearchQuery ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="search-off" size={64} color={theme.colors.outline} />
            <Text style={styles.emptyText}>No results found</Text>
            <Text style={styles.emptySubtext}>Try searching with different keywords</Text>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="search" size={64} color={theme.colors.outline} />
            <Text style={styles.emptyText}>Search your music</Text>
            <Text style={styles.emptySubtext}>Find artists, albums, songs, and playlists</Text>
          </View>
        )}
      </View>
    </ScreenBackground>
  );
}
