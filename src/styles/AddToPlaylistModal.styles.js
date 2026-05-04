import { StyleSheet } from 'react-native';

export const createStyles = (theme) => StyleSheet.create({
  sheet: {
    backgroundColor: theme.colors.surface,
    // borderTopLeftRadius / borderTopRightRadius are animated inline
    // (18 when collapsed, 0 when fully expanded to top)
    // height is also animated inline (collapsed SHEET_HEIGHT → fullscreen)
    // flex layout: header rows are fixed, list fills the rest
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 24,
  },
  handleBar: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 32,
    marginTop: 2,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Lexend_700Bold',
    color: theme.colors.onSurface,
    paddingHorizontal: 20,
    paddingBottom: 2,
  },
  songLabel: {
    fontSize: 12,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.45,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 10,
  },
  searchIcon: {
    opacity: 0.45,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    padding: 0,
  },
  clearIcon: {
    opacity: 0.4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.09)',
    marginBottom: 4,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  createLabel: {
    fontSize: 14,
    fontFamily: 'Lexend_500Medium',
    color: theme.colors.primary,
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 32,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  playlistItemPressed: {
    backgroundColor: theme.colors.surfaceVariant,
  },
  playlistItemAdded: {
    backgroundColor: theme.colors.playingBackground,
  },
  playlistThumb: {
    width: 44,
    height: 44,
    borderRadius: 5,
    backgroundColor: theme.colors.surfaceVariant,
  },
  playlistInfo: {
    flex: 1,
    minWidth: 0,
  },
  playlistName: {
    fontSize: 13.5,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onSurface,
  },
  playlistNameAdded: {
    color: theme.colors.primary,
  },
  playlistMeta: {
    fontSize: 11.5,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.45,
    marginTop: 1,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.35,
    textAlign: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
});
