# sona – Subsonic/Navidrome Client (React Native / Expo)

iOS-first music streaming client. Development on Linux, tested via Expo Go on physical iOS device.

## Stack

- **React Native** 0.81.5 + **React** 19.1.0 + **Expo** ~54
- **expo-audio** for playback (not expo-av)
- **react-native-paper** (MD3) for base UI components
- **@expo/vector-icons** (MaterialIcons throughout)
- **expo-blur** for `BlurView` (iOS only — see ScreenBackground)
- **react-native-gesture-handler** + **react-native-reanimated** (gesture layer)
- **react-native-draggable-flatlist** for queue reordering
- **@expo-google-fonts/lexend** (Lexend_400Regular, _500Medium, _600SemiBold, _700Bold)
- **axios** + **crypto-js** for Subsonic API
- **@react-native-async-storage/async-storage** for persistence
- **expo-image** for all cover art (disk+memory caching, request dedup, downsampled decode)
- **expo-file-system** (legacy API, `expo-file-system/legacy`) for the song file cache
- `@react-native-assets/slider` for every slider (player seek bar + Settings cache-size). `@react-native-community/slider` is still in package.json but no longer imported anywhere — safe to drop

## Project layout

```
src/
├── components/
│   ├── AddToPlaylistModal.js     # Bottom sheet: search/create playlists, add a song (used by SongMenu surfaces)
│   ├── CachedImage.js            # Drop-in cover art image over expo-image: loading tile / art / fallback (used throughout)
│   ├── MiniPlayer.js             # Collapsed player bar (tappable, swipe-up gesture handled by PlayerOverlay)
│   ├── PlayerOverlay.js          # Full-screen overlay: MiniPlayer + PlayerScreen + QueueScreen stacked
│   ├── PlaylistCollage.js        # 2×2 cover art grid component used as a fallback in PlaylistScreen
│   ├── ScreenBackground.js       # Cross-platform background: ImageBackground+BlurView (iOS) or themed View (Android)
│   ├── ThemedDialog.js           # Themed dialog shell: BlurView surface (iOS) or solid themed View (other platforms)
|   └── SongMenu.js               # Menu component used for song listings and in PlayerScreen
├── contexts/
│   ├── PlayerContext.js          # Global player state; wraps AudioPlayer. usePlayer() / useCurrentTrack() / usePlayerActions()
│   └── ThemeContext.js           # Accent color state, persists to AsyncStorage, exposes useTheme()
├── hooks/
│   └── useArtwork.js             # artworkSource()/useArtworkSource()/useArtworkImage() — expo-image sources + pre-decoded heroes; refresh-nonce helpers
├── screens/
│   ├── LoginScreen.js            # Server URL + credentials, calls SubsonicAPI.initialize()
│   ├── HomeScreen.js             # Landing tab: recently-listened playlists grid + horizontal album sections
│   ├── LibraryScreen.js          # Main browser: animated chip tabs + per-tab sort controls + FlatList
│   ├── SearchScreen.js           # search3 unified search (artists, albums, songs)
│   ├── SettingsScreen.js         # Animated chip tabs: Appearance, General, Server, Storage
│   ├── ArtistScreen.js           # Artist detail: album grid, top songs, favorite songs
│   ├── AlbumScreen.js            # Album detail: SectionList grouped by disc number
│   ├── PlaylistScreen.js         # Playlist detail: song rows with cover art thumbnails
│   ├── QueueScreen.js            # Priority queue + context queue with drag reorder
│   └── PlayerScreen.js           # Full player (rendered inside PlayerOverlay, not a nav screen)
├── services/
│   ├── SubsonicAPI.js            # Subsonic v1.16.1 API client, MD5 token auth, singleton
│   ├── AudioPlayer.js            # expo-audio singleton: playback, queues, persistence, listeners
│   ├── AppSettings.js            # Setting defaults + getAppSettings()/saveAppSettings() (key: appSettings)
│   ├── CacheService.js           # AsyncStorage-backed LRU cache for library metadata (JSON)
│   ├── SongCache.js              # Disk cache for full song files (the "music cache"); never auto-evicted
│   ├── LibrarySync.js            # Throttled background warm-up of LibraryScreen's cache on launch
│   ├── PlayerOverlayController.js # Singleton: expandPlayerOverlay / collapsePlayerOverlay
│   ├── RecentPlaylists.js        # Tracks playlist listen-times; sort helpers for "Recently Listened"
│   ├── PinnedPlaylists.js        # User-pinned Home playlists (set in Settings); merge helper for the grid
│   ├── RandomAlbums.js           # Shared, persisted random album ordering (Home + Library); reset on demand
│   └── NavigationService.js      # Navigation ref for imperative navigation outside components
├── styles/
│   └── <Screen>.styles.js        # One per screen/component; all export createStyles(theme)
└── theme/
    └── theme.js                  # Dark-only theme; accent palettes; createThemeWithVariants()
```

## Navigation

```
Stack Navigator (root)
├── Login (unauthenticated gate)
└── Main
    ├── Bottom Tab Navigator
    │   ├── Home     → HomeStack   (HomeScreen + Artist/Album/Playlist)   ← default/first tab
    │   ├── Library  → LibraryStack (LibraryScreen + Artist/Album/Playlist)
    │   ├── Search   → SearchStack  (SearchScreen + Artist/Album/Playlist)
    │   └── Settings → SettingsScreen
    ├── Artist  (stack push)
    ├── Album   (stack push)
    └── Playlist (stack push)

PlayerOverlay — mounted at app root, not in navigator
  Layers (bottom to top): MiniPlayer → PlayerScreen → QueueScreen
  Gestures: swipe-down collapses, swipe-up shows queue
```

Home, Library, and Search each have their own stack so detail screens (Artist/Album/Playlist) push within the active tab. "See All" on Home is cross-tab: `navigation.navigate('Library', { screen: 'LibraryHome', params: { initialTab, initialSort } })`.

**Swipe-back gesture:** detail screens (Artist/Album/Playlist, via `detailScreenOptions` in App.js) set `gestureEnabled: true` + `gestureResponseDistance: 50`. The 50pt strip is a documented contract with the swipeable song rows on those screens: each row `Swipeable` passes `hitSlop={{ left: -SWIPE_BACK_EDGE_WIDTH }}` (same 50) so row pans ignore touches starting in that strip and the navigator's back gesture wins there. Without the carve-out the row handler — deeper in the view tree, activating on any ≥10pt horizontal drag — beats the back gesture even at the screen edge. Trade-off: the swipe-right favorite gesture can't be *started* from the leftmost 50pt of a row.

## Theme system

`theme.js` exports:
- `accentPalettes` — 10 named palettes (velvet, ruby, olive, caramel, rose, pearl, lemon, cobalt, neon, sand), each with `primary`, `primaryContainer`, `secondary`, `secondaryContainer`
- `createThemeWithVariants(accentKey)` — produces a full MD3DarkTheme override with dynamic opacity variants: `borderLowOpacity` (9%), `playingBackground` (18%), `badgeBackground` (20%), `badgeBorder` (30%) all derived from `accent.primary` hex

`ThemeContext` loads `accentColor` from AsyncStorage on mount, calls `createThemeWithVariants`, stores result as `theme`. Components call `const { theme } = useTheme()` then `const styles = createStyles(theme)` inline.

Base palette (same across all accents):
- `background`: `#000000`, `surface`: `#121212`, `surfaceVariant`: `#1e1e1e`
- `onSurface`/`onBackground`: `#ffffff`, `onSurfaceVariant`: `#a0a0a0`, `outline`: `#333333`
- `error`: `#cf6679`, `onPrimary`/`onSecondary`: `#000000`

## ScreenBackground component

`ScreenBackground({ source, backgroundStyle, blurStyle, intensity=65, tint='dark', children })`

- iOS: `<ImageBackground source={source}>` → `<BlurView intensity tint>` → children
- Android: `<View backgroundColor={theme.colors.background}>` → `<View>` → children (no blur)

Used in ArtistScreen, AlbumScreen, PlaylistScreen, SettingsScreen. Background `source` is typically the album/artist cover art at 600px.

## ThemedDialog component

`ThemedDialog({ visible, onDismiss, title, children, confirmLabel, onConfirm, confirmDisabled, cancelLabel })`

Shared shell for modal dialogs (Settings → Server "Update Server Settings", Storage → cache-size), so they match the app's cards and bottom sheets instead of react-native-paper's stock MD3 elevation surface, which ignores the accent palette. Same platform split as ScreenBackground: iOS gets a `BlurView` surface with an `rgba(18,18,18,0.72)` tint; other platforms fall back to solid `theme.colors.surface`.

Two Paper internals it works around — both worth knowing before editing it:
- Paper's `Dialog` sets its own `backgroundColor` from `theme.colors.elevation.level3`. Overridden to `transparent` via `style`, which Paper merges last.
- Paper's `Dialog` clones its **first child** to inject `marginTop: 24`. The backdrop layer is that first child, so it re-declares `marginTop: 0` (its own style also merges last) and the title carries its own `paddingTop` instead.
- Clipping (`overflow: 'hidden'`) lives on the inner backdrop layer, **not** on the Dialog: Paper's Modal wraps content in a `Surface`, which logs a dev warning when overflow is hidden with a non-zero elevation (it defaults to `1`).

Note the destructive/confirmation prompts (logout, clear cache, success/error toasts) still use the native `Alert.alert`, which is already platform-idiomatic and unstyled by design.

## Animated chip tabs

Pattern shared by LibraryScreen, SettingsScreen, ArtistScreen. Constants:
```
CHIP_REORDER_DURATION = 620ms   (Easing.out(Easing.cubic))
CHIP_FADE_OUT_DURATION = 200ms  (Easing.out(Easing.quad))
CHIP_FADE_IN_DURATION = 240ms   (Easing.in(Easing.cubic))
```

State per screen:
- `chipDisplayOrder` — reordered `TABS` array with active tab first
- `chipHighlightAnimations` ref — `Animated.Value` per key (1 = active, 0 = inactive); interpolated to `backgroundColor` and text `color`
- `chipAnimations` ref — translateX per key for slide-to-front
- `chipLayoutsRef` ref — stores `{ x }` from `onLayout` per key
- `pendingChipAnimation` ref — snapshot of old positions before reorder; resolved in `handleChipLayout` after React re-renders new positions

`AnimatedTouchableOpacity` + `AnimatedText` created via `Animated.createAnimatedComponent`.

Chip `ScrollView` must have `flexShrink: 0` (and `flexGrow: 0`) in styles to prevent Yoga compression when list content is tall.

## SubsonicAPI

Singleton at `src/services/SubsonicAPI.js`. Auth: `token = MD5(password + salt)`, salt regenerated each `initialize()` call. Config persisted to AsyncStorage key `serverConfig`.

Key methods:
| Method | Endpoint | Notes |
|---|---|---|
| `ping()` | `ping` | connectivity check |
| `getArtists()` | `getArtists` | returns indexed artist list |
| `getArtist(id)` | `getArtist` | artist + album array |
| `getArtistImage(id)` | `getArtistInfo` | tries largeImageUrl, mediumImageUrl, smallImageUrl |
| `getAlbum(id)` | `getAlbum` | album + song array |
| `getAlbumList(type, size, offset, extraParams?)` | `getAlbumList2` | valid types: random, newest, highest, frequent, recent, alphabeticalByName, alphabeticalByArtist, starred, byYear, byGenre. `extraParams` spreads type-specific args (e.g. `{ fromYear, toYear }` for byYear — fromYear > toYear ⇒ newest-released first) |
| `getAllAlbums(type, max)` | batched | fetches in 500-item batches up to max |
| `search(query, ...)` | `search3` | returns `searchResult3` with artist/album/song arrays |
| `getTopSongs(artistName, count)` | `getTopSongs` | by artist name (not ID); requires API ≥ 1.13.0 |
| `getStarred()` | `getStarred` | returns `starred` with song/album/artist arrays |
| `getArtistAppearsIn(artist, excludeIds)` | `search3` | finds albums where artist has songs but isn't album artist |
| `getPlaylists()` / `getPlaylist(id)` | `getPlaylists` / `getPlaylist` | playlist list / detail with songs |
| `createPlaylist(name, songId?)` | `createPlaylist` | optionally seeds with one song |
| `addSongToPlaylist(playlistId, songId)` | `updatePlaylist` | via `songIdToAdd` |
| `removeFromPlaylist(playlistId, index)` | `updatePlaylist` | via `songIndexToRemove` (0-based) |
| `getStreamUrl(songId, { maxBitRate?, format? })` | `stream` | returns URL string (not a request); `format: 'mp3'` transcodes server-side, `'raw'` forces the original file |
| `getCoverArtUrl(id, size)` | `getCoverArt` | returns URL string |
| `scrobble(songId, submission)` | `scrobble` | call on track start |
| `star(id, albumId?, artistId?)` | `star` | |
| `unstar(id, albumId?, artistId?)` | `unstar` | |
| `generatePlaylistCollage(playlistId, size)` | — | returns single URL or `{ type: 'collage', coverArtUrls, albumCount, size }` |

## AudioPlayer

Singleton at `src/services/AudioPlayer.js`. Uses `createAudioPlayer` from `expo-audio`.

State fields: `currentTrack`, `playlist[]`, `currentIndex`, `isPlaying`, `isBuffering`, `position` (ms), `duration` (ms), `isLoading`, `priorityQueue[]`, `contextQueue { name, type, id }`, `currentTrackSource ('context'|'priority')`, `shuffle` (bool), `repeatMode ('none'|'all'|'one')`

**Buffering vs paused vs loading.** AVPlayer reports `playing = false` while it stalls waiting for data (`timeControlStatus = waitingToPlayAtSpecifiedRate`), so on a bad connection the UI used to flip to "paused" mid-track with no hint anything was wrong — and `isLoading` doesn't cover it (it's only true during `playTrack`'s brief setup). The service keeps `intendedPlaying` (what the user asked for, set at every play/pause/stop transition) alongside the live `isPlaying`, and the status timer derives `isBuffering = intendedPlaying && sound.isBuffering` — the intent gate matters because expo-audio's `isBuffering` also reports true for a deliberate pause on an empty buffer. `togglePlayPause` branches on `intendedPlaying`, not `isPlaying`, so tapping pause during a stall actually pauses instead of re-issuing `play()`. PlayerScreen and MiniPlayer render a spinner in the play/pause slot while `isLoading || isBuffering`, and stay tappable during buffering so a stalled stream can be paused. There is **no buffered-amount bar on the seek slider**: expo-audio never bridges AVPlayer's `loadedTimeRanges`/`playableDuration`, so no buffered-range data exists JS-side to draw one.

`duration` is seeded from the Subsonic track metadata (`track.duration`, seconds → ms) the instant playback starts, via `knownDurationMs()` — the native player can take a while (sometimes much longer for transcoded/chunked streams) to determine its own duration, and reports `NaN` in the meantime. The 100ms status-timer poll only overwrites `duration` once `this.sound.duration` is actually finite and positive, so the UI shows a real number immediately instead of "Loading…"/NaN and never regresses once it has one.

Queue model:
- **playlist** — the context queue (album, artist, playlist)
- **priorityQueue** — tracks inserted to play next; consumed before advancing playlist
- `currentTrackSource` distinguishes which queue the current track came from
- `toggleShuffle()` shuffles upcoming context tracks (restores `originalUpcoming` on toggle off); `cycleRepeatMode()` cycles none → all → one
- `queueTracksNext(tracks)` / `queueTracksLast(tracks)` — bulk-queue an ordered set (whole album / artist tab) at the front of the priority queue / end of the context queue. Exist because looping the single-track methods would notify per track and, for `insertIntoPriorityQueue(track, 0)`, reverse the order. Exposed through `PlayerContext` like the rest; used by the "Queue first"/"Queue last" menus on Album/Artist

`playTrack(track, playlist, index, options)` — stops current, sets state, persists to AsyncStorage, creates new `createAudioPlayer` instance. UI updates immediately via `notifyListeners()`.

Persistence keys: `currentTrack`, `currentPlaylist`, `currentIndex`, `currentPosition`, `isPlaying`, `audioPlayerPriorityQueue`, `audioPlayerQueueContext`, `audioPlayerCurrentTrackSource`, `audioPlayerShuffle`, `audioPlayerRepeatMode`.

Playback source: `resolveSourceUri(trackId)` (used by `playTrack` and session restore) prefers a `SongCache` local file; otherwise builds a stream URL — transcoded MP3 320 kbps unless the `originalQualityStreaming` setting is on.

Listener pattern: `addListener(fn)` / `removeListener(fn)` — `fn(state)` called on every state change. `PlayerContext` subscribes and re-publishes it (see below).

**The 100ms status timer means player state changes ~10x/sec while a track plays** — this dominates the perf characteristics of anything consuming it, so `PlayerContext` is split by update frequency rather than exposing one value.

## PlayerContext

`src/contexts/PlayerContext.js` provides three separate contexts, because a context consumer re-renders whenever its context value changes regardless of which fields it actually reads:

| Hook | Provides | Re-renders |
|---|---|---|
| `usePlayer()` | `{ playerState, ...actions }` | ~10x/sec while playing |
| `useCurrentTrack()` | `currentTrack` only | only on track change |
| `usePlayerActions()` | the action callbacks | never |

**Only use `usePlayer()` if you render live position/duration** — currently just PlayerScreen's slider, PlayerOverlay (MiniPlayer progress), and QueueScreen. Everything else wants `useCurrentTrack()` (backdrop art, now-playing row highlight) and/or `usePlayerActions()`.

The action callbacks are `.bind()`-ed **once at module scope** (`playerActions`) and must stay that way. They were previously re-bound inside a `useMemo` keyed on `playerState`, which handed every consumer new function identities 10x/sec. That silently defeated downstream memoization — in LibraryScreen it invalidated `handleAddLast` → `renderItem` → every row's `React.memo` comparator, so the entire visible list genuinely re-rendered 10x/sec and `VirtualizedList` logged "large list that is slow to update" warnings.

## Caching

Two user-facing caches, each with a settable budget (Settings → Storage):
- **Metadata cache** — `CacheService` (JSON), default 50 MB. Artwork is cached by expo-image (below), which manages its own storage/eviction and exposes no size stats — the Settings card covers metadata only, and its clear button also clears expo-image's disk+memory caches.
- **Music cache** — `SongCache` (song files), default 2048 MB

### CacheService
Singleton. In-memory `Map` + AsyncStorage backing (`@sona_cache_` prefix). Metadata key `@sona_cache_metadata` stores per-entry sizes/timestamps and `maxSizeMB`; LRU eviction (oldest-touched evicted first when over budget — nothing expires by age). Used by LibraryScreen (lists), HomeScreen (`home_albums`, `home_playlists`), and the detail screens (`album_<id>`, `artist_<id>`, `playlist_<id>`).

**Cached-first pattern** (Home + detail screens): on mount, `getAsync(key)` — if hit, render immediately and clear the spinner; then fetch from the network, re-render, and `set(key, data)`. Pull-to-refresh reuses the same load function. This means an album/artist/playlist screen always re-syncs its metadata (tracklist, playlist membership, etc.) from the server on every mount, not just on first view.

LibraryScreen is the exception: if its cache keys (`artists`, `albums_<sortOption>`, `likedSongs`, `playlists`) are already populated, it renders from cache **without** hitting the network at all — a manual pull-to-refresh (or the Random-sort reset button) is required to see changes. `LibrarySync` (below) exists mainly to work around this by keeping those keys warm.

### Artwork (expo-image)

All cover art renders through **expo-image** (SDWebImage on iOS), which owns download, disk + memory caching, in-flight request dedup, bounded download concurrency, and decode-at-display-size. This replaced a ~550-line hand-rolled `ArtworkCache` service (semaphore, subscribe/notify, retry timers, budget pruning) that reimplemented the same machinery and was the source of a long tail of bugs (LIFO starvation, missing timeouts, dangling URIs, a render/effect race that froze rows on their spinner until app restart).

`src/hooks/useArtwork.js` is what remains — it only builds source objects:
- `artworkSource(id, nonce?)` → `{ uri, cacheKey }` for expo-image, or `null` when there's no id
- `useArtworkSource(id, fallback?, nonce?)` — memoized form; used for the `ScreenBackground` backdrops and detail-screen heroes
- `getArtworkNonce` / `bumpArtworkNonce` / `useArtworkNonce` — persisted refresh nonces (see PlaylistScreen)

Four rules keep it correct and server-friendly:

1. **One cache entry per art id.** `ARTWORK_SIZE` (600) is the only size ever requested; call sites style the image and expo-image decodes at the rendered size (so a 600px file in a 44pt row costs a 44pt decode). Art used to be cached per requested size, which meant the same album was fetched up to three times and no screen benefited from another's cache. 600 covers every surface at native @3x except Album/Playlist hero art (660px) and PlayerScreen (~930px), which render slightly soft.
2. **Always pass `cacheKey`** (`artworkSource` does). `SubsonicAPI.initialize()` regenerates the auth salt every launch, so cover art *URLs* change every session — without an explicit id-derived `cacheKey`, expo-image keys on the URL and the whole disk cache would go cold on every restart.
3. **Art is treated as immutable per cacheKey.** Album and artist art never change once fetched. Playlist covers can change — that's what the persisted nonce is for: bumping it changes the `cacheKey`, which makes expo-image refetch (the replacement for the old `invalidate()`).
4. **Cache identity comes from the *stable* part of the coverArt id** (`stableArtworkId`, which strips a trailing `_<hex>` from Navidrome-shaped ids like `pl-<id>_<hex>`). Navidrome embeds the item's updated-at in artwork ids *and touches items on access* — merely opening a smart playlist bumps its updatedAt, so the same playlist returns a different coverArt id on the next `getPlaylists()`. Keying anything (cacheKey, component state, memo deps) on the raw id made every opened playlist's Home chip revert to a spinner and re-download its art on each return to Home. With the stable key, a suffix-only id change is a complete no-op: same cache entry, same source object identity, no native prop update. The flip side: art changed server-side is *not* picked up from the rotated id — only the pull-to-refresh nonce refetches, consistent with rule 3.

`CachedImage` (`coverArtId`, `fallbackSource`, `showLoadingIndicator`, `indicatorSize`, `resizeMode`, `nonce`, + expo-image props) is the component used everywhere cover art is rendered as content. It renders three states: an `ActivityIndicator` on a themed tile while loading, the image on success, and `fallbackSource` only once the load actually failed — a placeholder that later turns into art reads as broken, and is indistinguishable from art that genuinely doesn't exist. The expo-image element stays mounted underneath the indicator (swapping elements would drop the in-flight load), and `recyclingKey` keeps FlatList row reuse from painting a frame of the previous row's art. Note its `onLoad` passes expo-image's event shape: dimensions are on `e.source.{width,height}`, not `e.nativeEvent.source`.

Two prop-stability details in `CachedImage` are load-bearing: the native `ExpoImage` view runs a **full reload on any prop update** (`OnViewDidUpdateProps → reload()` in expo-image's iOS module), so the `source` object is memoized on the stable cache key and `transition` is a constant — a fresh source object per render, or a transition value that flips after load, makes every parent re-render visibly reload the image. Similarly `useArtworkImage` must `release()` its `ImageRef` on cleanup (expo-image's own `useImage` does the same): refs are native shared objects holding the decoded bitmap, and skipping the release leaks one per detail-screen open.

**Server throttling context** (why the above matters): `/rest/getCoverArt` is throttled server-side — Navidrome allows only a handful of concurrent artwork requests and queues the rest in a bounded backlog; overrun can wedge artwork serving until the server restarts. expo-image keeps the app inside that budget the same way every comparable client does: one URL per art id (rule 1), identical in-flight requests deduped, and download concurrency bounded by the native pipeline (~6 on iOS). Don't reintroduce per-size URLs, don't probe remote URLs with `Image.getSize` (that's a second full request for the same art — read dimensions from `onLoad` instead), and don't render the same art id under two different URLs.

Losses accepted in the migration, deliberately: artwork no longer counts against the Settings storage budget (expo-image exposes no size stats or cap, and its cache lives in OS-purgeable storage — a purge degrades to a re-download); and 404s (e.g. artists with no photo) are no longer negative-cached across mounts, just retried once per fresh mount.

### SongCache
Singleton at `src/services/SongCache.js`. Song files in `documentDirectory/music/`, index under `@sona_music_cache_index`, own `maxSizeMB` budget (default 2048).
- **Cached songs are never evicted automatically.** `cacheSong()` no longer prunes on download — a cached song persists until removed manually (`removeSong`, `clearAll`) or the budget is explicitly lowered via `setMaxSize()`, which prunes LRU-style to fit. There's no "manual eviction from a menu" UI yet — that's future work.
- `getCachedUri(songId)` — local URI or null (verifies file exists, touches LRU timestamp for the `setMaxSize` prune path); used by AudioPlayer
- `cacheSong(track)` / `cacheSongs(tracks)` / `cacheAlbum(albumId)` / `cachePlaylist(playlistId)` — download into the cache. **Not yet wired to any menus/UI** — exposed for later
- `removeSong(songId)`, `getStats()`, `setMaxSize(mb)`, `clearAll()`
- Download quality follows the `originalQualityCaching` setting: original file (`format=raw`) or MP3 320 kbps transcode

### LibrarySync
Module at `src/services/LibrarySync.js`. `syncLibrary()` is called fire-and-forget from `App.js` after every successful login-status check (internally throttled to once per 5 minutes, since that check re-runs on every navigation-state change). Warms LibraryScreen's `albums_newest`, `likedSongs`, and `playlists` CacheService keys directly from the network, so Library shows new albums/songs/playlists on next open without requiring a manual pull-to-refresh — including on a cold first launch, before Library has ever been opened. Deliberately skips the `artists` key — LibraryScreen still fetches and caches that list itself the first time it's opened, and re-seeding it here would just cause a redundant write.

### AppSettings
Module at `src/services/AppSettings.js`. `DEFAULT_SETTINGS` + `getAppSettings()` / `saveAppSettings()` over the `appSettings` AsyncStorage key. Settings: `autoPlay`, `originalQualityStreaming` (default false ⇒ streams transcode to MP3 320 kbps), `originalQualityCaching` (default true), `downloadOverWifi`, `scrobbling`. `getAppSettings` migrates the legacy `highQuality` key to `originalQualityStreaming`.

## RecentPlaylists

Module at `src/services/RecentPlaylists.js`. Persists an `{ [playlistId]: timestamp }` map under AsyncStorage key `playlistPlayTimes`.
- `recordPlaylistPlayed(playlist)` — stamps `Date.now()` for the playlist id (called from PlaylistScreen on play)
- `getPlaylistPlayTimes()` — returns the map
- `compareByRecentlyListened(playTimes)` — descending comparator: listen-time, then created-date fallback (`getPlaylistCreatedTimestamp`), then name. Shared by HomeScreen and LibraryScreen so both order playlists identically.

## PinnedPlaylists

Module at `src/services/PinnedPlaylists.js`. Stores the user's pinned Home playlists (an ordered id array) under AsyncStorage key `pinnedPlaylistIds`, capped at `MAX_PINNED` (6). Pins are managed in SettingsScreen → General → "Home Playlists".
- `getPinnedPlaylistIds()` / `setPinnedPlaylistIds(ids)` — read/write (dedupes, clamps to 6)
- `buildHomePlaylists(allPlaylists, pinnedIds, playTimes, count)` — pinned playlists first (in pin order), then `compareByRecentlyListened` fills remaining slots. Pins not present in `allPlaylists` (deleted) are skipped, so they revert to the fallback. Used by HomeScreen.

## RandomAlbums

Module at `src/services/RandomAlbums.js`. Holds the single random album ordering shared by Home's "Random" row and Library's "Random" sort, persisted under AsyncStorage key `randomAlbums` (raw AsyncStorage, not CacheService, so it isn't LRU-evicted).
- `getRandomAlbums(force = false)` — returns the persisted ordering if present; otherwise (or when `force`) fetches `getAlbumList('random', 500)`, persists it, and returns it. `force` is the reset, triggered by Library's refresh button.

Because both surfaces read the same key, Home's row and Library show the same shuffle until a reset.

## PlayerOverlay

Mounted outside the navigator at app root. Three vertical layers controlled by `Animated.Value overlayY`:
- Collapsed: only MiniPlayer visible at bottom
- Expanded: PlayerScreen fills screen
- Queue: QueueScreen slides up over PlayerScreen

`PanResponder` handles drag gestures. `PlayerOverlayController` exposes `registerPlayerOverlay` / `expandPlayerOverlay` / `collapsePlayerOverlay` for imperative calls from anywhere (e.g., after `playTrack`).

## Screen-specific details

### HomeScreen
Default/first bottom tab. Background: `ScreenBackground` with current track art (mirrors LibraryScreen). Content fades in via `listOpacity` once albums load. Sections, top to bottom:
- **Title** "Home" (shared page-title style: 28px Lexend_700Bold + accent text-shadow).
- **Playlists** — 2-column grid of up to 6 wide chips (cover art left, name right). Built by `buildHomePlaylists(getPlaylists(), pinnedIds, playTimes, 6)`: user-pinned playlists (from Settings) first in pin order, then `compareByRecentlyListened` fills the rest (most-recently-listened, then most-recently-created). Always fills to 6 when enough playlists exist; hidden when there are none. A pinned playlist that has been deleted drops out and reverts to the fallback.
- **Four horizontal album rows** (max 20 each): **Recently Played** (`getAlbumList('recent')`), **Recently Added** (`newest`), **Recently Released** (`byYear`, `fromYear=currentYear`/`toYear=0`), **Random** (first 20 of `getRandomAlbums()` — the shared persisted ordering, see RandomAlbums). Empty sections auto-hide.
- Each section header has a right-aligned "See All →" that deep-links into LibraryScreen on the matching tab + sort (see Navigation). The **Random** "See All" just passes `initialSort: 'random'` — Library reads the same persisted ordering, so the two match without passing data. The **Playlists** "See All" passes `initialSort: 'recentlyListened'`.

Playlists ordering and the random section refresh on focus (a Library reset re-persists the shared random set). Pull-to-refresh reloads albums + playlists.

Cached-first: album rows render instantly from `CacheService` key `home_albums` while the network refresh runs; the playlist grid falls back to `home_playlists` when the fetch fails. Art renders through `CachedImage`.

### LibraryScreen
Chip tabs: Liked Songs, Playlists, Albums, Artists. Each tab has its own sort options stored in AsyncStorage. Albums fetched via `getAllAlbums(type)` where `type` maps to Subsonic sort keys. Artists fetched once via `getArtists()`. List fades in via `listOpacity` Animated.Value (0→1, 400ms) after data loads — pattern to copy for any background-loaded list.

Row art (albums/liked/playlists/artists) all renders through `CachedImage` — same expo-image cache as everywhere else in the app. Artist rows use the artist's own id as the coverArt id; there's no separate artist-image AsyncStorage cache or enrichment step.

Sort options per tab:
- Liked Songs: Recently Listened, Recently Added, Date Loved, Alphabetical
- Playlists: Recently Listened, Default, Alphabetical, Date Created
- Albums: Recently Listened, Recently Added, Frequently Listened, Alphabetical, Date Released, Random
- Artists: Alphabetical, Album Count

**Playlists "Recently Listened"** uses the same `compareByRecentlyListened` as Home (listen-time desc, then created-date fallback); listen-times are read from `RecentPlaylists` into `playlistPlayTimes` state (refreshed on focus) and feed `createSortComparator`.

**Albums "Random"** reads the shared persisted ordering via `getRandomAlbums()` (RandomAlbums), so it matches Home and stays stable across navigation. When Random is the active album sort, the sort-direction toggle is replaced by a **refresh button** (`refreshRandomAlbums`) that calls `getRandomAlbums(true)` to reshuffle and re-persist (the only reset).

**Deep-link params** (`route.params`, consumed then cleared): `initialTab`, `initialSort`. A fresh (lazy) mount initializes `viewMode`/`sortOption` from these via `useState`; an already-mounted Library applies them on focus via `applyDeepLink` → `runViewModeTransition(mode, sortOverride)`.

### SearchScreen
- `search3` results + locally-filtered playlists in a `SectionList`; empty query shows "Recently Searched" (last 20 tapped results, persisted under AsyncStorage `sona_recent_searches`)
- Song rows highlight the now-playing track exactly like LibraryScreen: `useCurrentTrack()` id match → `flatListItemPlaying` / `itemTitlePlaying` / `itemSubtitlePlaying` styles (also applied to song rows inside Recently Searched, which reuse `renderSong`)

### ArtistScreen
- Header: circular artist image (falls back to `getCoverArtUrl(artist.id)`)
- Chip tabs: Albums, Top Songs, Favorite Songs
- Albums tab: 2-column grid (`ScrollView` + `flexWrap`), split into "Albums" and "Appears In" sections
- Top Songs: `getTopSongs(artist.name, 50)` — non-blocking after main `getArtist`; `isLoadingTopSongs` state controls ActivityIndicator
- Favorite Songs: `getStarred()` filtered by `artistId` or `artist` name, sorted by `starred` timestamp descending (latest favorited first); `isLoadingFavorites` state controls ActivityIndicator
- Appears In: `getArtistAppearsIn(artist, ownAlbumIds)` — non-blocking background fetch
- All background fetches use `.then().catch().finally(() => setLoading(false))`
- Cached-first via CacheService key `artist_<id>` (albums tab only; the background fetches always hit the network)
- **Play / Shuffle / + row** under the chips, styled like AlbumScreen's `playAreaRow` minus the heart. Tab-aware track list: Top Songs → `topSongs`, Favorite Songs → `likedSongs`, Albums → fetches every owned album's tracks via `getAlbum` (parallel `Promise.all`), then every "Appears In" album's — own discography plays before guest appearances. Play plays in order, Shuffle pre-shuffles, `+` opens a SongMenu with "Queue first"/"Queue last" (`queueTracksNext`/`queueTracksLast`). `preparingAction` state (`null | 'play' | 'shuffle' | 'queue'`) is tracked **per button** so only the tapped control shows its spinner; the Play pill's icon sits in a fixed 18×18 `playPillIconSlot` so the icon↔spinner swap can't resize the pill
- Song rows (`SongRow`, both song tabs): heart icon when starred, long-press or `⋯` opens `SongMenu` (with working AddToPlaylistModal), swipe gestures per "Swipeable song rows" below

### AlbumScreen
- `SectionList` grouped by `song.discNumber` (default 1); disc headers only shown when >1 disc
- Song rows: no thumbnail; heart icon when starred, then track number or play arrow, optional guest artist line; swipe gestures per "Swipeable song rows" below
- Album title wraps to as many lines as it needs (no `numberOfLines` cap); artist name is tappable to push ArtistScreen — its `TouchableOpacity` needs `alignSelf: 'flex-start'` (`albumArtistTouchable`) or the default cross-axis `stretch` makes the whole row width tappable
- Badges: year / song count / duration / disc count use the neutral `badge` style; genre badges add `badgeGenre` (accent `theme.colors.primary` border)
- `+` button in the play row opens a second `SongMenu` (pseudo-song header: album title/artist/art) with "Queue first"/"Queue last" for the full track list (`queueTracksNext`/`queueTracksLast`)
- Art: aspect-ratio adaptive via `useArtworkImage` (pre-decoded, sized before first paint — see Common patterns)
- Cached-first via CacheService key `album_<id>`

### PlaylistScreen
- Song rows with 44×44 cover art, `resizeMode="contain"` in fixed container (no JS resize on load); heart icon when starred; **no track numbers** (the number column only shows the play arrow for the current track); swipe gestures per "Swipeable song rows" below
- Collage: when the playlist has no dedicated `coverArt`, `pickCollageIds()` picks up to 4 distinct-album cover art ids locally from `playlistData.entry` (same dedup heuristic as `SubsonicAPI.generatePlaylistCollage`, done without its redundant second `getPlaylist` fetch) and `PlaylistCollage` renders them as a 2×2 grid, each cell going through `CachedImage` like any other album art. The chosen id list is cached (`CacheService` key `playlist_<id>_collageIds`) and only recomputed on an explicit pull-to-refresh, not on every open — the underlying album art itself never needs invalidating (it's immutable), only the *selection* can go stale as the playlist's songs change.
- Calls `recordPlaylistPlayed(playlist)` (RecentPlaylists) on both single-song play and play-all, feeding the "Recently Listened" ordering on Home and in Library
- Cached-first via CacheService key `playlist_<id>`. Unlike album/artist art, a playlist's own dedicated art can change server-side while its coverArt id stays the same — so on an explicit pull-to-refresh (`loadPlaylistData({ refreshArt: true })`) `bumpArtworkNonce(coverArt)` increments a **persisted** nonce that is baked into the artwork `cacheKey`, making expo-image refetch. Persisted (AsyncStorage `@sona_artwork_nonces`, loaded via `useArtworkNonce`) because a session-only nonce would revert to the stale disk-cache entry on next launch. Not bumped on every open — that redownloaded the art needlessly. Hero aspect ratio comes from `useArtworkImage` (pre-decoded, sized before first paint), same as AlbumScreen — see "Cover art sizing for detail screens" under Common patterns.

### PlayerScreen
- Rendered inside `PlayerOverlay`, receives `onClose`, `onShowQueue`, `onNavigateToArtist`, `onNavigateToAlbum`, `safeAreaInsets` as props
- Art: `PLAYER_ART_SIZE = screenWidth - 80`, aspect-ratio adapted via `onLoad`
- Seek: `@react-native-assets/slider`; value is percentage 0–100
- Long titles: `react-native-text-ticker` for marquee scroll
- Star toggle: calls `SubsonicAPI.star/unstar` directly, local `isStarred` state

### AddToPlaylistModal
- Bottom sheet (60% height, capped 520px) rendered by PlayerScreen, QueueScreen, LibraryScreen, and ArtistScreen; opened from SongMenu's "Add to playlist" action (still `disabled: true` in Album/Playlist/Search's menus)
- Search filter over `getPlaylists()`; create-new-playlist row calls `createPlaylist(name, songId)`; row tap calls `addSongToPlaylist`
- Expands to fullscreen when the keyboard shows (animated height + corner radius), collapses on hide

### SettingsScreen
Chip tabs: Appearance, General, Server, Storage.
- Appearance: accent color picker using `accentPalettes` from theme.js
- General: playback switches (auto-play, **Original quality streaming**, **Original quality caching**, scrobbling — see AppSettings); **Home Playlists** pin manager — lists all playlists (pinned first), each with a pin/unpin `IconButton`; persists via `PinnedPlaylists` (`MAX_PINNED` = 6). Reflected on Home on next focus.
- Server: re-login flow via `SubsonicAPI.initialize()` then `CommonActions.reset`
- Storage: two cache cards via `renderCacheCard` — **Metadata** (CacheService stats, slider 10–500 MB; its clear button also clears expo-image's disk+memory artwork caches, which have no stats/cap of their own) and **Music** (SongCache stats, slider 100 MB–20 GB); each with usage bar, max-size dialog, and clear button. Both the cache-size and server dialogs render through `ThemedDialog` (see above); the cache-size slider is the same `@react-native-assets/slider` as the player seek bar, with matching `thumbSize`/`trackHeight`.

## Common patterns

**Style factory:** every screen/component has `createStyles(theme)` in its paired `.styles.js`. Call at component render top: `const styles = createStyles(theme)`.

**Memo'd list items:** row components use `React.memo` with custom comparators checking only `item.id`, `isPlaying`, and `starred` boolean.

**Swipeable song rows:** song rows wrap in RNGH's legacy `Swipeable`. Two gestures:
- **Swipe left → "Add last"** (`SwipeAddLast`, accent `primaryContainer` panel, shared styles from `SongMenu.styles`): calls `appendToContextQueue`. Present in LibraryScreen (Liked tab), AlbumScreen, ArtistScreen (song tabs), PlaylistScreen.
- **Swipe right → favorite/unfavorite** (`SwipeFavorite`, `theme.colors.error` panel): **detail screens only** (Album/Artist/Playlist), deliberately not LibraryScreen. Optimistic update — flip `starred` in local state immediately (ISO timestamp on star, `undefined` on unstar), fire `SubsonicAPI.star/unstar`, roll back on failure. ArtistScreen applies the flip to both `topSongs` and `likedSongs` since a song can appear in both tabs.

Both directions come through one `onSwipeableOpen(direction)` handler (`'right'` = right panel shown = add-last; `'left'` = favorite), which also closes the row via ref. Row memo comparators must include `Boolean(item.starred)` or the heart won't repaint.

Two hard-won constraints on the containing lists:
- **Never set `removeClippedSubviews` on a list whose rows are Swipeable.** With it on, rows past roughly the first screenful stopped responding to swipes entirely (the original LibraryScreen "only the first 10 songs are slidable" bug): RNGH's pan handler doesn't reliably reattach to a native view that was clipped and later recycled. Removed from Library/Album/Playlist lists; virtualization via `windowSize` etc. stays.
- **Back-gesture edge carve-out** on detail screens: `hitSlop={{ left: -SWIPE_BACK_EDGE_WIDTH }}` (50) on each `Swipeable` — legacy Swipeable spreads its props onto the internal `PanGestureHandler`, and negative hitSlop shrinks the recognition area, reserving the left screen-edge strip for the navigator's swipe-back (see Navigation).

**Background data loading:** fire after main blocking fetch resolves, never block the loading gate on these:
```js
SubsonicAPI.getSomeData()
  .then(data => setState(data))
  .catch(() => {})
  .finally(() => setIsLoading(false));
```

**FlatList in flex column:** always set `style={{ flex: 1 }}` on `FlatList` when it shares a column with a chip `ScrollView`. The chip container needs `flexShrink: 0` to prevent Yoga compression when list is tall.

**Image flash prevention:** for thumbnail images in list rows, use `resizeMode="contain"` inside a fixed-size container. Do not use `Image.getSize` or `onLoad` resize state for small thumbnails — it causes a visible resize flash.

**Cover art sizing for detail screens:** resolve the hero through `useArtworkImage(id, nonce?)`, which pre-decodes via `Image.loadAsync` (same cache/dedup pipeline as rendering) and returns an `ImageRef` — render the ref as `source` and compute the display size from `ref.width/height` in a `useMemo`. Because the dimensions are known *before* the content lays out, a non-square image doesn't jump from a square first-frame layout and shove the list below it upward — which is exactly what sizing from `onLoad` did, and why Album/Playlist screens moved off it. Never probe the remote URL with `Image.getSize`: that's a second network request for the same art. Pair with `contentFit="contain"`, never `"cover"` — for cached art the sized-from-first-frame layout makes them identical, but on a cold download `"cover"` would crop the square placeholder into a non-square box while the real image is still in flight. PlayerScreen (art centered in a fixed container, so no layout shift below it) still sizes from `onLoad` — note expo-image's event shape there: `e.source.{width,height}`, not `e.nativeEvent.source`.

## Running

```bash
npx expo start --go              # Expo dev server for Expo Go; scan QR on iPhone
npx expo start                   # Defaults to dev-client mode (expo-dev-client is installed); press s to switch to Expo Go
npx expo start --clear           # Clear Metro cache
```

Server credentials are stored in AsyncStorage (`serverConfig`). To reset auth, use Settings → Server tab or clear app storage.

## Todos
- Genre searching, filtering, linking from playlists/albums
- Radio stations
- Smart playlist support
- Playlist tracklist and metadata editing
- Download entire albums/playlists
- Better song cache visibility
