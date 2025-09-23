import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Card,
  ActivityIndicator,
  FAB,
  IconButton,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import SubsonicAPI from '../services/SubsonicAPI';
import AudioPlayer from '../services/AudioPlayer';
import { theme } from '../theme/theme';

export default function ArtistScreen({ route, navigation }) {
  const { artist } = route.params;
  const [artistData, setArtistData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadArtistData();
  }, []);

  const loadArtistData = async () => {
    try {
      setIsLoading(true);
      const data = await SubsonicAPI.getArtist(artist.id);
      setArtistData(data);
    } catch (error) {
      console.error('Error loading artist data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadArtistData();
    setIsRefreshing(false);
  };

  const handleAlbumPress = (album) => {
    navigation.navigate('Album', { album });
  };

  const playAllSongs = async () => {
    if (!artistData || !artistData.album) return;

    try {
      // Get all songs from all albums
      const allSongs = [];
      for (const album of artistData.album) {
        const albumData = await SubsonicAPI.getAlbum(album.id);
        if (albumData.song) {
          allSongs.push(...albumData.song);
        }
      }

      if (allSongs.length > 0) {
        await AudioPlayer.playTrack(allSongs[0], allSongs, 0);
        navigation.navigate('Player');
      }
    } catch (error) {
      console.error('Error playing all songs:', error);
    }
  };

  const getCoverArtUrl = (album) => {
    if (album.coverArt) {
      return SubsonicAPI.getCoverArtUrl(album.coverArt, 300);
    }
    return null;
  };

  const renderAlbum = ({ item }) => ( // TODO: add favorites query
    <TouchableOpacity onPress={() => handleAlbumPress(item)}>
      <Card style={styles.albumCard}>
        <View style={styles.albumContent}>
          <Image
            source={
              getCoverArtUrl(item)
                ? { uri: getCoverArtUrl(item) }
                : require('../../assets/default-album.png')
            }
            style={styles.albumArt}
            defaultSource={require('../../assets/default-album.png')}
          />
          <View style={styles.albumInfo}>
            <Text style={styles.albumTitle} numberOfLines={2}>
              {item.name}
            </Text>
            {item.year && (
              <Text style={styles.albumYear}>{item.year}</Text>
            )}
            <Text style={styles.albumDetails}>
              {item.songCount} song{item.songCount !== 1 ? 's' : ''}
              {item.duration && ` • ${Math.floor(item.duration / 60)} min`}
            </Text>
          </View>
          <IconButton
            icon="PlayArrow"
            size={24}
            onPress={() => handleAlbumPress(item)}
            iconColor={theme.colors.primary}
          />
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <LinearGradient
      colors={[theme.colors.primary + '40', theme.colors.surface]}
      style={styles.header}
    >
      <View style={styles.artistInfo}>
        <Text style={styles.artistName}>{artist.name}</Text>
        {artistData && (
          <Text style={styles.artistStats}>
            {artistData.albumCount} album{artistData.albumCount !== 1 ? 's' : ''}
          </Text>
        )}
      </View>
    </LinearGradient>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading artist...</Text>
      </View>
    );
  }

  if (!artistData) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error" size={64} color={theme.colors.error} />
        <Text style={styles.errorText}>Failed to load artist</Text>
        <Text style={styles.errorSubtext}>Please try again later</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={artistData.album || []}
        renderItem={renderAlbum}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {artistData.album && artistData.album.length > 0 && (
        <FAB
          style={styles.fab}
          icon="PlayArrow"
          onPress={playAllSongs}
          label="Play All"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: 20,
    paddingBottom: 30,
  },
  artistInfo: {
    alignItems: 'center',
  },
  artistName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    textAlign: 'center',
    marginBottom: 8,
  },
  artistStats: {
    fontSize: 16,
    color: theme.colors.onSurface,
    opacity: 0.7,
  },
  listContainer: {
    paddingBottom: 80, // Space for FAB
  },
  albumCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: theme.colors.surface,
  },
  albumContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  albumArt: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  albumInfo: {
    flex: 1,
  },
  albumTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 4,
  },
  albumYear: {
    fontSize: 14,
    color: theme.colors.primary,
    marginBottom: 2,
  },
  albumDetails: {
    fontSize: 12,
    color: theme.colors.onSurface,
    opacity: 0.7,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.onBackground,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 40,
  },
  errorText: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.error,
    marginTop: 16,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 16,
    color: theme.colors.onBackground,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary,
  },
});
