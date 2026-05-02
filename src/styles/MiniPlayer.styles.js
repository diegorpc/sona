import { StyleSheet } from 'react-native';

export const MINI_HEIGHT = 54;

export const createStyles = (theme) => StyleSheet.create({
  touchable: {
    borderRadius: 14,
    backgroundColor: 'transparent',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    overflow: 'hidden',
  },
  blurContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(22, 22, 24, 0.88)',
  },
  touchablePressed: {
    opacity: 0.85,
  },
  content: {
    height: MINI_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  coverArt: {
    height: MINI_HEIGHT - 12,
    width: MINI_HEIGHT - 12,
    marginLeft: 8,
    marginRight: 10,
    borderRadius: 8,
    objectFit: 'contain',
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 13.5,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onSurface,
    marginTop: 1,
  },
  artist: {
    fontSize: 11.5,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.6,
    marginTop: 4,
  },
  playPause: {
    marginRight: 4,
    margin: 0,
  },
  progressTrack: {
    flexDirection: 'row',
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  progressFill: {
    backgroundColor: theme.colors.primary,
  },
});
