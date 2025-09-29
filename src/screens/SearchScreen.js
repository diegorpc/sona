import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
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
import SubsonicAPI from '../services/SubsonicAPI';
import AudioPlayer from '../services/AudioPlayer';
import { expandPlayerOverlay } from '../services/PlayerOverlayController';
import { theme } from '../theme/theme';
import { styles } from '../styles/SearchScreen.styles';

const DEFAULT_ART = require('../../assets/default-album.png');

export default function SearchScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

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
    navigation.navigate('Artist', { artist });
  }, [navigation]);

  const handleAlbumPress = useCallback((album) => {
    navigation.navigate('Album', { album });
  }, [navigation]);

  const handleSongPress = useCallback(async (song, songs, index) => {
    try {
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
    if (!searchResults) return null;

    const query = searchQuery.toLowerCase().trim();
    
    const filterByName = (items, field) => {
      if (!items || !Array.isArray(items)) return [];
      return items.filter(item => {
        const value = item[field];
        if (typeof value !== 'string') return false;
        return value.toLowerCase().includes(query);
      });
    };

    return {
      artist: filterByName(searchResults.artist, 'name'),
      album: filterByName(searchResults.album, 'name'),
      song: filterByName(searchResults.song, 'title'),
      playlist: filterByName(searchResults.playlist, 'name'),
    };
  }, [searchResults, searchQuery]);

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
      onPress={() => handleSongPress(item, section.data, index)}
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

  const sections = useMemo(() => {
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
  }, [filteredResults, renderArtist, renderAlbum, renderSong, renderPlaylist]);

  const renderSectionHeader = useCallback(({ section: { title } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  ), []);

  const keyExtractor = useCallback((item, index) => {
    return `${item.id || index}`;
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Searchbar
          placeholder="Search music..."
          onChangeText={handleSearch}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchbarInput}
          autoFocus
        />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : searchQuery && sections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="search-off" size={64} color={theme.colors.outline} />
          <Text style={styles.emptyText}>No results found</Text>
          <Text style={styles.emptySubtext}>
            Try searching with different keywords
          </Text>
        </View>
      ) : searchQuery && sections.length > 0 ? (
        <SectionList
          sections={sections}
          renderItem={({ item, index, section }) => section.renderItem({ item, index, section })}
          renderSectionHeader={renderSectionHeader}
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

