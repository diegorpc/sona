import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
} from 'react-native';
import {
  Text,
  Card,
  ActivityIndicator,
  FAB,
  IconButton,
  Chip,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import SubsonicAPI from '../services/SubsonicAPI';
import AudioPlayer from '../services/AudioPlayer';
import { theme } from '../theme/theme';
import { styles } from '../styles/AlbumScreen.styles';

const { width } = Dimensions.get('window');

export default function AlbumScreen({ route, navigation }) {
  const { album } = route.params;
  const [albumData, setAlbumData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadAlbumData();
  }, []);

  const loadAlbumData = async () => {
    try {
      setIsLoading(true);
      const data = await SubsonicAPI.getAlbum(album.id);
      setAlbumData(data);
    } catch (error) {
      console.error('Error loading album data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAlbumData();
    setIsRefreshing(false);
  };

  const handleSongPress = async (song, index) => {
    if (!albumData || !albumData.song) return;

    try {
      await AudioPlayer.playTrack(song, albumData.song, index);
      navigation.navigate('Player');
    } catch (error) {
      console.error('Error playing song:', error);
    }
  };

  const playAlbum = async () => {
    if (!albumData || !albumData.song || albumData.song.length === 0) return;

    try {
      await AudioPlayer.playTrack(albumData.song[0], albumData.song, 0);
      navigation.navigate('Player');
    } catch (error) {
      console.error('Error playing album:', error);
    }
  };

  const getCoverArtUrl = () => {
    if (album.coverArt || albumData?.coverArt) {
      return SubsonicAPI.getCoverArtUrl(album.coverArt || albumData.coverArt, 400);
    }
    return null;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getTotalDuration = () => {
    if (!albumData || !albumData.song) return '';
    const total = albumData.song.reduce((sum, song) => sum + (song.duration || 0), 0);
    return formatDuration(total);
  };

  const renderSong = ({ item, index }) => (
    <TouchableOpacity onPress={() => handleSongPress(item, index)}>
      <Card style={styles.songCard}>
        <View style={styles.songContent}>
          <View style={styles.trackNumber}>
            <Text style={styles.trackNumberText}>
              {item.track || index + 1}
            </Text>
          </View>
          <View style={styles.songInfo}>
            <Text style={styles.songTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.artist && item.artist !== album.artist && (
              <Text style={styles.songArtist} numberOfLines={1}>
                {item.artist}
              </Text>
            )}
          </View>
          <View style={styles.songActions}>
            {item.duration && (
              <Text style={styles.duration}>
                {formatDuration(item.duration)}
              </Text>
            )}
            <IconButton
              icon="play"
              size={20}
              onPress={() => handleSongPress(item, index)}
              iconColor={theme.colors.primary}
            />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <LinearGradient
      colors={[theme.colors.primary + '20', theme.colors.surface]}
      style={styles.header}
    >
      <View style={styles.albumArtContainer}>
        <Card style={styles.albumArtCard}>
          <Image
            source={
              getCoverArtUrl()
                ? { uri: getCoverArtUrl() }
                : require('../../assets/default-album.png')
            }
            style={styles.albumArt}
            defaultSource={require('../../assets/default-album.png')}
          />
        </Card>
      </View>
      
      <View style={styles.albumInfo}>
        <Text style={styles.albumTitle}>{album.name}</Text>
        <Text style={styles.albumArtist}>{album.artist}</Text>
        
        <View style={styles.albumMeta}>
          {album.year && (
            <Chip style={styles.metaChip} textStyle={styles.metaChipText}>
              {album.year}
            </Chip>
          )}
          {albumData && (
            <Chip style={styles.metaChip} textStyle={styles.metaChipText}>
              {albumData.songCount} song{albumData.songCount !== 1 ? 's' : ''}
            </Chip>
          )}
          {getTotalDuration() && (
            <Chip style={styles.metaChip} textStyle={styles.metaChipText}>
              {getTotalDuration()}
            </Chip>
          )}
        </View>
        
        {album.genre && (
          <View style={styles.genreContainer}>
            <Chip style={styles.genreChip} textStyle={styles.genreChipText}>
              {album.genre}
            </Chip>
          </View>
        )}
      </View>
    </LinearGradient>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading album...</Text>
      </View>
    );
  }

  if (!albumData) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error" size={64} color={theme.colors.error} />
        <Text style={styles.errorText}>Failed to load album</Text>
        <Text style={styles.errorSubtext}>Please try again later</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={albumData.song || []}
        renderItem={renderSong}
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

      {albumData.song && albumData.song.length > 0 && (
        <FAB
          style={styles.fab}
          icon="PlayArrow"
          onPress={playAlbum}
          label="PlayArrow"
        />
      )}
    </View>
  );
}

