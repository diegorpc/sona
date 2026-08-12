import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const ART_SIZE = Math.min(180, width - 180);
const GRID_HORIZONTAL_PADDING = 14;
const GRID_GAP = 12;
const GRID_CARD_SIZE = (width - GRID_HORIZONTAL_PADDING * 2 - GRID_GAP) / 2;

export const createStyles = (theme) => StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  blurOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 8, 8, 0.77)',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'Lexend_500Medium',
    color: theme.colors.onBackground,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.error,
  },
  errorSubtext: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onBackground,
    opacity: 0.6,
    textAlign: 'center',
  },
  // Sticky header (back + more icons)
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  stickyNavIcon: {
    color: theme.colors.onBackground,
    padding: 4,
    textShadowColor: theme.colors.primary,
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 0,
  },
  // Art glow container (circular for artist)
  artContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingBottom: 6,
  },
  artShadow: {
    borderRadius: ART_SIZE / 2,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
  },
  artImage: {
    width: ART_SIZE,
    height: ART_SIZE,
    borderRadius: ART_SIZE / 2,
  },
  titleBlock: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    alignItems: 'center',
  },
  artistName: {
    fontSize: 22,
    fontFamily: 'Lexend_700Bold',
    color: theme.colors.onSurface,
    textShadowColor: theme.colors.primary,
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 0,
  },
  artistStats: {
    fontSize: 13,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.55,
    marginTop: 5,
  },
  // Chip tabs (animated library-style chips)
  chipScrollContainer: {
    flexGrow: 0,
    flexShrink: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLowOpacity,
  },
  chipTabsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipTab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.11)',
  },
  chipTabText: {
    fontSize: 13,
    fontFamily: 'Lexend_500Medium',
    lineHeight: 18,
  },
  // Play / shuffle / queue row (mirrors AlbumScreen's playAreaRow, minus the heart)
  playAreaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  playPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 26,
    paddingVertical: 9,
    borderRadius: 99,
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  playPillText: {
    fontSize: 14,
    fontFamily: 'Lexend_700Bold',
    color: '#000',
    letterSpacing: 0.2,
  },
  // Fixed-size slot so swapping the play icon for a spinner never changes
  // the pill's width.
  playPillIconSlot: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Album grid (2x2 with large media art)
  albumGridContainer: {
    paddingHorizontal: GRID_HORIZONTAL_PADDING,
    paddingTop: 12,
    paddingBottom: 70,
  },
  albumGridRow: {
    justifyContent: 'space-between',
    marginBottom: GRID_GAP,
  },
  albumGridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: GRID_GAP,
    paddingBottom: 12,
  },
  sectionHeader: {
    fontSize: 14,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onSurface,
    marginBottom: 10,
    textShadowColor: theme.colors.primary,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
  albumCard: {
    width: GRID_CARD_SIZE,
  },
  albumCardArt: {
    width: GRID_CARD_SIZE,
    height: GRID_CARD_SIZE,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceVariant,
  },
  albumCardTitle: {
    fontSize: 14,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onSurface,
    marginTop: 8,
  },
  albumCardSubtitle: {
    fontSize: 12,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.55,
    marginTop: 2,
  },
  // Top songs / Favorite songs rows (same as playlist rows with art)
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLowOpacity,
    backgroundColor: 'transparent',
  },
  songItemPlaying: {
    backgroundColor: theme.colors.playingBackground,
  },
  heartWrapper: {
    width: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginLeft: 4,
  },
  heartIcon: {
    color: theme.colors.primary,
  },
  trackNumberWrapper: {
    width: 0,
    alignItems: 'center',
    marginRight: 0,
    flexShrink: 0,
  },
  trackNumber: {
    fontSize: 12,
    fontFamily: 'Lexend_500Medium',
    color: theme.colors.onSurface,
    opacity: 0.4,
  },
  nowPlayingIcon: {
    color: theme.colors.primary,
  },
  songImage: {
    width: 44,
    height: 44,
    borderRadius: 5,
    marginLeft: 8,
    marginRight: 10,
  },
  songInfo: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  songTitle: {
    fontSize: 13.5,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onSurface,
  },
  songTitlePlaying: {
    color: theme.colors.primary,
  },
  songArtist: {
    fontSize: 11.5,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.55,
    marginTop: 1,
  },
  songArtistPlaying: {
    color: theme.colors.primary,
    opacity: 0.7,
  },
  songDuration: {
    fontSize: 12,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.4,
    marginRight: 2,
    marginLeft: 4,
    flexShrink: 0,
  },
  menuButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  listContainer: {
    paddingBottom: 60,
  },
  emptyState: {
    paddingTop: 80,
    alignItems: 'center',
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
