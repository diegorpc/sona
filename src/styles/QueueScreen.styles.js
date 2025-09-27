import { StyleSheet } from 'react-native';
import { theme } from '../theme/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onSurface,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionLabel: {
    fontSize: 16,
    fontFamily: 'Lexend_500Medium',
    color: theme.colors.onSurface,
    marginBottom: 12,
  },
  listContainer: {
    overflow: 'hidden',
  },
  emptyState: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.outline,
    fontFamily: 'Lexend_400Regular',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.outlineVariant ?? theme.colors.outline,
  },
  itemActive: {
    backgroundColor: theme.colors.surfaceVariant ?? theme.colors.secondaryContainer,
  },
  leadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  coverArt: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontFamily: 'Lexend_500Medium',
    color: theme.colors.onSurface,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurfaceVariant ?? theme.colors.outline,
    marginTop: 2,
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  draggableContainer: {
    flexGrow: 0,
  },
  duration: {
    fontSize: 13,
    fontFamily: 'Lexend_500Medium',
    color: theme.colors.onSurface,
    marginRight: 12,
  },
  actionButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 4,
  },
  actionIcon: {
    color: theme.colors.primary,
  },
  handleButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  dragHandleIcon: {
    color: theme.colors.onSurfaceVariant ?? theme.colors.outline,
  },
  favoriteIcon: {
    color: theme.colors.primary,
    marginRight: 8,
  },
});
