import { Audio } from 'expo-av';
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
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
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
        await this.sound.unloadAsync();
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

      // Create and load sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: streamUrl },
        { 
          shouldPlay: true,
          isLooping: false,
          volume: 1.0,
        },
        this.onPlaybackStatusUpdate.bind(this)
      );

      this.sound = sound;
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

  onPlaybackStatusUpdate(status) {
    if (status.isLoaded) {
      this.position = status.positionMillis || 0;
      this.duration = status.durationMillis || 0;
      this.isPlaying = status.isPlaying || false;

      if (status.didJustFinish) {
        this.onTrackFinished();
      }

      this.notifyListeners();
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
        await this.sound.pauseAsync();
      } else {
        await this.sound.playAsync();
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
      await this.sound.setPositionAsync(positionMillis);
    } catch (error) {
      console.error('Error seeking:', error);
    }
  }

  // Set volume
  async setVolume(volume) {
    if (!this.sound) return;

    try {
      await this.sound.setVolumeAsync(volume);
    } catch (error) {
      console.error('Error setting volume:', error);
    }
  }

  // Stop playback
  async stop() {
    if (this.sound) {
      try {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
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
