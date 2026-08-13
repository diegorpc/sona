import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * @fileoverview Playlist listen-time tracking, backing the "Recently
 * Listened" ordering on Home and in Library. Times are stored as an
 * `{ [playlistId]: timestamp }` map under one AsyncStorage key.
 */

const PLAY_TIMES_KEY = 'playlistPlayTimes';

/**
 * Stamp a playlist as listened-to right now. Called from PlaylistScreen on
 * both single-song play and play-all.
 * @param {Object} playlist Playlist object; only `id` is read.
 * @returns {Promise<void>}
 */
export async function recordPlaylistPlayed(playlist) {
  if (!playlist?.id) return;
  try {
    const times = await getPlaylistPlayTimes();
    times[playlist.id] = Date.now();
    await AsyncStorage.setItem(PLAY_TIMES_KEY, JSON.stringify(times));
  } catch (error) {
    console.warn('Failed to record played playlist:', error);
  }
}

/**
 * Read the listen-time map.
 * @returns {Promise<Object<string, number>>} Playlist id → epoch ms (empty
 *   object when nothing recorded or on read failure).
 */
export async function getPlaylistPlayTimes() {
  try {
    const raw = await AsyncStorage.getItem(PLAY_TIMES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.warn('Failed to read playlist play times:', error);
    return {};
  }
}

/**
 * Best-effort creation timestamp for a playlist, across the field names
 * different servers use (`created`, `dateAdded`, `dateCreated`, `changed`).
 * @param {Object} playlist
 * @returns {number} Epoch ms, or 0 when no parseable field exists.
 */
export function getPlaylistCreatedTimestamp(playlist) {
  for (const field of ['created', 'dateAdded', 'dateCreated', 'changed']) {
    const value = playlist?.[field];
    if (!value) continue;
    if (typeof value === 'number') return value;
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

/**
 * Build a playlist comparator: most recently listened first, then (for
 * never-listened playlists, or ties) most recently created, then name.
 * Shared by HomeScreen and LibraryScreen so both order identically.
 * @param {Object<string, number>} [playTimes] Map from
 *   {@link getPlaylistPlayTimes}.
 * @returns {function(Object, Object): number} Descending-order comparator.
 */
export function compareByRecentlyListened(playTimes = {}) {
  return (a, b) => {
    const aPlayed = playTimes[a?.id] || 0;
    const bPlayed = playTimes[b?.id] || 0;
    if (aPlayed !== bPlayed) return bPlayed - aPlayed;

    const aCreated = getPlaylistCreatedTimestamp(a);
    const bCreated = getPlaylistCreatedTimestamp(b);
    if (aCreated !== bCreated) return bCreated - aCreated;

    return String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' });
  };
}
