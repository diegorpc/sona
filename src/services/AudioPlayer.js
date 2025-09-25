import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import AsyncStorage from '@react-native-async-storage/async-storage';
import SubsonicAPI from './SubsonicAPI';

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
      console.error('Error initializing audio:', error);
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
    };
    
    this.listeners.forEach(listener => listener(state));
  }

  // Load and play a track
  async playTrack(track, playlist = null, index = 0) {
    try {
      this.isLoading = true;
      this.notifyListeners();

      // Stop current track if playing
      if (this.sound) {
        this.clearStatusTimer();
        this.sound.remove();
        this.sound = null;
      }

      // Set up new track
      this.currentTrack = track;
      if (playlist) {
        this.playlist = playlist;
        this.currentIndex = index;
      } else {
        this.playlist = [track];
        this.currentIndex = 0;
      }

      // Get stream URL
      const streamUrl = SubsonicAPI.getStreamUrl(track.id);

      // Create audio player
      this.sound = createAudioPlayer({ uri: streamUrl }, {
        loop: false,
        volume: 1.0,
      });

      // Set up status monitoring
      this.setupAudioPlayerListeners();

      // Start playback
      this.sound.play();
      this.isPlaying = true;
      this.isLoading = false;

      await AsyncStorage.setItem('currentTrack', JSON.stringify(track));
      await AsyncStorage.setItem('currentPlaylist', JSON.stringify(this.playlist));
      await AsyncStorage.setItem('currentIndex', this.currentIndex.toString());

      // scrobble
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
    if (!this.sound) return;

    // Set up a timer to monitor playback status
    this.statusTimer = setInterval(() => {
      if (this.sound) {
        this.position = this.sound.currentTime * 1000; 
        this.duration = this.sound.duration * 1000; 
        this.isPlaying = this.sound.playing;

        // Check if track finished
        if (this.sound.currentTime >= this.sound.duration && this.sound.duration > 0) {
          this.onTrackFinished();
        }

        this.notifyListeners();
      }
    }, 100); // Update 
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
      console.error('Error handling track finish:', error);
    }
  }

  async togglePlayPause() {
    if (!this.sound) return;

    try {
      if (this.isPlaying) {
        this.sound.pause();
      } else {
        this.sound.play();
      }
    } catch (error) {
      console.error('Error toggling play/pause:', error);
    }
  }

  async playNext() {
    if (this.playlist.length === 0) return;

    const nextIndex = (this.currentIndex + 1) % this.playlist.length;
    const nextTrack = this.playlist[nextIndex];
    
    if (nextTrack) {
      await this.playTrack(nextTrack, this.playlist, nextIndex);
    }
  }

  async playPrevious() {
    if (this.playlist.length === 0) return;

    const prevIndex = this.currentIndex === 0 
      ? this.playlist.length - 1 
      : this.currentIndex - 1;
    const prevTrack = this.playlist[prevIndex];
    
    if (prevTrack) {
      await this.playTrack(prevTrack, this.playlist, prevIndex);
    }
  }

  // Seek to position
  async seekTo(positionMillis) {
    if (!this.sound) return;

    try {
      const positionSeconds = positionMillis / 1000;
      this.sound.seekTo(positionSeconds);
    } catch (error) {
      console.error('Error seeking:', error);
    }
  }

  // Set volume
  async setVolume(volume) {
    if (!this.sound) return;

    try {
      this.sound.volume = volume;
    } catch (error) {
      console.error('Error setting volume:', error);
    }
  }

  // Stop playback
  async stop() {
    if (this.sound) {
      try {
        this.sound.pause();
        this.clearStatusTimer();
        this.sound.remove();
        this.sound = null;
        this.isPlaying = false;
        this.position = 0;
        this.notifyListeners();
      } catch (error) {
        console.error('Error stopping playback:', error);
      }
    }
  }

  // Load saved state
  async loadSavedState() {
    try {
      const savedTrack = await AsyncStorage.getItem('currentTrack');
      const savedPlaylist = await AsyncStorage.getItem('currentPlaylist');
      const savedIndex = await AsyncStorage.getItem('currentIndex');

      if (savedTrack && savedPlaylist) {
        this.currentTrack = JSON.parse(savedTrack);
        this.playlist = JSON.parse(savedPlaylist);
        this.currentIndex = parseInt(savedIndex || '0');
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Error loading saved state:', error);
    }
  }

  // Get current state
  getCurrentState() {
    return {
      currentTrack: this.currentTrack,
      isPlaying: this.isPlaying,
      position: this.position,
      duration: this.duration,
      isLoading: this.isLoading,
      playlist: this.playlist,
      currentIndex: this.currentIndex,
    };
  }

  // Format time in MM:SS format
  formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

// Export singleton instance
export default new AudioPlayerService();
