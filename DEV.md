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
- **expo-file-system** (legacy API, `expo-file-system/legacy`) for artwork + song file caches
- `@react-native-assets/slider` for the player seek bar; `@react-native-community/slider` only for the Settings cache-size slider

## Project layout

```
src/
├── components/
│   ├── AddToPlaylistModal.js     # Bottom sheet: search/create playlists, add a song (used by SongMenu surfaces)
│   ├── CachedImage.js            # Drop-in cover art Image backed by ArtworkCache (used throughout)
│   ├── MiniPlayer.js             # Collapsed player bar (tappable, swipe-up gesture handled by PlayerOverlay)
│   ├── PlayerOverlay.js          # Full-screen overlay: MiniPlayer + PlayerScreen + QueueScreen stacked
│   ├── PlaylistCollage.js        # 2×2 cover art grid component used as a fallback in PlaylistScreen
│   ├── ScreenBackground.js       # Cross-platform background: ImageBackground+BlurView (iOS) or themed View (Android)
|   └── SongMenu.js               # Menu component used for song listings and in PlayerScreen
├── contexts/
│   ├── PlayerContext.js          # Global player state; wraps AudioPlayer, exposes usePlayer()
│   └── ThemeContext.js           # Accent color state, persists to AsyncStorage, exposes useTheme()
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
│   ├── ArtworkCache.js           # Disk cache for cover art files; LRU only under budget pressure, otherwise permanent
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

State fields: `currentTrack`, `playlist[]`, `currentIndex`, `isPlaying`, `position` (ms), `duration` (ms), `isLoading`, `priorityQueue[]`, `contextQueue { name, type, id }`, `currentTrackSource ('context'|'priority')`, `shuffle` (bool), `repeatMode ('none'|'all'|'one')`

Queue model:
- **playlist** — the context queue (album, artist, playlist)
- **priorityQueue** — tracks inserted to play next; consumed before advancing playlist
- `currentTrackSource` distinguishes which queue the current track came from
- `toggleShuffle()` shuffles upcoming context tracks (restores `originalUpcoming` on toggle off); `cycleRepeatMode()` cycles none → all → one

`playTrack(track, playlist, index, options)` — stops current, sets state, persists to AsyncStorage, creates new `createAudioPlayer` instance. UI updates immediately via `notifyListeners()`.

Persistence keys: `currentTrack`, `currentPlaylist`, `currentIndex`, `currentPosition`, `isPlaying`, `audioPlayerPriorityQueue`, `audioPlayerQueueContext`, `audioPlayerCurrentTrackSource`, `audioPlayerShuffle`, `audioPlayerRepeatMode`.

Playback source: `resolveSourceUri(trackId)` (used by `playTrack` and session restore) prefers a `SongCache` local file; otherwise builds a stream URL — transcoded MP3 320 kbps unless the `originalQualityStreaming` setting is on.

Listener pattern: `addListener(fn)` / `removeListener(fn)` — `fn(state)` called on every state change. `PlayerContext` subscribes and exposes state via `usePlayer()`.

## Caching

Two user-facing caches, each with a settable budget (Settings → Storage):
- **Metadata & artwork cache** — `CacheService` (JSON) + `ArtworkCache` (art files) sharing one budget, default 50 MB
- **Music cache** — `SongCache` (song files), default 2048 MB

### CacheService
Singleton. In-memory `Map` + AsyncStorage backing (`@sona_cache_` prefix). Metadata key `@sona_cache_metadata` stores per-entry sizes/timestamps and `maxSizeMB`; LRU eviction (oldest-touched evicted first when over budget — nothing expires by age). Used by LibraryScreen (lists), HomeScreen (`home_albums`, `home_playlists`), and the detail screens (`album_<id>`, `artist_<id>`, `playlist_<id>`).

**Cached-first pattern** (Home + detail screens): on mount, `getAsync(key)` — if hit, render immediately and clear the spinner; then fetch from the network, re-render, and `set(key, data)`. Pull-to-refresh reuses the same load function. This means an album/artist/playlist screen always re-syncs its metadata (tracklist, playlist membership, etc.) from the server on every mount, not just on first view.

LibraryScreen is the exception: if its cache keys (`artists`, `albums_<sortOption>`, `likedSongs`, `playlists`) are already populated, it renders from cache **without** hitting the network at all — a manual pull-to-refresh (or the Random-sort reset button) is required to see changes. `LibrarySync` (below) exists mainly to work around this by keeping those keys warm.

### ArtworkCache
Singleton at `src/services/ArtworkCache.js`. Downloads cover art to `cacheDirectory/artwork/` (index under `@sona_artwork_index`), keyed `<coverArtId>_<size>`. An entry, once downloaded, is never re-checked against the server — treat art as immutable once cached.
- `getArtwork(id, size)` — sync: returns the local URI if cached; otherwise starts a deduplicated background download and returns `null` (caller renders the remote URL — no mid-render source swap, no flicker)
- `getArtworkSource(id, size, fallback)` — same, but returns an `Image`-source object (`{ uri }` local/remote, or `fallback`) for call sites that don't render through `CachedImage` (`ScreenBackground` sources, `Image.getSize` probes, `MiniPlayer`'s `coverArtUrl` prop). `CachedImage` is a thin wrapper around this.
- `invalidate(id)` — drops every cached size for an id (and any negative-cache entry, see below) so the next fetch redownloads it fresh. Album and artist art are never invalidated (they don't change). **Playlist art is invalidated on every playlist-screen refresh** (see PlaylistScreen below), since a playlist's coverArt id can stay the same while the underlying image changes (regenerated collage, new custom image).
- Negative caching: a 404 (e.g. an artist with no photo) is remembered in `index.missing[key]` and never retried — `getArtwork`/`getArtworkSource` return `null`/`fallback` immediately instead of re-attempting the download every render. Cleared by `invalidate(id)`.
- `pruneToBudget()` — evicts oldest art so that artwork + CacheService JSON fit the shared `maxSizeMB`
- Consumed via the `CachedImage` component (`coverArtId`, `size`, `fallbackSource`, + Image props) — used everywhere cover art is rendered (Home, Library, Artist, Album, Playlist, Search, Queue, Player, MiniPlayer, SongMenu, AddToPlaylistModal, Settings' pin manager)

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

Row art (albums/liked/playlists/artists) all resolve through `ArtworkCache.getArtworkSource` — same disk cache as everywhere else in the app. Artist rows use the artist's own id as the coverArt id (`ArtworkCache.getArtworkSource(artist.id, 200)`); there's no separate artist-image AsyncStorage cache or enrichment step — an artist with no photo is negative-cached inside `ArtworkCache` itself (see below) so it isn't re-fetched on every render.

Sort options per tab:
- Liked Songs: Recently Listened, Recently Added, Date Loved, Alphabetical
- Playlists: Recently Listened, Default, Alphabetical, Date Created
- Albums: Recently Listened, Recently Added, Frequently Listened, Alphabetical, Date Released, Random
- Artists: Alphabetical, Album Count

**Playlists "Recently Listened"** uses the same `compareByRecentlyListened` as Home (listen-time desc, then created-date fallback); listen-times are read from `RecentPlaylists` into `playlistPlayTimes` state (refreshed on focus) and feed `createSortComparator`.

**Albums "Random"** reads the shared persisted ordering via `getRandomAlbums()` (RandomAlbums), so it matches Home and stays stable across navigation. When Random is the active album sort, the sort-direction toggle is replaced by a **refresh button** (`refreshRandomAlbums`) that calls `getRandomAlbums(true)` to reshuffle and re-persist (the only reset).

**Deep-link params** (`route.params`, consumed then cleared): `initialTab`, `initialSort`. A fresh (lazy) mount initializes `viewMode`/`sortOption` from these via `useState`; an already-mounted Library applies them on focus via `applyDeepLink` → `runViewModeTransition(mode, sortOverride)`.

### ArtistScreen
- Header: circular artist image (falls back to `getCoverArtUrl(artist.id)`)
- Chip tabs: Albums, Top Songs, Favorite Songs
- Albums tab: 2-column grid (`ScrollView` + `flexWrap`), split into "Albums" and "Appears In" sections
- Top Songs: `getTopSongs(artist.name, 50)` — non-blocking after main `getArtist`; `isLoadingTopSongs` state controls ActivityIndicator
- Favorite Songs: `getStarred()` filtered by `artistId` or `artist` name; `isLoadingFavorites` state controls ActivityIndicator
- Appears In: `getArtistAppearsIn(artist, ownAlbumIds)` — non-blocking background fetch
- All background fetches use `.then().catch().finally(() => setLoading(false))`
- Cached-first via CacheService key `artist_<id>` (albums tab only; the background fetches always hit the network)

### AlbumScreen
- `SectionList` grouped by `song.discNumber` (default 1); disc headers only shown when >1 disc
- Song rows: no thumbnail, track number or play arrow, optional guest artist line
- Art: aspect-ratio adaptive via `onLoad` → `handleArtLoad`
- Cached-first via CacheService key `album_<id>`

### PlaylistScreen
- Song rows with 44×44 cover art, `resizeMode="contain"` in fixed container (no JS resize on load)
- Collage: if `generatePlaylistCollage` returns `{ type: 'collage' }`, `PlaylistCollage` renders a 2×2 grid
- Calls `recordPlaylistPlayed(playlist)` (RecentPlaylists) on both single-song play and play-all, feeding the "Recently Listened" ordering on Home and in Library
- Cached-first via CacheService key `playlist_<id>`. Unlike album/artist art, playlist art can change server-side while the coverArt id stays the same — every network refresh (mount + pull-to-refresh) calls `ArtworkCache.invalidate(data.coverArt)` and bumps an `artNonce` state to force the header image to redownload and redisplay the fresh file.

### PlayerScreen
- Rendered inside `PlayerOverlay`, receives `onClose`, `onShowQueue`, `onNavigateToArtist`, `onNavigateToAlbum`, `safeAreaInsets` as props
- Art: `PLAYER_ART_SIZE = screenWidth - 80`, aspect-ratio adapted via `onLoad`
- Seek: `@react-native-assets/slider`; value is percentage 0–100
- Long titles: `react-native-text-ticker` for marquee scroll
- Star toggle: calls `SubsonicAPI.star/unstar` directly, local `isStarred` state

### AddToPlaylistModal
- Bottom sheet (60% height, capped 520px) rendered by PlayerScreen, QueueScreen, and LibraryScreen; opened from SongMenu's "Add to playlist" action
- Search filter over `getPlaylists()`; create-new-playlist row calls `createPlaylist(name, songId)`; row tap calls `addSongToPlaylist`
- Expands to fullscreen when the keyboard shows (animated height + corner radius), collapses on hide

### SettingsScreen
Chip tabs: Appearance, General, Server, Storage.
- Appearance: accent color picker using `accentPalettes` from theme.js
- General: playback switches (auto-play, **Original quality streaming**, **Original quality caching**, scrobbling — see AppSettings); **Home Playlists** pin manager — lists all playlists (pinned first), each with a pin/unpin `IconButton`; persists via `PinnedPlaylists` (`MAX_PINNED` = 6). Reflected on Home on next focus.
- Server: re-login flow via `SubsonicAPI.initialize()` then `CommonActions.reset`
- Storage: two cache cards via `renderCacheCard` — **Metadata & Artwork** (combined CacheService + ArtworkCache stats, slider 10–500 MB) and **Music** (SongCache stats, slider 100 MB–20 GB); each with usage bar, max-size dialog, and clear button

## Common patterns

**Style factory:** every screen/component has `createStyles(theme)` in its paired `.styles.js`. Call at component render top: `const styles = createStyles(theme)`.

**Memo'd list items:** row components use `React.memo` with custom comparators checking only `item.id`, `isPlaying`, and `starred` boolean.

**Background data loading:** fire after main blocking fetch resolves, never block the loading gate on these:
```js
SubsonicAPI.getSomeData()
  .then(data => setState(data))
  .catch(() => {})
  .finally(() => setIsLoading(false));
```

**FlatList in flex column:** always set `style={{ flex: 1 }}` on `FlatList` when it shares a column with a chip `ScrollView`. The chip container needs `flexShrink: 0` to prevent Yoga compression when list is tall.

**Image flash prevention:** for thumbnail images in list rows, use `resizeMode="contain"` inside a fixed-size container. Do not use `Image.getSize` or `onLoad` resize state for small thumbnails — it causes a visible resize flash.

**Cover art sizing for detail screens:** use `onLoad` → read `e.nativeEvent.source.{width,height}` → compute aspect ratio → update display size state. This is safe because the image is already decoded at that point.

## Running

```bash
npx expo start --go              # Expo dev server for Expo Go; scan QR on iPhone
npx expo start                   # Defaults to dev-client mode (expo-dev-client is installed); press s to switch to Expo Go
npx expo start --clear           # Clear Metro cache
```

Server credentials are stored in AsyncStorage (`serverConfig`). To reset auth, use Settings → Server tab or clear app storage.
