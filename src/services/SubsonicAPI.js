import axios from 'axios';
import CryptoJS from 'crypto-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Subsonic REST API client (protocol v1.16.1), exported as a singleton.
 *
 * Authentication uses the salted-token scheme: `token = MD5(password + salt)`,
 * with a fresh random salt generated on every {@link SubsonicAPI#initialize}
 * call. Because the salt (and therefore every URL's auth params) changes each
 * launch, anything that caches by URL must key on something stable instead —
 * see `artworkCacheKey` in hooks/useArtwork.js.
 *
 * Server credentials are persisted to AsyncStorage under `serverConfig` and
 * restored at launch via {@link SubsonicAPI#loadConfiguration}.
 */
class SubsonicAPI {
  constructor() {
    this.baseUrl = '';
    this.username = '';
    this.password = '';
    this.salt = '';
    this.token = '';
    this.version = '1.16.1';
    this.client = 'sona';
  }

  /**
   * Configure the client for a server and persist the credentials.
   *
   * Regenerates the auth salt/token, so previously issued URLs (streams,
   * cover art) become stale after this call.
   *
   * @param {string} serverUrl Server base URL, with or without trailing slash.
   * @param {string} username
   * @param {string} password Stored in plaintext in AsyncStorage; required to
   *   re-derive the token on each launch.
   * @returns {Promise<void>}
   */
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

  /**
   * Restore the persisted server configuration, if any.
   *
   * @returns {Promise<boolean>} True when a stored config was found and the
   *   client re-initialized from it; false otherwise.
   */
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

  /** @returns {string} Random salt for the MD5 token auth scheme. */
  generateSalt() {
    return Math.random().toString(36).substring(2, 15);
  }

  /**
   * Build a fully authenticated REST URL for an endpoint.
   *
   * @param {string} endpoint Endpoint name, e.g. `'getAlbum'`.
   * @param {Object<string, *>} [params] Endpoint-specific query parameters.
   * @returns {string} Absolute URL including auth + format parameters.
   */
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

  /**
   * Perform a GET request against a Subsonic endpoint.
   *
   * @param {string} endpoint Endpoint name.
   * @param {Object<string, *>} [params] Endpoint-specific query parameters.
   * @returns {Promise<Object>} The unwrapped `subsonic-response` payload.
   * @throws {Error} On network failure, or when the server responds with a
   *   Subsonic-level error status.
   */
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

  /**
   * Connectivity/credentials check.
   * @returns {Promise<Object>} The raw response; resolves iff the server is
   *   reachable and the credentials are valid.
   */
  async ping() {
    return await this.request('ping');
  }

  /**
   * Fetch the full artist list.
   * @returns {Promise<Object>} `artists` object with alphabetical `index`
   *   groups, each containing an `artist` array.
   */
  async getArtists() {
    const response = await this.request('getArtists');
    return response.artists;
  }

  /**
   * Fetch one artist with their albums.
   * @param {string} artistId
   * @returns {Promise<Object>} `artist` object including an `album` array.
   */
  async getArtist(artistId) {
    const response = await this.request('getArtist', { id: artistId });
    return response.artist;
  }

  /**
   * Fetch an artist's photo URL from `getArtistInfo`, preferring the largest
   * available size.
   *
   * Not currently used by the app (artist rows/headers use the artist id as
   * a coverArt id instead) — kept as a ready-made endpoint wrapper.
   *
   * @param {string} artistId
   * @returns {Promise<?string>} Image URL, or null when the server has none.
   */
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

  /**
   * Fetch one album with its tracks.
   * @param {string} albumId
   * @returns {Promise<Object>} `album` object including a `song` array.
   */
  async getAlbum(albumId) {
    const response = await this.request('getAlbum', { id: albumId });
    return response.album;
  }

  /**
   * Fetch one page of the server-sorted album list (`getAlbumList2`).
   *
   * @param {string} [type] Sort/selection type. Valid values: `random`,
   *   `newest`, `highest`, `frequent`, `recent`, `alphabeticalByName`,
   *   `alphabeticalByArtist`, `starred`, `byYear`, `byGenre`.
   * @param {number} [size] Page size (server max is 500).
   * @param {number} [offset] Item offset for pagination.
   * @param {Object<string, *>} [extraParams] Type-specific parameters, e.g.
   *   `{ fromYear, toYear }` for `byYear` (fromYear > toYear yields
   *   newest-released first) or `{ genre }` for `byGenre`.
   * @returns {Promise<Object[]>} Album array (empty when past the end).
   */
  async getAlbumList(type = 'alphabeticalByName', size = 500, offset = 0, extraParams = {}) {
    const params = { type, size, ...extraParams };
    if (offset) params.offset = offset;

    const response = await this.request('getAlbumList2', params);
    return response.albumList2?.album || [];
  }

  /**
   * Fetch the complete album list for a sort type, paging through
   * {@link SubsonicAPI#getAlbumList} in 500-item batches.
   *
   * @param {string} [type] Same types as {@link SubsonicAPI#getAlbumList}.
   * @param {number} [maxAlbums] Hard cap on the number of albums returned.
   * @returns {Promise<Object[]>} Concatenated album array.
   */
  async getAllAlbums(type = 'alphabeticalByName', maxAlbums = 2000) {
    const batchSize = 500;
    let allAlbums = [];
    let offset = 0;
    
    while (allAlbums.length < maxAlbums) {
      const batch = await this.getAlbumList(type, batchSize, offset);
      if (!batch || batch.length === 0) break;
      
      allAlbums.push(...batch);
      offset += batchSize;
      
      // If we got fewer than batchSize, we've reached the end
      if (batch.length < batchSize) break;
    }
    
    return allAlbums.slice(0, maxAlbums);
  }

  /**
   * Unified search across artists, albums, and songs (`search3`).
   *
   * @param {string} query
   * @param {number} [artistCount] Max artist results.
   * @param {number} [albumCount] Max album results.
   * @param {number} [songCount] Max song results.
   * @returns {Promise<Object>} `searchResult3` with optional `artist`,
   *   `album`, and `song` arrays (absent categories are omitted).
   */
  async search(query, artistCount = 20, albumCount = 20, songCount = 50) {
    const response = await this.request('search3', {
      query,
      artistCount,
      albumCount,
      songCount,
    });
    return response.searchResult3;
  }

  /**
   * Fetch random songs, optionally filtered by genre and/or year range.
   *
   * Not currently used by the app — kept as a ready-made endpoint wrapper
   * (candidate for a future "shuffle library" feature).
   *
   * @param {number} [size] Number of songs to return.
   * @param {string} [genre] Genre filter.
   * @param {number|string} [fromYear] Earliest release year.
   * @param {number|string} [toYear] Latest release year.
   * @returns {Promise<Object>} `randomSongs` object containing a `song` array.
   */
  async getRandomSongs(size = 50, genre = '', fromYear = '', toYear = '') {
    const params = { size };
    if (genre) params.genre = genre;
    if (fromYear) params.fromYear = fromYear;
    if (toYear) params.toYear = toYear;

    const response = await this.request('getRandomSongs', params);
    return response.randomSongs;
  }

  /**
   * Fetch one page of the server-sorted song list (`getSongList2`) —
   * the song-level analogue of {@link SubsonicAPI#getAlbumList}.
   *
   * Not currently used by the app — kept as a ready-made endpoint wrapper.
   *
   * @param {string} [type] Sort/selection type (same family as
   *   {@link SubsonicAPI#getAlbumList}).
   * @param {number} [size] Page size.
   * @param {number} [offset] Item offset for pagination.
   * @returns {Promise<Object[]>} Song array (empty when past the end).
   */
  async getSongList(type = 'alphabeticalByName', size = 50, offset = 0) {
    const params = { type, size };
    if (offset) params.offset = offset;

    const response = await this.request('getSongList2', params);
    return response.songList2?.song || [];
  }

  /**
   * Fetch all playlists visible to the user.
   * @returns {Promise<Object>} `playlists` object containing a `playlist`
   *   array (metadata only, no songs).
   */
  async getPlaylists() {
    const response = await this.request('getPlaylists');
    return response.playlists;
  }

  /**
   * Fetch one playlist with its songs.
   * @param {string} playlistId
   * @returns {Promise<Object>} `playlist` object including an `entry` array
   *   of songs.
   */
  async getPlaylist(playlistId) {
    const response = await this.request('getPlaylist', { id: playlistId });
    return response.playlist;
  }

  /**
   * Build a stream URL for a song. This only constructs the URL — no request
   * is made until something plays or downloads it.
   *
   * @param {string} songId
   * @param {Object} [options]
   * @param {number} [options.maxBitRate] Bitrate ceiling in kbps when
   *   transcoding.
   * @param {string} [options.format] `'raw'` forces the original file;
   *   `'mp3'` transcodes server-side. Omit for the server default.
   * @returns {string} Authenticated stream URL.
   */
  getStreamUrl(songId, { maxBitRate = null, format = null } = {}) {
    const params = { id: songId };
    if (maxBitRate) params.maxBitRate = maxBitRate;
    if (format) params.format = format;
    return this.buildUrl('stream', params);
  }

  /**
   * Build a cover art URL. URL construction only, no request.
   *
   * Note: app code should not call this directly for rendering — go through
   * hooks/useArtwork.js, which enforces the single-size, stable-cache-key
   * artwork policy.
   *
   * @param {string} coverArtId
   * @param {number} [size] Server-side resize target in pixels.
   * @returns {string} Authenticated cover art URL.
   */
  getCoverArtUrl(coverArtId, size = 300) {
    return this.buildUrl('getCoverArt', { id: coverArtId, size });
  }

  /**
   * Scrobble a song.
   *
   * @param {string} songId
   * @param {boolean} [submission] False sends a "now playing" notification
   *   (track start); true submits a completed listen (track end).
   * @returns {Promise<Object>}
   */
  async scrobble(songId, submission = true) {
    const params = {
      id: songId,
      submission,
      time: Date.now(),
    };
    return await this.request('scrobble', params);
  }

  /**
   * Star (favorite) a song, album, and/or artist.
   *
   * @param {?string} id Song id, or null.
   * @param {?string} [albumId]
   * @param {?string} [artistId]
   * @returns {Promise<Object>}
   */
  async star(id, albumId = null, artistId = null) {
    const params = {};
    if (id) params.id = id;
    if (albumId) params.albumId = albumId;
    if (artistId) params.artistId = artistId;
    return await this.request('star', params);
  }

  /**
   * Remove a star from a song, album, and/or artist.
   *
   * @param {?string} id Song id, or null.
   * @param {?string} [albumId]
   * @param {?string} [artistId]
   * @returns {Promise<Object>}
   */
  async unstar(id, albumId = null, artistId = null) {
    const params = {};
    if (id) params.id = id;
    if (albumId) params.albumId = albumId;
    if (artistId) params.artistId = artistId;
    return await this.request('unstar', params);
  }

  /**
   * Find albums where an artist appears on songs without being the
   * album-level artist ("Appears In" on ArtistScreen).
   *
   * Implementation: `search3` over songs matching the artist name, matched
   * back to the artist by id or exact (case-insensitive) name, deduped by
   * albumId. Albums in `excludeAlbumIds` (the artist's own discography) are
   * skipped.
   *
   * @param {Object} artist Artist object; `name` is required, `id` improves
   *   match accuracy.
   * @param {string[]} [excludeAlbumIds] Album ids to omit from the result.
   * @param {Object} [options]
   * @param {number} [options.songCount] Max songs to scan via search3.
   * @returns {Promise<Object[]>} Synthesized album objects
   *   (`{ id, name, artist, artistId, year, coverArt }`).
   */
  async getArtistAppearsIn(artist, excludeAlbumIds = [], { songCount = 500 } = {}) {
    if (!artist?.name) return [];

    const exclude = new Set(excludeAlbumIds);
    const result = await this.request('search3', {
      query: artist.name,
      artistCount: 0,
      albumCount: 0,
      songCount,
    });
    const songs = result?.searchResult3?.song || [];

    const normalized = artist.name.trim().toLowerCase();
    const albumsById = new Map();

    for (const song of songs) {
      if (!song.albumId || exclude.has(song.albumId)) continue;
      if (albumsById.has(song.albumId)) continue;

      // Match either by artistId or by exact artist name (case-insensitive).
      const matchesArtist =
        (artist.id && song.artistId === artist.id) ||
        (typeof song.artist === 'string' && song.artist.trim().toLowerCase() === normalized);
      if (!matchesArtist) continue;

      albumsById.set(song.albumId, {
        id: song.albumId,
        name: song.album,
        artist: song.albumArtist || song.artist,
        artistId: song.albumArtistId || null,
        year: song.year,
        coverArt: song.coverArt || song.albumId,
      });
    }

    return Array.from(albumsById.values());
  }

  /**
   * Remove a song from a playlist by position.
   *
   * @param {string} playlistId
   * @param {number} songIndexToRemove 0-based index within the playlist.
   * @returns {Promise<Object>}
   */
  async removeFromPlaylist(playlistId, songIndexToRemove) {
    return await this.request('updatePlaylist', { playlistId, songIndexToRemove });
  }

  /**
   * Create a playlist, optionally seeded with one song.
   *
   * @param {string} name
   * @param {?string} [songId] Song to add on creation.
   * @returns {Promise<Object>}
   */
  async createPlaylist(name, songId = null) {
    const params = { name };
    if (songId) params.songId = songId;
    return await this.request('createPlaylist', params);
  }

  /**
   * Append a single song to an existing playlist.
   *
   * @param {string} playlistId
   * @param {string} songId
   * @returns {Promise<Object>}
   */
  async addSongToPlaylist(playlistId, songId) {
    return await this.request('updatePlaylist', { playlistId, songIdToAdd: songId });
  }

  /**
   * Fetch an artist's top songs. Keyed by artist *name*, not id (a quirk of
   * the Subsonic API). Requires server API >= 1.13.0.
   *
   * @param {string} artistName
   * @param {number} [count] Max songs to return.
   * @returns {Promise<Object[]>} Song array (empty when unsupported/unknown).
   */
  async getTopSongs(artistName, count = 50) {
    const response = await this.request('getTopSongs', { artist: artistName, count });
    return response.topSongs?.song || [];
  }

  /**
   * Fetch all starred (favorited) items.
   * @returns {Promise<Object>} `starred` object with optional `song`,
   *   `album`, and `artist` arrays.
   */
  async getStarred() {
    const response = await this.request('getStarred');
    return response.starred;
  }

  /**
   * Build collage data for a playlist from its first (up to) 4 distinct
   * albums.
   *
   * Not currently used by the app — PlaylistScreen's `pickCollageIds()` does
   * the same dedup locally from already-fetched playlist data, skipping this
   * method's extra `getPlaylist` request. Kept as a self-contained variant
   * for contexts that don't already hold the playlist entries.
   *
   * @param {string} playlistId
   * @param {number} [size] Cover art size per tile in pixels.
   * @returns {Promise<?(string|{type: string, albumCount: number,
   *   coverArtUrls: string[], size: number})>} A single cover art URL when
   *   only one album is represented, a collage descriptor for 2–4 albums,
   *   or null when the playlist is empty / has no art / the fetch fails.
   */
  async generatePlaylistCollage(playlistId, size = 50) {
    try {
      const playlist = await this.getPlaylist(playlistId);
      if (!playlist || !playlist.entry || playlist.entry.length === 0) {
        return null;
      }

      // Collect cover art ids, deduped by both coverArt id and albumId so
      // multi-disc albums (distinct coverArt, same album) count once.
      const albumCoverArtIds = [];
      const seenCoverArtIds = new Set();
      const seenAlbumIds = new Set();

      for (const song of playlist.entry) {
        const coverArtId = song.coverArt;
        const albumId = song.albumId;

        if (coverArtId &&
            !seenCoverArtIds.has(coverArtId) &&
            (!albumId || !seenAlbumIds.has(albumId))) {
          seenCoverArtIds.add(coverArtId);
          if (albumId) seenAlbumIds.add(albumId);
          albumCoverArtIds.push(coverArtId);

          if (albumCoverArtIds.length >= 4) {
            break;
          }
        }
      }

      if (albumCoverArtIds.length === 0) {
        return null;
      }

      if (albumCoverArtIds.length === 1) {
        const singleCoverSize = Math.max(200, size);
        return this.getCoverArtUrl(albumCoverArtIds[0], singleCoverSize);
      }

      return {
        type: 'collage',
        albumCount: albumCoverArtIds.length,
        coverArtUrls: albumCoverArtIds.map(id => this.getCoverArtUrl(id, size)),
        size: size,
      };
    } catch (error) {
      console.error('Error generating playlist collage:', error);
      return null;
    }
  }

  /**
   * Clear the persisted server configuration and reset in-memory credentials.
   * @returns {Promise<void>}
   */
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
