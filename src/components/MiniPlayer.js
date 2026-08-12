import React from 'react';
import { View, Pressable, Easing } from 'react-native';
import { BlurView } from 'expo-blur';
import { IconButton, Text, ActivityIndicator } from 'react-native-paper';
import { useTheme } from '../contexts/ThemeContext';
import TextTicker from 'react-native-text-ticker'

import CachedImage from './CachedImage';
import { MINI_HEIGHT, createStyles } from '../styles/MiniPlayer.styles';

const DEFAULT_ART = require('../../assets/default-album.png');

const MiniPlayer = ({
  track,
  isPlaying,
  isLoading,
  isBuffering,
  position,
  duration,
  onPlayPause,
  onExpand,
  coverArtId,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  
  if (!track) {
    return null;
  }

  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;

  return (
    <Pressable
      onPress={onExpand}
      style={({ pressed }) => [
        styles.touchable,
        pressed && styles.touchablePressed,
      ]}
    >
      <BlurView intensity={45} tint="light" style={styles.blurContainer}>
        <View style={styles.content}>
          <CachedImage
            coverArtId={coverArtId}
            fallbackSource={DEFAULT_ART}
            style={styles.coverArt}
          />

          <View style={styles.infoContainer}>
            <TextTicker
              style={styles.title}
              duration={4000}
              bounce
              loop
              easing={Easing.linear}
              animationType="bounce"
              repeatSpacer={50}
              marqueeDelay={1000}
              bouncePadding={{ left: 0, right: 5 }}
              bounceDelay={1000}
            >
              {track.title}
            </TextTicker>
            <TextTicker
              style={styles.artist}
              duration={4000}
              bounce
              loop
              easing={Easing.linear}
              animationType="bounce"
              repeatSpacer={50}
              marqueeDelay={1000}
              bouncePadding={{ left: 0, right: 5 }}
              bounceDelay={1000}
            >
              {track.artist || 'Unknown Artist'}
            </TextTicker>
          </View>

          <IconButton
            icon={
              isLoading || isBuffering
                ? ({ size, color }) => <ActivityIndicator animating size={size * 0.75} color={color} />
                : isPlaying ? 'pause' : 'play'
            }
            iconColor={theme.colors.primary}
            containerColor="transparent"
            rippleColor="rgba(255, 255, 255, 0.1)"
            onPress={(event) => {
              event.stopPropagation();
              // Buffering stays tappable so a stalled stream can be paused
              if (!isLoading) {
                onPlayPause();
              }
            }}
            style={styles.playPause}
          />
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { flex: progress }]} />
          <View style={{ flex: Math.max(1 - progress, 0) }} />
        </View>
      </BlurView>
    </Pressable>
  );
};

export { MINI_HEIGHT };
export default MiniPlayer;
