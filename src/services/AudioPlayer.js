import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import AsyncStorage from '@react-native-async-storage/async-storage';
import SubsonicAPI from './SubsonicAPI';
import SongCache from './SongCache';
import { getAppSettings } from './AppSettings';

const PRIORITY_QUEUE_KEY = 'audioPlayerPriorityQueue';
const CONTEXT_QUEUE_KEY = 'audioPlayerQueueContext';
const CURRENT_TRACK_SOURCE_KEY = 'audioPlayerCurrentTrackSource';
const SHUFFLE_KEY = 'audioPlayerShuffle';
const REPEAT_MODE_KEY = 'audioPlayerRepeatMode';

// Subsonic track metadata already carries a duration (seconds) — use it as
// the displayed duration immediately, before the native player has buffered
// enough of the (often transcoded, chunked) stream to know its own duration.
// The status timer below only ever overwrites this with a live value once
// one is actually known, so the UI never regresses to "Loading…"/NaN once a
// number is showing.
function knownDurationMs(track) {
  const seconds = track?.duration;
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
}

/** In-place Fisher–Yates shuffle. Returns the same array for chaining. */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Global playback engine, exported as a singleton. Wraps expo-audio's
 * `createAudioPlayer` (one instance per track, recreated on every track
 * change) and owns all playback state, the two-queue model, and its
 * persistence to AsyncStorage.
 *
 * ## Queue model
 * - `playlist` — the *context queue*: the album/artist/playlist the current
 *   track was started from. `currentIndex` points at the current track
 *   within it; `contextQueue` (`{ name, type, id }`) labels it for the UI.
 * - `priorityQueue` — the user's queue ("Add next" inserts at the front,
 *   "Add last"/"Queue last" append at the back), consumed FIFO before the
 *   context queue advances.
 * - `currentTrackSource` (`'context' | 'priority'`) records which queue the
 *   current track came from, so QueueScreen can render it correctly.
 *
 * ## Status polling
 * expo-audio exposes no status event stream, so a 100 ms `setInterval`
 * (see {@link AudioPlayerService#setupAudioPlayerListeners}) polls the
 * native player for position/duration/playing/buffering, detects track end,
 * and calls {@link AudioPlayerService#notifyListeners}. **Player state
 * therefore changes ~10x/sec during playback** — this dominates the perf
 * characteristics of every consumer, and is why PlayerContext splits its
 * contexts by update frequency.
 *
 * ## Buffering vs paused vs loading
 * AVPlayer reports `playing = false` while stalled waiting for data, which
 * used to make the UI flip to "paused" mid-track on a bad connection.
 * `intendedPlaying` tracks what the user asked for (set at every play/pause/
 * stop transition) alongside the live `isPlaying`, and the status timer
 * derives `isBuffering = intendedPlaying && sound.isBuffering` — the intent
 * gate matters because expo-audio also reports `isBuffering` for a
 * deliberate pause on an empty buffer. `togglePlayPause` branches on
 * `intendedPlaying`, not `isPlaying`, so tapping pause during a stall
 * actually pauses instead of re-issuing `play()`. There is no buffered-range
 * bar on the seek slider because expo-audio never bridges AVPlayer's
 * `loadedTimeRanges` — no buffered-amount data exists JS-side.
 *
 * ## Listener pattern
 * `addListener(fn)` / `removeListener(fn)`; each listener receives the full
 * state snapshot (see {@link AudioPlayerService#getCurrentState}) on every
 * change. PlayerContext subscribes once and re-publishes through React
 * context.
 */
class AudioPlayerService {
  constructor() {
    this.sound = null;
    this.currentTrack = null;
    this.playlist = [];
    this.currentIndex = 0;
    this.isPlaying = false;
    this.intendedPlaying = false;
    this.isBuffering = false;
    this.position = 0;
    this.duration = 0;
    this.isLoading = false;
    this.listeners = [];
    this.priorityQueue = [];
    this.contextQueue = {
      name: null,
      type: null,
      id: null,
    };
    this.currentTrackSource = 'context';
    this.statusTimer = null;
    this.statusUpdateCount = 0;
    this.trackEndedFlag = false;
    this.shuffle = false;
    this.repeatMode = 'none'; // 'none' | 'all' | 'one'
    this.originalUpcoming = [];

    this.initializeAudio();
  }

  /**
   * Configure the OS audio session (background playback, silent-mode
   * playback, interruption behavior). Called once from the constructor.
   * @returns {Promise<void>}
   */
  async initializeAudio() {
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        shouldPlayInBackground: true,
        playsInSilentMode: true,
        interruptionModeAndroid: 'duckOthers',
        interruptionMode: 'mixWithOthers',
      });
    } catch (error) {
      console.error('Error initializing audio mode:', error);
    }
  }

  /**
   * Subscribe to playback state changes.
   * @param {function(Object): void} listener Receives the state snapshot
   *   from {@link AudioPlayerService#getCurrentState} on every change.
   */
  addListener(listener) {
    this.listeners.push(listener);
  }

  /** @param {function(Object): void} listener The listener to remove. */
  removeListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /** Push the current state snapshot to every registered listener. */
  notifyListeners() {
    const state = this.getCurrentState();
    this.listeners.forEach(listener => listener(state));
  }

  /**
   * Stop whatever is playing and start a new track.
   *
   * Persists the new state, tears down the previous expo-audio instance,
   * creates a fresh one for this track, and fires a "now playing" scrobble.
   * Listeners are notified immediately (before the audio is ready) so the
   * UI updates without waiting on the network.
   *
   * @param {Object} track The track to play (Subsonic song object).
   * @param {?Object[]} [playlist] Context queue to install. When omitted and
   *   no context queue exists, a single-track queue is synthesized; when
   *   omitted but a queue exists, the current queue is kept and only the
   *   index moves.
   * @param {number} [index] Position of `track` within `playlist`.
   * @param {Object} [options]
   * @param {?string} [options.contextName] Display label for the queue
   *   (album/playlist name).
   * @param {?string} [options.contextType] Queue origin type, e.g. `'album'`,
   *   `'playlist'`, `'artist'`.
   * @param {?string} [options.contextId] Id of the originating entity.
   * @param {string} [options.contextSource] `currentTrackSource` to set for
   *   context playback (defaults to `'context'`).
   * @param {boolean} [options.fromPriority] True when the track was pulled
   *   off the priority queue: the context queue is left untouched and the
   *   source is marked `'priority'`.
   * @param {string} [options.source] Explicit `currentTrackSource` override.
   * @returns {Promise<void>}
   */
  async playTrack(track, playlist = null, index = 0, options = {}) {
    if (!track) {
      return;
    }

    console.log('[AudioPlayer] playTrack called:', {
      trackId: track.id,
      title: track.title,
      index,
      options,
    });

    try {
      this.trackEndedFlag = false;
      await this.stopCurrentTrack();

      const {
        contextName = null,
        contextType = null,
        contextId = null,
        contextSource = 'context',
        fromPriority = false,
        source,
      } = options || {};

      this.currentTrack = track;

      if (!fromPriority) {
        if (Array.isArray(playlist) && playlist.length > 0) {
          this.playlist = [...playlist];
          const clampedIndex = Math.max(0, Math.min(index, this.playlist.length - 1));
          this.currentIndex = clampedIndex;
          this.contextQueue = {
            name: contextName,
            type: contextType,
            id: contextId,
          };
          this.currentTrackSource = contextSource || 'context';
          // Reset shuffle state when a new context is loaded
          this.shuffle = false;
          this.originalUpcoming = [];
        } else if (!Array.isArray(this.playlist) || this.playlist.length === 0) {
          this.playlist = [track];
          this.currentIndex = 0;
          this.contextQueue = {
            name: contextName,
            type: contextType,
            id: contextId,
          };
          this.currentTrackSource = contextSource || 'context';
          this.shuffle = false;
          this.originalUpcoming = [];
        } else {
          this.currentIndex = Math.max(0, Math.min(index, this.playlist.length - 1));
          this.currentTrackSource = contextSource || 'context';
        }
      } else {
        this.currentTrackSource = 'priority';
        if (Array.isArray(playlist) && playlist.length > 0 && this.playlist.length === 0) {
          this.playlist = [...playlist];
          this.currentIndex = Math.max(0, Math.min(index, this.playlist.length - 1));
        }
      }

      if (source === 'priority') {
        this.currentTrackSource = 'priority';
      }

      this.position = 0;
      this.duration = knownDurationMs(track);
      this.isLoading = true;
      this.isPlaying = false;
      this.isBuffering = false;

      this.notifyListeners();

      await AsyncStorage.multiSet([
        ['currentTrack', JSON.stringify(track)],
        ['currentPlaylist', JSON.stringify(this.playlist)],
        ['currentIndex', this.currentIndex.toString()],
        ['currentPosition', '0'],
        ['isPlaying', 'false'],
      ]);

      this.persistQueueState();

      const sourceUri = await this.resolveSourceUri(track.id);

      this.sound = createAudioPlayer(
        { uri: sourceUri },
        {
          loop: false,
          volume: 1.0,
        }
      );

      this.setupAudioPlayerListeners();

      this.sound.play();
      this.isPlaying = true;
      this.intendedPlaying = true;
      this.isLoading = false;

      await AsyncStorage.setItem('isPlaying', 'true');

      try {
        await SubsonicAPI.scrobble(track.id, false);
      } catch (error) {
        console.warn('Failed to scrobble track:', error);
      }

      this.notifyListeners();
    } catch (error) {
      console.error('Error playing track:', error);
      this.isLoading = false;
      this.notifyListeners();
    }
  }

  /**
   * Start the 100 ms status poll for the current `this.sound` instance.
   *
   * Each tick syncs position/duration/playing/buffering from the native
   * player, detects track end (within 0.5 s of the known duration, latched
   * by `trackEndedFlag` so it fires once), persists state every ~5 s, and
   * notifies listeners. `duration` is only overwritten once the native
   * player reports a finite positive value, so the metadata-seeded duration
   * never regresses to NaN (see {@link knownDurationMs}).
   */
  setupAudioPlayerListeners() {
    if (!this.sound) {
      console.warn('[AudioPlayer] setupAudioPlayerListeners: no sound object');
      return;
    }

    if (this.statusTimer) {
      this.clearStatusTimer();
    }

    this.statusUpdateCount = 0;
    this.trackEndedFlag = false;
    console.log('[AudioPlayer] Status timer started for track:', this.currentTrack?.title);

    this.statusTimer = setInterval(() => {
      if (!this.sound) {
        return;
      }

      const currentTime = this.sound.currentTime;
      const duration = this.sound.duration;

      this.position = currentTime * 1000;
      if (Number.isFinite(duration) && duration > 0) {
        this.duration = duration * 1000;
      }
      this.isPlaying = this.sound.playing;
      this.isBuffering = this.intendedPlaying && this.sound.isBuffering === true;

      // Track-end detection with threshold to prevent false positives
      // Only trigger if we're within 0.5 seconds of the end AND haven't already triggered
      const TRACK_END_THRESHOLD = 0.5; // seconds
      const trackEnded =
        !this.trackEndedFlag &&
        Number.isFinite(duration) &&
        duration > 0 &&
        currentTime >= (duration - TRACK_END_THRESHOLD);

      if (trackEnded) {
        console.log('[AudioPlayer] Track end detected:', {
          trackId: this.currentTrack?.id,
          title: this.currentTrack?.title,
          currentTime: currentTime.toFixed(2),
          duration: duration.toFixed(2),
          timeRemaining: (duration - currentTime).toFixed(2),
        });
        this.trackEndedFlag = true;
        this.onTrackFinished();
      }

      // Log periodic status (every 5 seconds)
      if (this.statusUpdateCount % 50 === 0) {
        console.log('[AudioPlayer] Status update:', {
          trackId: this.currentTrack?.id,
          title: this.currentTrack?.title,
          currentTime: currentTime.toFixed(2),
          duration: duration.toFixed(2),
          isPlaying: this.isPlaying,
        });
        this.saveCurrentState();
      }

      this.statusUpdateCount = (this.statusUpdateCount || 0) + 1;
      this.notifyListeners();
    }, 100);
  }

  /** Stop the status poll and reset the track-end latch. */
  clearStatusTimer() {
    if (this.statusTimer) {
      console.log('[AudioPlayer] Clearing status timer');
      clearInterval(this.statusTimer);
      this.statusTimer = null;
      this.trackEndedFlag = false;
    }
  }

  /**
   * Track-end handler: submit the completed-listen scrobble, then advance
   * via {@link AudioPlayerService#playNext}.
   * @returns {Promise<void>}
   */
  async onTrackFinished() {
    console.log('[AudioPlayer] onTrackFinished called for track:', this.currentTrack?.title);
    try {
      if (this.currentTrack) {
        console.log('[AudioPlayer] Scrobbling track:', this.currentTrack.id);
        await SubsonicAPI.scrobble(this.currentTrack.id, true);
      }
      console.log('[AudioPlayer] Calling playNext after track finished');
      await this.playNext();
    } catch (error) {
      console.error('[AudioPlayer] Error handling track completion:', error);
    }
  }

  /**
   * Resolve the playback URI for a track: a SongCache local file when one
   * exists, otherwise a stream URL (transcoded to MP3 320 kbps unless the
   * `originalQualityStreaming` setting is enabled).
   *
   * @param {string} trackId
   * @returns {Promise<string>} Local `file://` URI or remote stream URL.
   */
  async resolveSourceUri(trackId) {
    const cachedUri = await SongCache.getCachedUri(trackId).catch(() => null);
    if (cachedUri) return cachedUri;
    const settings = await getAppSettings();
    return SubsonicAPI.getStreamUrl(
      trackId,
      settings.originalQualityStreaming ? {} : { format: 'mp3', maxBitRate: 320 }
    );
  }

  /**
   * Set up a track without touching queue state — used for session restore
   * ({@link AudioPlayerService#loadSavedState}) and for re-arming playback
   * after the sound object was lost.
   *
   * @param {Object} track
   * @param {number} [position] Start position in milliseconds.
   * @param {boolean} [shouldPlay] Whether to start playing immediately.
   * @returns {Promise<void>}
   */
  async initializeTrackForPlayback(track, position = 0, shouldPlay = false) {
    if (!track) {
      return;
    }

    try {
      this.isLoading = true;
      this.duration = knownDurationMs(track);
      this.notifyListeners();

      await this.stopCurrentTrack();

      const sourceUri = await this.resolveSourceUri(track.id);
      this.sound = createAudioPlayer(
        { uri: sourceUri },
        {
          loop: false,
          volume: 1.0,
        }
      );

      this.setupAudioPlayerListeners();

      if (position > 0) {
        this.sound.seekTo(position / 1000);
      }

      if (shouldPlay) {
        this.sound.play();
        this.isPlaying = true;
        this.intendedPlaying = true;
      } else {
        this.isPlaying = false;
        this.intendedPlaying = false;
      }

      this.isLoading = false;
      this.notifyListeners();
    } catch (error) {
      console.error('Error initializing track for playback:', error);
      this.isLoading = false;
      this.notifyListeners();
    }
  }

  /**
   * Toggle between playing and paused, branching on `intendedPlaying` (not
   * the live `isPlaying`) so a tap during a buffering stall pauses instead
   * of re-issuing `play()`. Re-arms the track from scratch if the sound
   * object has been lost.
   * @returns {Promise<void>}
   */
  async togglePlayPause() {
    console.log('[AudioPlayer] togglePlayPause called, current isPlaying:', this.isPlaying);

    if (!this.sound) {
      console.log('[AudioPlayer] No sound object, initializing track for playback');
      if (this.currentTrack) {
        await this.initializeTrackForPlayback(this.currentTrack, this.position, true);
      } else {
        console.warn('[AudioPlayer] No current track available to toggle playback.');
      }
      return;
    }

    try {
      if (this.intendedPlaying) {
        console.log('[AudioPlayer] Pausing playback');
        this.sound.pause();
        this.isPlaying = false;
        this.intendedPlaying = false;
        this.isBuffering = false;
        await AsyncStorage.setItem('isPlaying', 'false');
      } else {
        console.log('[AudioPlayer] Resuming playback');
        this.sound.play();
        this.isPlaying = true;
        this.intendedPlaying = true;
        await AsyncStorage.setItem('isPlaying', 'true');
      }

      this.notifyListeners();
    } catch (error) {
      console.error('[AudioPlayer] Error toggling play/pause:', error);
      if (this.currentTrack) {
        await this.initializeTrackForPlayback(this.currentTrack, this.position, !this.intendedPlaying);
      }
    }
  }

  /**
   * Advance playback. Order of precedence:
   * 1. repeat-one — replay the current track (unless priority tracks wait);
   * 2. the priority queue (FIFO);
   * 3. the next context-queue track;
   * 4. at the end of the context queue: wrap to the start under repeat-all,
   *    otherwise stop.
   * @returns {Promise<void>}
   */
  async playNext() {
    console.log('[AudioPlayer] playNext called:', {
      priorityQueueLength: this.priorityQueue.length,
      playlistLength: this.playlist.length,
      currentIndex: this.currentIndex,
      repeatMode: this.repeatMode,
    });

    // Repeat-one: replay the current track (priority queue still takes precedence)
    if (this.repeatMode === 'one' && this.priorityQueue.length === 0 && this.currentTrack) {
      console.log('[AudioPlayer] Repeat-one: replaying current track');
      await this.playTrack(this.currentTrack, this.playlist, this.currentIndex, {
        contextName: this.contextQueue?.name,
        contextType: this.contextQueue?.type,
        contextId: this.contextQueue?.id,
        contextSource: 'context',
      });
      return;
    }

    if (this.priorityQueue.length > 0) {
      const nextPriorityTrack = this.priorityQueue.shift();
      console.log('[AudioPlayer] Playing next from priority queue:', nextPriorityTrack?.title);
      this.persistQueueState();
      this.notifyListeners();

      if (nextPriorityTrack) {
        await this.playTrack(nextPriorityTrack, this.playlist, this.currentIndex, {
          fromPriority: true,
          source: 'priority',
        });
      }
      return;
    }

    if (!Array.isArray(this.playlist) || this.playlist.length === 0) {
      console.log('[AudioPlayer] playNext: no playlist available');
      return;
    }

    const nextIndex = this.currentIndex + 1;
    if (nextIndex >= this.playlist.length) {
      if (this.repeatMode === 'all' && this.playlist.length > 0) {
        console.log('[AudioPlayer] Repeat-all: wrapping to start of context queue');
        const firstTrack = this.playlist[0];
        await this.playTrack(firstTrack, this.playlist, 0, {
          contextName: this.contextQueue?.name,
          contextType: this.contextQueue?.type,
          contextId: this.contextQueue?.id,
          contextSource: 'context',
        });
      } else {
        console.log('[AudioPlayer] playNext: reached end of playlist, stopping');
        await this.stop();
      }
      return;
    }

    const nextTrack = this.playlist[nextIndex];
    if (nextTrack) {
      console.log('[AudioPlayer] Playing next track from playlist:', {
        nextIndex,
        title: nextTrack.title,
      });
      await this.playTrack(nextTrack, this.playlist, nextIndex, {
        contextName: this.contextQueue?.name,
        contextType: this.contextQueue?.type,
        contextId: this.contextQueue?.id,
        contextSource: 'context',
      });
    }
  }

  /**
   * Play the previous context-queue track. No-op at the first track (no
   * wrap-around, and the priority queue is never re-entered).
   * @returns {Promise<void>}
   */
  async playPrevious() {
    console.log('[AudioPlayer] playPrevious called');

    if (!Array.isArray(this.playlist) || this.playlist.length === 0) {
      console.log('[AudioPlayer] playPrevious: no playlist available');
      return;
    }

    const previousIndex = this.currentIndex - 1;
    if (previousIndex < 0) {
      console.log('[AudioPlayer] playPrevious: already at first track');
      return;
    }

    const previousTrack = this.playlist[previousIndex];
    if (previousTrack) {
      console.log('[AudioPlayer] Playing previous track:', {
        previousIndex,
        title: previousTrack.title,
      });
      await this.playTrack(previousTrack, this.playlist, previousIndex, {
        contextName: this.contextQueue?.name,
        contextType: this.contextQueue?.type,
        contextId: this.contextQueue?.id,
        contextSource: 'context',
      });
    }
  }

  /**
   * Seek within the current track. Also resets the track-end latch so
   * seeking backwards can re-trigger end detection later.
   * @param {number} positionMillis Target position in milliseconds.
   * @returns {Promise<void>}
   */
  async seekTo(positionMillis) {
    if (!this.sound) {
      console.warn('[AudioPlayer] seekTo: no sound object');
      return;
    }

    try {
      console.log('[AudioPlayer] Seeking to:', positionMillis / 1000, 'seconds');
      this.sound.seekTo(positionMillis / 1000);
      this.position = positionMillis;
      // Reset track ended flag when seeking (user might seek backwards)
      this.trackEndedFlag = false;
      this.notifyListeners();
    } catch (error) {
      console.error('[AudioPlayer] Error seeking within track:', error);
    }
  }

  /**
   * Tear down the current expo-audio instance (pause, stop the status poll,
   * release the native player) without touching queue state. Used before
   * every new track and by {@link AudioPlayerService#stop}.
   * @returns {Promise<void>}
   */
  async stopCurrentTrack() {
    if (!this.sound) {
      return;
    }

    console.log('[AudioPlayer] Stopping current track:', this.currentTrack?.title);

    try {
      if (this.isPlaying) {
        this.sound.pause();
      }

      this.clearStatusTimer();

      await new Promise(resolve => setTimeout(resolve, 50));

      this.sound.remove();
      this.sound = null;
      this.isPlaying = false;
      this.intendedPlaying = false;
      this.isBuffering = false;
      this.trackEndedFlag = false;
    } catch (error) {
      console.error('[AudioPlayer] Error stopping current track:', error);
      this.sound = null;
      this.isPlaying = false;
      this.intendedPlaying = false;
      this.isBuffering = false;
      this.clearStatusTimer();
    }
  }

  /**
   * Stop playback entirely and reset position/duration. The current track
   * and queues are kept so the UI can still show what was playing.
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.sound) {
      return;
    }

    try {
      await this.stopCurrentTrack();
      this.position = 0;
      this.duration = 0;
      await AsyncStorage.multiSet([
        ['isPlaying', 'false'],
        ['currentPosition', '0'],
      ]);
      this.notifyListeners();
    } catch (error) {
      console.error('Error stopping playback:', error);
    }
  }

  /**
   * Persist position/isPlaying and queue state. Called every ~5 s by the
   * status poll so a killed app restores close to where it left off.
   * @returns {Promise<void>}
   */
  async saveCurrentState() {
    if (!this.currentTrack) {
      return;
    }

    try {
      await AsyncStorage.multiSet([
        ['currentPosition', this.position.toString()],
        ['isPlaying', this.isPlaying.toString()],
      ]);
      this.persistQueueState();
    } catch (error) {
      console.error('Error saving playback state:', error);
    }
  }

  /**
   * Restore the previous session: queues, shuffle/repeat flags, current
   * track, and position, resuming playback if the app was playing when it
   * closed. Called once at launch by PlayerProvider — nothing else should
   * call this, since concurrent restores race each other.
   * @returns {Promise<void>}
   */
  async loadSavedState() {
    try {
      const entries = await AsyncStorage.multiGet([
        'currentTrack',
        'currentPlaylist',
        'currentIndex',
        'currentPosition',
        'isPlaying',
        PRIORITY_QUEUE_KEY,
        CONTEXT_QUEUE_KEY,
        CURRENT_TRACK_SOURCE_KEY,
        SHUFFLE_KEY,
        REPEAT_MODE_KEY,
      ]);

      const store = Object.fromEntries(entries);

      if (store[PRIORITY_QUEUE_KEY]) {
        try {
          this.priorityQueue = JSON.parse(store[PRIORITY_QUEUE_KEY]) || [];
        } catch (error) {
          console.warn('Failed to parse saved priority queue:', error);
          this.priorityQueue = [];
        }
      }

      if (store[CONTEXT_QUEUE_KEY]) {
        try {
          const parsedContext = JSON.parse(store[CONTEXT_QUEUE_KEY]);
          if (parsedContext && typeof parsedContext === 'object') {
            this.contextQueue = {
              name: parsedContext.name ?? null,
              type: parsedContext.type ?? null,
              id: parsedContext.id ?? null,
            };
          }
        } catch (error) {
          console.warn('Failed to parse saved context queue metadata:', error);
        }
      }

      if (typeof store[CURRENT_TRACK_SOURCE_KEY] === 'string') {
        this.currentTrackSource = store[CURRENT_TRACK_SOURCE_KEY] || 'context';
      }

      if (store[SHUFFLE_KEY] === 'true') {
        this.shuffle = true;
      }

      if (store[REPEAT_MODE_KEY]) {
        const mode = store[REPEAT_MODE_KEY];
        if (mode === 'all' || mode === 'one') {
          this.repeatMode = mode;
        }
      }

      const savedTrack = store.currentTrack;
      const savedPlaylist = store.currentPlaylist;

      if (savedTrack && savedPlaylist) {
        this.currentTrack = JSON.parse(savedTrack);
        this.playlist = JSON.parse(savedPlaylist);
        this.currentIndex = parseInt(store.currentIndex || '0', 10);

        await this.initializeTrackForPlayback(
          this.currentTrack,
          parseInt(store.currentPosition || '0', 10),
          store.isPlaying === 'true'
        );
      }

      this.notifyListeners();
    } catch (error) {
      console.error('Error loading saved playback state:', error);
    }
  }

  /**
   * Move a priority-queue track from one position to another (drag reorder
   * in QueueScreen). Out-of-range indices are a no-op.
   * @param {number} fromIndex
   * @param {number} toIndex
   */
  reorderPriorityQueue(fromIndex, toIndex) {
    const updated = moveItem(this.priorityQueue, fromIndex, toIndex);
    if (!updated) {
      return;
    }

    this.priorityQueue = updated;
    this.persistQueueState();
    this.notifyListeners();
  }

  /**
   * Remove one track from the priority queue by index.
   * @param {number} index
   */
  removePriorityTrack(index) {
    if (index < 0 || index >= this.priorityQueue.length) {
      return;
    }

    const updated = [...this.priorityQueue];
    updated.splice(index, 1);
    this.priorityQueue = updated;
    this.persistQueueState();
    this.notifyListeners();
  }

  /**
   * Append a single track to the end of the context queue.
   *
   * No longer wired to any UI: the "Add last" surfaces used to call this,
   * which put the track behind the rest of the current album/playlist
   * instead of at the back of the user's queue — they now use
   * {@link AudioPlayerService#insertIntoPriorityQueue}. Kept as a queue
   * primitive.
   * @param {Object} track
   */
  appendToContextQueue(track) {
    if (!track) return;
    this.playlist = [...this.playlist, track];
    this.persistQueueState();
    this.notifyListeners();
  }

  /**
   * Insert a single track into the priority queue.
   * @param {Object} track
   * @param {number} [targetIndex] Insertion position; defaults to the end,
   *   clamped into range. Pass 0 for "play next".
   */
  insertIntoPriorityQueue(track, targetIndex = this.priorityQueue.length) {
    if (!track) {
      return;
    }

    const clampedIndex = Math.max(0, Math.min(targetIndex, this.priorityQueue.length));
    const updated = [...this.priorityQueue];
    updated.splice(clampedIndex, 0, track);
    this.priorityQueue = updated;
    this.persistQueueState();
    this.notifyListeners();
  }

  /**
   * Prepend an ordered set of tracks to the priority queue ("Queue first"
   * on a whole album or artist). Exists as a bulk operation because looping
   * `insertIntoPriorityQueue(track, 0)` would reverse the order and notify
   * listeners once per track.
   * @param {Object[]} tracks
   */
  queueTracksNext(tracks) {
    if (!Array.isArray(tracks) || tracks.length === 0) {
      return;
    }

    this.priorityQueue = [...tracks, ...this.priorityQueue];
    this.persistQueueState();
    this.notifyListeners();
  }

  /**
   * Append an ordered set of tracks to the end of the priority queue
   * ("Queue last" on a whole album or artist). Previously appended to the
   * context queue, which buried the tracks behind the rest of the current
   * album/playlist instead of placing them at the back of the user's queue.
   * @param {Object[]} tracks
   */
  queueTracksLast(tracks) {
    if (!Array.isArray(tracks) || tracks.length === 0) {
      return;
    }

    this.priorityQueue = [...this.priorityQueue, ...tracks];
    this.persistQueueState();
    this.notifyListeners();
  }

  /**
   * Reorder the *upcoming* portion of the context queue (drag reorder in
   * QueueScreen). Indices are relative to the upcoming list — i.e. 0 is the
   * track after the current one; already-played tracks are untouched.
   * @param {number} fromIndex
   * @param {number} toIndex
   */
  reorderContextQueue(fromIndex, toIndex) {
    const upcoming = this.getUpcomingContextTracks();
    const updatedUpcoming = moveItem(upcoming, fromIndex, toIndex);
    if (!updatedUpcoming) {
      return;
    }

    this.playlist = [
      ...this.playlist.slice(0, this.currentIndex + 1),
      ...updatedUpcoming,
    ];

    this.persistQueueState();
    this.notifyListeners();
  }

  /**
   * Move an upcoming context-queue track into the priority queue (dragging
   * a row across the queue boundary in QueueScreen).
   * @param {number} relativeIndex Index within the upcoming context tracks
   *   (0 = the track after the current one).
   * @param {number} [priorityIndex] Insertion position in the priority
   *   queue; defaults to the end, clamped into range.
   */
  moveContextTrackToPriority(relativeIndex, priorityIndex = this.priorityQueue.length) {
    if (relativeIndex < 0) {
      return;
    }

    const absoluteIndex = this.currentIndex + 1 + relativeIndex;
    if (absoluteIndex < 0 || absoluteIndex >= this.playlist.length) {
      return;
    }

    const updatedPlaylist = [...this.playlist];
    const [track] = updatedPlaylist.splice(absoluteIndex, 1);
    if (!track) {
      return;
    }
    this.playlist = updatedPlaylist;

    const clampedIndex = Math.max(0, Math.min(priorityIndex, this.priorityQueue.length));
    const updatedPriority = [...this.priorityQueue];
    updatedPriority.splice(clampedIndex, 0, track);
    this.priorityQueue = updatedPriority;

    this.persistQueueState();
    this.notifyListeners();
  }

  /**
   * Toggle shuffle for the *upcoming* context tracks. Turning shuffle on
   * snapshots the current upcoming order (`originalUpcoming`) and shuffles
   * in place; turning it off restores the snapshot, keeping only tracks
   * still present in the queue. Already-played tracks are never reordered.
   */
  toggleShuffle() {
    const upcoming = this.playlist.slice(this.currentIndex + 1);

    if (!this.shuffle) {
      this.originalUpcoming = [...upcoming];
      this.playlist = [
        ...this.playlist.slice(0, this.currentIndex + 1),
        ...shuffleArray([...upcoming]),
      ];
      this.shuffle = true;
    } else {
      if (this.originalUpcoming.length > 0) {
        const upcomingIds = new Set(upcoming.map(t => t?.id).filter(Boolean));
        const restored = this.originalUpcoming.filter(t => t?.id && upcomingIds.has(t.id));
        this.playlist = [
          ...this.playlist.slice(0, this.currentIndex + 1),
          ...restored,
        ];
      }
      this.shuffle = false;
      this.originalUpcoming = [];
    }

    this.persistQueueState();
    this.notifyListeners();
  }

  /** Cycle the repeat mode: none → all → one → none. */
  cycleRepeatMode() {
    const next = { none: 'all', all: 'one', one: 'none' };
    this.repeatMode = next[this.repeatMode] ?? 'none';
    this.persistQueueState();
    this.notifyListeners();
  }

  /**
   * @returns {Object[]} The context-queue tracks after the current one
   *   (empty when at the end or when no queue is loaded).
   */
  getUpcomingContextTracks() {
    if (!Array.isArray(this.playlist) || this.playlist.length === 0) {
      return [];
    }

    return this.playlist.slice(Math.min(this.currentIndex + 1, this.playlist.length));
  }

  /**
   * Snapshot of the full playback state, as delivered to listeners.
   *
   * @returns {{
   *   currentTrack: ?Object,
   *   isPlaying: boolean,
   *   isBuffering: boolean,
   *   position: number,
   *   duration: number,
   *   isLoading: boolean,
   *   playlist: Object[],
   *   currentIndex: number,
   *   priorityQueue: Object[],
   *   contextQueue: { name: ?string, type: ?string, id: ?string },
   *   currentTrackSource: string,
   *   shuffle: boolean,
   *   repeatMode: string,
   * }} Positions/durations are in milliseconds; `currentTrackSource` is
   *   `'context' | 'priority'`; `repeatMode` is `'none' | 'all' | 'one'`.
   */
  getCurrentState() {
    return {
      currentTrack: this.currentTrack,
      isPlaying: this.isPlaying,
      isBuffering: this.isBuffering,
      position: this.position,
      duration: this.duration,
      isLoading: this.isLoading,
      playlist: this.playlist,
      currentIndex: this.currentIndex,
      priorityQueue: this.priorityQueue,
      contextQueue: this.contextQueue,
      currentTrackSource: this.currentTrackSource,
      shuffle: this.shuffle,
      repeatMode: this.repeatMode,
    };
  }

  /**
   * Persist queue/shuffle/repeat state to AsyncStorage (fire-and-forget;
   * failures are logged, never thrown).
   */
  persistQueueState() {
    try {
      const entries = [
        [PRIORITY_QUEUE_KEY, JSON.stringify(this.priorityQueue)],
        [CONTEXT_QUEUE_KEY, JSON.stringify(this.contextQueue)],
        [CURRENT_TRACK_SOURCE_KEY, this.currentTrackSource || 'context'],
        [SHUFFLE_KEY, this.shuffle ? 'true' : 'false'],
        [REPEAT_MODE_KEY, this.repeatMode],
      ];

      AsyncStorage.multiSet(entries).catch(error => {
        console.warn('Failed to persist queue state:', error);
      });
    } catch (error) {
      console.warn('Unexpected error while persisting queue state:', error);
    }
  }

  /**
   * Format a duration for display.
   * @param {number} milliseconds
   * @returns {string} `m:ss`, e.g. `3:07`.
   */
  formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

/**
 * Return a copy of `array` with the item at `fromIndex` moved to `toIndex`
 * (clamped into range), or null when the inputs are invalid — callers treat
 * null as "leave the queue unchanged".
 *
 * @param {Array} array
 * @param {number} fromIndex
 * @param {number} toIndex
 * @returns {?Array}
 */
const moveItem = (array, fromIndex, toIndex) => {
  if (!Array.isArray(array) || array.length === 0) {
    return null;
  }

  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) {
    return null;
  }

  if (fromIndex < 0 || fromIndex >= array.length) {
    return null;
  }

  const clampedToIndex = Math.max(0, Math.min(toIndex, array.length - 1));
  const updated = [...array];
  const [item] = updated.splice(fromIndex, 1);

  updated.splice(clampedToIndex, 0, item);
  return updated;
};

export default new AudioPlayerService();
