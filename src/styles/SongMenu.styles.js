import { StyleSheet } from 'react-native';

export const createStyles = (theme) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 32,
    // Shadow for elevation
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
  // Song header (art + title + artist)
  songHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 14,
  },
  songHeaderArt: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: theme.colors.surfaceVariant,
  },
  songHeaderInfo: {
    flex: 1,
    minWidth: 0,
  },
  songHeaderTitle: {
    fontSize: 14,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onSurface,
  },
  songHeaderArtist: {
    fontSize: 12,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.55,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.09)',
    marginHorizontal: 0,
  },
  // Menu option rows
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 16,
  },
  menuItemDisabled: {
    opacity: 0.3,
  },
  menuItemIcon: {
    color: theme.colors.onSurface,
    opacity: 0.75,
  },
  menuItemIconDisabled: {
    opacity: 1,
  },
  menuItemLabel: {
    fontSize: 14,
    fontFamily: 'Lexend_500Medium',
    color: theme.colors.onSurface,
  },
  menuItemLabelDisabled: {
    opacity: 1,
  },
  // Swipe-left action revealed in list rows
  swipeAction: {
    width: 80,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  swipeActionContent: {
    flex: 1,
    width: 80,
    backgroundColor: theme.colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeActionLabel: {
    fontSize: 10,
    fontFamily: 'Lexend_500Medium',
    color: theme.colors.onPrimary,
    marginTop: 3,
  },
});
