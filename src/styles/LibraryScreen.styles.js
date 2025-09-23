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
  chipScrollContainer: {
    maxHeight: 50,
  },
  chipContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  bubbleChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  bubbleChipSelected: {
    backgroundColor: theme.colors.secondary,
  },
  bubbleChipUnselected: {
    backgroundColor: theme.colors.outline,
    opacity: 0.6,
  },
  bubbleChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bubbleChipTextSelected: {
    color: theme.colors.onSecondary,
  },
  bubbleChipTextUnselected: {
    color: theme.colors.onSurface,
    opacity: 0.7,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 80, // Space for FAB
  },
  itemCard: {
    marginBottom: 8,
    backgroundColor: theme.colors.surface,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  itemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 14,
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.onBackground,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.onBackground,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary,
  },
});
