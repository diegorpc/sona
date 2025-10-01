import { StyleSheet, Dimensions } from 'react-native';
import { theme } from '../theme/theme';

const { width } = Dimensions.get('window');

export const styles = StyleSheet.create({
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
  playlistImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 16,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  playlistName: {
    fontSize: 22,
    fontFamily: 'Lexend_700Bold',
    color: theme.colors.onSurface,
    marginBottom: 6,
  },
  playlistDetails: {
    fontSize: 13,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.7,
    marginBottom: 2,
  },
  listContainer: {
    paddingBottom: 100,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.outline,
  },
  trackNumber: {
    width: 32,
    alignItems: 'center',
    marginRight: 8,
  },
  trackNumberText: {
    fontSize: 13,
    fontFamily: 'Lexend_500Medium',
    color: theme.colors.onSurface,
    opacity: 0.6,
  },
  songImage: {
    width: 48,
    height: 48,
    borderRadius: 4,
    marginRight: 12,
  },
  songInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  songTitle: {
    fontSize: 14,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onSurface,
    marginBottom: 2,
  },
  songArtist: {
    fontSize: 12,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.7,
  },
  songDuration: {
    fontSize: 13,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurface,
    opacity: 0.6,
    marginRight: 8,
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
