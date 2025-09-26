import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MiniPlayer from './MiniPlayer';
import PlayerScreen from '../screens/PlayerScreen';
import { usePlayer } from '../contexts/PlayerContext';
import SubsonicAPI from '../services/SubsonicAPI';
import { styles } from '../styles/PlayerOverlay.styles';
import {
  registerPlayerOverlay,
  unregisterPlayerOverlay,
} from '../services/PlayerOverlayController';

const ANIMATION_DURATION = 280;
const TAB_BAR_OFFSET = 50;

const PlayerOverlay = () => {
  const { playerState, togglePlayPause } = usePlayer();
  const { currentTrack, isPlaying, isLoading, position, duration } = playerState;
  const [isExpanded, setIsExpanded] = useState(false);
  const insets = useSafeAreaInsets();
  const animation = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const screenHeight = Dimensions.get('window').height;
  const skipNextAnimationRef = useRef(false);

  useEffect(() => {
    if (skipNextAnimationRef.current) {
      skipNextAnimationRef.current = false;
      animation.setValue(isExpanded ? 1 : 0);
      return;
    }

    Animated.timing(animation, {
      toValue: isExpanded ? 1 : 0,
      duration: ANIMATION_DURATION,
      easing: undefined,
      useNativeDriver: true,
    }).start();
  }, [animation, isExpanded]);

  useEffect(() => {
    if (!currentTrack) {
      setIsExpanded(false);
    }
  }, [currentTrack]);

  const coverArtUrl = currentTrack?.coverArt
    ? SubsonicAPI.getCoverArtUrl(currentTrack.coverArt, 240)
    : null;

  const backdropOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.4],
  });

  const fullscreenBaseTranslateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [screenHeight, 0],
  });

  const fullscreenTranslateY = Animated.add(fullscreenBaseTranslateY, dragY);

  const miniOpacity = animation.interpolate({
    inputRange: [0, 0.2],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const collapsedBottom = insets.bottom + TAB_BAR_OFFSET;

  const handleExpand = useCallback(() => {
    if (!isExpanded) {
      setIsExpanded(true);
    }
  }, [isExpanded]);

  const handleCollapse = useCallback(() => {
    if (isExpanded) {
      setIsExpanded(false);
      Animated.spring(dragY, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  }, [dragY, isExpanded]);

  const collapseFromGesture = useCallback(() => {
    if (!isExpanded) {
      return;
    }

    skipNextAnimationRef.current = true;

    Animated.parallel([
      Animated.timing(animation, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        easing: undefined,
        useNativeDriver: true,
      }),
      Animated.timing(dragY, {
        toValue: 0,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
    ]).start(() => {
      dragY.setValue(0);
      setIsExpanded(false);
    });
  }, [animation, dragY, isExpanded]);

  useEffect(() => {
    registerPlayerOverlay({
      expand: handleExpand,
      collapse: handleCollapse,
    });

    return () => {
      unregisterPlayerOverlay();
    };
  }, [handleCollapse, handleExpand]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          isExpanded && (gestureState.dy > 6 || Math.abs(gestureState.vy) > 0.15),
        onPanResponderGrant: () => {
          dragY.setValue(0);
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            dragY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          const shouldClose = gestureState.dy > 160 || gestureState.vy > 0.8;

          if (shouldClose) {
            collapseFromGesture();
          } else {
            Animated.spring(dragY, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [collapseFromGesture, dragY, isExpanded]
  );

  if (!currentTrack) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <Animated.View
        pointerEvents={isExpanded ? 'auto' : 'none'}
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        <TouchableWithoutFeedback onPress={handleCollapse}>
          <View style={styles.backdropTouchable} />
        </TouchableWithoutFeedback>
      </Animated.View>

      <Animated.View
        pointerEvents={isExpanded ? 'none' : 'auto'}
        style={[
          styles.miniContainer,
          {
            bottom: collapsedBottom,
            opacity: miniOpacity,
          },
        ]}
      >
        <MiniPlayer
          track={currentTrack}
          isPlaying={isPlaying}
          isLoading={isLoading}
          position={position}
          duration={duration}
          coverArtUrl={coverArtUrl}
          onPlayPause={togglePlayPause}
          onExpand={handleExpand}
        />
      </Animated.View>

      <Animated.View
        pointerEvents={isExpanded ? 'auto' : 'none'}
        style={[
          styles.fullscreenContainer,
          {
            transform: [{ translateY: fullscreenTranslateY }],
            paddingBottom: insets.bottom,
            paddingTop: insets.top,
          },
        ]}
        {...panResponder.panHandlers}
      >
        <PlayerScreen onClose={handleCollapse} />
      </Animated.View>
    </View>
  );
};

export default PlayerOverlay;

