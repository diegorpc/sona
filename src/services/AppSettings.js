import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'appSettings';

// Single source of truth for app setting defaults.
// - originalQualityStreaming: stream untouched files; off = transcode to MP3 320 kbps
// - originalQualityCaching: cache untouched files; off = cache MP3 320 kbps transcodes
export const DEFAULT_SETTINGS = {
  autoPlay: true,
  originalQualityStreaming: false,
  originalQualityCaching: true,
  downloadOverWifi: true,
  scrobbling: true,
};

// Read settings merged over defaults. Migrates the legacy `highQuality` key.
export async function getAppSettings() {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    if (saved.highQuality !== undefined && saved.originalQualityStreaming === undefined) {
      saved.originalQualityStreaming = saved.highQuality;
    }
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch (error) {
    console.error('Error reading app settings:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveAppSettings(settings) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
