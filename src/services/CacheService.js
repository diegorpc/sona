import AsyncStorage from '@react-native-async-storage/async-storage';

class CacheService {
  constructor() {
    this.memoryCache = new Map();
    this.CACHE_PREFIX = '@sona_cache_';
    this.METADATA_KEY = '@sona_cache_metadata';
    this.DEFAULT_MAX_SIZE_MB = 500; // 500 MB default limit
    this.initialized = false;
  }

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

  // Get cache metadata (sizes, timestamps, etc.)
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

  async saveMetadata(metadata) {
    try {
      await AsyncStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.error('Error saving metadata:', error);
    }
  }

  // Calculate approximate size of data in bytes
  calculateSize(data) {
    try {
      const jsonString = JSON.stringify(data);
      return new Blob([jsonString]).size;
    } catch {
      // Fallback: rough estimate
      return JSON.stringify(data).length * 2;
    }
  }

  // Set cache with persistence
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

  // Get cache (try memory first, then AsyncStorage)
  get(key) {
    // Check memory cache first
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }
    
    // Return null for synchronous access, load async in background
    this.loadFromStorage(key);
    return null;
  }

  // Async version of get
  async getAsync(key) {
    if (!this.initialized) await this.initialize();
    
    // Check memory cache first
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }
    
    // Load from AsyncStorage
    return await this.loadFromStorage(key);
  }

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

  // Prune oldest cache entries to free up space
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

  // Check if cache exists
  has(key) {
    return this.memoryCache.has(key);
  }

  async hasAsync(key) {
    if (!this.initialized) await this.initialize();
    
    if (this.memoryCache.has(key)) return true;
    
    const metadata = await this.getMetadata();
    return !!metadata.entries[key];
  }

  // Clear specific cache entry
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

  // Clear all cache
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

  // Get cache statistics
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

  // Set maximum cache size
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

  // Preload all cache into memory (call on app start)
  async preloadCache() {
    if (!this.initialized) await this.initialize();
    
    try {
      const metadata = await this.getMetadata();
      const keys = Object.keys(metadata.entries);
      
      for (const key of keys) {
        if (!this.memoryCache.has(key)) {
          await this.loadFromStorage(key);
        }
      }
    } catch (error) {
      console.error('Error preloading cache:', error);
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

export default cacheService;
