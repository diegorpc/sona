import AsyncStorage from '@react-native-async-storage/async-storage';
import { compareByRecentlyListened } from './RecentPlaylists';

const PINNED_KEY = 'pinnedPlaylistIds';
export const MAX_PINNED = 6;

export async function getPinnedPlaylistIds() {
  try {
    const raw = await AsyncStorage.getItem(PINNED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch (error) {
    console.warn('Failed to read pinned playlists:', error);
    return [];
  }
}

export async function setPinnedPlaylistIds(ids) {
  const unique = [...new Set((ids || []).map(String))].slice(0, MAX_PINNED);
  try {
    await AsyncStorage.setItem(PINNED_KEY, JSON.stringify(unique));
  } catch (error) {
    console.warn('Failed to save pinned playlists:', error);
  }
  return unique;
}

// Resolve the Home playlist grid: pinned playlists first (in pin order), then the
// recently-listened fallback fills remaining slots. Pins whose playlist no longer
// exists are silently dropped, so a deleted playlist reverts to the fallback.
export function buildHomePlaylists(allPlaylists = [], pinnedIds = [], playTimes = {}, count = MAX_PINNED) {
  const byId = new Map(allPlaylists.map(p => [String(p.id), p]));
  const seen = new Set();
  const pinned = [];

  for (const id of pinnedIds) {
    const key = String(id);
    const playlist = byId.get(key);
    if (playlist && !seen.has(key)) {
      pinned.push(playlist);
      seen.add(key);
    }
  }

  const rest = allPlaylists
    .filter(p => !seen.has(String(p.id)))
    .sort(compareByRecentlyListened(playTimes));

  return [...pinned, ...rest].slice(0, count);
}
