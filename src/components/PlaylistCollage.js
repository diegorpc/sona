import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

const PlaylistCollage = ({ collageData, size = 200, style }) => {
  if (!collageData || collageData.type !== 'collage') {
    return null;
  }

  const { coverArtUrls, albumCount } = collageData;
  const imageSize = size / 2; 

  const renderCollageImages = () => {
    const images = [];
    
    // Fill up to 4 positions
    for (let i = 0; i < 4; i++) {
      const imageUrl = i < coverArtUrls.length ? coverArtUrls[i] : null;
      
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
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={[styles.collageImage, { width: imageSize, height: imageSize }]}
              defaultSource={require('../../assets/default-album.png')}
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
};

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
