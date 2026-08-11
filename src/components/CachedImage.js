import React, { useMemo } from 'react';
import { Image } from 'react-native';
import ArtworkCache from '../services/ArtworkCache';

// Drop-in cover art Image backed by ArtworkCache. Renders the local file when
// cached; otherwise renders the remote URL and caches it in the background for
// the next mount (no source swap mid-render, so no flicker).
export default function CachedImage({ coverArtId, size = 300, fallbackSource, ...imageProps }) {
  const source = useMemo(
    () => ArtworkCache.getArtworkSource(coverArtId, size, fallbackSource),
    [coverArtId, size, fallbackSource]
  );

  if (!source) return null;
  return <Image source={source} {...imageProps} />;
}
