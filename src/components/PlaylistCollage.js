import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import CachedImage from './CachedImage';

const DEFAULT_ART = require('../../assets/default-album.png');

const PlaylistCollage = memo(({ collageData, size = 200, style }) => {
  if (!collageData || collageData.type !== 'collage') {
    return null;
  }

  const { coverArtIds } = collageData;
  const imageSize = size / 2;

  const renderCollageImages = () => {
    const images = [];

    // Fill up to 4 positions
    for (let i = 0; i < 4; i++) {
      const coverArtId = i < coverArtIds.length ? coverArtIds[i] : null;

      images.push(
        <View
          key={i}
          style={[
            styles.imageContainer,
            {
              width: imageSize,
              height: imageSize,
            },
            // Position images in 2x2 grid
            i === 0 && { top: 0, left: 0 },
            i === 1 && { top: 0, right: 0 },
            i === 2 && { bottom: 0, left: 0 },
            i === 3 && { bottom: 0, right: 0 },
          ]}
        >
          {coverArtId ? (
            <CachedImage
              coverArtId={coverArtId}
              size={Math.round(imageSize * 2)}
              fallbackSource={DEFAULT_ART}
              style={[styles.collageImage, { width: imageSize, height: imageSize }]}
              defaultSource={DEFAULT_ART}
            />
          ) : (
            <View style={[styles.emptySlot, { width: imageSize, height: imageSize }]} />
          )}
        </View>
      );
    }

    return images;
  };

  return (
    <View style={[styles.collageContainer, { width: size, height: size }, style]}>
      {renderCollageImages()}
    </View>
  );
}, (prevProps, nextProps) => {
  // Only re-render if collageData or size changes
  if (prevProps.size !== nextProps.size) return false;

  // Deep comparison for collageData
  if (!prevProps.collageData && !nextProps.collageData) return true;
  if (!prevProps.collageData || !nextProps.collageData) return false;

  if (prevProps.collageData.type !== nextProps.collageData.type) return false;
  if (prevProps.collageData.albumCount !== nextProps.collageData.albumCount) return false;

  // Compare coverArtIds arrays
  const prevIds = prevProps.collageData.coverArtIds || [];
  const nextIds = nextProps.collageData.coverArtIds || [];

  if (prevIds.length !== nextIds.length) return false;

  for (let i = 0; i < prevIds.length; i++) {
    if (prevIds[i] !== nextIds[i]) return false;
  }

  return true;
});

const styles = StyleSheet.create({
  collageContainer: {
    position: 'relative',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'absolute',
    overflow: 'hidden',
  },
  collageImage: {
    resizeMode: 'cover',
  },
  emptySlot: {
    backgroundColor: '#e0e0e0',
  },
});

export default PlaylistCollage;
