import { StyleSheet } from 'react-native';

import { theme } from '../theme/theme';

export const MINI_HEIGHT = 54;

export const styles = StyleSheet.create({
  touchable: {
    borderRadius: 12,
    backgroundColor: 'transparent',
    elevation: 6,
    shadowColor: '#00000040',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    overflow: 'hidden',
    opacity: 0.95,
  },
  blurContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: `${theme.colors.surface}66`,
  },
  touchablePressed: {
    backgroundColor: `${theme.colors.surface}30`,
  },
  content: {
    height: MINI_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  coverArt: {
    height: MINI_HEIGHT-10,
    width: MINI_HEIGHT-10,
    marginRight: 10,
    marginLeft: 10,
    borderRadius: 12,
    objectFit: 'contain',
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onSurface,
    marginTop: 4
  },
  artist: {
    fontSize: 12,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.7,
    marginBottom: 6,
  },
  playPause: {
    marginRight: 4,
  },
  progressTrack: {
    flexDirection: 'row',
    height: 2,
    backgroundColor: theme.colors.outlineVariant || `${theme.colors.outline}33`,
  },
  progressFill: {
    backgroundColor: theme.colors.primary,
  },
});
