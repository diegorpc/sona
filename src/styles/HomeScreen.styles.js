import { StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const ALBUM_CARD_SIZE = Math.round(Math.min(160, (SCREEN_WIDTH - 16 * 2 - 12) / 2.4));

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
  // Page header
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Lexend_700Bold',
    color: theme.colors.onSurface,
    textShadowColor: theme.colors.primary,
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 0,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  // Section header (title + See All)
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 21,
    fontFamily: 'Lexend_700Bold',
    color: theme.colors.onSurface,
    textShadowColor: theme.colors.primary,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingLeft: 8,
  },
  seeAllText: {
    fontSize: 13,
    fontFamily: 'Lexend_500Medium',
    color: theme.colors.primary,
  },
  // Playlists grid (2 columns)
  playlistGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  playlistChip: {
    width: '49%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  playlistChipImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 10,
    backgroundColor: theme.colors.surface,
  },
  playlistChipText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onSurface,
  },
  // Horizontal album cards
  albumRow: {
    paddingHorizontal: 16,
    gap: 12,
  },
  albumCard: {
    width: ALBUM_CARD_SIZE,
  },
  albumCardImage: {
    width: ALBUM_CARD_SIZE,
    height: ALBUM_CARD_SIZE,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceVariant,
    marginBottom: 7,
  },
  albumCardTitle: {
    fontSize: 13.5,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onSurface,
  },
  albumCardArtist: {
    fontSize: 11.5,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.55,
    marginTop: 1,
  },
  albumCardYear: {
    fontSize: 11,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.4,
    marginTop: 1,
  },
});
