import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  IconButton,
  Card,
  Surface,
} from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';

import { MaterialIcons } from '@expo/vector-icons';
import AudioPlayer from '../services/AudioPlayer';
import SubsonicAPI from '../services/SubsonicAPI';
import { theme } from '../theme/theme';

const { width } = Dimensions.get('window');

export default function PlayerScreen({ navigation }) {
  const [playerState, setPlayerState] = useState(AudioPlayer.getCurrentState());
  const [isSliding, setIsSliding] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);

  useEffect(() => {
    // Load saved state
    AudioPlayer.loadSavedState();

    // Add listener for player state changes
    const listener = (state) => {
      setPlayerState(state);
      if (!isSliding) {
        setSliderValue(state.position);
      }
    };

    AudioPlayer.addListener(listener);

    return () => {
      AudioPlayer.removeListener(listener);
    };
  }, [isSliding]);

  const handlePlayPause = () => {
    AudioPlayer.togglePlayPause();
  };

  const handleNext = () => {
    AudioPlayer.playNext();
  };

  const handlePrevious = () => {
    AudioPlayer.playPrevious();
  };

  const handleSeek = (value) => {
    if (duration > 0) {
      const seekPosition = (value / 100) * duration;
      AudioPlayer.seekTo(seekPosition);
    }
  };

  const handleSliderStart = () => {
    setIsSliding(true);
  };

  const handleSliderComplete = (value) => {
    setIsSliding(false);
    handleSeek(value);
  };

  const handleSliderChange = (value) => {
    if (isSliding) {
      setSliderValue((value / 100) * duration);
    }
  };

  const getCoverArtUrl = (track) => {
    if (track && track.coverArt) {
      return SubsonicAPI.getCoverArtUrl(track.coverArt, 400);
    }
    return null;
  };

  const formatTime = (milliseconds) => {
    return AudioPlayer.formatTime(milliseconds);
  };

  const { currentTrack, isPlaying, position, duration, isLoading } = playerState;

  if (!currentTrack) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialIcons name="music-note" size={64} color={theme.colors.outline} />
        <Text style={styles.emptyText}>No track selected</Text>
        <Text style={styles.emptySubtext}>
          Choose a song from your library to start playing
        </Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[theme.colors.background, theme.colors.surface]}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Album Art */}
        <View style={styles.albumArtContainer}>
          <Card style={styles.albumArtCard}>
            <Image
              source={
                getCoverArtUrl(currentTrack)
                  ? { uri: getCoverArtUrl(currentTrack) }
                  : require('../../assets/default-album.png')
              }
              style={styles.albumArt}
              defaultSource={require('../../assets/default-album.png')}
            />
          </Card>
        </View>

        {/* Track Info */}
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={2}>
            {currentTrack.title}
          </Text>
          <Text style={styles.trackArtist} numberOfLines={1}>
            {currentTrack.artist}
          </Text>
          {currentTrack.album && (
            <Text style={styles.trackAlbum} numberOfLines={1}>
              {currentTrack.album}
            </Text>
          )}
        </View>

        {/* Progress */}
        <View style={styles.progressContainer}>
          <Slider
            style={styles.slider} 
            minimumValue={0}
            maximumValue={100}
            value={duration > 0 ? (isSliding ? (sliderValue / duration) * 100 : (position / duration) * 100) : 0}
            onValueChange={handleSliderChange}
            onSlidingStart={handleSliderStart}
            onSlidingComplete={handleSliderComplete}
            minimumTrackTintColor={theme.colors.primary}
            maximumTrackTintColor={theme.colors.outline}
            thumbStyle={styles.sliderThumb}
            trackStyle={styles.sliderTrack}
          />
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>
              {formatTime(isSliding ? sliderValue : position)}
            </Text>
            <Text style={styles.timeText}>
              {formatTime(duration)}
            </Text>
          </View>
        </View>

        {/* Controls */}
        <Surface style={styles.controlsContainer}>
          <IconButton
            icon="skip-previous"
            size={32}
            onPress={handlePrevious}
            iconColor={theme.colors.onSurface}
          />
          
          <IconButton
            icon={isLoading ? 'timer-sand' : isPlaying ? 'pause' : 'play'}
            size={48}
            onPress={handlePlayPause}
            disabled={isLoading}
            iconColor={theme.colors.primary}
            style={styles.playButton}
          />
          
          <IconButton
            icon="skip-next"
            size={32}
            onPress={handleNext}
            iconColor={theme.colors.onSurface}
          />
        </Surface>

        {/* Additional Controls */}
        <View style={styles.additionalControls}>
          <IconButton
            icon="shuffle"
            size={24}
            onPress={() => {/* TODO: Implement shuffle */}}
            iconColor={theme.colors.onSurface}
          />
          
          <IconButton
            icon="heart-outline"
            size={24}
            onPress={() => {/* TODO: Implement favorite */}}
            iconColor={theme.colors.onSurface}
          />
          
          <IconButton
            icon="repeat"
            size={24}
            onPress={() => {/* TODO: Implement repeat */}}
            iconColor={theme.colors.onSurface}
          />
          
          <IconButton
            icon="playlist-music"
            size={24}
            onPress={() => {/* TODO: Show queue */}}
            iconColor={theme.colors.onSurface}
          />
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  albumArtContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  albumArtCard: {
    elevation: 8,
    borderRadius: 12,
  },
  albumArt: {
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: 12,
  },
  trackInfo: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  trackTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.onBackground,
    textAlign: 'center',
    marginBottom: 8,
  },
  trackArtist: {
    fontSize: 18,
    color: theme.colors.onBackground,
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: 4,
  },
  trackAlbum: {
    fontSize: 16,
    color: theme.colors.onBackground,
    opacity: 0.6,
    textAlign: 'center',
  },
  progressContainer: {
    paddingHorizontal: 20,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderThumb: {
    backgroundColor: theme.colors.primary,
    width: 12,
    height: 12,
  },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -10,
  },
  timeText: {
    fontSize: 12,
    color: theme.colors.onBackground,
    opacity: 0.7,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 50,
    paddingVertical: 10,
    elevation: 4,
  },
  playButton: {
    backgroundColor: theme.colors.primaryContainer,
    marginHorizontal: 20,
  },
  additionalControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.onBackground,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: theme.colors.onBackground,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 24,
  },
});
