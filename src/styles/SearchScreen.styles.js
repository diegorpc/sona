import { StyleSheet } from 'react-native';
import { theme } from '../theme/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    elevation: 2,
  },
  searchbar: {
    marginBottom: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tab: {
    marginRight: 8,
    marginBottom: 4,
  },
  resultsList: {
    padding: 16,
  },
  resultCard: {
    marginBottom: 8,
    backgroundColor: theme.colors.surface,
  },
  resultContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  albumThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 4,
    marginRight: 12,
  },
  songThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 12,
  },
  resultInfo: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 2,
  },
  resultSubtitle: {
    fontSize: 14,
    color: theme.colors.onSurface,
    opacity: 0.7,
  },
  resultAlbum: {
    fontSize: 12,
    color: theme.colors.onSurface,
    opacity: 0.5,
  },
  resultYear: {
    fontSize: 12,
    color: theme.colors.onSurface,
    opacity: 0.5,
  },
  songActions: {
    alignItems: 'flex-end',
  },
  duration: {
    fontSize: 12,
    color: theme.colors.onSurface,
    opacity: 0.7,
    marginBottom: 4,
  },
  sectionHeader: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.onBackground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.onBackground,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
});
