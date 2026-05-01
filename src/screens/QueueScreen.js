import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Image, View, TouchableOpacity, ScrollView } from 'react-native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { Text } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import SubsonicAPI from '../services/SubsonicAPI';
import { useTheme } from '../contexts/ThemeContext';
import { usePlayer } from '../contexts/PlayerContext';
import { createStyles } from '../styles/QueueScreen.styles';

const DEFAULT_ART = require('../../assets/default-album.png');
const QUEUE_THUMB_SIZE = 44;

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

// ─── Queue item ────────────────────────────────────────────────────
const QueueItem = memo(({ item, drag, isActive, isNowPlaying, actionIcon, actionLabel, onActionPress }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const duration = useMemo(() => formatDuration(item?.duration), [item?.duration]);

  const coverArtSource = useMemo(() => getCoverArt(item, 128), [item?.coverArt, item?.albumId]);
  const [thumbSize, setThumbSize] = useState({ width: QUEUE_THUMB_SIZE, height: QUEUE_THUMB_SIZE });
  useEffect(() => { setThumbSize({ width: QUEUE_THUMB_SIZE, height: QUEUE_THUMB_SIZE }); }, [coverArtSource]);
  const handleThumbLoad = useCallback((e) => {
    const { width: w, height: h } = e.nativeEvent.source;
    if (!w || !h) return;
    const ratio = w / h;
    setThumbSize(ratio >= 1
      ? { width: QUEUE_THUMB_SIZE, height: Math.round(QUEUE_THUMB_SIZE / ratio) }
      : { width: Math.round(QUEUE_THUMB_SIZE * ratio), height: QUEUE_THUMB_SIZE }
    );
  }, []);

  return (
    <View style={[styles.itemContainer, isActive && styles.itemActive, isNowPlaying && styles.itemActive]}>
      {/* Drag handle or now-playing indicator */}
      {isNowPlaying ? (
        <View style={styles.nowPlayingIndicator}>
          <MaterialIcons name="play-arrow" size={14} color={theme.colors.primary} />
        </View>
      ) : (
        <TouchableOpacity
          onPressIn={drag}
          onLongPress={drag}
          delayLongPress={60}
          style={styles.dragHandle}
          accessibilityLabel="Drag to reorder"
        >
          <MaterialIcons name="drag-handle" size={22} style={styles.dragHandleIcon} />
        </TouchableOpacity>
      )}

      <View style={styles.coverArtContainer}>
        <Image
          source={coverArtSource}
          style={{ width: thumbSize.width, height: thumbSize.height, borderRadius: 6 }}
          defaultSource={DEFAULT_ART}
          onLoad={handleThumbLoad}
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

        {/* Skip (now playing) or Remove (priority queue) */}
        {isNowPlaying && (
          <TouchableOpacity style={styles.actionButton} onPress={onActionPress} accessibilityLabel="Skip track">
            <MaterialIcons name="skip-next" size={22} style={styles.skipIcon} />
          </TouchableOpacity>
        )}
        {!isNowPlaying && typeof onActionPress === 'function' && (
          <TouchableOpacity style={styles.actionButton} onPress={onActionPress} accessibilityLabel={actionLabel}>
            <MaterialIcons name={actionIcon} size={20} style={styles.actionIcon} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});
QueueItem.displayName = 'QueueItem';

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
  onReorderContext,
  onMoveContextToPriority,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { playerState } = usePlayer();
  const [shuffleOn, setShuffleOn] = useState(false);
  const [repeatOn, setRepeatOn] = useState(false);

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

  const renderPriorityItem = useCallback(({ item, drag, isActive, index }) => (
    <QueueItem
      item={item}
      drag={drag}
      isActive={isActive}
      onActionPress={() => handleRemovePriority(index)}
      actionIcon="remove-circle-outline"
      actionLabel="Remove from queue"
    />
  ), [handleRemovePriority]);

  const renderContextItem = useCallback(({ item, drag, isActive }) => (
    <QueueItem item={item} drag={drag} isActive={isActive} />
  ), []);

  return (
    <ImageBackground source={backgroundArt} style={styles.backgroundImage} resizeMode="cover">
      <BlurView intensity={65} tint="dark" style={styles.blurOverlay}>
        {/* Accent glow */}
        <LinearGradient
          colors={[`${theme.colors.primary}38`, 'transparent']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 260 }}
        />

        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="chevron-left" size={28} color={theme.colors.onSurface} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Queue</Text>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Now Playing */}
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

            <View style={styles.divider} />

            {/* Priority queue */}
            <Text style={styles.sectionLabelMuted}>Next in Queue</Text>
            {priorityQueue.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Queue is empty</Text>
              </View>
            ) : (
              <DraggableFlatList
                data={priorityQueue}
                keyExtractor={(item, index) => `priority-${item?.id ?? 'track'}-${index}`}
                renderItem={renderPriorityItem}
                onDragEnd={({ from, to }) => {
                  if (typeof onReorderPriority === 'function' && from !== to) {
                    onReorderPriority(from, to);
                  }
                }}
                activationDistance={6}
                autoscrollThreshold={32}
                scrollEnabled={false}
              />
            )}

            <View style={styles.divider} />

            {/* Context queue */}
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
              <DraggableFlatList
                data={contextQueue}
                keyExtractor={(item, index) => `context-${item?.id ?? 'track'}-${index}`}
                renderItem={renderContextItem}
                onDragEnd={({ from, to }) => {
                  if (typeof onReorderContext === 'function' && from !== to) {
                    onReorderContext(from, to);
                  }
                }}
                activationDistance={6}
                autoscrollThreshold={32}
                scrollEnabled={false}
              />
            )}
            <View style={styles.listFooter} />
          </ScrollView>
        </View>
      </BlurView>
    </ImageBackground>
  );
};

export default QueueScreen;
