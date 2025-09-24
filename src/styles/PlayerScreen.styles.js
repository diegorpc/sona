import { StyleSheet, Dimensions } from 'react-native';
import { theme } from '../theme/theme';

const { width } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  albumArtContainer: {
    alignItems: 'center',
    marginTop: 20,
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
    backgroundColor: theme.colors.surface,
    borderRadius: 50,
    paddingVertical: 10,
    elevation: 4,
  },
  playButton: {
    backgroundColor: theme.colors.primaryContainer,
    marginHorizontal: 20,
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
