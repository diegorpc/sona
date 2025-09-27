import React, { memo, useCallback, useMemo } from 'react';
import { Image, View, TouchableOpacity } from 'react-native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { IconButton, Text } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';

import SubsonicAPI from '../services/SubsonicAPI';
import { styles } from '../styles/QueueScreen.styles';

const DEFAULT_ART = require('../../assets/default-album.png');

const getCoverArt = (track, size = 80) => {
  if (track?.coverArt) {
    return { uri: SubsonicAPI.getCoverArtUrl(track.coverArt, size) };
  }

  if (track?.albumId) {
    return { uri: SubsonicAPI.getCoverArtUrl(track.albumId, size) };
  }

  return DEFAULT_ART;
};

const formatDuration = durationSeconds => {
  if (!Number.isFinite(durationSeconds)) {
    return '';
  }

  const totalSeconds = Math.max(0, Math.floor(durationSeconds));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const QueueItem = memo(
  ({
    item,
    drag,
    isActive,
    onActionPress,
    actionIcon,
    actionAccessibilityLabel,
  }) => {
    const durationLabel = useMemo(() => formatDuration(item?.duration), [item?.duration]);
    const isFavorited = useMemo(
      () => Boolean(item?.starred || item?.starredOn || item?.isFavorite),
      [item?.starred, item?.starredOn, item?.isFavorite]
    );

    return (
      <View style={[styles.itemContainer, isActive && styles.itemActive]}>
        <View style={styles.leadingContainer}>
          {isFavorited && (
            <MaterialIcons name="favorite" size={16} style={styles.favoriteIcon} />
          )}
          <Image
            source={getCoverArt(item, 128)}
            style={styles.coverArt}
            defaultSource={DEFAULT_ART}
          />
        </View>

        <View style={styles.infoContainer}>
          <Text numberOfLines={1} style={styles.title}>
            {item?.title ?? 'Unknown Title'}
          </Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            {item?.artist ?? 'Unknown Artist'}
            {item?.album ? ` · ${item.album}` : ''}
          </Text>
        </View>

        <View style={styles.rightContent}>
          {durationLabel ? <Text style={styles.duration}>{durationLabel}</Text> : null}

          {typeof onActionPress === 'function' && (
            <TouchableOpacity
              onPress={onActionPress}
              style={styles.actionButton}
              accessibilityRole="button"
              accessibilityLabel={actionAccessibilityLabel}
            >
              <MaterialIcons name={actionIcon} size={22} style={styles.actionIcon} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPressIn={drag}
            onLongPress={drag}
            delayLongPress={60}
            style={styles.handleButton}
            accessibilityRole="button"
            accessibilityLabel="Drag to reorder"
          >
            <MaterialIcons name="drag-handle" size={22} style={styles.dragHandleIcon} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }
);

QueueItem.displayName = 'QueueItem';

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
  const handleRemovePriority = useCallback(
    index => {
      if (typeof onRemovePriority === 'function') {
        onRemovePriority(index);
      }
    },
    [onRemovePriority]
  );

  const handleMoveToPriority = useCallback(
    index => {
      if (typeof onMoveContextToPriority === 'function') {
        onMoveContextToPriority(index, priorityQueue.length);
      }
    },
    [onMoveContextToPriority, priorityQueue.length]
  );

  const headerTitle = contextLabel ? `Next in ${contextLabel}:` : 'Next in Queue:';

  const renderPriorityItem = useCallback(
    ({ item, drag, isActive, index }) => (
      <QueueItem
        item={item}
        drag={drag}
        isActive={isActive}
        onActionPress={() => handleRemovePriority(index)}
        actionIcon="delete-outline"
        actionAccessibilityLabel="Remove from priority queue"
      />
    ),
    [handleRemovePriority]
  );

  const renderContextItem = useCallback(
    ({ item, drag, isActive, index }) => (
      <QueueItem
        item={item}
        drag={drag}
        isActive={isActive}
      />
    ),
    [handleMoveToPriority]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton
          icon="chevron-left"
          size={26}
          onPress={onClose}
          accessibilityLabel="Back to player"
        />
        <Text style={styles.headerTitle}>Queue</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Next in Queue:</Text>
        <View style={styles.listContainer}>
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
              containerStyle={styles.draggableContainer}
              scrollEnabled={false}
            />
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{headerTitle}</Text>
        <View style={styles.listContainer}>
          {contextQueue.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {`No upcoming tracks`}
              </Text>
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
              containerStyle={styles.draggableContainer}
              scrollEnabled={false}
            />
          )}
        </View>
      </View>
    </View>
  );
};

export default QueueScreen;
