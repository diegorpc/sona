# sona – Subsonic/Navidrome Client (React Native / Expo)

iOS-first music streaming client. Development on Linux, tested via Expo Go on physical iOS device.

**Where documentation lives:** every service in `src/services/` (and `src/hooks/useArtwork.js`, `src/contexts/PlayerContext.js`) carries JSDoc explaining its API and the reasoning behind non-obvious decisions — read the file's class/fileoverview docblock before changing it. This document covers what no single file can: architecture, cross-file contracts, and constraints discovered the hard way.

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
- **@react-native-assets/slider** for every slider (player seek bar + Settings cache-size)

## Project layout

```
src/
├── components/
│   ├── AddToPlaylistModal.js     # Bottom sheet: search/create playlists, add a song (used by SongMenu surfaces)
│   ├── CachedImage.js            # Drop-in cover art image over expo-image: loading tile / art / fallback
│   ├── MiniPlayer.js             # Collapsed player bar (tappable, swipe-up gesture handled by PlayerOverlay)
│   ├── PlayerOverlay.js          # Full-screen overlay: MiniPlayer + PlayerScreen + QueueScreen stacked
│   ├── PlaylistCollage.js        # 2×2 cover art grid, fallback art in PlaylistScreen
│   ├── ScreenBackground.js       # Cross-platform background: ImageBackground+BlurView (iOS) or themed View
│   ├── ThemedDialog.js           # Themed dialog shell: BlurView surface (iOS) or solid themed View
|   └── SongMenu.js               # Menu component used for song listings and in PlayerScreen
├── contexts/
│   ├── PlayerContext.js          # Global player state; usePlayer() / useCurrentTrack() / usePlayerActions()
│   └── ThemeContext.js           # Accent color state, persists to AsyncStorage, exposes useTheme()
├── hooks/
│   └── useArtwork.js             # expo-image sources, pre-decoded heroes, refresh nonces
├── screens/
│   ├── LoginScreen.js            # Server URL + credentials, calls SubsonicAPI.initialize()
│   ├── HomeScreen.js             # Landing tab: playlists grid + horizontal album sections
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
│   ├── AppSettings.js            # Setting defaults + getAppSettings()/saveAppSettings()
│   ├── CacheService.js           # AsyncStorage-backed LRU cache for library metadata (JSON)
│   ├── SongCache.js              # Disk cache for full song files; never auto-evicted
│   ├── LibrarySync.js            # Throttled background warm-up of LibraryScreen's cache on launch
│   ├── PlayerOverlayController.js # Imperative expand/collapse bridge to PlayerOverlay
│   ├── RecentPlaylists.js        # Playlist listen-times; "Recently Listened" sort helpers
│   ├── PinnedPlaylists.js        # User-pinned Home playlists + grid merge helper
│   ├── RandomAlbums.js           # Shared, persisted random album ordering (Home + Library)
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

Home, Library, and Search each have their own stack so detail screens push within the active tab. "See All" on Home is cross-tab: `navigation.navigate('Library', { screen: 'LibraryHome', params: { initialTab, initialSort } })`.

**Swipe-back gesture:** detail screens (via `detailScreenOptions` in App.js) set `gestureEnabled: true` + `gestureResponseDistance: 50`. The 50pt strip is a documented contract with the swipeable song rows on those screens: each row `Swipeable` passes `hitSlop={{ left: -SWIPE_BACK_EDGE_WIDTH }}` (same 50) so row pans ignore touches starting in that strip and the navigator's back gesture wins there. Without the carve-out the row handler — deeper in the view tree, activating on any ≥10pt horizontal drag — beats the back gesture even at the screen edge. Trade-off: the swipe-right favorite gesture can't be *started* from the leftmost 50pt of a row.

## Theme system

`theme.js` exports:
- `accentPalettes` — 10 named palettes (velvet, ruby, olive, caramel, rose, pearl, lemon, cobalt, neon, sand), each with `primary`, `primaryContainer`, `secondary`, `secondaryContainer`
- `createThemeWithVariants(accentKey)` — full MD3DarkTheme override with opacity variants derived from `accent.primary`: `borderLowOpacity` (9%), `playingBackground` (18%), `badgeBackground` (20%), `badgeBorder` (30%)

`ThemeContext` loads `accentColor` from AsyncStorage on mount and exposes the built theme. Components call `const { theme } = useTheme()` then `const styles = createStyles(theme)` inline.

Base palette (same across all accents): `background` `#000000`, `surface` `#121212`, `surfaceVariant` `#1e1e1e`, `onSurface`/`onBackground` `#ffffff`, `onSurfaceVariant` `#a0a0a0`, `outline` `#333333`, `error` `#cf6679`, `onPrimary`/`onSecondary` `#000000`.

## Shared components

**ScreenBackground** `({ source, backgroundStyle, blurStyle, intensity=65, tint='dark', children })` — iOS renders `ImageBackground` → `BlurView` → children; Android renders themed `View`s (no blur). Used by Artist/Album/Playlist/Settings screens, `source` typically the cover art at 600px.

**ThemedDialog** `({ visible, onDismiss, title, children, confirmLabel, onConfirm, confirmDisabled, cancelLabel })` — shared shell for modal dialogs (Settings → Server, Storage → cache-size) so they match the app's cards instead of Paper's stock MD3 elevation surface, which ignores the accent palette. Same platform split as ScreenBackground (iOS `BlurView` with `rgba(18,18,18,0.72)` tint, solid `surface` elsewhere). Three Paper internals it works around — know these before editing it:
- Paper's `Dialog` sets its own `backgroundColor` from `theme.colors.elevation.level3`; overridden to `transparent` via `style`, which Paper merges last.
- Paper's `Dialog` clones its **first child** to inject `marginTop: 24`. The backdrop layer is that first child, so it re-declares `marginTop: 0` and the title carries its own `paddingTop`.
- Clipping (`overflow: 'hidden'`) lives on the inner backdrop layer, **not** the Dialog: Paper's Modal wraps content in a `Surface` that warns when overflow is hidden with non-zero elevation.

Destructive/confirmation prompts (logout, clear cache, toasts) still use the native `Alert.alert` by design.

**CachedImage** (`coverArtId`, `fallbackSource`, `showLoadingIndicator`, `indicatorSize`, `resizeMode`, `nonce`, + expo-image props) — the component for all cover art rendered as content. Three states: `ActivityIndicator` on a themed tile while loading, the image on success, `fallbackSource` only once the load actually *failed* (a placeholder that later turns into art reads as broken). The expo-image element stays mounted underneath the indicator (swapping elements would drop the in-flight load), and `recyclingKey` keeps FlatList row reuse from painting a frame of the previous row's art. Two prop-stability details are load-bearing: the native `ExpoImage` view runs a **full reload on any prop update** (`OnViewDidUpdateProps → reload()` in expo-image's iOS module), so the `source` object is memoized on the stable cache key and `transition` is a constant — a fresh source object per render, or a transition value that flips after load, makes every parent re-render visibly reload the image. Its `onLoad` receives expo-image's event shape: dimensions on `e.source.{width,height}`, not `e.nativeEvent.source`.

## Animated chip tabs

Pattern shared by LibraryScreen, SettingsScreen, ArtistScreen. Constants:
```
CHIP_REORDER_DURATION = 620ms   (Easing.out(Easing.cubic))
CHIP_FADE_OUT_DURATION = 200ms  (Easing.out(Easing.quad))
CHIP_FADE_IN_DURATION = 240ms   (Easing.in(Easing.cubic))
```

State per screen: `chipDisplayOrder` (active tab first), `chipHighlightAnimations` ref (`Animated.Value` per key, interpolated to colors), `chipAnimations` ref (translateX for slide-to-front), `chipLayoutsRef` (`{ x }` from `onLayout`), `pendingChipAnimation` ref (old-position snapshot resolved in `handleChipLayout` after re-render). `AnimatedTouchableOpacity`/`AnimatedText` via `Animated.createAnimatedComponent`. The chip `ScrollView` must have `flexShrink: 0` + `flexGrow: 0` to prevent Yoga compression when list content is tall.

## Services

Each service documents its own API — this section only records what spans files.

### SubsonicAPI

Singleton API client; salted-MD5 token auth. **The salt regenerates every `initialize()` call**, so every URL's auth params change each launch — anything caching by URL must key on something stable (see the artwork rules below). Config persists under AsyncStorage `serverConfig`.

### AudioPlayer + PlayerContext

`AudioPlayer` owns playback, the two-queue model (context queue + priority queue), and persistence; its class docblock covers the queue semantics, the buffering/intent model, and duration seeding. The one fact every consumer must know: **a 100ms status poll makes player state change ~10x/sec during playback**, so `PlayerContext` splits into three contexts by update frequency:

| Hook | Provides | Re-renders |
|---|---|---|
| `usePlayer()` | `{ playerState, ...actions }` | ~10x/sec while playing |
| `useCurrentTrack()` | `currentTrack` only | only on track change |
| `usePlayerActions()` | the action callbacks | never |

**Only use `usePlayer()` when rendering live position/duration** — currently just PlayerScreen's slider, PlayerOverlay (MiniPlayer progress), and QueueScreen. Everything else wants `useCurrentTrack()` (backdrop art, now-playing row highlight) and/or `usePlayerActions()`.

The action callbacks are `.bind()`-ed **once at module scope** and must stay that way — re-binding per render hands every consumer new function identities 10x/sec, silently defeating downstream memoization (this once made LibraryScreen's entire visible list re-render 10x/sec).

Session restore (`loadSavedState`) is called **only** by `PlayerProvider` — a second caller races two concurrent restores.

### Caching

Two user-facing caches with settable budgets (Settings → Storage):
- **Metadata cache** — `CacheService` (JSON), default 50 MB, LRU. Artwork is cached by expo-image, which manages its own storage and exposes no size stats — the Settings card covers metadata only; its clear button also clears expo-image's disk+memory caches.
- **Music cache** — `SongCache` (song files), default 2048 MB, never auto-evicted. Download entry points not yet wired to UI.

**Cached-first pattern** (Home + detail screens): on mount, `getAsync(key)` — if hit, render immediately and clear the spinner; then fetch from the network, re-render, and `set(key, data)`. Pull-to-refresh reuses the same load function. So detail screens always re-sync from the server on every mount. LibraryScreen is the exception: with populated cache keys it renders from cache **without** hitting the network — only pull-to-refresh (or the Random reset) refetches. `LibrarySync` exists to keep those keys warm.

### Artwork (expo-image + useArtwork)

All cover art renders through **expo-image** (SDWebImage on iOS), which owns download, disk+memory caching, in-flight dedup, bounded concurrency, and decode-at-display-size. This replaced a ~550-line hand-rolled `ArtworkCache` that reimplemented the same machinery and was a long tail of bugs. `src/hooks/useArtwork.js` only builds source objects; its docstrings explain each helper. Four rules keep it correct and server-friendly:

1. **One cache entry per art id.** `ARTWORK_SIZE` (600) is the only size ever requested; call sites style the image and expo-image decodes at rendered size. Art used to be cached per requested size — same album fetched up to three times, no cross-screen cache reuse. 600 covers every surface at native @3x except Album/Playlist heroes (660px) and PlayerScreen (~930px), which render slightly soft.
2. **Always pass `cacheKey`** (`artworkSource` does). URLs change every session (auth salt), so without an id-derived `cacheKey` the whole disk cache goes cold on every restart.
3. **Art is immutable per cacheKey.** Album/artist art never changes once fetched. Playlist covers can — that's the persisted refresh nonce: bumping it changes the `cacheKey`, forcing a refetch.
4. **Cache identity comes from the *stable* part of the coverArt id** (`stableArtworkId`). Navidrome embeds updated-at in artwork ids *and touches items on access* — opening a smart playlist rotates its coverArt id. Keying on the raw id made opened playlists' Home chips revert to spinners and re-download art on every return. With the stable key a suffix-only change is a complete no-op. Flip side: server-side art changes are only picked up via the pull-to-refresh nonce, consistent with rule 3.

**Server throttling context** (why this matters): `/rest/getCoverArt` is throttled server-side — Navidrome allows a handful of concurrent artwork requests with a bounded backlog; overrun can wedge artwork serving until the server restarts. Don't reintroduce per-size URLs, don't probe remote URLs with `Image.getSize` (a second full request — read dimensions from `onLoad` instead), and don't render the same art id under two different URLs.

Accepted losses from the migration: artwork no longer counts against the Settings storage budget (expo-image exposes no stats/cap; its cache is OS-purgable, degrading to a re-download), and 404s are no longer negative-cached across mounts.

### Small services

One-line map — details in each file's docblock: **AppSettings** (defaults + settings persistence, quality toggles), **LibrarySync** (throttled post-login warm-up of Library's cache keys), **RecentPlaylists** (listen-time map + `compareByRecentlyListened`, shared by Home and Library), **PinnedPlaylists** (pinned Home playlists + `buildHomePlaylists` grid merge), **RandomAlbums** (single persisted shuffle shared by Home and Library), **PlayerOverlayController** (imperative expand/collapse bridge), **NavigationService** (navigation ref + auth-change handler).

## PlayerOverlay

Mounted outside the navigator at app root. Three vertical layers controlled by `Animated.Value overlayY`: collapsed (MiniPlayer only), expanded (PlayerScreen), queue (QueueScreen slides over PlayerScreen). `PanResponder` handles drag gestures. `PlayerOverlayController` exposes register/expand/collapse for imperative calls from anywhere (e.g., after `playTrack`).

## Screen-specific details

### HomeScreen
Default tab. Background: `ScreenBackground` with current track art. Content fades in via `listOpacity` once albums load. Sections top to bottom:
- **Title** "Home" (shared page-title style: 28px Lexend_700Bold + accent text-shadow).
- **Playlists** — 2-column grid of up to 6 wide chips, built by `buildHomePlaylists(...)`: pins first (in pin order), then recently-listened fills. Hidden when there are none.
- **Four horizontal album rows** (max 20 each): Recently Played (`recent`), Recently Added (`newest`), Recently Released (`byYear`, `fromYear=currentYear`/`toYear=0`), Random (first 20 of `getRandomAlbums()`). Empty sections auto-hide.
- Section headers deep-link "See All →" into Library on the matching tab + sort. Random's "See All" just passes `initialSort: 'random'` — Library reads the same persisted ordering, so they match without passing data.

Playlist ordering and the random section refresh on focus. Pull-to-refresh reloads albums + playlists. Cached-first via `home_albums` / `home_playlists`.

### LibraryScreen
Chip tabs: Liked Songs, Playlists, Albums, Artists; per-tab sort persisted to AsyncStorage. List fades in via `listOpacity` (0→1, 400ms) after load — the pattern to copy for background-loaded lists. Artist rows use the artist's own id as the coverArt id — there is no separate artist-image cache or enrichment step.

Sort options: Liked Songs (Recently Listened / Recently Added / Date Loved / Alphabetical), Playlists (Recently Listened / Default / Alphabetical / Date Created), Albums (Recently Listened / Recently Added / Frequently Listened / Alphabetical / Date Released / Random), Artists (Alphabetical / Album Count).

Playlists "Recently Listened" uses the shared `compareByRecentlyListened` (refreshed on focus). Albums "Random" reads the shared persisted ordering; when active, the sort-direction toggle becomes a **refresh button** calling `getRandomAlbums(true)` — the only reshuffle.

**Deep-link params** (`route.params`, consumed then cleared): `initialTab`, `initialSort`. A fresh mount initializes from them via `useState`; an already-mounted Library applies them on focus via `applyDeepLink` → `runViewModeTransition(mode, sortOverride)`.

### SearchScreen
`search3` results + locally-filtered playlists in a `SectionList`; empty query shows "Recently Searched" (last 20 tapped results, AsyncStorage `sona_recent_searches`). Song rows highlight the now-playing track like LibraryScreen (`useCurrentTrack()` id match), including inside Recently Searched.

### ArtistScreen
- Header: circular artist image (artist id as coverArt id). Chip tabs: Albums, Top Songs, Favorite Songs.
- Albums tab: 2-column grid split into "Albums" and "Appears In" (`getArtistAppearsIn`, background fetch). Top Songs: `getTopSongs(artist.name, 50)`, non-blocking. Favorite Songs: `getStarred()` filtered to the artist, sorted latest-favorited first. All background fetches use `.then().catch().finally()`.
- Cached-first via `artist_<id>` (albums tab only; background fetches always hit the network).
- **Play / Shuffle / + row** under the chips. Tab-aware track list: Top Songs → `topSongs`, Favorite Songs → `likedSongs`, Albums → fetches every owned album's tracks via parallel `getAlbum`, then "Appears In" albums — own discography before guest appearances. `+` opens a SongMenu with "Queue first"/"Queue last". `preparingAction` state (`null | 'play' | 'shuffle' | 'queue'`) is tracked **per button** so only the tapped control shows a spinner; the Play pill's icon sits in a fixed 18×18 slot so the icon↔spinner swap can't resize the pill.
- Song rows: heart when starred, long-press or `⋯` opens `SongMenu`, swipe gestures per "Swipeable song rows".

### AlbumScreen
- `SectionList` grouped by `song.discNumber`; disc headers only when >1 disc. Song rows: no thumbnail; heart, track number or play arrow, optional guest-artist line; swipe gestures.
- Album title wraps freely; artist name pushes ArtistScreen — its `TouchableOpacity` needs `alignSelf: 'flex-start'` or the default `stretch` makes the whole row width tappable.
- Badges: year/count/duration/disc use neutral `badge`; genre adds `badgeGenre` (accent border).
- `+` opens a SongMenu (pseudo-song header) with "Queue first"/"Queue last" for the full track list.
- Hero art: aspect-ratio adaptive via `useArtworkImage` (pre-decoded, sized before first paint — see Common patterns). Cached-first via `album_<id>`.

### PlaylistScreen
- Song rows with 44×44 art, `resizeMode="contain"` in a fixed container; heart when starred; no track numbers (the number column only shows the play arrow for the current track); swipe gestures.
- Collage: when the playlist has no dedicated `coverArt`, `pickCollageIds()` picks up to 4 distinct-album cover ids locally from the entries and `PlaylistCollage` renders a 2×2 grid through `CachedImage`. The chosen ids are cached (`playlist_<id>_collageIds`) and only recomputed on pull-to-refresh — the underlying art is immutable; only the *selection* can go stale.
- Calls `recordPlaylistPlayed(playlist)` on single-song play and play-all.
- Cached-first via `playlist_<id>`. A playlist's own art can change server-side under a stable coverArt id, so pull-to-refresh (`loadPlaylistData({ refreshArt: true })`) calls `bumpArtworkNonce(coverArt)` — a **persisted** nonce baked into the artwork cacheKey (session-only would revert to the stale disk entry next launch). Not bumped on every open — that redownloaded art needlessly. Hero sizing via `useArtworkImage`, same as AlbumScreen.

### PlayerScreen
- Rendered inside `PlayerOverlay`; receives `onClose`, `onShowQueue`, `onNavigateToArtist`, `onNavigateToAlbum`, `safeAreaInsets` as props.
- Art: `PLAYER_ART_SIZE = screenWidth - 80`, aspect-ratio adapted via `onLoad` (fixed container, so no layout shift below).
- Seek: `@react-native-assets/slider`, value 0–100. Long titles marquee via `react-native-text-ticker`. Star toggle calls `SubsonicAPI.star/unstar` directly with local `isStarred` state.

### AddToPlaylistModal
- Bottom sheet (60% height, capped 520px) rendered by PlayerScreen, QueueScreen, LibraryScreen, ArtistScreen; opened from SongMenu's "Add to playlist" (still `disabled: true` in Album/Playlist/Search menus).
- Search filter over `getPlaylists()`; create-new row calls `createPlaylist(name, songId)`; row tap calls `addSongToPlaylist`. Expands to fullscreen while the keyboard shows.

### SettingsScreen
Chip tabs: Appearance (accent picker), General (playback switches + **Home Playlists** pin manager via `PinnedPlaylists`), Server (re-login via `SubsonicAPI.initialize()` then `CommonActions.reset`), Storage (two cache cards via `renderCacheCard` — Metadata slider 10–500 MB, Music slider 100 MB–20 GB; usage bar, max-size dialog, clear button each). The Metadata clear button also clears expo-image's artwork caches. Both dialogs render through `ThemedDialog`; the cache-size slider matches the player seek bar's `thumbSize`/`trackHeight`.

## Common patterns

**Style factory:** every screen/component has `createStyles(theme)` in its paired `.styles.js`. Call at render top: `const styles = createStyles(theme)`.

**Memo'd list items:** row components use `React.memo` with custom comparators checking only `item.id`, `isPlaying`, and `starred` boolean.

**Swipeable song rows:** song rows wrap in RNGH's legacy `Swipeable`. Two gestures:
- **Swipe left → "Add last"** (`SwipeAddLast`, accent `primaryContainer` panel, shared styles from `SongMenu.styles`): calls `insertIntoPriorityQueue(track)` — appends to the end of the priority queue, same as the SongMenu "Add last in queue" option everywhere. Present in LibraryScreen (Liked tab), AlbumScreen, ArtistScreen (song tabs), PlaylistScreen. (`appendToContextQueue` — end of *context* queue — is intentionally unwired: queue-mutating UI operates on the priority queue only.)
- **Swipe right → favorite/unfavorite** (`SwipeFavorite`, `theme.colors.error` panel): **detail screens only**, deliberately not LibraryScreen. Optimistic update — flip `starred` locally (ISO timestamp on star, `undefined` on unstar), fire `SubsonicAPI.star/unstar`, roll back on failure. ArtistScreen applies the flip to both `topSongs` and `likedSongs` since a song can appear in both tabs.

Both directions come through one `onSwipeableOpen(direction)` handler (`'right'` = add-last, `'left'` = favorite), which also closes the row via ref. Row memo comparators must include `Boolean(item.starred)` or the heart won't repaint.

Two hard-won constraints on the containing lists:
- **Never set `removeClippedSubviews` on a list whose rows are Swipeable.** With it on, rows past roughly the first screenful stopped responding to swipes entirely: RNGH's pan handler doesn't reliably reattach to a native view that was clipped and later recycled. Virtualization via `windowSize` etc. stays.
- **Back-gesture edge carve-out** on detail screens: `hitSlop={{ left: -SWIPE_BACK_EDGE_WIDTH }}` (50) on each `Swipeable` — legacy Swipeable spreads its props onto the internal `PanGestureHandler`, and negative hitSlop shrinks the recognition area, reserving the left edge for the navigator's swipe-back (see Navigation).

**Background data loading:** fire after the main blocking fetch resolves, never block the loading gate on these:
```js
SubsonicAPI.getSomeData()
  .then(data => setState(data))
  .catch(() => {})
  .finally(() => setIsLoading(false));
```

**FlatList in flex column:** always set `style={{ flex: 1 }}` on `FlatList` when it shares a column with a chip `ScrollView`; the chip container needs `flexShrink: 0`.

**Image flash prevention:** thumbnails in list rows use `resizeMode="contain"` inside a fixed-size container. No `Image.getSize` or `onLoad` resize state for small thumbnails — it causes a visible resize flash.

**Cover art sizing for detail screens:** resolve the hero through `useArtworkImage(id, nonce?)`, which pre-decodes via `Image.loadAsync` (same cache/dedup pipeline as rendering) and returns an `ImageRef` — render the ref as `source` and compute display size from `ref.width/height` in a `useMemo`. Dimensions are known *before* the content lays out, so a non-square image doesn't jump from a square first frame and shove the list below it — which is exactly what sizing from `onLoad` did. Never probe the remote URL with `Image.getSize` (a second network request). Pair with `contentFit="contain"`, never `"cover"` — on a cold download `"cover"` would crop the square placeholder while the real image is in flight. PlayerScreen (fixed container, no layout shift below) still sizes from `onLoad`.

## Running

```bash
npx expo start --go              # Expo dev server for Expo Go; scan QR on iPhone
npx expo start                   # Defaults to dev-client mode; press s to switch to Expo Go
npx expo start --clear           # Clear Metro cache
```

Server credentials live in AsyncStorage (`serverConfig`). To reset auth, use Settings → Server or clear app storage.

## Todos
- Genre searching, filtering, linking from playlists/albums
- Radio stations
- Smart playlist support
- Playlist tracklist and metadata editing
- Download entire albums/playlists
- Better song cache visibility (incl. manual eviction UI for SongCache)
