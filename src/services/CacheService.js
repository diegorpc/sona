import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * LRU cache for library metadata (JSON), exported as a singleton — the
 * "Metadata" cache in Settings → Storage.
 *
 * Entries live in AsyncStorage under `@sona_cache_<key>`, mirrored into an
 * in-memory Map after first read. A separate metadata record
 * (`@sona_cache_metadata`) tracks per-entry sizes and last-write timestamps
 * plus the user-set budget (`maxSizeMB`). When a write would exceed the
 * budget, the oldest-written entries are evicted first; nothing ever
 * expires by age alone.
 *
 * Used by the screens for the cached-first pattern: HomeScreen
 * (`home_albums`, `home_playlists`), LibraryScreen (`artists`,
 * `albums_<sort>`, `likedSongs`, `playlists`), and the detail screens
 * (`album_<id>`, `artist_<id>`, `playlist_<id>`).
 *
 * Cover art is *not* stored here — expo-image owns artwork caching (see
 * hooks/useArtwork.js). The song-file cache is SongCache.
 */
class CacheService {
  constructor() {
    this.memoryCache = new Map();
    this.CACHE_PREFIX = '@sona_cache_';
    this.METADATA_KEY = '@sona_cache_metadata';
    this.DEFAULT_MAX_SIZE_MB = 50;
    this.initialized = false;
  }

  /**
   * Ensure the metadata record exists and carries a budget. Called lazily
   * by every public method; safe to call repeatedly.
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Load metadata
      const metadata = await this.getMetadata();
      if (!metadata.maxSizeMB) {
        metadata.maxSizeMB = this.DEFAULT_MAX_SIZE_MB;
        await this.saveMetadata(metadata);
      }
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing cache:', error);
      this.initialized = true;
    }
  }

  /**
   * Read the cache's bookkeeping record.
   * @returns {Promise<{entries: Object, totalSizeBytes: number, maxSizeMB: number}>}
   *   `entries` maps cache key → `{ size, timestamp }`.
   */
  async getMetadata() {
    try {
      const data = await AsyncStorage.getItem(this.METADATA_KEY);
      return data ? JSON.parse(data) : { 
        entries: {}, 
        totalSizeBytes: 0,
        maxSizeMB: this.DEFAULT_MAX_SIZE_MB 
      };
    } catch (error) {
      console.error('Error getting metadata:', error);
      return { entries: {}, totalSizeBytes: 0, maxSizeMB: this.DEFAULT_MAX_SIZE_MB };
    }
  }

  /**
   * Persist the bookkeeping record.
   * @param {Object} metadata As returned by {@link CacheService#getMetadata}.
   * @returns {Promise<void>}
   */
  async saveMetadata(metadata) {
    try {
      await AsyncStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.error('Error saving metadata:', error);
    }
  }

  /**
   * Approximate the serialized size of a value in bytes.
   * @param {*} data Any JSON-serializable value.
   * @returns {number}
   */
  calculateSize(data) {
    try {
      const jsonString = JSON.stringify(data);
      return new Blob([jsonString]).size;
    } catch {
      // Fallback: rough estimate
      return JSON.stringify(data).length * 2;
    }
  }

  /**
   * Store a value, evicting oldest entries first if the write would exceed
   * the budget. Also updates the in-memory mirror.
   * @param {string} key Cache key (without the storage prefix).
   * @param {*} data Any JSON-serializable value.
   * @returns {Promise<void>}
   */
  async set(key, data) {
    if (!this.initialized) await this.initialize();
    
    try {
      const storageKey = this.CACHE_PREFIX + key;
      const dataSize = this.calculateSize(data);
      const metadata = await this.getMetadata();
      
      // Check if adding this would exceed limit
      const existingSize = metadata.entries[key]?.size || 0;
      const newTotalSize = metadata.totalSizeBytes - existingSize + dataSize;
      const maxSizeBytes = metadata.maxSizeMB * 1024 * 1024;
      
      if (newTotalSize > maxSizeBytes) {
        console.warn(`Cache size limit exceeded. Max: ${metadata.maxSizeMB}MB`);
        // Remove oldest entries to make room
        await this.pruneCache(dataSize - existingSize, metadata);
      }
      
      // Save to AsyncStorage
      await AsyncStorage.setItem(storageKey, JSON.stringify(data));
      
      // Update metadata
      const updatedMetadata = await this.getMetadata();
      updatedMetadata.entries[key] = {
        size: dataSize,
        timestamp: Date.now(),
      };
      updatedMetadata.totalSizeBytes = updatedMetadata.totalSizeBytes - existingSize + dataSize;
      await this.saveMetadata(updatedMetadata);
      
      // Also keep in memory cache for fast access
      this.memoryCache.set(key, data);
    } catch (error) {
      console.error(`Error setting cache for ${key}:`, error);
    }
  }

  /**
   * Read a value — from the in-memory mirror when warm, falling back to
   * AsyncStorage.
   * @param {string} key
   * @returns {Promise<*>} The cached value, or null on miss.
   */
  async getAsync(key) {
    if (!this.initialized) await this.initialize();
    
    // Check memory cache first
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }
    
    // Load from AsyncStorage
    return await this.loadFromStorage(key);
  }

  /**
   * Read an entry from AsyncStorage into the in-memory mirror.
   * @param {string} key
   * @returns {Promise<*>} The parsed value, or null on miss/parse failure.
   */
  async loadFromStorage(key) {
    try {
      const storageKey = this.CACHE_PREFIX + key;
      const data = await AsyncStorage.getItem(storageKey);
      
      if (data) {
        const parsed = JSON.parse(data);
        this.memoryCache.set(key, parsed);
        return parsed;
      }
      return null;
    } catch (error) {
      console.error(`Error loading cache for ${key}:`, error);
      return null;
    }
  }

  /**
   * Evict entries oldest-written-first until at least `neededBytes` have
   * been freed.
   * @param {number} neededBytes
   * @param {Object} metadata Current bookkeeping record.
   * @returns {Promise<void>}
   */
  async pruneCache(neededBytes, metadata) {
    const entries = Object.entries(metadata.entries)
      .sort((a, b) => a[1].timestamp - b[1].timestamp); // Sort by timestamp (oldest first)
    
    let freedBytes = 0;
    for (const [key, entry] of entries) {
      if (freedBytes >= neededBytes) break;
      
      await this.clear(key);
      freedBytes += entry.size;
    }
  }

  /**
   * Remove one entry from storage, bookkeeping, and the in-memory mirror.
   * @param {string} key
   * @returns {Promise<void>}
   */
  async clear(key) {
    if (!this.initialized) await this.initialize();
    
    try {
      const storageKey = this.CACHE_PREFIX + key;
      await AsyncStorage.removeItem(storageKey);
      
      const metadata = await this.getMetadata();
      const entrySize = metadata.entries[key]?.size || 0;
      
      delete metadata.entries[key];
      metadata.totalSizeBytes -= entrySize;
      
      await this.saveMetadata(metadata);
      this.memoryCache.delete(key);
    } catch (error) {
      console.error(`Error clearing cache for ${key}:`, error);
    }
  }

  /**
   * Remove every entry, preserving the configured budget.
   * @returns {Promise<void>}
   */
  async clearAll() {
    if (!this.initialized) await this.initialize();
    
    try {
      const metadata = await this.getMetadata();
      const keys = Object.keys(metadata.entries);
      
      // Remove all cache entries
      for (const key of keys) {
        const storageKey = this.CACHE_PREFIX + key;
        await AsyncStorage.removeItem(storageKey);
      }
      
      // Reset metadata
      const maxSize = metadata.maxSizeMB;
      await this.saveMetadata({ 
        entries: {}, 
        totalSizeBytes: 0,
        maxSizeMB: maxSize 
      });
      
      this.memoryCache.clear();
    } catch (error) {
      console.error('Error clearing all cache:', error);
    }
  }

  /**
   * Usage statistics for the Settings → Storage card.
   * @returns {Promise<{totalSizeMB: string, totalSizeBytes: number,
   *   maxSizeMB: number, entryCount: number, entries: Object}>}
   */
  async getStats() {
    if (!this.initialized) await this.initialize();
    
    const metadata = await this.getMetadata();
    return {
      totalSizeMB: (metadata.totalSizeBytes / (1024 * 1024)).toFixed(2),
      totalSizeBytes: metadata.totalSizeBytes,
      maxSizeMB: metadata.maxSizeMB,
      entryCount: Object.keys(metadata.entries).length,
      entries: metadata.entries,
    };
  }

  /**
   * Change the budget, pruning oldest-first if the cache now exceeds it.
   * @param {number} sizeMB
   * @returns {Promise<void>}
   */
  async setMaxSize(sizeMB) {
    if (!this.initialized) await this.initialize();
    
    const metadata = await this.getMetadata();
    metadata.maxSizeMB = sizeMB;
    await this.saveMetadata(metadata);
    
    // If current size exceeds new limit, prune
    const maxSizeBytes = sizeMB * 1024 * 1024;
    if (metadata.totalSizeBytes > maxSizeBytes) {
      await this.pruneCache(metadata.totalSizeBytes - maxSizeBytes, metadata);
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

export default cacheService;
