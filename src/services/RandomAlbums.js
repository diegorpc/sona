import AsyncStorage from '@react-native-async-storage/async-storage';
import SubsonicAPI from './SubsonicAPI';

const RANDOM_ALBUMS_KEY = 'randomAlbums';
const RANDOM_FETCH_SIZE = 500;

/**
 * The single random album ordering shared by Home's "Random" row and
 * Library's "Random" sort. Persisted under raw AsyncStorage (not
 * CacheService, so it can't be LRU-evicted) so both surfaces show the same
 * shuffle, stable across navigation and launches, until explicitly reset.
 *
 * @param {boolean} [force] True reshuffles: fetch a fresh random set,
 *   persist it, and return it (Library's refresh button — the only reset).
 * @returns {Promise<Object[]>} Album array.
 */
export async function getRandomAlbums(force = false) {
  if (!force) {
    try {
      const raw = await AsyncStorage.getItem(RANDOM_ALBUMS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (error) {
      console.warn('Failed to read random albums:', error);
    }
  }

  const fresh = await SubsonicAPI.getAlbumList('random', RANDOM_FETCH_SIZE, 0);
  try {
    await AsyncStorage.setItem(RANDOM_ALBUMS_KEY, JSON.stringify(fresh));
  } catch (error) {
    console.warn('Failed to persist random albums:', error);
  }
  return fresh;
}
