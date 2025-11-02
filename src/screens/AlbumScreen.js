import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Image,
  ImageBackground,
  RefreshControl,
} from 'react-native';
import { Text, ActivityIndicator, FAB } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import SubsonicAPI from '../services/SubsonicAPI';
import AudioPlayer from '../services/AudioPlayer';
import { expandPlayerOverlay } from '../services/PlayerOverlayController';
import { usePlayer } from '../contexts/PlayerContext';
import { theme } from '../theme/theme';
import { styles } from '../styles/AlbumScreen.styles';

const DEFAULT_ART = require('../../assets/default-album.png');

export default function AlbumScreen({ route, navigation }) {
  const { album } = route.params;
  const { playerState: { currentTrack } } = usePlayer();
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
      await AudioPlayer.playTrack(song, albumData.song, index, {
        contextName: album.name,
        contextType: 'album',
        contextId: album.id,
      });
      expandPlayerOverlay();
    } catch (error) {
      console.error('Error playing song:', error);
    }
  };

  const playAlbum = async () => {
    if (!albumData || !albumData.song || albumData.song.length === 0) return;

    try {
      await AudioPlayer.playTrack(albumData.song[0], albumData.song, 0, {
        contextName: album.name,
        contextType: 'album',
        contextId: album.id,
      });
      expandPlayerOverlay();
    } catch (error) {
      console.error('Error playing album:', error);
    }
  };

  const getCoverArtUrl = () => {
    if (album.coverArt || albumData?.coverArt) {
      return SubsonicAPI.getCoverArtUrl(album.coverArt || albumData.coverArt, 300);
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
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const SongItem = memo(({ item, index }) => {
    const handlePress = useCallback(() => {
      handleSongPress(item, index);
    }, [item, index]);

    const duration = useMemo(() => formatDuration(item.duration), [item.duration]);

    return (
      <TouchableOpacity style={styles.songItem} onPress={handlePress} activeOpacity={0.7}>
        <View style={styles.trackNumber}>
          <Text style={styles.trackNumberText}>{item.track || index + 1}</Text>
        </View>
        <View style={styles.songInfo}>
          <Text style={styles.songTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {item.artist && item.artist !== album.artist && (
            <Text style={styles.songArtistText} numberOfLines={1}>
              {item.artist}
            </Text>
          )}
        </View>
        {duration && <Text style={styles.songDuration}>{duration}</Text>}
      </TouchableOpacity>
    );
  }, (prevProps, nextProps) => {
    return prevProps.item.id === nextProps.item.id && prevProps.index === nextProps.index;
  });

  const renderSong = useCallback(({ item, index }) => {
    return <SongItem item={item} index={index} />;
  }, []);

  const keyExtractor = useCallback((item, index) => item.id || `song-${index}`, []);

  const getItemLayout = useCallback((data, index) => ({
    length: 57,
    offset: 57 * index,
    index,
  }), []);

  const renderHeader = () => (
    <BlurView intensity={40} tint="dark" style={[styles.header, styles.headerBlur]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
      >
        <MaterialIcons name="arrow-back" size={24} color={theme.colors.onSurface} />
      </TouchableOpacity>
      <View style={styles.headerContent}>
        <Image
          source={getCoverArtUrl() ? { uri: getCoverArtUrl() } : DEFAULT_ART}
          style={styles.albumImage}
          defaultSource={DEFAULT_ART}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.albumName} numberOfLines={2}>
            {album.name}
          </Text>
          <Text style={styles.albumArtist} numberOfLines={1}>
            {album.artist}
          </Text>
          <View style={styles.albumTags}>
            {album.year && (
              <View style={styles.tagChip}>
                <Text style={styles.tagChipText}>{album.year}</Text>
              </View>
            )}
            {albumData && (
              <View style={styles.tagChip}>
                <Text style={styles.tagChipText}>
                  {albumData.songCount} song{albumData.songCount !== 1 ? 's' : ''}
                </Text>
              </View>
            )}
            {getTotalDuration() && (
              <View style={styles.tagChip}>
                <Text style={styles.tagChipText}>{getTotalDuration()}</Text>
              </View>
            )}
            {album.genre && (
              <View style={styles.tagChip}>
                <Text style={styles.tagChipText}>{album.genre}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </BlurView>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="album" size={64} color={theme.colors.outline} />
      <Text style={styles.emptyText}>No songs in album</Text>
      <Text style={styles.emptySubtext}>This album is empty</Text>
    </View>
  );

  const backgroundArt = useMemo(() => {
    // Use album cover if available
    if (album?.coverArt) {
      return { uri: SubsonicAPI.getCoverArtUrl(album.coverArt, 600) };
    }
    // Fallback to current track if no album cover
    if (currentTrack?.coverArt) {
      return { uri: SubsonicAPI.getCoverArtUrl(currentTrack.coverArt, 600) };
    }
    if (currentTrack?.albumId) {
      return { uri: SubsonicAPI.getCoverArtUrl(currentTrack.albumId, 600) };
    }
    return DEFAULT_ART;
  }, [album?.coverArt, currentTrack?.albumId, currentTrack?.coverArt]);

  if (isLoading) {
    return (
      <ImageBackground source={backgroundArt} style={styles.backgroundImage} resizeMode="cover">
        <BlurView intensity={65} tint="dark" style={styles.blurOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading album...</Text>
          </View>
        </BlurView>
      </ImageBackground>
    );
  }

  if (!albumData) {
    return (
      <ImageBackground source={backgroundArt} style={styles.backgroundImage} resizeMode="cover">
        <BlurView intensity={65} tint="dark" style={styles.blurOverlay}>
          <View style={styles.errorContainer}>
            <MaterialIcons name="error" size={64} color={theme.colors.error} />
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
          <FlatList
            data={albumData.song || []}
            renderItem={renderSong}
            keyExtractor={keyExtractor}
            getItemLayout={getItemLayout}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderEmptyState}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                colors={[theme.colors.primary]}
              />
            }
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={20}
            windowSize={10}
          />

          {albumData.song && albumData.song.length > 0 && (
            <FAB
              style={styles.fab}
              icon="play-arrow"
              onPress={playAlbum}
              label="Play"
            />
          )}
        </View>
      </BlurView>
    </ImageBackground>
  );
}

