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
    paddingTop: 17,
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
  searchbar: {
    borderRadius: 10,
    height: 44,
    backgroundColor: theme.colors.surfaceVariant,
  },
  searchbarInput: {
    fontFamily: 'Lexend_500Medium',
    fontSize: 16,
    paddingTop: 0,
    paddingBottom: 10,
    color: theme.colors.onSurface,
  },
  resultsList: {
    paddingBottom: 100,
  },
  // ─── Section headers ──────────────────────────────────────────
  sectionHeader: {
    paddingTop: 12,
    paddingBottom: 4,
    paddingHorizontal: 14,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onSurface,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textShadowColor: theme.colors.primary,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
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
  },
  itemDuration: {
    fontSize: 12,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.45,
    marginRight: 4,
  },
  // Loading / empty
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 55,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onBackground,
    marginTop: 4,
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
