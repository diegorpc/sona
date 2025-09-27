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
import QueueScreen from '../screens/QueueScreen';
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
  const {
    playerState,
    togglePlayPause,
    reorderPriorityQueue,
    removePriorityTrack,
    reorderContextQueue,
    moveContextTrackToPriority,
  } = usePlayer();
  const { currentTrack, isPlaying, isLoading, position, duration } = playerState;
  const [isExpanded, setIsExpanded] = useState(false);
  const [isQueueVisible, setIsQueueVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const animation = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const screenHeight = Dimensions.get('window').height;
  const skipNextAnimationRef = useRef(false);
  const queueAnimation = useRef(new Animated.Value(0)).current;

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

  const handleHideQueue = useCallback(() => {
    Animated.timing(queueAnimation, {
      toValue: 0,
      duration: ANIMATION_DURATION,
      easing: undefined,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsQueueVisible(false);
      }
    });
  }, [queueAnimation]);

  const handleCollapse = useCallback(() => {
    if (isQueueVisible) {
      handleHideQueue();
      return;
    }

    if (isExpanded) {
      setIsExpanded(false);
      Animated.spring(dragY, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  }, [dragY, handleHideQueue, isExpanded, isQueueVisible]);

  const collapseFromGesture = useCallback(() => {
    if (!isExpanded || isQueueVisible) {
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
  }, [animation, dragY, isExpanded, isQueueVisible]);

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
          !isQueueVisible &&
          isExpanded &&
          (gestureState.dy > 6 || Math.abs(gestureState.vy) > 0.15),
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
    [collapseFromGesture, dragY, isExpanded, isQueueVisible]
  );

  const handleShowQueue = useCallback(() => {
    if (isQueueVisible) {
      return;
    }

    setIsQueueVisible(true);
    Animated.timing(queueAnimation, {
      toValue: 1,
      duration: ANIMATION_DURATION,
      easing: undefined,
      useNativeDriver: true,
    }).start();
  }, [isQueueVisible, queueAnimation]);

  const queueTranslateY = useMemo(
    () =>
      queueAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [screenHeight, 0],
      }),
    [queueAnimation, screenHeight]
  );

  const priorityQueue = useMemo(
    () => playerState.priorityQueue ?? [],
    [playerState.priorityQueue]
  );

  const contextQueue = useMemo(() => {
    if (!Array.isArray(playerState.playlist) || playerState.playlist.length === 0) {
      return [];
    }

    const startIndex = Math.min(playerState.currentIndex + 1, playerState.playlist.length);
    return playerState.playlist.slice(startIndex);
  }, [playerState.playlist, playerState.currentIndex]);

  const contextLabel = useMemo(() => {
    if (playerState.queueContext?.name) {
      return playerState.queueContext.name;
    }

    if (currentTrack?.album) {
      return currentTrack.album;
    }

    if (currentTrack?.artist) {
      return currentTrack.artist;
    }

    return 'Current Context';
  }, [currentTrack?.album, currentTrack?.artist, playerState.queueContext?.name]);

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
        <PlayerScreen onClose={handleCollapse} onShowQueue={handleShowQueue} />
      </Animated.View>

      {isQueueVisible && (
        <Animated.View
          pointerEvents="auto"
          style={[
            styles.queueOverlay,
            {
              paddingBottom: insets.bottom,
              paddingTop: insets.top,
              transform: [{ translateY: queueTranslateY }],
            },
          ]}
        >
          <QueueScreen
            currentTrack={currentTrack}
            priorityQueue={priorityQueue}
            contextQueue={contextQueue}
            contextLabel={contextLabel}
            onClose={handleHideQueue}
            onReorderPriority={reorderPriorityQueue}
            onRemovePriority={removePriorityTrack}
            onReorderContext={reorderContextQueue}
            onMoveContextToPriority={moveContextTrackToPriority}
          />
        </Animated.View>
      )}
    </View>
  );
};

export default PlayerOverlay;

