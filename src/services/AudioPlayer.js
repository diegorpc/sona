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
      // Properly stop and cleanup current track if playing
      await this.stopCurrentTrack();

      // Set up new track
      this.currentTrack = track;
      if (playlist) {
        this.playlist = playlist;
        this.currentIndex = index;
      } else {
        this.playlist = [track];
        this.currentIndex = 0;
      }

      // Reset position and set loading state
      this.position = 0;
      this.duration = 0;
      this.isLoading = true;
      this.isPlaying = false;

      // Notify listeners immediately so UI shows new track info
      this.notifyListeners();

      console.log(`Loading new track: ${track.title} by ${track.artist}`);

      // Save track info immediately so it persists even if loading fails
      await AsyncStorage.setItem('currentTrack', JSON.stringify(track));
      await AsyncStorage.setItem('currentPlaylist', JSON.stringify(this.playlist));
      await AsyncStorage.setItem('currentIndex', this.currentIndex.toString());
      await AsyncStorage.setItem('currentPosition', '0');
      await AsyncStorage.setItem('isPlaying', 'false'); // Will be updated to true after loading

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

      // Update playing state after successful load
      await AsyncStorage.setItem('isPlaying', 'true');

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
    if (this.statusTimer) {
      this.clearStatusTimer();
    }
    this.statusUpdateCount = 0;
    this.statusTimer = setInterval(() => {
      if (this.sound) {
        this.position = this.sound.currentTime * 1000; 
        this.duration = this.sound.duration * 1000; 
        this.isPlaying = this.sound.playing;

        // Check if track finished
        if (this.sound.currentTime >= this.sound.duration && this.sound.duration > 0) {
          this.onTrackFinished();
        }

        // Save state periodically (every 5 seconds)
        if (this.statusUpdateCount % 50 === 0) {
          this.saveCurrentState();
        }
        this.statusUpdateCount = (this.statusUpdateCount || 0) + 1;

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

  // Initialize track for playback (used for restoring saved state)
  async initializeTrackForPlayback(track, position = 0, shouldPlay = false) {
    try {
      this.isLoading = true;
      this.notifyListeners();

      // Properly stop current track if playing
      await this.stopCurrentTrack();

      // Get stream URL
      const streamUrl = SubsonicAPI.getStreamUrl(track.id);

      // Create audio player
      this.sound = createAudioPlayer({ uri: streamUrl }, {
        loop: false,
        volume: 1.0,
      });

      // Set up status monitoring
      this.setupAudioPlayerListeners();

      // Seek to saved position if provided
      if (position > 0) {
        const positionSeconds = position / 1000;
        this.sound.seekTo(positionSeconds);
      }

      // Start playback if it was playing before
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
      // If no sound is loaded but we have a current track, initialize it
      if (this.currentTrack) {
        console.log('No audio player loaded, initializing track for playback...');
        await this.initializeTrackForPlayback(this.currentTrack, this.position, true);
        return;
      }
      console.warn('No current track available to play');
      return;
    }

    try {
      if (this.isPlaying) {
        this.sound.pause();
        await AsyncStorage.setItem('isPlaying', 'false');
        console.log('Playback paused');
      } else {
        this.sound.play();
        await AsyncStorage.setItem('isPlaying', 'true');
        console.log('Playback resumed');
      }
    } catch (error) {
      console.error('Error toggling play/pause:', error);
      // If the sound object is corrupted, try to reinitialize
      if (this.currentTrack) {
        console.log('Attempting to reinitialize audio player...');
        await this.initializeTrackForPlayback(this.currentTrack, this.position, !this.isPlaying);
      }
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
      this.position = positionMillis;
      this.notifyListeners();
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

  // Internal method to stop current track without clearing track info
  async stopCurrentTrack() {
    if (this.sound) {
      try {
        // Pause first to stop audio immediately
        if (this.isPlaying) {
          this.sound.pause();
        }
        
        // Clear the status timer to prevent updates
        this.clearStatusTimer();
        
        // Wait a brief moment to ensure pause takes effect
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Remove the audio player instance
        this.sound.remove();
        this.sound = null;
        
        // Reset playing state
        this.isPlaying = false;
        
        console.log('Previous track stopped successfully');
      } catch (error) {
        console.error('Error stopping current track:', error);
        // Force cleanup even if there's an error
        this.sound = null;
        this.isPlaying = false;
        this.clearStatusTimer();
      }
    }
  }

  // Stop playback
  async stop() {
    if (this.sound) {
      try {
        await this.stopCurrentTrack();
        this.position = 0;
        await AsyncStorage.setItem('isPlaying', 'false');
        await AsyncStorage.setItem('currentPosition', '0');
        this.notifyListeners();
      } catch (error) {
        console.error('Error stopping playback:', error);
      }
    }
  }

  // Save current state to AsyncStorage
  async saveCurrentState() {
    try {
      if (this.currentTrack) {
        await AsyncStorage.setItem('currentPosition', this.position.toString());
        await AsyncStorage.setItem('isPlaying', this.isPlaying.toString());
      }
    } catch (error) {
      console.error('Error saving current state:', error);
    }
  }

  // Load saved state
  async loadSavedState() {
    try {
      const savedTrack = await AsyncStorage.getItem('currentTrack');
      const savedPlaylist = await AsyncStorage.getItem('currentPlaylist');
      const savedIndex = await AsyncStorage.getItem('currentIndex');
      const savedPosition = await AsyncStorage.getItem('currentPosition');
      const savedIsPlaying = await AsyncStorage.getItem('isPlaying');

      if (savedTrack && savedPlaylist) {
        this.currentTrack = JSON.parse(savedTrack);
        this.playlist = JSON.parse(savedPlaylist);
        this.currentIndex = parseInt(savedIndex || '0');
        
        // Restore the audio player with the saved track
        await this.initializeTrackForPlayback(
          this.currentTrack, 
          parseInt(savedPosition || '0'),
          savedIsPlaying === 'true'
        );
        
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
