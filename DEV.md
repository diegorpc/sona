# sona – Subsonic/Navidrome Client (React Native / Expo)

iOS-first music streaming client. Development on Windows, tested via Expo Go on physical iOS device.

## Stack

- **React Native** 0.81.4 + **React** 19.1.0 + **Expo** ~54
- **expo-audio** for playback (not expo-av)
- **react-native-paper** (MD3) for base UI components
- **@expo/vector-icons** (MaterialIcons throughout)
- **expo-blur** for `BlurView` (iOS only — see ScreenBackground)
- **react-native-gesture-handler** + **react-native-reanimated** (gesture layer)
- **react-native-draggable-flatlist** for queue reordering
- **@expo-google-fonts/lexend** (Lexend_400Regular, _500Medium, _600SemiBold, _700Bold)
- **axios** + **crypto-js** for Subsonic API
- **@react-native-async-storage/async-storage** for persistence
- `@react-native-assets/slider` for the player seek bar (not the community slider)

## Project layout

```
src/
├── components/
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
│   ├── CacheService.js           # AsyncStorage-backed LRU cache for library data
│   ├── PlayerOverlayController.js # Singleton: expandPlayerOverlay / collapsePlayerOverlay
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
    │   ├── Library  → LibraryScreen
    │   ├── Search   → SearchScreen
    │   └── Settings → SettingsScreen
    ├── Artist  (stack push)
    ├── Album   (stack push)
    └── Playlist (stack push)

PlayerOverlay — mounted at app root, not in navigator
  Layers (bottom to top): MiniPlayer → PlayerScreen → QueueScreen
  Gestures: swipe-down collapses, swipe-up shows queue
```

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
| `getAlbumList(type, size, offset)` | `getAlbumList2` | valid types: random, newest, highest, frequent, recent, alphabeticalByName, alphabeticalByArtist, starred, byYear, byGenre |
| `getAllAlbums(type, max)` | batched | fetches in 500-item batches up to max |
| `search(query, ...)` | `search3` | returns `searchResult3` with artist/album/song arrays |
| `getTopSongs(artistName, count)` | `getTopSongs` | by artist name (not ID); requires API ≥ 1.13.0 |
| `getStarred()` | `getStarred` | returns `starred` with song/album/artist arrays |
| `getArtistAppearsIn(artist, excludeIds)` | `search3` | finds albums where artist has songs but isn't album artist |
| `getStreamUrl(songId, maxBitRate?)` | `stream` | returns URL string (not a request) |
| `getCoverArtUrl(id, size)` | `getCoverArt` | returns URL string |
| `scrobble(songId, submission)` | `scrobble` | call on track start |
| `star(id, albumId?, artistId?)` | `star` | |
| `unstar(id, albumId?, artistId?)` | `unstar` | |
| `generatePlaylistCollage(playlistId, size)` | — | returns single URL or `{ type: 'collage', coverArtUrls, albumCount, size }` |

## AudioPlayer

Singleton at `src/services/AudioPlayer.js`. Uses `createAudioPlayer` from `expo-audio`.

State fields: `currentTrack`, `playlist[]`, `currentIndex`, `isPlaying`, `position` (ms), `duration` (ms), `isLoading`, `priorityQueue[]`, `queueContext { name, type, id }`, `currentTrackSource ('context'|'priority')`

Queue model:
- **playlist** — the context queue (album, artist, playlist)
- **priorityQueue** — tracks inserted to play next; consumed before advancing playlist
- `currentTrackSource` distinguishes which queue the current track came from

`playTrack(track, playlist, index, options)` — stops current, sets state, persists to AsyncStorage, creates new `createAudioPlayer` instance. UI updates immediately via `notifyListeners()`.

Persistence keys: `currentTrack`, `currentPlaylist`, `currentIndex`, `currentPosition`, `isPlaying`, `audioPlayerPriorityQueue`, `audioPlayerQueueContext`, `audioPlayerCurrentTrackSource`.

Listener pattern: `addListener(fn)` / `removeListener(fn)` — `fn(state)` called on every state change. `PlayerContext` subscribes and exposes state via `usePlayer()`.

## CacheService

Singleton. In-memory `Map` + AsyncStorage backing. Default max 500 MB. Metadata key `@sona_cache_metadata` stores per-entry sizes and timestamps. LRU eviction when limit exceeded. Used by LibraryScreen for artist/album/playlist lists.

## PlayerOverlay

Mounted outside the navigator at app root. Three vertical layers controlled by `Animated.Value overlayY`:
- Collapsed: only MiniPlayer visible at bottom
- Expanded: PlayerScreen fills screen
- Queue: QueueScreen slides up over PlayerScreen

`PanResponder` handles drag gestures. `PlayerOverlayController` exposes `registerPlayerOverlay` / `expandPlayerOverlay` / `collapsePlayerOverlay` for imperative calls from anywhere (e.g., after `playTrack`).

## Screen-specific details

### LibraryScreen
Chip tabs: Liked Songs, Playlists, Albums, Artists. Each tab has its own sort options stored in AsyncStorage. Albums fetched via `getAllAlbums(type)` where `type` maps to Subsonic sort keys. Artists fetched once via `getArtists()`. List fades in via `listOpacity` Animated.Value (0→1, 400ms) after data loads — pattern to copy for any background-loaded list.

Sort options per tab:
- Liked Songs: Recently Listened, Recently Added, Date Loved, Alphabetical
- Playlists: Default, Alphabetical, Date Created
- Albums: Recently Listened, Recently Added, Frequently Listened, Alphabetical, Date Released
- Artists: Alphabetical, Album Count

### ArtistScreen
- Header: circular artist image (falls back to `getCoverArtUrl(artist.id)`)
- Chip tabs: Albums, Top Songs, Favorite Songs
- Albums tab: 2-column grid (`ScrollView` + `flexWrap`), split into "Albums" and "Appears In" sections
- Top Songs: `getTopSongs(artist.name, 50)` — non-blocking after main `getArtist`; `isLoadingTopSongs` state controls ActivityIndicator
- Favorite Songs: `getStarred()` filtered by `artistId` or `artist` name; `isLoadingFavorites` state controls ActivityIndicator
- Appears In: `getArtistAppearsIn(artist, ownAlbumIds)` — non-blocking background fetch
- All background fetches use `.then().catch().finally(() => setLoading(false))`

### AlbumScreen
- `SectionList` grouped by `song.discNumber` (default 1); disc headers only shown when >1 disc
- Song rows: no thumbnail, track number or play arrow, optional guest artist line
- Art: aspect-ratio adaptive via `onLoad` → `handleArtLoad`

### PlaylistScreen
- Song rows with 44×44 cover art, `resizeMode="contain"` in fixed container (no JS resize on load)
- Collage: if `generatePlaylistCollage` returns `{ type: 'collage' }`, `PlaylistCollage` renders a 2×2 grid

### PlayerScreen
- Rendered inside `PlayerOverlay`, receives `onClose`, `onShowQueue`, `onNavigateToArtist`, `onNavigateToAlbum`, `safeAreaInsets` as props
- Art: `PLAYER_ART_SIZE = screenWidth - 80`, aspect-ratio adapted via `onLoad`
- Seek: `@react-native-assets/slider`; value is percentage 0–100
- Long titles: `react-native-text-ticker` for marquee scroll
- Star toggle: calls `SubsonicAPI.star/unstar` directly, local `isStarred` state

### SettingsScreen
Chip tabs: Appearance, General, Server, Storage.
- Appearance: accent color picker using `accentPalettes` from theme.js
- Server: re-login flow via `SubsonicAPI.initialize()` then `CommonActions.reset`
- Storage: cache stats from `CacheService.getStats()`, clear cache button

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
npm start                        # Expo dev server; scan QR with Expo Go on iPhone
npm start -- --reset-cache       # Clear Metro cache
```

Server credentials are stored in AsyncStorage (`serverConfig`). To reset auth, use Settings → Server tab or clear app storage.
