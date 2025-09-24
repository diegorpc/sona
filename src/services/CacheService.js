class CacheService {
  constructor() {
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes 
  }

  // Set cache with timestamp
  set(key, data) {
    this.cache.set(key, data);
    this.cacheTimestamps.set(key, Date.now());
  }

  // Get cache if not expired
  get(key) {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return null;

    const isExpired = Date.now() - timestamp > this.CACHE_DURATION;
    if (isExpired) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }

    return this.cache.get(key);
  }

  // Check if cache exists and is valid
  has(key) {
    return this.get(key) !== null;
  }

  // Clear specific cache entry
  clear(key) {
    this.cache.delete(key);
    this.cacheTimestamps.delete(key);
  }

  // Clear all cache
  clearAll() {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  // Get cache size
  size() {
    return this.cache.size;
  }
}

// Create singleton instance
const cacheService = new CacheService();

export default cacheService;
