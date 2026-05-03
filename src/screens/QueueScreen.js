import React, { memo, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Image, View, TouchableOpacity, Animated, PanResponder, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { Text } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenBackground from '../components/ScreenBackground';
import SongMenu from '../components/SongMenu';

import SubsonicAPI from '../services/SubsonicAPI';
import { useTheme } from '../contexts/ThemeContext';
import { usePlayer } from '../contexts/PlayerContext';
import { createStyles } from '../styles/QueueScreen.styles';
import { createStyles as createMenuStyles } from '../styles/SongMenu.styles';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const QUEUE_LAYOUT_ANIMATION = {
  duration: 220,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

const DEFAULT_ART = require('../../assets/default-album.png');
const QUEUE_THUMB_SIZE = 44;
const SWIPE_ACTION_WIDTH = 80;

// Swipe action shown when sliding a context queue row left
const SwipeAddNext = memo(({ progress, theme }) => {
  const menuStyles = createMenuStyles(theme);
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [SWIPE_ACTION_WIDTH, 0],
    extrapolate: 'clamp',
  });
  return (
    <View style={menuStyles.swipeAction}>
      <Animated.View style={[menuStyles.swipeActionContent, { transform: [{ translateX }] }]}>
        <MaterialIcons name="queue-play-next" size={22} color={theme.colors.onPrimary} />
        <Text style={menuStyles.swipeActionLabel}>Play next</Text>
      </Animated.View>
    </View>
  );
});
SwipeAddNext.displayName = 'SwipeAddNext';

// Swipe delete action for priority queue (red background with trash icon)
const SwipeDelete = memo(({ progress, theme }) => {
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [SWIPE_ACTION_WIDTH, 0],
    extrapolate: 'clamp',
  });
  return (
    <View style={{
      backgroundColor: theme.colors.error || '#ef4444',
      width: SWIPE_ACTION_WIDTH,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <Animated.View style={{ transform: [{ translateX }], alignItems: 'center' }}>
        <MaterialIcons name="delete" size={22} color="#fff" />
        <Text style={{
          color: '#fff',
          fontSize: 11,
          fontFamily: 'Lexend_500Medium',
          marginTop: 2,
        }}>Remove</Text>
      </Animated.View>
    </View>
  );
});
SwipeDelete.displayName = 'SwipeDelete';

// Static context-queue row (LibraryScreen-style: starred icon, long-press menu, swipe to add)
const ContextQueueRow = memo(({ item, index, theme, styles, onPress, onLongPress, onSwipeAddNext }) => {
  const swipeRef = useRef(null);
  const coverArtSource = useMemo(() => {
    if (item?.coverArt) return { uri: SubsonicAPI.getCoverArtUrl(item.coverArt, 200) };
    if (item?.albumId) return { uri: SubsonicAPI.getCoverArtUrl(item.albumId, 200) };
    return DEFAULT_ART;
  }, [item?.coverArt, item?.albumId]);
  const isStarred = Boolean(item?.starred);

  const handlePress = useCallback(() => {
    if (onPress) onPress(item, index);
  }, [onPress, item, index]);
  const handleLongPress = useCallback(() => {
    if (onLongPress) onLongPress(item, index);
  }, [onLongPress, item, index]);

  const renderRightActions = useCallback(
    (progress) => <SwipeAddNext progress={progress} theme={theme} />,
    [theme]
  );
  const handleSwipeOpen = useCallback(() => {
    if (onSwipeAddNext) onSwipeAddNext(item, index);
    swipeRef.current?.close();
  }, [item, index, onSwipeAddNext]);

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      onSwipeableOpen={handleSwipeOpen}
      rightThreshold={60}
      overshootRight={false}
      friction={2}
    >
      <TouchableOpacity
        style={styles.itemContainer}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={350}
        activeOpacity={0.7}
      >
        {isStarred ? (
          <MaterialIcons
            name="favorite"
            size={14}
            color={theme.colors.primary}
            style={{ marginRight: 8 }}
          />
        ) : (
          <View style={{ width: 14, marginRight: 8 }} />
        )}
        <View style={styles.coverArtContainer}>
          <Image source={coverArtSource} style={styles.coverArt} resizeMode="contain" defaultSource={DEFAULT_ART} />
        </View>
        <View style={styles.infoContainer}>
          <Text numberOfLines={1} style={styles.title}>{item?.title ?? 'Unknown Title'}</Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            {item?.artist ?? 'Unknown Artist'}{item?.album ? ` · ${item.album}` : ''}
          </Text>
        </View>
        <View style={styles.rightContent}>
          {Number.isFinite(item?.duration) ? (
            <Text style={styles.duration}>{formatDuration(item.duration)}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
});
ContextQueueRow.displayName = 'ContextQueueRow';

const getCoverArt = (track, size = 80) => {
  if (track?.coverArt) return { uri: SubsonicAPI.getCoverArtUrl(track.coverArt, size) };
  if (track?.albumId) return { uri: SubsonicAPI.getCoverArtUrl(track.albumId, size) };
  return DEFAULT_ART;
};

const formatDuration = (durationSeconds) => {
  if (!Number.isFinite(durationSeconds)) return '';
  const totalSeconds = Math.max(0, Math.floor(durationSeconds));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// ─── Queue item (renders inside Swipeable for priority queue) ────────────────────────────────────────────────────
const QueueItem = memo(({ item, drag, isActive, isNowPlaying, onActionPress }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const duration = useMemo(() => formatDuration(item?.duration), [item?.duration]);

  const coverArtSource = useMemo(() => getCoverArt(item, 200), [item?.coverArt, item?.albumId]);

  return (
    <View style={[styles.itemContainer, isActive && styles.itemActive, isNowPlaying && styles.itemActive]}>
      {/* Drag handle or now-playing indicator */}
      {isNowPlaying ? (
        <View style={styles.nowPlayingIndicator}>
          <MaterialIcons name="play-arrow" size={14} color={theme.colors.primary} />
        </View>
      ) : (
        <TouchableOpacity
          onLongPress={drag}
          delayLongPress={100}
          style={styles.dragHandle}
          accessibilityLabel="Long press to reorder"
        >
          <MaterialIcons name="drag-handle" size={22} style={styles.dragHandleIcon} />
        </TouchableOpacity>
      )}

      <View style={styles.coverArtContainer}>
        <Image
          source={coverArtSource}
          style={styles.coverArt}
          resizeMode="contain"
          defaultSource={DEFAULT_ART}
        />
      </View>

      <View style={styles.infoContainer}>
        <Text numberOfLines={1} style={[styles.title, isNowPlaying && styles.titleActive]}>
          {item?.title ?? 'Unknown Title'}
        </Text>
        <Text numberOfLines={1} style={[styles.subtitle, isNowPlaying && styles.subtitleActive]}>
          {item?.artist ?? 'Unknown Artist'}
          {item?.album ? ` · ${item.album}` : ''}
        </Text>
      </View>

      <View style={styles.rightContent}>
        {duration ? <Text style={styles.duration}>{duration}</Text> : null}

        {/* Skip (now playing) */}
        {isNowPlaying && (
          <TouchableOpacity style={styles.actionButton} onPress={onActionPress} accessibilityLabel="Skip track">
            <MaterialIcons name="skip-next" size={22} style={styles.skipIcon} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});
QueueItem.displayName = 'QueueItem';

// ─── Priority Queue Row (draggable + swipe-to-delete) ────────────────────────────────────────────────────
const PriorityQueueRow = memo(({ entry, drag, isActive, theme, styles, onSwipeRemove }) => {
  const swipeRef = useRef(null);

  const renderRightActions = useCallback(
    (progress) => <SwipeDelete progress={progress} theme={theme} />,
    [theme]
  );

  const handleSwipeOpen = useCallback(() => {
    if (onSwipeRemove) onSwipeRemove(entry.originalIndex);
    swipeRef.current?.close();
  }, [entry.originalIndex, onSwipeRemove]);

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      onSwipeableOpen={handleSwipeOpen}
      rightThreshold={60}
      overshootRight={false}
      friction={2}
    >
      <QueueItem
        item={entry.item}
        drag={drag}
        isActive={isActive}
      />
    </Swipeable>
  );
});
PriorityQueueRow.displayName = 'PriorityQueueRow';

// ─── Context section header ─────────────────────────────────────────
const ContextHeader = ({ contextLabel, shuffleOn, repeatOn, onToggleShuffle, onToggleRepeat, styles, theme }) => (
  <View style={styles.contextHeaderRow}>
    <View style={styles.contextHeaderText}>
      <Text style={styles.contextHeaderLabel}>Next in:</Text>
      <Text style={styles.contextHeaderName} numberOfLines={1}>{contextLabel}</Text>
    </View>
    <View style={styles.contextToggles}>
      <TouchableOpacity
        onPress={onToggleShuffle}
        style={[styles.toggleButton, shuffleOn && styles.toggleButtonActive]}
        accessibilityLabel="Toggle shuffle"
      >
        <MaterialIcons
          name="shuffle"
          size={15}
          color={shuffleOn ? theme.colors.primary : theme.colors.onSurface}
          style={{ opacity: shuffleOn ? 1 : 0.4 }}
        />
        <Text style={[styles.toggleLabel, shuffleOn && styles.toggleLabelActive]}>Shuffle</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onToggleRepeat}
        style={[styles.toggleButton, repeatOn && styles.toggleButtonActive]}
        accessibilityLabel="Toggle repeat"
      >
        <MaterialIcons
          name="repeat"
          size={15}
          color={repeatOn ? theme.colors.primary : theme.colors.onSurface}
          style={{ opacity: repeatOn ? 1 : 0.4 }}
        />
        <Text style={[styles.toggleLabel, repeatOn && styles.toggleLabelActive]}>Repeat</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// ─── Main QueueScreen ──────────────────────────────────────────────
const QueueScreen = ({
  currentTrack,
  priorityQueue,
  contextQueue,
  contextLabel,
  onClose,
  onReorderPriority,
  onRemovePriority,
  safeAreaInsets = { top: 0, bottom: 0 },
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { insertIntoPriorityQueue, appendToContextQueue, moveContextTrackToPriority } = usePlayer();
  const [shuffleOn, setShuffleOn] = useState(false);
  const [repeatOn, setRepeatOn] = useState(false);
  const [menuSong, setMenuSong] = useState(null);
  
  // Track scroll position to know when we're at the top for drag-to-dismiss
  const scrollYRef = useRef(0);
  const isAtTopRef = useRef(true);

  // Animate list changes (add/remove) smoothly
  useEffect(() => {
    LayoutAnimation.configureNext(QUEUE_LAYOUT_ANIMATION);
  }, [priorityQueue.length, contextQueue.length]);

  const backgroundArt = useMemo(() => {
    if (currentTrack?.coverArt) return { uri: SubsonicAPI.getCoverArtUrl(currentTrack.coverArt, 600) };
    if (currentTrack?.albumId) return { uri: SubsonicAPI.getCoverArtUrl(currentTrack.albumId, 600) };
    return DEFAULT_ART;
  }, [currentTrack?.coverArt, currentTrack?.albumId]);

  const handleRemovePriority = useCallback((index) => {
    if (typeof onRemovePriority === 'function') onRemovePriority(index);
  }, [onRemovePriority]);

  const handleSkipNowPlaying = useCallback(() => {
    // Skip to next track (same as pressing next in player)
    const AudioPlayer = require('../services/AudioPlayer').default;
    AudioPlayer.playNext();
  }, []);

  // Priority queue is the only draggable list. Items only contain track entries.
  const priorityItems = useMemo(
    () => priorityQueue.map((track, index) => ({
      item: track,
      originalIndex: index,
      key: `priority-${track?.id ?? 'track'}-${index}`,
    })),
    [priorityQueue]
  );

  const renderPriorityItem = useCallback(({ item: entry, drag, isActive }) => (
    <PriorityQueueRow
      entry={entry}
      drag={drag}
      isActive={isActive}
      theme={theme}
      styles={styles}
      onSwipeRemove={handleRemovePriority}
    />
  ), [handleRemovePriority, theme, styles]);

  const handleDragEnd = useCallback(({ from, to }) => {
    if (from === to) return;
    if (typeof onReorderPriority === 'function') {
      onReorderPriority(from, to);
    }
  }, [onReorderPriority]);

  // Context queue handlers (static rows: tap, long-press menu, swipe to add)
  const handleContextRowPress = useCallback((track) => {
    setMenuSong(track);
  }, []);
  const handleContextRowLongPress = useCallback((track) => {
    setMenuSong(track);
  }, []);
  const handleContextSwipeAddNext = useCallback((_track, index) => {
    // Move from context queue into the priority queue (removes from context, appends to priority).
    if (typeof moveContextTrackToPriority === 'function') {
      moveContextTrackToPriority(index, priorityQueue.length);
    }
  }, [moveContextTrackToPriority, priorityQueue.length]);

  const menuOptions = useMemo(() => {
    if (!menuSong) return [];
    return [
      {
        key: 'addNext',
        label: 'Add next in queue',
        icon: 'queue-play-next',
        onPress: () => insertIntoPriorityQueue(menuSong, 0),
      },
      {
        key: 'addLast',
        label: 'Add last in queue',
        icon: 'add-to-queue',
        onPress: () => appendToContextQueue(menuSong),
      },
    ];
  }, [menuSong, insertIntoPriorityQueue, appendToContextQueue]);

  const dragOffset = useRef(new Animated.Value(0)).current;
  const isDraggingRef = useRef(false);

  // Handle scroll events from DraggableFlatList
  const handleScroll = useCallback(({ nativeEvent }) => {
    scrollYRef.current = nativeEvent.contentOffset.y;
    isAtTopRef.current = scrollYRef.current <= 0;
  }, []);

  // PanResponder for drag-down-to-dismiss
  // Works from handle bar (always) and Now Playing section (when at top of scroll)
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Capture immediately on touch start for handle bar
        onStartShouldSetPanResponder: () => true,
        // For moves, only capture if we're dragging down and at top of list
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Always allow drag from handle bar (negative y or small dy)
          // For Now Playing area, only allow if at top and dragging down
          const isDraggingDown = gestureState.dy > 2;
          const isFastDrag = Math.abs(gestureState.vy) > 0.5;
          return (isDraggingDown && isAtTopRef.current) || isFastDrag;
        },
        onPanResponderGrant: () => {
          dragOffset.setValue(0);
          isDraggingRef.current = true;
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            const resistance = 0.6;
            dragOffset.setValue(gestureState.dy * resistance);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          isDraggingRef.current = false;
          const shouldClose = gestureState.dy > 80 || gestureState.vy > 0.5;
          
          if (shouldClose) {
            if (typeof onClose === 'function') onClose();
          } else {
            Animated.spring(dragOffset, {
              toValue: 0,
              useNativeDriver: true,
              friction: 8,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          isDraggingRef.current = false;
          Animated.spring(dragOffset, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
        },
        onPanResponderTerminationRequest: () => !isDraggingRef.current,
      }),
    [dragOffset, onClose]
  );
  
  // Separate pan responder for handle bar (always draggable)
  const handleBarPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gestureState.dy > 2 || Math.abs(gestureState.vy) > 0.05,
        onPanResponderGrant: () => {
          dragOffset.setValue(0);
          isDraggingRef.current = true;
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            const resistance = 0.6;
            dragOffset.setValue(gestureState.dy * resistance);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          isDraggingRef.current = false;
          const shouldClose = gestureState.dy > 80 || gestureState.vy > 0.5;
          
          if (shouldClose) {
            if (typeof onClose === 'function') onClose();
          } else {
            Animated.spring(dragOffset, {
              toValue: 0,
              useNativeDriver: true,
              friction: 8,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          isDraggingRef.current = false;
          Animated.spring(dragOffset, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
        },
      }),
    [dragOffset, onClose]
  );

  return (
      <ScreenBackground source={backgroundArt} backgroundStyle={styles.backgroundImage} blurStyle={styles.blurOverlay}>
        <Animated.View style={[styles.container, { transform: [{ translateY: dragOffset }] }]}>
          {/* Drag handle bar - always draggable for dismiss */}
          <View style={[styles.handleBarContainer, { paddingTop: safeAreaInsets.top + 8 }]} {...handleBarPanResponder.panHandlers}>
            <View style={styles.handleBar} />
          </View>

          {/* Header + Now Playing - wrapped for drag-down gesture */}
          <View {...handleBarPanResponder.panHandlers}>
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.headerBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialIcons name="chevron-left" size={28} color={theme.colors.onSurface} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Queue</Text>
            </View>
            {/* Now Playing */}
            <View style={styles.nowPlayingContainer}>
              <Text style={styles.sectionLabel}>Now Playing</Text>
              {currentTrack ? (
                <QueueItem
                  item={currentTrack}
                  drag={() => {}}
                  isActive={false}
                  isNowPlaying
                  onActionPress={handleSkipNowPlaying}
                />
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Nothing playing</Text>
                </View>
              )}
            </View>
          </View>
          {/* Priority-only DraggableFlatList. Now Playing is static (header), context queue is static (footer). */}
          <DraggableFlatList
            data={priorityItems}
            renderItem={renderPriorityItem}
            keyExtractor={(item) => item.key}
            onDragEnd={handleDragEnd}
            activationDistance={10}
            autoscrollThreshold={32}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            ListHeaderComponent={(
              <View>
                {priorityQueue.length > 0 && (
                  <Text style={styles.sectionLabelMuted}>Next in Queue</Text>
                )}
              </View>
            )}
            ListFooterComponent={(
              <View>
                {priorityQueue.length > 0 && <View style={styles.divider} />}
                <ContextHeader
                  contextLabel={contextLabel || 'Current Context'}
                  shuffleOn={shuffleOn}
                  repeatOn={repeatOn}
                  onToggleShuffle={() => setShuffleOn(v => !v)}
                  onToggleRepeat={() => setRepeatOn(v => !v)}
                  styles={styles}
                  theme={theme}
                />
                {contextQueue.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No upcoming tracks</Text>
                  </View>
                ) : (
                  contextQueue.map((track, index) => (
                    <ContextQueueRow
                      key={`context-${track?.id ?? 'track'}-${index}`}
                      item={track}
                      index={index}
                      theme={theme}
                      styles={styles}
                      onPress={handleContextRowPress}
                      onLongPress={handleContextRowLongPress}
                      onSwipeAddNext={handleContextSwipeAddNext}
                    />
                  ))
                )}
                <View style={[styles.listFooter, { height: safeAreaInsets.bottom + 20 }]} />
              </View>
            )}
          />
        </Animated.View>
        <SongMenu
          song={menuSong}
          visible={menuSong !== null}
          onClose={() => setMenuSong(null)}
          options={menuOptions}
        />
      </ScreenBackground>
  );
};

export default QueueScreen;
