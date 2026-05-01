import { StyleSheet } from 'react-native';

export const createStyles = (theme) => StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  blurOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 8, 8, 0.78)',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: 40,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 0,
    backgroundColor: 'transparent',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Lexend_700Bold',
    color: theme.colors.onSurface,
    textShadowColor: theme.colors.primary,
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 0,
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
  // Chip tabs
  chipScrollContainer: {
    marginHorizontal: -16,
  },
  chipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    gap: 7,
  },
  bubbleChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
    minWidth: 64,
    alignItems: 'center',
    marginHorizontal: 0,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.11)',
  },
  bubbleChipText: {
    fontSize: 13,
    fontFamily: 'Lexend_500Medium',
    textAlign: 'center',
  },
  chipSectionWrapper: {
    width: '100%',
  },
  // Sort control
  sortControlContainer: {
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sortDirectionButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortControlFixed: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLowOpacity,
    backgroundColor: 'transparent',
  },
  sortTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  sortTriggerActive: {},
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
  sortMenuContainer: {
    position: 'absolute',
    width: 220,
    borderRadius: 14,
    paddingVertical: 4,
    backgroundColor: theme.colors.surface,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
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
    paddingBottom: 120,
  },
  libraryList: {
    flex: 1,
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
  // ─── Unified flat list item ────────────────────────────────────
  flatListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLowOpacity,
    backgroundColor: 'transparent',
  },
  flatListItemPlaying: {
    backgroundColor: theme.colors.playingBackground,
  },
  itemLeadingIcon: {
    marginRight: 6,
  },
  itemImageContainer: {
    width: 52,
    height: 52,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemImage: {
    width: 52,
    height: 52,
    borderRadius: 5,
    marginRight: 10,
  },
  itemImageRound: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 10,
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 13.5,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onSurface,
    marginBottom: 2,
  },
  itemTitlePlaying: {
    color: theme.colors.primary,
  },
  itemSubtitle: {
    fontSize: 11.5,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.55,
  },
  itemSubtitlePlaying: {
    color: theme.colors.primary,
    opacity: 0.7,
  },
  itemRightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    gap: 4,
  },
  itemDuration: {
    fontSize: 12,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.45,
  },
  itemMenuButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemMenuDots: {
    fontSize: 16,
    color: theme.colors.onSurface,
    opacity: 0.45,
    letterSpacing: 1,
  },
  nowPlayingIndicator: {
    marginRight: 6,
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
    paddingTop: 80,
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
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
});
