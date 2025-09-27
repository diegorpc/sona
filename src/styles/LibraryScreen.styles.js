import { StyleSheet } from 'react-native';
import { theme } from '../theme/theme';

export const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  blurOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 8, 8, 0.55)',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: 40,
  },
  header: {
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    // borderBottomWidth: 1,
    // borderBottomColor: theme.colors.primary,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
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
    // elevation: 4,
    // shadowColor: '#000',
    // shadowOpacity: 0.25,
    // shadowRadius: 6,
    // shadowOffset: { width: 0, height: 4 },
  },
  bubbleChipText: {
    fontSize: 14,
    fontFamily: 'Lexend_500Medium',
    textAlign: 'center',
  },
  chipSectionWrapper: {
    width: '100%',
  },
  sortControlContainer: {
    paddingHorizontal: 8,
  },
  sortTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  sortTriggerActive: {
  },
  sortTriggerIcon: {
    marginRight: 6,
  },
  sortTriggerLabel: {
    fontSize: 13,
    fontFamily: 'Lexend_500Medium',
    color: theme.colors.onSurfaceVariant,
  },
  sortMenuPortal: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  sortMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  sortMenuContent: {
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
  },
  sortMenuContainer: {
    position: 'absolute',
    width: 220,
    borderRadius: 14,
    paddingVertical: 4,
    backgroundColor: theme.colors.surface,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  sortMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  sortMenuItemActive: {
    backgroundColor: theme.colors.secondaryContainer,
  },
  sortMenuItemIcon: {
    marginRight: 12,
    opacity: 0.8,
  },
  sortMenuItemLabel: {
    fontFamily: 'Lexend_500Medium',
    fontSize: 14,
    color: theme.colors.onSurface,
    flex: 1,
  },
  sortMenuItemLabelActive: {
    color: theme.colors.primary,
  },
  sortMenuItemCheck: {
    marginLeft: 12,
  },
  listContainer: {
    paddingBottom: 80,
  },
  libraryList: {
    flex: 1,
  },

  // Flat list item container 
  flatListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2, // item height
    backgroundColor: theme.colors.transparent,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.outline,
    minHeight: 68, // Minimum height
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
  listFooter: {
    padding: 20,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
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
