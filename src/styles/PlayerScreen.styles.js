import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export const createStyles = (theme) => StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  blurOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  accentGlow: {
    position: 'absolute',
    top: -100,
    left: width / 2 - 150,
    width: 300,
    height: 300,
    borderRadius: 150,
    // rendered via LinearGradient in screen
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingBottom: 16,
  },
  header: {
    alignItems: 'center',
    paddingTop: 12,
  },
  dragIndicator: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.30)',
    marginBottom: 8,
  },
  closeButton: {
    position: 'absolute',
    right: 12,
  },
  albumArtContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  albumArt: {
    width: width - 80,
    height: width - 80,
    borderRadius: 18,
  },
  albumArtShadow: {
    borderRadius: 18,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
    elevation: 20,
  },
  trackInfo: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 14,
  },
  trackTitle: {
    fontSize: 21,
    fontFamily: 'Lexend_700Bold',
    color: theme.colors.onBackground,
    textAlign: 'center',
    textShadowColor: theme.colors.primary,
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 0,
    marginBottom: 6,
  },
  trackArtist: {
    fontSize: 14,
    fontFamily: 'Lexend_500Medium',
    color: theme.colors.onBackground,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 3,
  },
  trackAlbum: {
    fontSize: 12,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onBackground,
    opacity: 0.45,
    textAlign: 'center',
  },
  // Glass controls card
  controlsCard: {
    marginHorizontal: 12,
    backgroundColor: 'rgba(18, 18, 20, 0.76)',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.borderLowOpacity,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  progressContainer: {
    marginBottom: 4,
  },
  slider: {
    width: '100%',
    height: 36,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  timeText: {
    fontSize: 11,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onBackground,
    opacity: 0.45,
  },
  // Full-width transport: prev · play · next
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 14,
    marginBottom: 14,
  },
  skipButton: {
    padding: 4,
  },
  playButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  // Bottom controls row: heart · queue · dots
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  secondaryButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    padding: 40,
  },
  emptyText: {
    fontSize: 20,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onBackground,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onBackground,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
});
