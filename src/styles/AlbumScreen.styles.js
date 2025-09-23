import { StyleSheet, Dimensions } from 'react-native';
import { theme } from '../theme/theme';

const { width } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: 20,
    paddingBottom: 30,
  },
  albumArtContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  albumArtCard: {
    elevation: 8,
    borderRadius: 12,
  },
  albumArt: {
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: 12,
  },
  albumInfo: {
    alignItems: 'center',
  },
  albumTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    textAlign: 'center',
    marginBottom: 8,
  },
  albumArtist: {
    fontSize: 18,
    color: theme.colors.onSurface,
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: 16,
  },
  albumMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  metaChip: {
    backgroundColor: theme.colors.primaryContainer,
  },
  metaChipText: {
    fontSize: 12,
    color: theme.colors.onPrimaryContainer,
  },
  genreContainer: {
    alignItems: 'center',
  },
  genreChip: {
    backgroundColor: theme.colors.secondaryContainer,
  },
  genreChipText: {
    fontSize: 12,
    color: theme.colors.onSecondaryContainer,
  },
  listContainer: {
    paddingBottom: 80, // Space for FAB
  },
  songCard: {
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: theme.colors.surface,
  },
  songContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  trackNumber: {
    width: 32,
    alignItems: 'center',
    marginRight: 12,
  },
  trackNumberText: {
    fontSize: 14,
    color: theme.colors.onSurface,
    opacity: 0.7,
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.onSurface,
    marginBottom: 2,
  },
  songArtist: {
    fontSize: 14,
    color: theme.colors.onSurface,
    opacity: 0.7,
  },
  songActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  duration: {
    fontSize: 12,
    color: theme.colors.onSurface,
    opacity: 0.7,
    marginRight: 8,
  },
  playButton: {
    margin: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.onBackground,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 40,
  },
  errorText: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.error,
    marginTop: 16,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 16,
    color: theme.colors.onBackground,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary,
  },
});
