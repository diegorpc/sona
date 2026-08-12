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

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

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

  addListener(listener) {
    this.listeners.push(listener);
  }

  removeListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  notifyListeners() {
    const state = {
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

    this.listeners.forEach(listener => listener(state));
  }

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

  clearStatusTimer() {
    if (this.statusTimer) {
      console.log('[AudioPlayer] Clearing status timer');
      clearInterval(this.statusTimer);
      this.statusTimer = null;
      this.trackEndedFlag = false;
    }
  }

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

  // Prefer a cached local file; otherwise stream (transcoded to MP3 320 kbps
  // unless original-quality streaming is enabled in settings).
  async resolveSourceUri(trackId) {
    const cachedUri = await SongCache.getCachedUri(trackId).catch(() => null);
    if (cachedUri) return cachedUri;
    const settings = await getAppSettings();
    return SubsonicAPI.getStreamUrl(
      trackId,
      settings.originalQualityStreaming ? {} : { format: 'mp3', maxBitRate: 320 }
    );
  }

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

  async setVolume(volume) {
    if (!this.sound) {
      return;
    }

    try {
      this.sound.volume = volume;
    } catch (error) {
      console.error('Error setting volume:', error);
    }
  }

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

  setPriorityQueue(newQueue = []) {
    if (!Array.isArray(newQueue)) {
      return;
    }

    this.priorityQueue = [...newQueue];
    this.persistQueueState();
    this.notifyListeners();
  }

  reorderPriorityQueue(fromIndex, toIndex) {
    const updated = moveItem(this.priorityQueue, fromIndex, toIndex);
    if (!updated) {
      return;
    }

    this.priorityQueue = updated;
    this.persistQueueState();
    this.notifyListeners();
  }

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

  appendToContextQueue(track) {
    if (!track) return;
    this.playlist = [...this.playlist, track];
    this.persistQueueState();
    this.notifyListeners();
  }

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

  queueTracksNext(tracks) {
    if (!Array.isArray(tracks) || tracks.length === 0) {
      return;
    }

    this.priorityQueue = [...tracks, ...this.priorityQueue];
    this.persistQueueState();
    this.notifyListeners();
  }

  queueTracksLast(tracks) {
    if (!Array.isArray(tracks) || tracks.length === 0) {
      return;
    }

    this.playlist = [...this.playlist, ...tracks];
    this.persistQueueState();
    this.notifyListeners();
  }

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

  toggleRepeatAll() {
    this.repeatMode = this.repeatMode === 'all' ? 'none' : 'all';
    this.persistQueueState();
    this.notifyListeners();
  }

  toggleRepeatOne() {
    this.repeatMode = this.repeatMode === 'one' ? 'none' : 'one';
    this.persistQueueState();
    this.notifyListeners();
  }

  // Cycles: none → all → one → none
  cycleRepeatMode() {
    const next = { none: 'all', all: 'one', one: 'none' };
    this.repeatMode = next[this.repeatMode] ?? 'none';
    this.persistQueueState();
    this.notifyListeners();
  }

  getUpcomingContextTracks() {
    if (!Array.isArray(this.playlist) || this.playlist.length === 0) {
      return [];
    }

    return this.playlist.slice(Math.min(this.currentIndex + 1, this.playlist.length));
  }

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

  formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

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
