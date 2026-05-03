import { StyleSheet } from 'react-native';

export const createStyles = (theme) => StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  blurOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 8, 8, 0.72)',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingBottom: 180,
  },
  handleBarContainer: {
    alignItems: 'center',
    paddingBottom: 0,
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 1,
    paddingHorizontal: 64,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLowOpacity,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Lexend_700Bold',
    color: theme.colors.onSurface,
    textShadowColor: theme.colors.primary,
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 0,
  },
  scrollView: {
    flex: 1,
  },
  nowPlayingContainer: {
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },
  sectionLabelMuted: {
    fontSize: 10,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onSurface,
    opacity: 0.45,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 2,
  },
  // Context section header row: "Next in:\nName" + shuffle/repeat toggles
  contextHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  contextHeaderText: {
    flex: 1,
  },
  contextHeaderLabel: {
    fontSize: 10,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onSurface,
    opacity: 0.45,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  contextHeaderName: {
    fontSize: 13,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onSurface,
    opacity: 0.6,
    marginTop: 2,
  },
  contextToggles: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    flexShrink: 0,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.borderLowOpacity,
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.badgeBackground,
    borderColor: theme.colors.badgeBorder,
  },
  toggleLabel: {
    fontSize: 11,
    fontFamily: 'Lexend_500Medium',
    color: theme.colors.onSurface,
    opacity: 0.4,
  },
  toggleLabelActive: {
    color: theme.colors.primary,
    opacity: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.borderLowOpacity,
    marginVertical: 4,
  },
  // ─── Context queue row (PlaylistScreen-matching spacing) ───────────
  contextItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLowOpacity,
    backgroundColor: 'transparent',
  },
  // Leading heart icon (when starred)
  favoriteIcon: {
    marginLeft: 4,
  },
  // Spacer occupying the same width as the heart icon (when not starred)
  itemLeadingIcon: {
    width: 14,
    marginLeft: 4,
  },
  contextCoverArtContainer: {
    width: 44,
    height: 44,
    marginLeft: 8,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextCoverArt: {
    width: 44,
    height: 44,
    borderRadius: 5,
  },
  contextTitle: {
    fontSize: 13.5,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onSurface,
  },
  contextSubtitle: {
    fontSize: 11.5,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.55,
    marginTop: 1,
  },
  contextDuration: {
    fontSize: 12,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.4,
    marginRight: 2,
    flexShrink: 0,
  },
  // ─── Priority queue / Now Playing row ──────────────────────────────
  // Track row
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLowOpacity,
    backgroundColor: 'transparent',
  },
  itemActive: {
    backgroundColor: theme.colors.playingBackground,
  },
  dragHandle: {
    paddingRight: 8,
  },
  dragHandleIcon: {
    color: theme.colors.onSurface,
    opacity: 0.3,
  },
  nowPlayingIndicator: {
    width: 14,
    marginRight: 12,
    alignItems: 'center',
  },
  coverArtContainer: {
    width: 44,
    height: 44,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverArt: {
    width: 44,
    height: 44,
    borderRadius: 6,
    marginRight: 10,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  title: {
    fontSize: 13,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onSurface,
  },
  titleActive: {
    color: theme.colors.primary,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.55,
    marginTop: 2,
  },
  subtitleActive: {
    color: theme.colors.primary,
    opacity: 0.7,
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
  },
  duration: {
    fontSize: 12,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.4,
  },
  actionButton: {
    padding: 6,
  },
  actionIcon: {
    color: theme.colors.onSurface,
    opacity: 0.45,
  },
  skipIcon: {
    color: theme.colors.onSurface,
    opacity: 0.55,
  },
  listFooter: {
    height: 20,
  },
  emptyState: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'flex-start',
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.35,
  },
});
