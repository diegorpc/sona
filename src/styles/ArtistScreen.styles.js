import { StyleSheet } from 'react-native';
import { theme } from '../theme/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: 20,
    paddingBottom: 30,
  },
  artistInfo: {
    alignItems: 'center',
  },
  artistName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    textAlign: 'center',
    marginBottom: 8,
  },
  artistStats: {
    fontSize: 16,
    color: theme.colors.onSurface,
    opacity: 0.7,
  },
  listContainer: {
    paddingBottom: 80, // Space for FAB
  },
  albumCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: theme.colors.surface,
  },
  albumContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  albumArt: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  albumInfo: {
    flex: 1,
  },
  albumTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 4,
  },
  albumYear: {
    fontSize: 14,
    color: theme.colors.primary,
    marginBottom: 2,
  },
  albumDetails: {
    fontSize: 12,
    color: theme.colors.onSurface,
    opacity: 0.7,
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
