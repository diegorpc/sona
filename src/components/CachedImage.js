import React, { useMemo, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { artworkSource, artworkCacheKey } from '../hooks/useArtwork';
import { useTheme } from '../contexts/ThemeContext';

export default function CachedImage({
  coverArtId,
  fallbackSource,
  style,
  showLoadingIndicator = true,
  indicatorSize = 'small',
  resizeMode = 'cover',
  nonce = 0,
  onLoad,
  onError,
  ...imageProps
}) {
  const { theme } = useTheme();

  // Keyed on the *stable* cache key, not the raw id: Navidrome rotates the
  // updated-at suffix inside coverArt ids whenever an item is touched (opening
  // a smart playlist is enough), and keying on the raw id flipped chips back
  // to a spinner + forced a re-download on every return to the screen.
  const key = coverArtId ? artworkCacheKey(coverArtId, nonce) : null;
  const [state, setState] = useState({ key, status: 'loading' });
  // Reset during render, not in an effect: FlatList reuses row components as
  // you scroll, and an effect would leave one frame of the old row's status.
  if (state.key !== key) setState({ key, status: 'loading' });

  // Stable object identity while the key is unchanged. The native view runs a
  // full reload on *any* prop update, so handing it a fresh source object on
  // every parent re-render made images visibly reload for no reason.
  const source = useMemo(
    () => (key ? artworkSource(coverArtId, nonce) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );
  const failed = state.status === 'error';

  if (!source || failed) {
    if (!fallbackSource) {
      return <View style={[styles.tile, { backgroundColor: theme.colors.surfaceVariant }, style]} />;
    }
    return (
      <Image
        source={fallbackSource}
        style={style}
        contentFit={resizeMode}
        {...imageProps}
      />
    );
  }

  const loading = state.status === 'loading';

  return (
    <View style={[styles.tile, loading && { backgroundColor: theme.colors.surfaceVariant }, style]}>
      <Image
        source={source}
        recyclingKey={key}
        style={StyleSheet.absoluteFill}
        contentFit={resizeMode}
        cachePolicy="memory-disk"
        transition={100}
        onLoad={(e) => {
          setState(prev => (prev.key === key ? { key, status: 'ready' } : prev));
          if (onLoad) onLoad(e);
        }}
        onError={(e) => {
          setState(prev => (prev.key === key ? { key, status: 'error' } : prev));
          if (onError) onError(e);
        }}
        {...imageProps}
      />
      {loading && showLoadingIndicator ? (
        <ActivityIndicator size={indicatorSize} color={theme.colors.onSurfaceVariant} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
