import { StyleSheet, Dimensions } from 'react-native';
import { theme } from '../theme/theme';

const { width } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  albumArtContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  albumArtCard: {
    elevation: 8,
    borderRadius: 12,
  },
  albumArt: {
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: 12,
  },
  trackInfo: {
    alignItems: 'center',
    paddingHorizontal: 20,
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
    marginTop: -10,
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
    backgroundColor: theme.colors.background,
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
