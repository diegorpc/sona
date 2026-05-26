import AsyncStorage from '@react-native-async-storage/async-storage';

const PLAY_TIMES_KEY = 'playlistPlayTimes';

// Record that a playlist was just listened to. Stored as an { [id]: timestamp } map.
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

// Best-effort creation timestamp for a playlist across the field names servers use.
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

// Comparator: most recently listened first, then (for never-listened playlists,
// or ties) most recently created first. Returns a descending-order comparator.
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
