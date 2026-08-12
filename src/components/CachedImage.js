import React, { useEffect, useMemo, useState } from 'react';
import { Image } from 'react-native';
import ArtworkCache from '../services/ArtworkCache';

// Drop-in cover art Image backed by ArtworkCache. Renders the local file when
// cached; otherwise renders the remote URL right away (no flicker on mount)
// while a background download caches it. If that remote load itself stalls
// or fails — easy to hit when a screen mounts dozens of these at once, e.g.
// Home's rows — the native Image has no way to know the file is sitting
// locally-cached moments later, and would be stuck on the placeholder
// forever. `readyTick` fixes that: it bumps once ArtworkCache's download for
// this id/size resolves, forcing `source` to recompute and pick up the now-
// cached local file instead of staying wedged on a failed remote fetch.
export default function CachedImage({ coverArtId, size = 300, fallbackSource, ...imageProps }) {
  const [readyTick, setReadyTick] = useState(0);

  useEffect(() => {
    if (!coverArtId) return;
    if (ArtworkCache.getLocalUriSync(coverArtId, size)) return; // already cached, nothing to wait for
    let cancelled = false;
    // download() dedupes against any in-flight/cached request for this key —
    // this doesn't trigger an extra fetch beyond what getArtworkSource below
    // already kicked off.
    ArtworkCache.download(coverArtId, size).then(uri => {
      if (!cancelled && uri) setReadyTick(t => t + 1);
    });
    return () => { cancelled = true; };
  }, [coverArtId, size]);

  const source = useMemo(
    () => ArtworkCache.getArtworkSource(coverArtId, size, fallbackSource),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coverArtId, size, fallbackSource, readyTick]
  );

  if (!source) return null;
  return <Image source={source} {...imageProps} />;
}
