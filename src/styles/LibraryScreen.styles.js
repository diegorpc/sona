import { StyleSheet } from 'react-native';
import { theme } from '../theme/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: theme.colors.surface,
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Lexend_700Bold',
    color: theme.colors.onSurface,
  },
  headerAction: {
    padding: 6,
    borderRadius: 999,
  },
  searchbar: {
    borderRadius: 10,
    height: 44,
    marginBottom: 8,
  },
  searchbarInput: {
    fontFamily: 'Lexend_500Medium',
    fontSize: 16,
    paddingVertical: 0,
  },
  chipScrollContainer: {
    maxHeight: 44,
    marginTop: 12,
    marginHorizontal: -16, // Extend to screen edges
  },
  chipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16, // Add padding back for first chip
    paddingRight: 16, // Add padding back for last chip
  },
  bubbleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    minWidth: 68,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  bubbleChipSelected: {
    backgroundColor: theme.colors.secondary,
  },
  bubbleChipUnselected: {
    backgroundColor: theme.colors.surfaceVariant,
  },
  bubbleChipText: {
    fontSize: 14,
    fontFamily: 'Lexend_500Medium',
  },
  bubbleChipTextSelected: {
    color: theme.colors.onSecondary,
  },
  bubbleChipTextUnselected: {
    color: theme.colors.onSurfaceVariant,
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
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onSurface,
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 14,
    fontFamily: 'Lexend_400Regular',
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
    fontFamily: 'Lexend_500Medium',
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
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onBackground,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onBackground,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  }
});
