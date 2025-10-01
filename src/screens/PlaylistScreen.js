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
import PlaylistCollage from '../components/PlaylistCollage';
import { expandPlayerOverlay } from '../services/PlayerOverlayController';
import { usePlayer } from '../contexts/PlayerContext';
import { theme } from '../theme/theme';
import { styles } from '../styles/PlaylistScreen.styles';

const DEFAULT_ART = require('../../assets/default-album.png');

export default function PlaylistScreen({ route, navigation }) {
  const { playlist } = route.params;
  const { playerState: { currentTrack } } = usePlayer();
  const [playlistData, setPlaylistData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadPlaylistData();
  }, []);

  const loadPlaylistData = async () => {
    try {
      setIsLoading(true);
      const data = await SubsonicAPI.getPlaylist(playlist.id);
      setPlaylistData(data);
    } catch (error) {
      console.error('Error loading playlist data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadPlaylistData();
    setIsRefreshing(false);
  };

  const handleSongPress = async (song, index) => {
    if (!playlistData || !playlistData.entry) return;

    try {
      await AudioPlayer.playTrack(song, playlistData.entry, index, {
        contextName: playlist.name,
        contextType: 'playlist',
        contextId: playlist.id,
      });
      expandPlayerOverlay();
    } catch (error) {
      console.error('Error playing song:', error);
    }
  };

  const playPlaylist = async () => {
    if (!playlistData || !playlistData.entry || playlistData.entry.length === 0) return;

    try {
      await AudioPlayer.playTrack(playlistData.entry[0], playlistData.entry, 0, {
        contextName: playlist.name,
        contextType: 'playlist',
        contextId: playlist.id,
      });
      expandPlayerOverlay();
    } catch (error) {
      console.error('Error playing playlist:', error);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getTotalDuration = () => {
    if (!playlistData || !playlistData.entry) return '';
    const total = playlistData.entry.reduce((sum, song) => sum + (song.duration || 0), 0);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getPlaylistImage = () => {
    // Try to use a collage if we can generate one
    if (playlistData && playlistData.entry && playlistData.entry.length > 0) {
      // Use the first song's album art
      const firstSong = playlistData.entry[0];
      if (firstSong.coverArt) {
        return { uri: SubsonicAPI.getCoverArtUrl(firstSong.coverArt, 300) };
      }
    }
    return DEFAULT_ART;
  };

  const SongItem = memo(({ item, index }) => {
    const handlePress = useCallback(() => {
      handleSongPress(item, index);
    }, [item, index]);

    const duration = useMemo(() => formatDuration(item.duration), [item.duration]);
    const coverArtUrl = useMemo(() => {
      return item.coverArt ? SubsonicAPI.getCoverArtUrl(item.coverArt, 200) : null;
    }, [item.coverArt]);

    return (
      <TouchableOpacity style={styles.songItem} onPress={handlePress} activeOpacity={0.7}>
        <View style={styles.trackNumber}>
          <Text style={styles.trackNumberText}>{index + 1}</Text>
        </View>
        <Image
          source={coverArtUrl ? { uri: coverArtUrl } : DEFAULT_ART}
          style={styles.songImage}
          defaultSource={DEFAULT_ART}
        />
        <View style={styles.songInfo}>
          <Text style={styles.songTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {item.artist && (
            <Text style={styles.songArtist} numberOfLines={1}>
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
    length: 64,
    offset: 64 * index,
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
        <Image source={getPlaylistImage()} style={styles.playlistImage} />
        <View style={styles.headerInfo}>
          <Text style={styles.playlistName} numberOfLines={2}>
            {playlist.name}
          </Text>
          {playlistData && (
            <>
              <Text style={styles.playlistDetails}>
                {playlistData.songCount || 0} song{(playlistData.songCount || 0) !== 1 ? 's' : ''}
              </Text>
              {getTotalDuration() && (
                <Text style={styles.playlistDetails}>{getTotalDuration()}</Text>
              )}
            </>
          )}
        </View>
      </View>
    </BlurView>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="queue-music" size={64} color={theme.colors.outline} />
      <Text style={styles.emptyText}>No songs in playlist</Text>
      <Text style={styles.emptySubtext}>This playlist is empty</Text>
    </View>
  );

  const backgroundArt = useMemo(() => {
    if (currentTrack?.coverArt) {
      return { uri: SubsonicAPI.getCoverArtUrl(currentTrack.coverArt, 600) };
    }
    if (currentTrack?.albumId) {
      return { uri: SubsonicAPI.getCoverArtUrl(currentTrack.albumId, 600) };
    }
    return DEFAULT_ART;
  }, [currentTrack?.albumId, currentTrack?.coverArt]);

  if (isLoading) {
    return (
      <ImageBackground source={backgroundArt} style={styles.backgroundImage} resizeMode="cover">
        <BlurView intensity={65} tint="dark" style={styles.blurOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading playlist...</Text>
          </View>
        </BlurView>
      </ImageBackground>
    );
  }

  if (!playlistData) {
    return (
      <ImageBackground source={backgroundArt} style={styles.backgroundImage} resizeMode="cover">
        <BlurView intensity={65} tint="dark" style={styles.blurOverlay}>
          <View style={styles.errorContainer}>
            <MaterialIcons name="error" size={64} color={theme.colors.error} />
            <Text style={styles.errorText}>Failed to load playlist</Text>
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
            data={playlistData.entry || []}
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

          {playlistData.entry && playlistData.entry.length > 0 && (
            <FAB
              style={styles.fab}
              icon="play-arrow"
              onPress={playPlaylist}
              label="Play"
            />
          )}
        </View>
      </BlurView>
    </ImageBackground>
  );
}
