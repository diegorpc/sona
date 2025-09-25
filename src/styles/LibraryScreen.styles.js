import { StyleSheet } from 'react-native';
import { theme } from '../theme/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surface,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 44,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Lexend_700Bold',
    color: theme.colors.onSurface,
    textShadowOffset: { width: 1, height: 2 },
    textShadowColor: '#9a6bff',

  },
  headerTitleWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  headerActionWrapper: {
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerActionTouchable: {
    padding: 6,
    borderRadius: 999,
  },
  searchbar: {
    borderRadius: 10,
    height: 44,
    marginBottom: 0,
    flex: 1,
  },
  searchbarInput: {
    fontFamily: 'Lexend_500Medium',
    fontSize: 16,
    paddingTop: 0,
    paddingBottom: 10,
  },
  searchOverlay: {
    position: 'absolute',
    right: 0,
    height: 44,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chipScrollContainer: {
    maxHeight: 44,
    marginHorizontal: -16, // Extend to screen edges
  },
  chipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16, 
    paddingRight: 16,
  },
  bubbleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    minWidth: 68,
    alignItems: 'center',
    marginHorizontal: 4,

  },
  bubbleChipElevated: {
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  bubbleChipText: {
    fontSize: 14,
    fontFamily: 'Lexend_500Medium',
    textAlign: 'center',
  },
  chipSectionWrapper: {
    width: '100%',
    marginTop: 12,
  },
  sortControlContainer: {
    paddingHorizontal: 8,
    boxShadow: '0px 5px 9px 0px rgba(0,0,0,0.6)',
  },
  sortTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 10,
  },
  sortTriggerIcon: {
    marginRight: 6,
  },
  sortTriggerLabel: {
    fontSize: 13,
    fontFamily: 'Lexend_500Medium',
    color: theme.colors.onSurfaceVariant,
  },
  sortMenuContent: {
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
  },
  sortMenuItemLabel: {
    fontFamily: 'Lexend_500Medium',
  },
  listContainer: {
    paddingBottom: 80,
  },

  // Flat list item container 
  flatListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8, // item height
    backgroundColor: theme.colors.background,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.outline,
    minHeight: 72, // Minimum height
  },
  itemLeadingIcon: {
    marginRight: 6,
  },
  itemImage: {
    width: 56,
    height: 56,
    borderRadius: 2,
    marginRight: 10,
    objectFit: 'contain',
    resizeMode: 'contain',
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 14,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onSurface,
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 12,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.7,
  },

  // Right side content for songs and playlists
  itemRightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  itemDuration: {
    fontSize: 14,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.6,
    marginRight: 6,
  },
  itemMenuButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemMenuDots: {
    fontSize: 16,
    color: theme.colors.onSurface,
    opacity: 0.6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
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
