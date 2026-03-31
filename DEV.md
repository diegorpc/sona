# Sona Music - Subsonic/Navidrome Client

A beautiful React Native music streaming client for Subsonic and Navidrome servers, designed for iOS with Windows development support.

## Features

### Core Functionality
- 🎵 **Stream Music** - Connect to your Subsonic/Navidrome server
- 🎧 **Background Playback** - Music continues playing when app is minimized using expo-audio
- 🔍 **Search** - Find artists, albums, and songs quickly across your library
- 📱 **Lock Screen Controls** - Control playback from iOS lock screen and control center
- ⭐ **Favorites** - Star your favorite tracks and albums
- 📊 **Scrobbling** - Track your listening history on your server
- 🎯 **Queue Management** - View and manage your playback queue with drag-to-reorder
- 🔀 **Shuffle & Repeat** - Randomize and repeat your music

### Library Features
- 📚 **Library Browser** - Browse artists, albums, playlists, and songs with optimized pagination
- 🎨 **Playlist Collages** - Automatically generated 2x2 album art collages for playlists
- 🔄 **Smart Caching** - Intelligent caching system with configurable size limits
- ⚡ **Performance Optimized** - React.memo, useMemo, and useCallback for smooth scrolling
- 🎭 **Smooth Animations** - Fade transitions and chip animations for library filtering

### Playback Features
- 🎼 **Full Player** - Beautiful full-screen player with album art and controls
- 🎚️ **Mini Player** - Persistent mini player overlay for quick access
- ⏮️ **Previous/Next** - Navigate through your queue
- ⏸️ **Play/Pause** - Full playback control
- 🔊 **Seek Control** - Scrub through tracks with progress bar
- 💾 **State Persistence** - Remembers playback state across app restarts

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```

## Configuration

1. Launch the app
2. Enter your Subsonic/Navidrome server details:
   - Server URL (e.g., https://your-server.com)
   - Username
   - Password

## Technologies Used

### Core Framework
- **React Native** 0.81.4 - Mobile app framework
- **React** 19.1.0 - UI library
- **Expo** ~54.0.10 - React Native tooling and services

### Navigation
- **@react-navigation/native** ^6.1.18 - Navigation framework
- **@react-navigation/stack** ^6.4.1 - Stack navigator
- **@react-navigation/bottom-tabs** ^6.6.1 - Bottom tab navigation

### UI & Design
- **react-native-paper** ^5.11.6 - Material Design 3 components
- **@expo/vector-icons** ^15.0.2 - Icon library
- **@expo-google-fonts/lexend** ^0.4.1 - Custom font family
- **expo-linear-gradient** ~15.0.7 - Gradient backgrounds
- **expo-blur** ~15.0.7 - Blur effects
- **react-native-text-ticker** ^1.15.0 - Scrolling text for long titles

### Audio & Media
- **expo-audio** ^1.0.13 - Audio playback engine
- **expo-av** ~16.0.7 - Legacy audio/video support

### Gestures & Animations
- **react-native-gesture-handler** ~2.28.0 - Gesture system
- **react-native-reanimated** ^4.1.2 - Animation library
- **react-native-worklets** ^0.5.1 - High-performance animations
- **react-native-draggable-flatlist** ^4.0.3 - Drag-to-reorder lists

### Data & Storage
- **@react-native-async-storage/async-storage** 2.2.0 - Persistent storage
- **axios** ^1.7.7 - HTTP client for API requests
- **crypto-js** ^4.2.0 - MD5 hashing for authentication

### Other Components
- **@react-native-community/slider** 5.0.1 - Slider component for seek/volume
- **react-native-safe-area-context** ~5.6.0 - Safe area handling

## Development Workflow

### Windows Development Setup

Since you're developing on Windows for iOS, here's the recommended workflow:

1. **Use Expo Go for testing**
   - Install Expo Go on your iPhone from the App Store
   - Make sure your phone and computer are on the same WiFi network
   - Run `npm start` and scan the QR code

2. **Hot Reload**
   - Changes to your code will automatically refresh on your device
   - Shake your device to open the developer menu

3. **Debugging**
   - Use Chrome DevTools for debugging JavaScript
   - Enable Remote JS Debugging from the developer menu

### Project Structure

```
src/
├── components/                    # Reusable UI components
│   ├── MiniPlayer.js             # Persistent mini player overlay
│   ├── PlayerOverlay.js          # Full-screen player overlay
│   └── PlaylistCollage.js        # 2x2 album art collage for playlists
├── contexts/                      # React contexts
│   └── PlayerContext.js          # Global player state management
├── screens/                       # App screens
│   ├── LoginScreen.js            # Server authentication
│   ├── LibraryScreen.js          # Main library browser (artists/albums/playlists/songs)
│   ├── SearchScreen.js           # Global search functionality
│   ├── SettingsScreen.js         # App settings and configuration
│   ├── ArtistScreen.js           # Artist detail view
│   ├── AlbumScreen.js            # Album detail view
│   ├── PlaylistScreen.js         # Playlist detail view
│   └── QueueScreen.js            # Playback queue management
├── services/                      # Core services
│   ├── SubsonicAPI.js            # Subsonic API client
│   ├── AudioPlayer.js            # Audio playback engine (expo-audio)
│   ├── CacheService.js           # Library data caching system
│   └── PlayerOverlayController.js # Player overlay state controller
├── styles/                        # StyleSheet definitions
│   ├── SettingsScreen.styles.js
│   ├── LibraryScreen.styles.js
│   ├── SearchScreen.styles.js
│   └── ... (one per screen)
└── theme/                         # App theming
    └── theme.js                  
```

## Configuration

## Building for Production

### TestFlight (Recommended for iOS)

1. **Build with Expo**
   ```bash
   expo build:ios
   ```

2. **Upload to TestFlight**
   - Download the generated IPA file
   - Upload to App Store Connect
   - Distribute via TestFlight

### Ejecting to Native Code (Advanced)

If you need native iOS features:

```bash
expo eject
```

This will create native iOS and Android projects that you can open in Xcode/Android Studio.

## Architecture

### Audio System (AudioPlayer.js)

The audio player uses **expo-audio** for high-quality playback:

- **State Management**: Maintains current track, playlist, queue, and playback position
- **Persistence**: Saves playback state to AsyncStorage for restoration on app restart
- **Status Monitoring**: Timer-based status updates (100ms interval) for position tracking
- **Background Playback**: Configured for iOS background audio and lock screen controls
- **Auto-play**: Automatically advances to next track when current track ends
- **Error Recovery**: Automatic reinitialization if audio player becomes corrupted

Key Methods:
- `playTrack()` - Load and play a new track (updates UI immediately, loads audio in background)
- `togglePlayPause()` - Toggle between play/pause states
- `stop()` - Stop playback and cleanup
- `seekTo()` - Seek to specific position in track
- `playNext()` / `playPrevious()` - Navigate queue

### Caching System (CacheService.js)

Smart caching for library data to reduce server requests:

- **LRU Cache**: Least Recently Used eviction strategy
- **Size Management**: Configurable max cache size (100MB - 20GB)
- **Metadata Tracking**: Tracks entry sizes, access times, and total cache usage
- **Automatic Pruning**: Removes old entries when cache limit exceeded
- **Stats API**: Provides cache usage statistics for UI display

### Library Browser (LibraryScreen.js)

Highly optimized virtualized list with:

- **Pagination**: 50 items per page for smooth scrolling
- **React Performance**: React.memo, useMemo, useCallback throughout
- **Custom Comparison**: Prevents unnecessary re-renders
- **FlatList Optimization**: removeClippedSubviews, windowSize, maxToRenderPerBatch tuning
- **Animation Sequence**: Chip reorder → fade out → data load → fade in
- **Playlist Collages**: Generates 2x2 album art grids for playlists

### Navigation Structure

```
Stack Navigator (Root)
├── Login Screen (unauthenticated)
└── Main (authenticated)
    ├── Bottom Tab Navigator
    │   ├── Library Tab
    │   ├── Search Tab
    │   └── Settings Tab
    ├── Artist Screen (modal)
    ├── Album Screen (modal)
    └── Playlist Screen (modal)

+ PlayerOverlay (global component)
  └── Gestures: Swipe down to dismiss, Swipe up for queue
```

## API Reference

### Subsonic API Integration

The app uses Subsonic API v1.16.1 with MD5 token authentication:

**Endpoints Used:**
- `ping` - Server connectivity test
- `getArtists` - Fetch all artists (indexed)
- `getArtist` - Get artist details and albums
- `getAlbum` - Get album details and tracks
- `getPlaylists` - Get user playlists
- `getPlaylist` - Get playlist details
- `search3` - Universal search (artists, albums, songs)
- `stream` - Audio streaming endpoint
- `getCoverArt` - Album/artist artwork
- `scrobble` - Submit listening history
- `star` / `unstar` - Favorite management

**Authentication:**
- Uses MD5 token-based auth: `token = MD5(password + salt)`
- Credentials stored securely in AsyncStorage
- Auto-reconnect on token expiration

### Services API

**AudioPlayer Service:**
```javascript
// Play a track
await AudioPlayer.playTrack(track, playlist, index);

// Control playback
AudioPlayer.togglePlayPause();
AudioPlayer.stop();
AudioPlayer.playNext();
AudioPlayer.playPrevious();
AudioPlayer.seekTo(positionMs);

// Listen to state changes
AudioPlayer.addListener(callback);
```

**CacheService:**
```javascript
// Get cached data
const data = await CacheService.get(key);

// Set cache entry
await CacheService.set(key, data);

// Manage cache
await CacheService.clearAll();
await CacheService.setMaxSize(sizeMB);
const stats = await CacheService.getStats();
```

## Troubleshooting

### Development Issues

1. **Metro Bundler Issues**
   ```bash
   npx react-native start --reset-cache
   ```

2. **Dependency Issues**
   ```bash
   rm -rf node_modules
   npm install
   ```

3. **Expo Issues**
   ```bash
   expo r -c
   ```

## Current Implementation Status

### ✅ Completed Features
- ✅ Login/Authentication screen
- ✅ Library browser with tabs (Artists, Albums, Playlists, Songs)
- ✅ Artist detail screen
- ✅ Album detail screen
- ✅ Playlist detail screen
- ✅ Global search functionality
- ✅ Full-screen player with controls
- ✅ Mini player overlay
- ✅ Queue management screen with drag-to-reorder
- ✅ Background audio playback
- ✅ Lock screen controls
- ✅ Smart caching system
- ✅ Settings screen (Server, Playback, Downloads, Storage)
- ✅ Playlist collages (2x2 album art)
- ✅ Scrobbling support
- ✅ Favorite/star management
- ✅ State persistence across app restarts
- ✅ Theme customization (accent colors)

### 🚧 Planned Features
- 🚧 Home/Dashboard screen 
- 🚧 Rework artist, album, playlist pages
- 🚧 Offline downloads for tracks/albums
- 🚧 Lyrics display
- 🚧 CarPlay support
- 🚧 Sleep timer
- 🚧 Crossfade between tracks
- 🚧 Advanced queue features (save queue, queue history)


---

**Note**: This app is designed for personal use with your own music server. Ensure you have the rights to stream the music on your server.
