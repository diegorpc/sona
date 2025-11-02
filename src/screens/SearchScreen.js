import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  SectionList,
  ImageBackground,
} from 'react-native';
import {
  Text,
  Searchbar,
  ActivityIndicator,
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SubsonicAPI from '../services/SubsonicAPI';
import AudioPlayer from '../services/AudioPlayer';
import { expandPlayerOverlay } from '../services/PlayerOverlayController';
import { usePlayer } from '../contexts/PlayerContext';
import { theme } from '../theme/theme';
import { styles } from '../styles/SearchScreen.styles';

const DEFAULT_ART = require('../../assets/default-album.png');
const RECENT_SEARCHES_KEY = 'sona_recent_searches';
const MAX_RECENT_SEARCHES = 20;

export default function SearchScreen({ navigation }) {
  const {
    playerState: { currentTrack },
  } = usePlayer();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);

  const saveRecentSearch = useCallback((item, type) => {
    if (!item) {
      return;
    }

    const itemId = item.id || item.name || item.title;
    if (!itemId) {
      return;
    }

    setRecentSearches(prev => {
      const filtered = prev.filter(entry => entry.storageId !== `${type}-${itemId}`);
      const entry = {
        storageId: `${type}-${itemId}`,
        type,
        item,
        timestamp: Date.now(),
      };
      const updated = [entry, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated)).catch(error => {
        console.error('Error saving recent searches:', error);
      });
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
    navigation.navigate('Artist', { artist });
  }, [navigation, saveRecentSearch]);

  const handleAlbumPress = useCallback((album) => {
    saveRecentSearch(album, 'album');
    navigation.navigate('Album', { album });
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
  }, []);

  const handlePlaylistPress = useCallback((playlist) => {
    // TODO: Navigate to playlist screen when implemented
    console.log('Playlist pressed:', playlist.name);
    saveRecentSearch(playlist, 'playlist');
  }, [saveRecentSearch]);

  const loadRecentSearches = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed);
        }
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  }, []);

  useEffect(() => {
    loadRecentSearches();
  }, [loadRecentSearches]);

  useEffect(() => {
    let isMounted = true;

    const loadPlaylists = async () => {
      try {
        setIsLoadingPlaylists(true);
        const response = await SubsonicAPI.getPlaylists();
        const playlistsData = Array.isArray(response?.playlist)
          ? response.playlist
          : Array.isArray(response)
            ? response
            : [];

        if (isMounted) {
          setPlaylists(playlistsData);
        }
      } catch (error) {
        console.error('Error loading playlists for search:', error);
      } finally {
        if (isMounted) {
          setIsLoadingPlaylists(false);
        }
      }
    };

    loadPlaylists();

    return () => {
      isMounted = false;
    };
  }, []);

  const getCoverArtUrl = useCallback((item) => {
    if (item.coverArt) {
      return SubsonicAPI.getCoverArtUrl(item.coverArt, 200);
    }
    return null;
  }, []);

  const formatDuration = useCallback((seconds) => {
    if (!seconds) return '';
    
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  }, []);

  // Filter results to strictly match search query
  const filteredResults = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    if (!query) {
      return {
        artist: [],
        album: [],
        song: [],
        playlist: [],
      };
    }

    const filterByName = (items, field) => {
      if (!items || !Array.isArray(items)) return [];
      return items.filter(item => {
        const value = item[field];
        if (typeof value !== 'string') return false;
        return value.toLowerCase().includes(query);
      });
    };

    const searchArtistResults = searchResults
      ? filterByName(searchResults.artist, 'name')
      : [];
    const searchAlbumResults = searchResults
      ? filterByName(searchResults.album, 'name')
      : [];
    const searchSongResults = searchResults
      ? filterByName(searchResults.song, 'title')
      : [];
    const playlistResults = filterByName(playlists, 'name');

    return {
      artist: searchArtistResults,
      album: searchAlbumResults,
      song: searchSongResults,
      playlist: playlistResults,
    };
  }, [searchResults, searchQuery, playlists]);

  const renderArtist = useCallback(({ item }) => (
    <TouchableOpacity 
      style={styles.flatListItem}
      onPress={() => handleArtistPress(item)}
      activeOpacity={0.7}
    >
      <Image
        source={DEFAULT_ART}
        style={styles.itemImage}
        defaultSource={DEFAULT_ART}
      />
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle}>{item.name}</Text>
        <Text style={styles.itemSubtitle}>
          {item.albumCount} album{item.albumCount !== 1 ? 's' : ''}
        </Text>
      </View>
    </TouchableOpacity>
  ), [handleArtistPress]);

  const renderAlbum = useCallback(({ item }) => (
    <TouchableOpacity 
      style={styles.flatListItem}
      onPress={() => handleAlbumPress(item)}
      activeOpacity={0.7}
    >
      <Image
        source={
          getCoverArtUrl(item)
            ? { uri: getCoverArtUrl(item) }
            : DEFAULT_ART
        }
        style={styles.itemImage}
        defaultSource={DEFAULT_ART}
      />
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle}>{item.name}</Text>
        <Text style={styles.itemSubtitle}>{item.artist}</Text>
      </View>
    </TouchableOpacity>
  ), [handleAlbumPress, getCoverArtUrl]);

  const renderSong = useCallback(({ item, index, section }) => (
    <TouchableOpacity 
      style={styles.flatListItem}
      onPress={() => handleSongPress(item, section?.data ?? [item], index ?? 0)}
      activeOpacity={0.7}
    >
      {/* {item.starred ?(
        <MaterialIcons
          name="favorite"
          size={16}
          color={theme.colors.primary}
          style={styles.itemLeadingIcon}
        />
      ): <MaterialIcons
          name="favorite-outline"
          size={16}
          color={theme.colors.primary}
          style={styles.itemLeadingIcon}
        />} */}
      <Image
        source={
          getCoverArtUrl(item)
            ? { uri: getCoverArtUrl(item) }
            : DEFAULT_ART
        }
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
  ), [handleSongPress, getCoverArtUrl, formatDuration]);

  const renderPlaylist = useCallback(({ item }) => (
    <TouchableOpacity 
      style={styles.flatListItem}
      onPress={() => handlePlaylistPress(item)}
      activeOpacity={0.7}
    >
      <Image
        source={DEFAULT_ART}
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
  ), [handlePlaylistPress]);

  const renderRecentItem = useCallback(({ item, index }) => {
    const actualItem = item.item;
    if (!actualItem) {
      return null;
    }

    switch (item.type) {
      case 'artist':
        return renderArtist({ item: actualItem });
      case 'album':
        return renderAlbum({ item: actualItem });
      case 'song':
        return renderSong({ item: actualItem, index, section: { data: [actualItem] } });
      case 'playlist':
        return renderPlaylist({ item: actualItem });
      default:
        return null;
    }
  }, [renderAlbum, renderArtist, renderPlaylist, renderSong]);

  const sections = useMemo(() => {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      if (recentSearches.length === 0) {
        return [];
      }

      const sortedRecent = [...recentSearches].sort((a, b) => b.timestamp - a.timestamp);

      return [
        {
          title: 'Recently Searched',
          data: sortedRecent,
          renderItem: renderRecentItem,
        },
      ];
    }

    if (!filteredResults) return [];

    const { artist = [], album = [], song = [], playlist = [] } = filteredResults;
    const result = [];

    if (artist.length > 0) {
      result.push({
        title: 'Artists',
        data: artist,
        renderItem: renderArtist,
      });
    }

    if (album.length > 0) {
      result.push({
        title: 'Albums',
        data: album,
        renderItem: renderAlbum,
      });
    }

    if (song.length > 0) {
      result.push({
        title: 'Songs',
        data: song,
        renderItem: renderSong,
      });
    }

    if (playlist.length > 0) {
      result.push({
        title: 'Playlists',
        data: playlist,
        renderItem: renderPlaylist,
      });
    }

    return result;
  }, [filteredResults, renderArtist, renderAlbum, renderSong, renderPlaylist, recentSearches, renderRecentItem, searchQuery]);

  const renderSectionHeader = useCallback(({ section: { title } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  ), []);

  const keyExtractor = useCallback((item, index) => {
    if (item?.storageId) {
      return item.storageId;
    }
    if (item?.id) {
      return `${item.id}`;
    }
    return `${index}`;
  }, []);

  const backgroundArt = useMemo(() => {
    if (currentTrack?.coverArt) {
      return { uri: SubsonicAPI.getCoverArtUrl(currentTrack.coverArt, 600) };
    }
    if (currentTrack?.albumId) {
      return { uri: SubsonicAPI.getCoverArtUrl(currentTrack.albumId, 600) };
    }
    return DEFAULT_ART;
  }, [currentTrack?.albumId, currentTrack?.coverArt]);

  const renderWithBackdrop = useCallback(
    content => (
      <ImageBackground source={backgroundArt} style={styles.backgroundImage} resizeMode="cover">
        <BlurView intensity={65} tint="dark" style={styles.blurOverlay}>
          {content}
        </BlurView>
      </ImageBackground>
    ),
    [backgroundArt]
  );

  const hasSearchQuery = searchQuery.trim().length > 0;
  const hasSections = sections.length > 0;
  const hasRecentSearches = !hasSearchQuery && recentSearches.length > 0;

  return renderWithBackdrop(
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
        <Searchbar
          placeholder="Search music..."
          onChangeText={handleSearch}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchbarInput}
          autoFocus
        />
      </View>

      {/* Fixed Recently Searched header */}
      {hasRecentSearches && (
        <View style={styles.recentSearchHeader}>
          <Text style={styles.sectionTitle}>Recently Searched</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : hasSearchQuery ? (
        hasSections && !isLoadingPlaylists ? (
          <SectionList
            sections={sections}
            renderItem={({ item, index, section }) => section.renderItem({ item, index, section })}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.resultsList}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
          />
        ) : (!isLoadingPlaylists && !hasSections) ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="search-off" size={64} color={theme.colors.outline} />
            <Text style={styles.emptyText}>No results found</Text>
            <Text style={styles.emptySubtext}>
              Try searching with different keywords
            </Text>
          </View>
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        )
      ) : hasSections ? (
        <SectionList
          sections={hasRecentSearches ? [{ title: '', data: recentSearches.sort((a, b) => b.timestamp - a.timestamp), renderItem: renderRecentItem }] : []}
          renderItem={({ item, index, section }) => section.renderItem({ item, index, section })}
          renderSectionHeader={null}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="search" size={64} color={theme.colors.outline} />
          <Text style={styles.emptyText}>Search your music</Text>
          <Text style={styles.emptySubtext}>
            Find artists, albums, songs, and playlists
          </Text>
        </View>
      )}
    </View>
  );
}

