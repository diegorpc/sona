import { StyleSheet, Dimensions } from 'react-native';
import { theme } from '../theme/theme';

const { width } = Dimensions.get('window');

export const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  blurOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    alignItems: 'center',
    paddingTop: 12,
  },
  dragIndicator: {
    width: 56,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    marginBottom: 12,
    borderWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  closeButton: {
    position: 'absolute',
    right: 12,
    top: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 0,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  albumArtContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  albumArtCard: {
  },

  albumArt: {
    width: 270,
    height: 270,
    objectFit: 'contain',
    backgroundColor: 'transparent'

  },
  trackInfo: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  trackTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.onBackground,
    textAlign: 'center',
    marginBottom: 8,
  },
  trackArtist: {
    fontSize: 18,
    color: theme.colors.onBackground,
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: 4,
  },
  trackAlbum: {
    fontSize: 16,
    color: theme.colors.onBackground,
    opacity: 0.6,
    textAlign: 'center',
  },
  progressContainer: {
    paddingHorizontal: 20,
  },
  slider: {
    width: '100%',
    borderRadius: 2,
    height: 35,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  timeText: {
    fontSize: 12,
    color: theme.colors.onBackground,
    opacity: 0.7,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  playButton: {
    backgroundColor: theme.colors.primary,
    marginHorizontal: 40,
  },
  additionalControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
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
    fontWeight: '600',
    color: theme.colors.onBackground,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: theme.colors.onBackground,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 24,
  },
});
