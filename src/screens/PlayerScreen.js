import React, { useEffect, useRef, useState } from 'react';
import { View, Image, ImageBackground } from 'react-native';
import { Text, IconButton, Card, Surface } from 'react-native-paper';
import Slider from '@react-native-assets/slider';

import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import AudioPlayer from '../services/AudioPlayer';
import SubsonicAPI from '../services/SubsonicAPI';
import { theme } from '../theme/theme';
import { styles } from '../styles/PlayerScreen.styles';

const DEFAULT_ART = require('../../assets/default-album.png');

export default function PlayerScreen({ onClose, onShowQueue }) {
  const [playerState, setPlayerState] = useState(AudioPlayer.getCurrentState());
  const [isSliding, setIsSliding] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);
  const isSlidingRef = useRef(false);

  useEffect(() => {
    // Load saved state
    AudioPlayer.loadSavedState();

    // Add listener for player state changes
    const listener = (state) => {
      setPlayerState(state);
      if (!isSlidingRef.current) {
        setSliderValue(state.position);
      }
    };

    AudioPlayer.addListener(listener);

    return () => {
      AudioPlayer.removeListener(listener);
    };
  }, []);

  const handlePlayPause = () => {
    AudioPlayer.togglePlayPause();
  };

  const handleNext = () => {
    AudioPlayer.playNext();
  };

  const handlePrevious = () => {
    AudioPlayer.playPrevious();
  };

  const handleSeek = async (value) => {
    if (duration > 0) {
      const seekPosition = (value / 100) * duration;
      console.log('seeking to ' + seekPosition/1000 + 's ' , value);
      await AudioPlayer.seekTo(seekPosition);
    }
  };

  const handleSliderStart = () => {
    isSlidingRef.current = true;
    setIsSliding(true);
  };

  const handleSliderComplete = async (value) => {
    await handleSeek(value);
    isSlidingRef.current = false;
    setIsSliding(false);
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

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="music-note" size={64} color={theme.colors.outline} />
      <Text style={styles.emptyText}>No track selected</Text>
      <Text style={styles.emptySubtext}>
        Choose a song from your library to start playing
      </Text>
    </View>
  );

  const { currentTrack, isPlaying, position, duration, isLoading } = playerState;

  const shouldShowDuration = !isLoading && Number.isFinite(duration) && duration > 0;
  const endTimeDisplay = shouldShowDuration ? formatTime(duration) : 'Loading…';

  const isStarred = useRef(currentTrack.starred);

  const handleClose = () => {
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  if (!currentTrack) {
    return renderEmptyState();
  }

  const coverArtUrl = getCoverArtUrl(currentTrack);

  return (
    <ImageBackground
      source={coverArtUrl ? { uri: coverArtUrl } : DEFAULT_ART}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <BlurView intensity={65} tint="dark" style={styles.blurOverlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.dragIndicator} />
            <IconButton
              icon="chevron-down"
              size={28}
              onPress={handleClose}
              iconColor={theme.colors.onBackground}
              style={styles.closeButton}
            />
          </View>

          <View style={styles.content}>
            <View style={styles.albumArtContainer}>
              <Image
                source={coverArtUrl ? { uri: coverArtUrl } : DEFAULT_ART}
                style={styles.albumArt}
                defaultSource={DEFAULT_ART}
              />
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
                value={
                  duration > 0
                    ? isSliding
                      ? (sliderValue / duration) * 100
                      : (position / duration) * 100
                    : 0
                }
                onValueChange={handleSliderChange}
                onSlidingStart={handleSliderStart}
                onSlidingComplete={handleSliderComplete}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor={theme.colors.outline}
                thumbTintColor={theme.colors.primary}
                thumbSize={16}
                trackHeight={5}
              />
              <View style={styles.timeContainer}>
                <Text style={styles.timeText}>
                  {formatTime(isSliding ? sliderValue : position)}
                </Text>
                <Text style={styles.timeText}>{endTimeDisplay}</Text>
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
                iconColor={theme.colors.onSurface}
                style={styles.playButton}
              />

              <IconButton
                icon="skip-next"
                size={32}
                onPress={handleNext}
                iconColor={theme.colors.onSurface}
              />
            </Surface>

            <View style={styles.additionalControls}>
              <IconButton
                icon="shuffle"
                size={24}
                onPress={() => {
                  /* TODO: Implement shuffle */
                }}
                iconColor={theme.colors.onSurface}
              />

              <IconButton
                icon={isStarred.current ? 'heart' : 'heart-outline'}
                size={24}
                onPress={() => {
                  if (isStarred.current) {
                    SubsonicAPI.unstar(currentTrack.id);
                    isStarred.current = false;
                  } else {
                    SubsonicAPI.star(currentTrack.id);
                    isStarred.current = true;
                  }
                }}
                iconColor={theme.colors.onSurface}
              />

              <IconButton
                icon="repeat"
                size={24}
                onPress={() => {
                  /* TODO: Implement repeat */
                }}
                iconColor={theme.colors.onSurface}
              />

              <IconButton
                icon="playlist-music"
                size={24}
                onPress={() => {
                  onShowQueue();
                }}
                iconColor={theme.colors.onSurface}
              />
            </View>
          </View>
        </View>
      </BlurView>
    </ImageBackground>
  );
}

