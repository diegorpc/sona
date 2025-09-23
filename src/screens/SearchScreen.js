import React, { useState } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import {
  Text,
  Searchbar,
  Card,
  ActivityIndicator,
  Chip,
  Divider,
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import SubsonicAPI from '../services/SubsonicAPI';
import AudioPlayer from '../services/AudioPlayer';
import { theme } from '../theme/theme';
import { styles } from '../styles/SearchScreen.styles';

export default function SearchScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState('all');

  const handleSearch = async (query) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    setIsLoading(true);
    try {
      const results = await SubsonicAPI.search(query, 20, 20, 50);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleArtistPress = (artist) => {
    navigation.navigate('Artist', { artist });
  };

  const handleAlbumPress = (album) => {
    navigation.navigate('Album', { album });
  };

  const handleSongPress = async (song, songs, index) => {
    try {
      await AudioPlayer.playTrack(song, songs, index);
      navigation.navigate('Player');
    } catch (error) {
      console.error('Error playing song:', error);
    }
  };

  const getCoverArtUrl = (item) => {
    if (item.coverArt) {
      return SubsonicAPI.getCoverArtUrl(item.coverArt, 200);
    }
    return null;
  };

  const renderArtist = ({ item }) => (
    <TouchableOpacity onPress={() => handleArtistPress(item)}>
      <Card style={styles.resultCard}>
        <View style={styles.resultContent}>
          <View style={styles.resultInfo}>
            <Text style={styles.resultTitle}>{item.name}</Text>
            <Text style={styles.resultSubtitle}>
              {item.albumCount} album{item.albumCount !== 1 ? 's' : ''}
            </Text>
          </View>
          <MaterialIcons name="person" size={24} color={theme.colors.primary} />
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderAlbum = ({ item }) => (
    <TouchableOpacity onPress={() => handleAlbumPress(item)}>
      <Card style={styles.resultCard}>
        <View style={styles.resultContent}>
          <Image
            source={
              getCoverArtUrl(item)
                ? { uri: getCoverArtUrl(item) }
                : require('../../assets/default-album.png')
            }
            style={styles.albumThumbnail}
            defaultSource={require('../../assets/default-album.png')}
          />
          <View style={styles.resultInfo}>
            <Text style={styles.resultTitle}>{item.name}</Text>
            <Text style={styles.resultSubtitle}>{item.artist}</Text>
            {item.year && (
              <Text style={styles.resultYear}>{item.year}</Text>
            )}
          </View>
          <MaterialIcons name="album" size={24} color={theme.colors.primary} />
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderSong = ({ item, index }) => (
    <TouchableOpacity 
      onPress={() => handleSongPress(item, searchResults.song, index)}
    >
      <Card style={styles.resultCard}>
        <View style={styles.resultContent}>
          <Image
            source={
              getCoverArtUrl(item)
                ? { uri: getCoverArtUrl(item) }
                : require('../../assets/default-album.png')
            }
            style={styles.songThumbnail}
            defaultSource={require('../../assets/default-album.png')}
          />
          <View style={styles.resultInfo}>
            <Text style={styles.resultTitle}>{item.title}</Text>
            <Text style={styles.resultSubtitle}>{item.artist}</Text>
            {item.album && (
              <Text style={styles.resultAlbum}>{item.album}</Text>
            )}
          </View>
          <View style={styles.songActions}>
            {item.duration && (
              <Text style={styles.duration}>
                {Math.floor(item.duration / 60)}:
                {String(item.duration % 60).padStart(2, '0')}
              </Text>
            )}
            <MaterialIcons name="play-arrow" size={24} color={theme.colors.primary} />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderSearchResults = () => {
    if (!searchResults) return null;

    const { artist = [], album = [], song = [] } = searchResults;

    if (selectedTab === 'artists') {
      return (
        <FlatList
          data={artist}
          renderItem={renderArtist}
          keyExtractor={(item) => `artist-${item.id}`}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
        />
      );
    }

    if (selectedTab === 'albums') {
      return (
        <FlatList
          data={album}
          renderItem={renderAlbum}
          keyExtractor={(item) => `album-${item.id}`}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
        />
      );
    }

    if (selectedTab === 'songs') {
      return (
        <FlatList
          data={song}
          renderItem={renderSong}
          keyExtractor={(item) => `song-${item.id}`}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
        />
      );
    }

    // All results
    const allResults = [];
    
    if (artist.length > 0) {
      allResults.push({ type: 'header', title: 'Artists' });
      allResults.push(...artist.slice(0, 3).map(item => ({ ...item, type: 'artist' })));
    }
    
    if (album.length > 0) {
      allResults.push({ type: 'header', title: 'Albums' });
      allResults.push(...album.slice(0, 3).map(item => ({ ...item, type: 'album' })));
    }
    
    if (song.length > 0) {
      allResults.push({ type: 'header', title: 'Songs' });
      allResults.push(...song.slice(0, 5).map(item => ({ ...item, type: 'song' })));
    }

    return (
      <FlatList
        data={allResults}
        renderItem={({ item, index }) => {
          if (item.type === 'header') {
            return (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{item.title}</Text>
              </View>
            );
          }
          
          if (item.type === 'artist') {
            return renderArtist({ item });
          }
          
          if (item.type === 'album') {
            return renderAlbum({ item });
          }
          
          if (item.type === 'song') {
            return renderSong({ item, index });
          }
        }}
        keyExtractor={(item, index) => `${item.type}-${item.id || index}`}
        contentContainerStyle={styles.resultsList}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const getResultCount = () => {
    if (!searchResults) return 0;
    const { artist = [], album = [], song = [] } = searchResults;
    return artist.length + album.length + song.length;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Searchbar
          placeholder="Search music..."
          onChangeText={handleSearch}
          value={searchQuery}
          style={styles.searchbar}
          autoFocus
        />
        
        {searchResults && (
          <View style={styles.tabContainer}>
            <Chip
              selected={selectedTab === 'all'}
              onPress={() => setSelectedTab('all')}
              style={styles.tab}
            >
              All ({getResultCount()})
            </Chip>
            <Chip
              selected={selectedTab === 'artists'}
              onPress={() => setSelectedTab('artists')}
              style={styles.tab}
            >
              Artists ({searchResults.artist?.length || 0})
            </Chip>
            <Chip
              selected={selectedTab === 'albums'}
              onPress={() => setSelectedTab('albums')}
              style={styles.tab}
            >
              Albums ({searchResults.album?.length || 0})
            </Chip>
            <Chip
              selected={selectedTab === 'songs'}
              onPress={() => setSelectedTab('songs')}
              style={styles.tab}
            >
              Songs ({searchResults.song?.length || 0})
            </Chip>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : searchQuery && !searchResults ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="search-off" size={64} color={theme.colors.outline} />
          <Text style={styles.emptyText}>No results found</Text>
          <Text style={styles.emptySubtext}>
            Try searching with different keywords
          </Text>
        </View>
      ) : searchQuery && searchResults ? (
        renderSearchResults()
      ) : (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="search" size={64} color={theme.colors.outline} />
          <Text style={styles.emptyText}>Search your music</Text>
          <Text style={styles.emptySubtext}>
            Find artists, albums, and songs
          </Text>
        </View>
      )}
    </View>
  );
}

