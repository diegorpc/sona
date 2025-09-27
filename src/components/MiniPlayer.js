import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { View, Image, Pressable, Animated, Easing } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { theme } from '../theme/theme';

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

  const scrollXTitle = useRef(new Animated.Value(0));
  const scrollXArtist = useRef(new Animated.Value(0));
  const [titleWidth, setTitleWidth] = useState(0);
  const [artistWidth, setArtistWidth] = useState(0);
  const [titleContainerWidth, setTitleContainerWidth] = useState(0);
  const [artistContainerWidth, setArtistContainerWidth] = useState(0);

  const measureTextTitle = useCallback(event => {
    setTitleWidth(event.nativeEvent.layout.width);
  }, []);

  const measureTextArtist = useCallback(event => {
    setArtistWidth(event.nativeEvent.layout.width);
  }, []);

  const handleTitleContainerLayout = useCallback(event => {
    setTitleContainerWidth(event.nativeEvent.layout.width);
  }, []);

  const handleArtistContainerLayout = useCallback(event => {
    setArtistContainerWidth(event.nativeEvent.layout.width);
  }, []);

  const shouldScrollTitle = useMemo(
    () => titleWidth > titleContainerWidth + 1 && titleContainerWidth > 0,
    [titleWidth, titleContainerWidth]
  );

  const shouldScrollArtist = useMemo(
    () => artistWidth > artistContainerWidth + 1 && artistContainerWidth > 0,
    [artistWidth, artistContainerWidth]
  );

  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;

  useEffect(() => {
    if (!shouldScrollTitle) {
      scrollXTitle.current.stopAnimation();
      scrollXTitle.current.setValue(0);
      return undefined;
    }

    scrollXTitle.current.stopAnimation();
    scrollXTitle.current.setValue(0);

    const animation = Animated.loop(
      Animated.timing(scrollXTitle.current, {
        toValue: -(titleWidth - titleContainerWidth),
        duration: duration || 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [shouldScrollTitle, titleWidth, titleContainerWidth, duration, track?.title]);

  useEffect(() => {
    if (!shouldScrollArtist) {
      scrollXArtist.current.stopAnimation();
      scrollXArtist.current.setValue(0);
      return undefined;
    }

    scrollXArtist.current.stopAnimation();
    scrollXArtist.current.setValue(0);

    const animation = Animated.loop(
      Animated.timing(scrollXArtist.current, {
        toValue: -(artistWidth - artistContainerWidth),
        duration: duration || 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [shouldScrollArtist, artistWidth, artistContainerWidth, duration, track?.artist]);

  return (
    <Pressable
      onPress={onExpand}
      style={({ pressed }) => [
        styles.touchable,
        pressed && styles.touchablePressed,
      ]}
    >
      <View style={styles.content}>
        <Image
          source={coverArtUrl ? { uri: coverArtUrl } : DEFAULT_ART}
          defaultSource={DEFAULT_ART}
          style={styles.coverArt}
        />

        <View style={styles.infoContainer}>
          <View style={styles.animatedTextContainer} onLayout={handleTitleContainerLayout}>
            <Animated.View
              style={[
                styles.scrollingText,
                shouldScrollTitle && { transform: [{ translateX: scrollXTitle.current }] },
              ]}
              pointerEvents="none"
            >
              <Text numberOfLines={1} style={styles.title} onLayout={measureTextTitle}>
                {track.title}
              </Text>
            </Animated.View>
          </View>
          <View style={styles.animatedTextContainer} onLayout={handleArtistContainerLayout}>
            <Animated.View
              style={[
                styles.scrollingText,
                shouldScrollArtist && { transform: [{ translateX: scrollXArtist.current }] },
              ]}
              pointerEvents="none"
            >
              <Text numberOfLines={1} style={styles.artist} onLayout={measureTextArtist}>
                {track.artist || 'Unknown Artist'}
              </Text>
            </Animated.View>
          </View>
        </View>

        <IconButton
          icon={isLoading ? 'timer-sand' : isPlaying ? 'pause' : 'play'}
          size={24}
          iconColor={theme.colors.onSurface}
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
    </Pressable>
  );
};

export { MINI_HEIGHT };
export default MiniPlayer;
