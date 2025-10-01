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
import { styles } from '../styles/ArtistScreen.styles';

const DEFAULT_ART = require('../../assets/default-album.png');

export default function ArtistScreen({ route, navigation }) {
  const { artist } = route.params;
  const { playerState: { currentTrack } } = usePlayer();
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

  const handleAlbumPress = useCallback((album) => {
    navigation.navigate('Album', { album });
  }, [navigation]);

  const playAllSongs = async () => {
    if (!artistData || !artistData.album) return;

    try {
      const allSongs = [];
      for (const album of artistData.album) {
        const albumData = await SubsonicAPI.getAlbum(album.id);
        if (albumData.song) {
          allSongs.push(...albumData.song);
        }
      }

      if (allSongs.length > 0) {
        await AudioPlayer.playTrack(allSongs[0], allSongs, 0, {
          contextName: artist.name,
          contextType: 'artist',
          contextId: artist.id,
        });
        expandPlayerOverlay();
      }
    } catch (error) {
      console.error('Error playing all songs:', error);
    }
  };

  const getArtistImageUrl = () => {
    if (artist.artistImageUrl) {
      return artist.artistImageUrl;
    }
    if (artist.id) {
      return SubsonicAPI.getCoverArtUrl(artist.id, 300);
    }
    return null;
  };

  const getCoverArtUrl = (album) => {
    if (album.coverArt) {
      return SubsonicAPI.getCoverArtUrl(album.coverArt, 200);
    }
    return null;
  };

  const AlbumItem = memo(({ item }) => {
    const handlePress = useCallback(() => {
      handleAlbumPress(item);
    }, [item]);

    const coverArtUrl = useMemo(() => getCoverArtUrl(item), [item]);

    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
        <View style={styles.albumCard}>
          <View style={styles.albumContent}>
            <Image
              source={coverArtUrl ? { uri: coverArtUrl } : DEFAULT_ART}
              style={styles.albumArt}
              defaultSource={DEFAULT_ART}
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
            <TouchableOpacity style={styles.albumPlayButton} onPress={handlePress}>
              <MaterialIcons name="play-arrow" size={24} color={theme.colors.onPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, (prevProps, nextProps) => prevProps.item.id === nextProps.item.id);

  const renderAlbum = useCallback(({ item }) => {
    return <AlbumItem item={item} />;
  }, []);

  const keyExtractor = useCallback((item) => item.id, []);

  const getItemLayout = useCallback((data, index) => ({
    length: 116,
    offset: 116 * index,
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
          source={getArtistImageUrl() ? { uri: getArtistImageUrl() } : DEFAULT_ART}
          style={styles.artistImage}
          defaultSource={DEFAULT_ART}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.artistName} numberOfLines={2}>
            {artist.name}
          </Text>
          {artistData && (
            <Text style={styles.artistStats}>
              {artistData.albumCount} album{artistData.albumCount !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </View>
    </BlurView>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="album" size={64} color={theme.colors.outline} />
      <Text style={styles.emptyText}>No albums found</Text>
      <Text style={styles.emptySubtext}>This artist has no albums</Text>
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
            <Text style={styles.loadingText}>Loading artist...</Text>
          </View>
        </BlurView>
      </ImageBackground>
    );
  }

  if (!artistData) {
    return (
      <ImageBackground source={backgroundArt} style={styles.backgroundImage} resizeMode="cover">
        <BlurView intensity={65} tint="dark" style={styles.blurOverlay}>
          <View style={styles.errorContainer}>
            <MaterialIcons name="error" size={64} color={theme.colors.error} />
            <Text style={styles.errorText}>Failed to load artist</Text>
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
            data={artistData.album || []}
            renderItem={renderAlbum}
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
            initialNumToRender={15}
            windowSize={10}
          />

          {artistData.album && artistData.album.length > 0 && (
            <FAB
              style={styles.fab}
              icon="play-arrow"
              onPress={playAllSongs}
              label="Play All"
            />
          )}
        </View>
      </BlurView>
    </ImageBackground>
  );
}

