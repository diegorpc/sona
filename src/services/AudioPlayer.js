import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import AsyncStorage from '@react-native-async-storage/async-storage';
import SubsonicAPI from './SubsonicAPI';

const PRIORITY_QUEUE_KEY = 'audioPlayerPriorityQueue';
const QUEUE_CONTEXT_KEY = 'audioPlayerQueueContext';
const CURRENT_TRACK_SOURCE_KEY = 'audioPlayerCurrentTrackSource';

class AudioPlayerService {
  constructor() {
    this.sound = null;
    this.currentTrack = null;
    this.playlist = [];
    this.currentIndex = 0;
    this.isPlaying = false;
    this.position = 0;
    this.duration = 0;
    this.isLoading = false;
    this.listeners = [];
    this.priorityQueue = [];
    this.queueContext = {
      name: null,
      type: null,
      id: null,
    };
    this.currentTrackSource = 'context';
    this.statusTimer = null;
    this.statusUpdateCount = 0;

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
      position: this.position,
      duration: this.duration,
      isLoading: this.isLoading,
      playlist: this.playlist,
      currentIndex: this.currentIndex,
      priorityQueue: this.priorityQueue,
      queueContext: this.queueContext,
      currentTrackSource: this.currentTrackSource,
    };

    this.listeners.forEach(listener => listener(state));
  }

  async playTrack(track, playlist = null, index = 0, options = {}) {
    if (!track) {
      return;
    }

    try {
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
          this.queueContext = {
            name: contextName,
            type: contextType,
            id: contextId,
          };
          this.currentTrackSource = contextSource || 'context';
        } else if (!Array.isArray(this.playlist) || this.playlist.length === 0) {
          this.playlist = [track];
          this.currentIndex = 0;
          this.queueContext = {
            name: contextName,
            type: contextType,
            id: contextId,
          };
          this.currentTrackSource = contextSource || 'context';
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
      this.duration = 0;
      this.isLoading = true;
      this.isPlaying = false;

      this.notifyListeners();

      await AsyncStorage.multiSet([
        ['currentTrack', JSON.stringify(track)],
        ['currentPlaylist', JSON.stringify(this.playlist)],
        ['currentIndex', this.currentIndex.toString()],
        ['currentPosition', '0'],
        ['isPlaying', 'false'],
      ]);

      this.persistQueueState();

      const streamUrl = SubsonicAPI.getStreamUrl(track.id);

      this.sound = createAudioPlayer(
        { uri: streamUrl },
        {
          loop: false,
          volume: 1.0,
        }
      );

      this.setupAudioPlayerListeners();

      this.sound.play();
      this.isPlaying = true;
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
      return;
    }

    if (this.statusTimer) {
      this.clearStatusTimer();
    }

    this.statusUpdateCount = 0;
    this.statusTimer = setInterval(() => {
      if (!this.sound) {
        return;
      }

      this.position = this.sound.currentTime * 1000;
      this.duration = this.sound.duration * 1000;
      this.isPlaying = this.sound.playing;

      const trackEnded =
        Number.isFinite(this.sound.duration) &&
        this.sound.duration > 0 &&
        this.sound.currentTime >= this.sound.duration;

      if (trackEnded) {
        this.onTrackFinished();
      }

      if (this.statusUpdateCount % 50 === 0) {
        this.saveCurrentState();
      }

      this.statusUpdateCount = (this.statusUpdateCount || 0) + 1;
      this.notifyListeners();
    }, 100);
  }

  clearStatusTimer() {
    if (this.statusTimer) {
      clearInterval(this.statusTimer);
      this.statusTimer = null;
    }
  }

  async onTrackFinished() {
    try {
      if (this.currentTrack) {
        await SubsonicAPI.scrobble(this.currentTrack.id, true);
      }
      await this.playNext();
    } catch (error) {
      console.error('Error handling track completion:', error);
    }
  }

  async initializeTrackForPlayback(track, position = 0, shouldPlay = false) {
    if (!track) {
      return;
    }

    try {
      this.isLoading = true;
      this.notifyListeners();

      await this.stopCurrentTrack();

      const streamUrl = SubsonicAPI.getStreamUrl(track.id);
      this.sound = createAudioPlayer(
        { uri: streamUrl },
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
      } else {
        this.isPlaying = false;
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
    if (!this.sound) {
      if (this.currentTrack) {
        await this.initializeTrackForPlayback(this.currentTrack, this.position, true);
      } else {
        console.warn('No current track available to toggle playback.');
      }
      return;
    }

    try {
      if (this.isPlaying) {
        this.sound.pause();
        this.isPlaying = false;
        await AsyncStorage.setItem('isPlaying', 'false');
      } else {
        this.sound.play();
        this.isPlaying = true;
        await AsyncStorage.setItem('isPlaying', 'true');
      }

      this.notifyListeners();
    } catch (error) {
      console.error('Error toggling play/pause:', error);
      if (this.currentTrack) {
        await this.initializeTrackForPlayback(this.currentTrack, this.position, !this.isPlaying);
      }
    }
  }

  async playNext() {
    if (this.priorityQueue.length > 0) {
      const nextPriorityTrack = this.priorityQueue.shift();
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
      return;
    }

    const nextIndex = this.currentIndex + 1;
    if (nextIndex >= this.playlist.length) {
      await this.stop();
      return;
    }

    const nextTrack = this.playlist[nextIndex];
    if (nextTrack) {
      await this.playTrack(nextTrack, this.playlist, nextIndex, {
        contextName: this.queueContext?.name,
        contextType: this.queueContext?.type,
        contextId: this.queueContext?.id,
        contextSource: 'context',
      });
    }
  }

  async playPrevious() {
    if (!Array.isArray(this.playlist) || this.playlist.length === 0) {
      return;
    }

    const previousIndex = this.currentIndex - 1;
    if (previousIndex < 0) {
      return;
    }

    const previousTrack = this.playlist[previousIndex];
    if (previousTrack) {
      await this.playTrack(previousTrack, this.playlist, previousIndex, {
        contextName: this.queueContext?.name,
        contextType: this.queueContext?.type,
        contextId: this.queueContext?.id,
        contextSource: 'context',
      });
    }
  }

  async seekTo(positionMillis) {
    if (!this.sound) {
      return;
    }

    try {
      this.sound.seekTo(positionMillis / 1000);
      this.position = positionMillis;
      this.notifyListeners();
    } catch (error) {
      console.error('Error seeking within track:', error);
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

    try {
      if (this.isPlaying) {
        this.sound.pause();
      }

      this.clearStatusTimer();

      await new Promise(resolve => setTimeout(resolve, 50));

      this.sound.remove();
      this.sound = null;
      this.isPlaying = false;
    } catch (error) {
      console.error('Error stopping current track:', error);
      this.sound = null;
      this.isPlaying = false;
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
        QUEUE_CONTEXT_KEY,
        CURRENT_TRACK_SOURCE_KEY,
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

      if (store[QUEUE_CONTEXT_KEY]) {
        try {
          const parsedContext = JSON.parse(store[QUEUE_CONTEXT_KEY]);
          if (parsedContext && typeof parsedContext === 'object') {
            this.queueContext = {
              name: parsedContext.name ?? null,
              type: parsedContext.type ?? null,
              id: parsedContext.id ?? null,
            };
          }
        } catch (error) {
          console.warn('Failed to parse saved queue context:', error);
        }
      }

      if (typeof store[CURRENT_TRACK_SOURCE_KEY] === 'string') {
        this.currentTrackSource = store[CURRENT_TRACK_SOURCE_KEY] || 'context';
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

    this.priorityQueue.splice(index, 1);
    this.persistQueueState();
    this.notifyListeners();
  }

  insertIntoPriorityQueue(track, targetIndex = this.priorityQueue.length) {
    if (!track) {
      return;
    }

    const clampedIndex = Math.max(0, Math.min(targetIndex, this.priorityQueue.length));
    this.priorityQueue.splice(clampedIndex, 0, track);
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

    const [track] = this.playlist.splice(absoluteIndex, 1);
    if (!track) {
      return;
    }

    const clampedIndex = Math.max(0, Math.min(priorityIndex, this.priorityQueue.length));
    this.priorityQueue.splice(clampedIndex, 0, track);

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
      position: this.position,
      duration: this.duration,
      isLoading: this.isLoading,
      playlist: this.playlist,
      currentIndex: this.currentIndex,
      priorityQueue: this.priorityQueue,
      queueContext: this.queueContext,
      currentTrackSource: this.currentTrackSource,
    };
  }

  persistQueueState() {
    try {
      const entries = [
        [PRIORITY_QUEUE_KEY, JSON.stringify(this.priorityQueue)],
        [QUEUE_CONTEXT_KEY, JSON.stringify(this.queueContext)],
        [CURRENT_TRACK_SOURCE_KEY, this.currentTrackSource || 'context'],
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
