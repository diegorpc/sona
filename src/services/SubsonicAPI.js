import axios from 'axios';
import CryptoJS from 'crypto-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

class SubsonicAPI {
  constructor() {
    this.baseUrl = '';
    this.username = '';
    this.password = '';
    this.salt = '';
    this.token = '';
    this.version = '1.16.1';
    this.client = 'Sona';
  }

  // Initialize API with server configuration
  async initialize(serverUrl, username, password) {
    this.baseUrl = serverUrl.endsWith('/') ? serverUrl + 'rest' : serverUrl + '/rest';
    this.username = username;
    this.password = password;
    this.salt = this.generateSalt();
    this.token = CryptoJS.MD5(password + this.salt).toString();

    // Save configuration
    const config = {
      serverUrl,
      username,
      password,
    };
    await AsyncStorage.setItem('serverConfig', JSON.stringify(config));
  }

  // Load configuration from storage
  async loadConfiguration() {
    try {
      const config = await AsyncStorage.getItem('serverConfig');
      if (config) {
        const { serverUrl, username, password } = JSON.parse(config);
        await this.initialize(serverUrl, username, password);
        return true;
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
    }
    return false;
  }

  // Generate random salt for authentication
  generateSalt() {
    return Math.random().toString(36).substring(2, 15);
  }

  // Build API URL with authentication parameters
  buildUrl(endpoint, params = {}) {
    const baseParams = {
      u: this.username,
      t: this.token,
      s: this.salt,
      v: this.version,
      c: this.client,
      f: 'json',
      ...params,
    };

    const queryString = Object.keys(baseParams)
      .map(key => `${key}=${encodeURIComponent(baseParams[key])}`)
      .join('&');

    return `${this.baseUrl}/${endpoint}?${queryString}`;
  }

  // Generic API request method
  async request(endpoint, params = {}) {
    try {
      const url = this.buildUrl(endpoint, params);
      const response = await axios.get(url);
      
      if (response.data['subsonic-response'].status === 'ok') {
        return response.data['subsonic-response'];
      } else {
        throw new Error(response.data['subsonic-response'].error.message);
      }
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  // Test server connection
  async ping() {
    return await this.request('ping');
  }

  // Get all artists
  async getArtists() {
    const response = await this.request('getArtists');
    return response.artists;
  }

  // Get artist info and albums
  async getArtist(artistId) {
    const response = await this.request('getArtist', { id: artistId });
    return response.artist;
  }

  // Get artist image URL
  async getArtistImage(artistId) {
    const response = await this.request('getArtistInfo', { id: artistId });
    const artistInfo = response?.artistInfo;

    if (!artistInfo) {
      return null;
    }

    const imageKeys = ['largeImageUrl', 'mediumImageUrl', 'smallImageUrl'];
    for (const key of imageKeys) {
      const value = artistInfo[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          return trimmed;
        }
      }
    }

    return null;
  }

  // Get album info and tracks
  async getAlbum(albumId) {
    const response = await this.request('getAlbum', { id: albumId });
    return response.album;
  }

  // Get paginated album lists with sorting
  async getAlbumList(type = 'alphabeticalByName', size = 50, offset = 0) {
    const params = { type, size };
    if (offset) params.offset = offset;

    const response = await this.request('getAlbumList2', params);
    return response.albumList2?.album || [];
  }

  // Search for music
  async search(query, artistCount = 20, albumCount = 20, songCount = 50) {
    const response = await this.request('search3', {
      query,
      artistCount,
      albumCount,
      songCount,
    });
    return response.searchResult3;
  }

  // Get random songs
  async getRandomSongs(size = 50, genre = '', fromYear = '', toYear = '') {
    const params = { size };
    if (genre) params.genre = genre;
    if (fromYear) params.fromYear = fromYear;
    if (toYear) params.toYear = toYear;

    const response = await this.request('getRandomSongs', params);
    return response.randomSongs;
  }

  // Get paginated song lists with sorting
  async getSongList(type = 'alphabeticalByName', size = 50, offset = 0) {
    const params = { type, size };
    if (offset) params.offset = offset;

    const response = await this.request('getSongList2', params);
    return response.songList2?.song || [];
  }

  // Get playlists
  async getPlaylists() {
    const response = await this.request('getPlaylists');
    return response.playlists;
  }

  // Get playlist
  async getPlaylist(playlistId) {
    const response = await this.request('getPlaylist', { id: playlistId });
    return response.playlist;
  }

  // Get stream URL for a song
  getStreamUrl(songId, maxBitRate = null) {
    const params = { id: songId };
    if (maxBitRate) params.maxBitRate = maxBitRate;
    return this.buildUrl('stream', params);
  }

  // Get cover art URL
  getCoverArtUrl(coverArtId, size = 300) {
    return this.buildUrl('getCoverArt', { id: coverArtId, size });
  }

  // Scrobble (mark as played)
  async scrobble(songId, submission = true) {
    const params = {
      id: songId,
      submission,
      time: Date.now(),
    };
    return await this.request('scrobble', params);
  }

  // Star/unstar item
  async star(id, albumId = null, artistId = null) {
    const params = {};
    if (id) params.id = id;
    if (albumId) params.albumId = albumId;
    if (artistId) params.artistId = artistId;
    return await this.request('star', params);
  }

  async unstar(id, albumId = null, artistId = null) {
    const params = {};
    if (id) params.id = id;
    if (albumId) params.albumId = albumId;
    if (artistId) params.artistId = artistId;
    return await this.request('unstar', params);
  }

  // Get starred items
  async getStarred() {
    const response = await this.request('getStarred');
    return response.starred;
  }

  // Generate playlist collage image from first 4 distinct albums
  async generatePlaylistCollage(playlistId, size = 50) {
    try {
      // Get playlist details with songs
      const playlist = await this.getPlaylist(playlistId);
      if (!playlist || !playlist.entry || playlist.entry.length === 0) {
        return null;
      }

      // Extract unique album cover art IDs from songs
      const albumCoverArtIds = [];
      const seenCoverArtIds = new Set();
      const seenAlbumIds = new Set(); // Also track by album ID to avoid duplicates
      
      for (const song of playlist.entry) {
        // Check both coverArt ID and albumId to ensure true uniqueness
        const coverArtId = song.coverArt;
        const albumId = song.albumId;
        
        if (coverArtId && 
            !seenCoverArtIds.has(coverArtId) && 
            (!albumId || !seenAlbumIds.has(albumId))) {
          seenCoverArtIds.add(coverArtId);
          if (albumId) seenAlbumIds.add(albumId);
          albumCoverArtIds.push(coverArtId);
          
          // Stop at 4 unique albums for collage
          if (albumCoverArtIds.length >= 4) {
            break;
          }
        }
      }

      // If no cover art found, return null
      if (albumCoverArtIds.length === 0) {
        return null;
      }

      // If only one album, return that album's cover art
      if (albumCoverArtIds.length === 1) {
        const singleCoverSize = Math.max(200, size);
        return this.getCoverArtUrl(albumCoverArtIds[0], singleCoverSize);
      }

      // For 2-4 albums, create a collage data structure
      // Return an object that can be used to create a collage
      const collageData = {
        type: 'collage',
        albumCount: albumCoverArtIds.length,
        coverArtUrls: albumCoverArtIds.map(id => this.getCoverArtUrl(id, size)),
        size: size
      };

      return collageData;
    } catch (error) {
      console.error('Error generating playlist collage:', error);
      return null;
    }
  }

  // Logout and clear stored configuration
  async logout() {
    await AsyncStorage.removeItem('serverConfig');
    this.baseUrl = '';
    this.username = '';
    this.password = '';
    this.salt = '';
    this.token = '';
  }
}

// Export singleton instance
export default new SubsonicAPI();
