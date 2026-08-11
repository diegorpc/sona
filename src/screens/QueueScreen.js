import React, { memo, useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { Image, View, TouchableOpacity, Animated, PanResponder } from 'react-native';
import Reanimated, { LinearTransition, FadeIn, FadeOut } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { Text } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenBackground from '../components/ScreenBackground';
import SongMenu from '../components/SongMenu';
import AddToPlaylistModal from '../components/AddToPlaylistModal';

import ArtworkCache from '../services/ArtworkCache';
import { useTheme } from '../contexts/ThemeContext';
import { usePlayer } from '../contexts/PlayerContext';
import { createStyles } from '../styles/QueueScreen.styles';
import { createStyles as createMenuStyles } from '../styles/SongMenu.styles';
import { collapseAllPlayerOverlay } from '../services/PlayerOverlayController';
import { navigate } from '../services/NavigationService';

const ITEM_LAYOUT = LinearTransition.duration(260);
const ITEM_ENTERING = FadeIn.duration(200);
const ITEM_EXITING = FadeOut.duration(160);

const DEFAULT_ART = require('../../assets/default-album.png');
const QUEUE_THUMB_SIZE = 44;
const SWIPE_ACTION_WIDTH = 80;
const CONTEXT_PAGE_SIZE = 50;

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

// Swipe delete action for priority queue — same overflow-hidden structure as SwipeAddNext
const SwipeDelete = memo(({ progress, theme }) => {
  const menuStyles = createMenuStyles(theme);
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [SWIPE_ACTION_WIDTH, 0],
    extrapolate: 'clamp',
  });
  return (
    <View style={menuStyles.swipeAction}>
      <Animated.View style={[
        menuStyles.swipeActionContent,
        { transform: [{ translateX }], backgroundColor: theme.colors.error || '#ef4444' },
      ]}>
        <MaterialIcons name="delete" size={22} color="#fff" />
        <Text style={[menuStyles.swipeActionLabel, { color: '#fff' }]}>Remove</Text>
      </Animated.View>
    </View>
  );
});
SwipeDelete.displayName = 'SwipeDelete';

// Static context-queue row (LibraryScreen-style: starred icon, long-press menu, swipe to add)
const ContextQueueRow = memo(({ item, index, theme, styles, onPress, onLongPress, onSwipeAddNext }) => {
  const swipeRef = useRef(null);
  const coverArtSource = useMemo(() => {
    if (item?.coverArt) return ArtworkCache.getArtworkSource(item.coverArt, 200, DEFAULT_ART);
    if (item?.albumId) return ArtworkCache.getArtworkSource(item.albumId, 200, DEFAULT_ART);
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
    <Reanimated.View
      layout={ITEM_LAYOUT}
      entering={ITEM_ENTERING}
      exiting={ITEM_EXITING}
      style={{ overflow: 'hidden' }}
    >
      <Swipeable
        ref={swipeRef}
        renderRightActions={renderRightActions}
        onSwipeableOpen={handleSwipeOpen}
        rightThreshold={60}
        overshootRight={false}
        friction={2}
      >
        <TouchableOpacity
          style={styles.contextItemContainer}
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
              style={styles.favoriteIcon}
            />
          ) : (
            <View style={styles.itemLeadingIcon} />
          )}
          <View style={styles.contextCoverArtContainer}>
            <Image source={coverArtSource} style={styles.contextCoverArt} resizeMode="contain" defaultSource={DEFAULT_ART} />
          </View>
          <View style={styles.infoContainer}>
            <Text numberOfLines={1} style={styles.contextTitle}>{item?.title ?? 'Unknown Title'}</Text>
            <Text numberOfLines={1} style={styles.contextSubtitle}>
              {item?.artist ?? 'Unknown Artist'}{item?.album ? ` · ${item.album}` : ''}
            </Text>
          </View>
          {Number.isFinite(item?.duration) ? (
            <Text style={styles.contextDuration}>{formatDuration(item.duration)}</Text>
          ) : null}
        </TouchableOpacity>
      </Swipeable>
    </Reanimated.View>
  );
});
ContextQueueRow.displayName = 'ContextQueueRow';

const getCoverArt = (track, size = 80) => {
  if (track?.coverArt) return ArtworkCache.getArtworkSource(track.coverArt, size, DEFAULT_ART);
  if (track?.albumId) return ArtworkCache.getArtworkSource(track.albumId, size, DEFAULT_ART);
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
    <Reanimated.View
      layout={ITEM_LAYOUT}
      entering={ITEM_ENTERING}
      exiting={ITEM_EXITING}
      style={{ overflow: 'hidden' }}
    >
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
    </Reanimated.View>
  );
});
PriorityQueueRow.displayName = 'PriorityQueueRow';

// ─── Context section header ─────────────────────────────────────────
const REPEAT_ICON = { none: 'repeat', all: 'repeat', one: 'repeat-one' };

const ContextHeader = ({ contextLabel, shuffleOn, repeatMode, onToggleShuffle, onCycleRepeat, styles, theme }) => {
  const repeatActive = repeatMode !== 'none';
  return (
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
          onPress={onCycleRepeat}
          style={[styles.toggleButton, repeatActive && styles.toggleButtonActive]}
          accessibilityLabel={`Repeat: ${repeatMode}`}
        >
          <MaterialIcons
            name={REPEAT_ICON[repeatMode] ?? 'repeat'}
            size={15}
            color={repeatActive ? theme.colors.primary : theme.colors.onSurface}
            style={{ opacity: repeatActive ? 1 : 0.4 }}
          />
          <Text style={[styles.toggleLabel, repeatActive && styles.toggleLabelActive]}>
            Repeat
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

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
  const {
    playerState,
    insertIntoPriorityQueue,
    appendToContextQueue,
    moveContextTrackToPriority,
    toggleShuffle,
    cycleRepeatMode,
  } = usePlayer();
  const [menuSong, setMenuSong] = useState(null);
  const [addToPlaylistSong, setAddToPlaylistSong] = useState(null);
  const [contextPage, setContextPage] = useState(0);

  // Reset pagination when context queue changes (track change / new context)
  useEffect(() => {
    setContextPage(0);
  }, [contextQueue]);

  const shuffleOn = playerState.shuffle ?? false;
  const repeatMode = playerState.repeatMode ?? 'none';

  // Track scroll position to know when we're at the top for drag-to-dismiss
  const scrollYRef = useRef(0);
  const isAtTopRef = useRef(true);

  const backgroundArt = useMemo(() => {
    if (currentTrack?.coverArt) return ArtworkCache.getArtworkSource(currentTrack.coverArt, 600, DEFAULT_ART);
    if (currentTrack?.albumId) return ArtworkCache.getArtworkSource(currentTrack.albumId, 600, DEFAULT_ART);
    return DEFAULT_ART;
  }, [currentTrack?.coverArt, currentTrack?.albumId]);

  const handleRemovePriority = useCallback((index) => {
    if (typeof onRemovePriority === 'function') onRemovePriority(index);
  }, [onRemovePriority]);

  const handleSkipNowPlaying = useCallback(() => {
    const AudioPlayer = require('../services/AudioPlayer').default;
    AudioPlayer.playNext();
  }, []);

  // Priority queue is the only draggable list.
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

  // Paginated context queue items
  const displayedContextItems = useMemo(
    () => contextQueue.slice(0, (contextPage + 1) * CONTEXT_PAGE_SIZE),
    [contextQueue, contextPage]
  );
  const hasMoreContextItems = displayedContextItems.length < contextQueue.length;

  const handleLoadMore = useCallback(() => {
    if (hasMoreContextItems) {
      setContextPage(prev => prev + 1);
    }
  }, [hasMoreContextItems]);

  // Context queue handlers (static rows: tap, long-press menu, swipe to add)
  const handleContextRowPress = useCallback((track) => {
    setMenuSong(track);
  }, []);
  const handleContextRowLongPress = useCallback((track) => {
    setMenuSong(track);
  }, []);
  const handleContextSwipeAddNext = useCallback((_track, index) => {
    if (typeof moveContextTrackToPriority === 'function') {
      moveContextTrackToPriority(index, priorityQueue.length);
    }
  }, [moveContextTrackToPriority, priorityQueue.length]);

  const menuOptions = useMemo(() => {
    if (!menuSong) return [];
    return [
      {
        key: 'goToAlbum',
        label: 'Go to album',
        icon: 'album',
        disabled: !menuSong.albumId,
        onPress: () => {
          collapseAllPlayerOverlay();
          navigate('Album', {
            album: {
              id: menuSong.albumId,
              name: menuSong.album,
              coverArt: menuSong.coverArt,
              artist: menuSong.artist,
              artistId: menuSong.artistId,
            },
          });
        },
      },
      {
        key: 'goToArtist',
        label: 'Go to artist',
        icon: 'person',
        disabled: !menuSong.artistId,
        onPress: () => {
          collapseAllPlayerOverlay();
          navigate('Artist', { artist: { id: menuSong.artistId, name: menuSong.artist } });
        },
      },
      {
        key: 'addToPlaylist',
        label: 'Add to playlist',
        icon: 'playlist-add',
        onPress: () => setAddToPlaylistSong(menuSong),
      },
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
      {
        key: 'download',
        label: 'Download',
        icon: 'download',
        disabled: true,
        onPress: () => {},
      },
    ];
  }, [menuSong, insertIntoPriorityQueue, appendToContextQueue]);

  const dragOffset = useRef(new Animated.Value(0)).current;
  const isDraggingRef = useRef(false);

  const handleScroll = useCallback(({ nativeEvent }) => {
    scrollYRef.current = nativeEvent.contentOffset.y;
    isAtTopRef.current = scrollYRef.current <= 0;
  }, []);

  // PanResponder for drag-down-to-dismiss
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => {
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
            dragOffset.setValue(gestureState.dy * 0.6);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          isDraggingRef.current = false;
          const shouldClose = gestureState.dy > 80 || gestureState.vy > 0.5;
          if (shouldClose) {
            if (typeof onClose === 'function') onClose();
          } else {
            Animated.spring(dragOffset, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
          }
        },
        onPanResponderTerminate: () => {
          isDraggingRef.current = false;
          Animated.spring(dragOffset, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
        },
        onPanResponderTerminationRequest: () => !isDraggingRef.current,
      }),
    [dragOffset, onClose]
  );

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
            dragOffset.setValue(gestureState.dy * 0.6);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          isDraggingRef.current = false;
          const shouldClose = gestureState.dy > 80 || gestureState.vy > 0.5;
          if (shouldClose) {
            if (typeof onClose === 'function') onClose();
          } else {
            Animated.spring(dragOffset, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
          }
        },
        onPanResponderTerminate: () => {
          isDraggingRef.current = false;
          Animated.spring(dragOffset, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
        },
      }),
    [dragOffset, onClose]
  );

  return (
      <ScreenBackground source={backgroundArt} backgroundStyle={styles.backgroundImage} blurStyle={styles.blurOverlay}>
        <Animated.View style={[styles.container, { transform: [{ translateY: dragOffset }] }]}>
          {/* Drag handle bar - always draggable for dismiss */}
          <View style={[styles.handleBarContainer, { paddingTop: safeAreaInsets.top + 8 }]} {...handleBarPanResponder.panHandlers}>
            <TouchableOpacity onPress={onClose} style={styles.handleBar} hitSlop={{ top: 8, bottom: 8, left: 40, right: 40 }} activeOpacity={0.6}>
              <MaterialIcons name="expand-more" size={28} color={theme.colors.onSurface} style={{ opacity: 0.35 }} />
            </TouchableOpacity>
          </View>

          {/* Header + Now Playing - wrapped for drag-down gesture */}
          <View {...handleBarPanResponder.panHandlers}>
            <View style={styles.header}>
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

          {/* Priority-only DraggableFlatList. Context queue is rendered in the footer with pagination. */}
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
            itemLayoutAnimation={ITEM_LAYOUT}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
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
                  repeatMode={repeatMode}
                  onToggleShuffle={toggleShuffle}
                  onCycleRepeat={cycleRepeatMode}
                  styles={styles}
                  theme={theme}
                />
                {displayedContextItems.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No upcoming tracks</Text>
                  </View>
                ) : (
                  displayedContextItems.map((track, index) => (
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
                {hasMoreContextItems && (
                  <View style={styles.emptyState}>
                    <Text style={[styles.emptyText, { opacity: 0.25 }]}>
                      {contextQueue.length - displayedContextItems.length} more tracks…
                    </Text>
                  </View>
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
        <AddToPlaylistModal
          song={addToPlaylistSong}
          visible={addToPlaylistSong !== null}
          onClose={() => setAddToPlaylistSong(null)}
        />
      </ScreenBackground>
  );
};

export default QueueScreen;
