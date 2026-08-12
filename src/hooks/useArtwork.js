import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import SubsonicAPI from '../services/SubsonicAPI';

// Cover art resolution for expo-image. Download, disk/memory caching, request
// dedup, bounded concurrency, and retries are all expo-image's job now — these
// helpers only build the source object it needs.
//
// One cache entry per art id: ARTWORK_SIZE (600) is the only size ever
// requested, call sites style the image and let expo-image downscale (it
// decodes to the view size, so a 600px file rendered at 44pt costs a 44pt
// decode, not a 600px one). Every distinct size used to be a separate cache
// entry *and* a separate on-the-fly resize on the server, which meant the same
// album was fetched up to three times and no screen ever benefited from
// another screen's cache.
export const ARTWORK_SIZE = 600;

// Navidrome bakes the item's updated-at timestamp into every artwork id
// (`pl-<id>_<hex>`, `al-<id>_<hex>`, …) — and it *touches* items on access:
// opening a smart playlist re-evaluates it and bumps its updatedAt, so the
// same playlist comes back from the next getPlaylists() with a different
// coverArt id. Cache identity must therefore come from the stable part of the
// id only. Keying on the raw id made every Home chip for an opened playlist
// flip back to a spinner and re-download its art on each return to Home —
// a "new" id every time, pointing at the same image.
export function stableArtworkId(coverArtId) {
  const match = /^((?:al|ar|pl|mf)-[^_]+)_[0-9a-f]+$/.exec(String(coverArtId));
  return match ? match[1] : String(coverArtId);
}

// The salt (and therefore the token in every URL) is regenerated on each app
// launch — see SubsonicAPI.initialize(). Without an explicit cacheKey,
// expo-image keys its disk cache on the URL, and the whole cache would go cold
// every session. The cacheKey is derived from the stable art id alone so it
// survives launches, re-authentication, and Navidrome's updated-at churn; art
// only ever refetches through the refresh nonce below.
export function artworkCacheKey(coverArtId, nonce = 0) {
  const id = stableArtworkId(coverArtId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${id}_${ARTWORK_SIZE}${nonce ? `_v${nonce}` : ''}`;
}

// Source object for expo-image's <Image>/<ImageBackground>. Returns null when
// there's no art id, so callers can fall back explicitly.
//
// `nonce` exists for art that can change server-side under a stable coverArt
// id (playlist covers). Bumping it changes the cacheKey, which makes
// expo-image treat it as a brand-new image and refetch — the expo-image
// equivalent of the old ArtworkCache.invalidate(). Album and artist art never
// change once fetched, so those call sites never pass one.
export function artworkSource(coverArtId, nonce = 0) {
  if (!coverArtId) return null;
  return {
    uri: SubsonicAPI.getCoverArtUrl(coverArtId, ARTWORK_SIZE),
    cacheKey: artworkCacheKey(coverArtId, nonce),
  };
}

// Image `source` for the given art id, falling back to `fallback` when there
// is no id at all. Used for decorative art (blurred screen backdrops); anything
// rendered as an actual thumbnail should go through CachedImage, which layers
// loading/fallback states on top.
//
// Memoized on the *stable* cache key, deliberately: a suffix-only id change
// (Navidrome updated-at churn) keeps the previous source object, so the native
// view's props don't change and it doesn't reload at all.
export function useArtworkSource(coverArtId, fallback = null, nonce = 0) {
  const key = coverArtId ? artworkCacheKey(coverArtId, nonce) : null;
  return useMemo(
    () => (key ? artworkSource(coverArtId, nonce) : fallback),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, fallback]
  );
}

// Pre-decoded image for the detail-screen heroes. Returns an expo-image
// ImageRef (renderable directly as `source`, with `.width`/`.height`) or null
// while loading / on failure / when there's no id.
//
// This exists to kill the aspect-ratio layout flash: sizing the hero from
// `onLoad` means the first frames lay out for a square placeholder, then jump
// once the real dimensions arrive — visibly shoving the content below upward.
// `Image.loadAsync` resolves through the same cache/dedup pipeline as
// rendering, so for cached art the dimensions are known before the screen's
// data-loading gate clears and the first painted frame is already correct.
// (A cold download still swaps placeholder → art when it lands; that's
// unavoidable without blocking the screen on the network.)
export function useArtworkImage(coverArtId, nonce = 0) {
  const key = coverArtId ? artworkCacheKey(coverArtId, nonce) : null;
  const [state, setState] = useState({ key: null, image: null });

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let loaded = null;
    Image.loadAsync(artworkSource(coverArtId, nonce))
      .then(image => {
        if (cancelled) {
          image.release();
          return;
        }
        loaded = image;
        setState({ key, image });
      })
      .catch(() => { if (!cancelled) setState({ key, image: null }); });
    return () => {
      cancelled = true;
      // ImageRefs are native shared objects holding the decoded bitmap —
      // without an explicit release (expo-image's own useImage does the same)
      // every screen mount leaks one until GC gets around to it.
      loaded?.release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // A stale ref (different id/nonce) is worse than a loading frame.
  return state.key === key ? state.image : null;
}

// ─── Refresh nonces ───────────────────────────────────────────────
// Persisted so a refreshed playlist cover stays refreshed across launches —
// a session-only nonce would revert to the stale disk-cache entry (old
// cacheKey) on next start. Keyed by coverArt id, stored as one small map.

const NONCE_KEY = '@sona_artwork_nonces';

async function readNonces() {
  try {
    const raw = await AsyncStorage.getItem(NONCE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function getArtworkNonce(coverArtId) {
  if (!coverArtId) return 0;
  const nonces = await readNonces();
  return nonces[stableArtworkId(coverArtId)] || 0;
}

// Bumps and persists the nonce for an art id, returning the new value.
export async function bumpArtworkNonce(coverArtId) {
  if (!coverArtId) return 0;
  const id = stableArtworkId(coverArtId);
  const nonces = await readNonces();
  const next = (nonces[id] || 0) + 1;
  nonces[id] = next;
  try {
    await AsyncStorage.setItem(NONCE_KEY, JSON.stringify(nonces));
  } catch {}
  return next;
}

// Loads the persisted nonce for an art id (0 until loaded / when none).
export function useArtworkNonce(coverArtId) {
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (!coverArtId) {
      setNonce(0);
      return;
    }
    getArtworkNonce(coverArtId).then(n => {
      if (!cancelled) setNonce(n);
    });
    return () => { cancelled = true; };
  }, [coverArtId]);
  return [nonce, setNonce];
}
