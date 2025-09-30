import React from 'react';
import { View, Image, Pressable, Easing } from 'react-native';
import { BlurView } from 'expo-blur';
import { IconButton, Text } from 'react-native-paper';
import { theme } from '../theme/theme';
import TextTicker from 'react-native-text-ticker'

import { MINI_HEIGHT, styles } from '../styles/MiniPlayer.styles';

const DEFAULT_ART = require('../../assets/default-album.png');

const MiniPlayer = ({
  track,
  isPlaying,
  isLoading,
  position,
  duration,
  onPlayPause,
  onExpand,
  coverArtUrl,
}) => {
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
          <Image
            source={coverArtUrl ? { uri: coverArtUrl } : DEFAULT_ART}
            defaultSource={DEFAULT_ART}
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
            icon={isLoading ? 'timer-sand' : isPlaying ? 'pause' : 'play'}
            size={24}
            iconColor={theme.colors.primary}
            onPress={(event) => {
              event.stopPropagation();
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
