import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ScrollView,
} from 'react-native';
import {
  Text,
  Card,
  ActivityIndicator,
  Searchbar,
  FAB,
  Chip,
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import SubsonicAPI from '../services/SubsonicAPI';
import AudioPlayer from '../services/AudioPlayer';
import { theme } from '../theme/theme';
import { styles } from '../styles/LibraryScreen.styles';

export default function LibraryScreen({ navigation }) {
  const [artists, setArtists] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [songs, setSongs] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('artists'); // 'artists', 'albums', 'songs', 'liked', 'playlists'

  useEffect(() => {
    loadLibrary();
  }, []);

  useEffect(() => {
    filterData();
  }, [searchQuery, artists, albums, songs, likedSongs, playlists, viewMode]);

  const loadLibrary = async () => {
    try {
      setIsLoading(true);
      
      // Load artists
      const artistsData = await SubsonicAPI.getArtists();
      const allArtists = [];
      if (artistsData && artistsData.index) {
        artistsData.index.forEach(indexGroup => {
          if (indexGroup.artist) {
            allArtists.push(...indexGroup.artist);
          }
        });
      }
      setArtists(allArtists);
      
      // Load albums from all artists
      const allAlbums = [];
      for (const artist of allArtists.slice(0, 20)) { // Limit to first 20 artists for performance
        try {
          const artistData = await SubsonicAPI.getArtist(artist.id);
          if (artistData && artistData.album) {
            allAlbums.push(...artistData.album);
          }
        } catch (error) {
          console.warn(`Error loading albums for artist ${artist.name}:`, error);
        }
      }
      setAlbums(allAlbums);
      
      // Load random songs for songs view
      try {
        const randomSongs = await SubsonicAPI.getRandomSongs(100);
        if (randomSongs && randomSongs.song) {
          setSongs(randomSongs.song);
        }
      } catch (error) {
        console.warn('Error loading songs:', error);
      }
      
      // Load liked/starred songs
      try {
        const starredData = await SubsonicAPI.getStarred();
        if (starredData && starredData.song) {
          setLikedSongs(starredData.song);
        }
      } catch (error) {
        console.warn('Error loading liked songs:', error);
      }
      
      // Load playlists
      try {
        const playlistsData = await SubsonicAPI.getPlaylists();
        if (playlistsData && playlistsData.playlist) {
          setPlaylists(playlistsData.playlist);
        }
      } catch (error) {
        console.warn('Error loading playlists:', error);
      }
      
    } catch (error) {
      console.error('Error loading library:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadLibrary();
    setIsRefreshing(false);
  };

  const filterData = () => {
    let currentData = [];
    let searchField = 'name';
    
    switch (viewMode) {
      case 'artists':
        currentData = artists;
        searchField = 'name';
        break;
      case 'albums':
        currentData = albums;
        searchField = 'name';
        break;
      case 'songs':
        currentData = songs;
        searchField = 'title';
        break;
      case 'liked':
        currentData = likedSongs;
        searchField = 'title';
        break;
      case 'playlists':
        currentData = playlists;
        searchField = 'name';
        break;
    }
    
    if (!searchQuery) {
      setFilteredData(currentData);
    } else {
      const filtered = currentData.filter(item =>
        item[searchField] && item[searchField].toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredData(filtered);
    }
  };

  const handleItemPress = (item) => {
    switch (viewMode) {
      case 'artists':
        navigation.navigate('Artist', { artist: item });
        break;
      case 'albums':
        navigation.navigate('Album', { album: item });
        break;
      case 'songs':
      case 'liked':
        // Play the song
        AudioPlayer.playTrack(item, filteredData, filteredData.indexOf(item));
        navigation.navigate('Player');
        break;
      case 'playlists':
        // Navigate to playlist or load playlist songs
        // For now, just show an alert - you can implement playlist navigation later
        console.log('Playlist pressed:', item.name);
        break;
    }
  };

  const playRandomSongs = async () => {
    try {
      const randomSongs = await SubsonicAPI.getRandomSongs(50);
      if (randomSongs && randomSongs.song && randomSongs.song.length > 0) {
        await AudioPlayer.playTrack(randomSongs.song[0], randomSongs.song, 0);
        navigation.navigate('Player');
      }
    } catch (error) {
      console.error('Error playing random songs:', error);
    }
  };

  const getImageUrl = (item) => {
    switch (viewMode) {
      case 'artists':
        return item.artistImageUrl || (item.coverArt ? SubsonicAPI.getCoverArtUrl(item.coverArt, 100) : null);
      case 'albums':
      case 'songs':
      case 'liked':
        return item.coverArt ? SubsonicAPI.getCoverArtUrl(item.coverArt, 100) : null;
      case 'playlists':
        // For playlists, we might not have cover art, so return null for now
        return null;
      default:
        return null;
    }
  };

  const renderItem = ({ item, index }) => {
    let title, subtitle, iconName;
    
    switch (viewMode) {
      case 'artists':
        title = item.name;
        subtitle = `${item.albumCount} album${item.albumCount !== 1 ? 's' : ''}`;
        iconName = 'chevron-right';
        break;
      case 'albums':
        title = item.name;
        subtitle = item.artist || 'Unknown Artist';
        iconName = 'chevron-right';
        break;
      case 'songs':
      case 'liked':
        title = item.title;
        subtitle = item.artist || 'Unknown Artist';
        iconName = 'play-arrow';
        break;
      case 'playlists':
        title = item.name;
        subtitle = `${item.songCount || 0} song${(item.songCount || 0) !== 1 ? 's' : ''}`;
        iconName = 'chevron-right';
        break;
    }
    
    const imageUrl = getImageUrl(item);
    
    return (
      <TouchableOpacity onPress={() => handleItemPress(item)}>
        <Card style={styles.itemCard}>
          <View style={styles.itemContent}>
            <Image
              source={imageUrl ? { uri: imageUrl } : require('../../assets/default-album.png')}
              style={styles.itemImage}
              defaultSource={require('../../assets/default-album.png')}
            />
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle}>{title}</Text>
              <Text style={styles.itemSubtitle}>{subtitle}</Text>
            </View>
            <MaterialIcons 
              name={iconName} 
              size={24} 
              color={theme.colors.onSurface} 
            />
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    const emptyMessages = {
      artists: { text: 'No artists found', icon: 'person' },
      albums: { text: 'No albums found', icon: 'album' },
      songs: { text: 'No songs found', icon: 'music-note' },
      liked: { text: 'No liked songs found', icon: 'favorite' },
      playlists: { text: 'No playlists found', icon: 'playlist-music' }
    };
    
    const { text, icon } = emptyMessages[viewMode] || emptyMessages.songs;
    
    return (
      <View style={styles.emptyState}>
        <MaterialIcons name={icon} size={64} color={theme.colors.outline} />
        <Text style={styles.emptyText}>{text}</Text>
        <Text style={styles.emptySubtext}>
          {searchQuery ? 'Try a different search term' : 'Your library appears to be empty'}
        </Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading your library...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Searchbar
          placeholder={`Search ${viewMode}...`}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.chipScrollContainer}
          contentContainerStyle={styles.chipContainer}
        >
          <TouchableOpacity
            onPress={() => setViewMode('artists')}
            style={[
              styles.bubbleChip,
              viewMode === 'artists' ? styles.bubbleChipSelected : styles.bubbleChipUnselected
            ]}
          >
            <Text style={[
              styles.bubbleChipText,
              viewMode === 'artists' ? styles.bubbleChipTextSelected : styles.bubbleChipTextUnselected
            ]}>Artists</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => setViewMode('albums')}
            style={[
              styles.bubbleChip,
              viewMode === 'albums' ? styles.bubbleChipSelected : styles.bubbleChipUnselected
            ]}
          >
            <Text style={[
              styles.bubbleChipText,
              viewMode === 'albums' ? styles.bubbleChipTextSelected : styles.bubbleChipTextUnselected
            ]}>Albums</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => setViewMode('songs')}
            style={[
              styles.bubbleChip,
              viewMode === 'songs' ? styles.bubbleChipSelected : styles.bubbleChipUnselected
            ]}
          >
            <Text style={[
              styles.bubbleChipText,
              viewMode === 'songs' ? styles.bubbleChipTextSelected : styles.bubbleChipTextUnselected
            ]}>Songs</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => setViewMode('liked')}
            style={[
              styles.bubbleChip,
              viewMode === 'liked' ? styles.bubbleChipSelected : styles.bubbleChipUnselected
            ]}
          >
            <Text style={[
              styles.bubbleChipText,
              viewMode === 'liked' ? styles.bubbleChipTextSelected : styles.bubbleChipTextUnselected
            ]}>Liked Songs</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => setViewMode('playlists')}
            style={[
              styles.bubbleChip,
              viewMode === 'playlists' ? styles.bubbleChipSelected : styles.bubbleChipUnselected
            ]}
          >
            <Text style={[
              styles.bubbleChipText,
              viewMode === 'playlists' ? styles.bubbleChipTextSelected : styles.bubbleChipTextUnselected
            ]}>Playlists</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <FlatList
        data={filteredData}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${viewMode}-${item.id || item.name || index}`}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />

      <FAB
        style={styles.fab}
        icon="shuffle"
        onPress={playRandomSongs}
        label="Shuffle"
      />
    </View>
  );
}

