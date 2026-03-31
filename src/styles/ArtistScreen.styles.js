import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

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
    backgroundColor: 'transparent',
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
    backgroundColor: 'transparent',
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
    opacity: 0.7,
    textAlign: 'center',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerBlur: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(154, 107, 255, 0.2)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(18, 18, 18, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  artistImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginRight: 16,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  artistName: {
    fontSize: 24,
    fontFamily: 'Lexend_700Bold',
    color: theme.colors.onSurface,
    marginBottom: 6,
  },
  artistStats: {
    fontSize: 14,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.7,
  },
  listContainer: {
    paddingBottom: 100,
    paddingHorizontal: 8,
  },
  albumCard: {
    backgroundColor: 'rgba(30, 30, 30, 0.5)',
    borderRadius: 12,
    marginVertical: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(154, 107, 255, 0.15)',
  },
  albumContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  albumArt: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 14,
  },
  albumInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  albumTitle: {
    fontSize: 16,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onSurface,
    marginBottom: 4,
  },
  albumYear: {
    fontSize: 13,
    fontFamily: 'Lexend_500Medium',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  albumDetails: {
    fontSize: 12,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.7,
  },
  albumPlayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
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
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    backgroundColor: theme.colors.primary,
  },
});
