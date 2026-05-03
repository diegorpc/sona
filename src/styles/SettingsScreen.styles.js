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
  // ─── Header ───────────────────────────────────────────────────
  header: {
    paddingHorizontal: 16,
    paddingTop: 17,
    paddingBottom: 14,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Lexend_700Bold',
    color: theme.colors.onSurface,
    textShadowColor: theme.colors.primary,
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 0,
    marginBottom: 14,
  },
  // ─── Chips ────────────────────────────────────────────────────
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
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.11)',
  },
  bubbleChipText: {
    fontSize: 13,
    fontFamily: 'Lexend_500Medium',
    textAlign: 'center',
  },
  // ─── Content ──────────────────────────────────────────────────
  scrollContainer: {
    flex: 1,
  },
  scrollFooter: {
    height: 120,
  },
  card: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: theme.colors.surface,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onSurface,
    marginBottom: 6,
  },
  sectionDescription: {
    fontSize: 13,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurfaceVariant,
    marginBottom: 20,
    lineHeight: 20,
  },
  // ─── Accent color picker ───────────────────────────────────────
  accentColorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  accentColorOption: {
    width: '48%',
    aspectRatio: 2.5,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  accentColorSelected: {
    borderColor: theme.colors.primary,
  },
  accentColorSwatch: {
    width: 28,
    height: 14,
    borderRadius: 20,
    marginRight: 10,
  },
  accentColorName: {
    fontSize: 14,
    fontFamily: 'Lexend_500Medium',
    color: theme.colors.onSurface,
    flex: 1,
  },
  // ─── Buttons ──────────────────────────────────────────────────
  button: {
    marginTop: 16,
  },
  logoutButton: {
    margin: 16,
    marginTop: 8,
  },
  // ─── Dialogs ──────────────────────────────────────────────────
  dialogInput: {
    marginBottom: 16,
  },
  dialogDescription: {
    fontSize: 14,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurfaceVariant,
    marginBottom: 20,
    lineHeight: 20,
  },
  sliderContainer: {
    paddingVertical: 8,
  },
  sliderLabel: {
    fontSize: 18,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  sliderLabelSmall: {
    fontSize: 12,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurfaceVariant,
  },
  // ─── Cache stats ───────────────────────────────────────────────
  cacheStatsContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 8,
    marginBottom: 12,
  },
  cacheStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cacheStatLabel: {
    fontSize: 13,
    fontFamily: 'Lexend_400Regular',
    color: theme.colors.onSurfaceVariant,
  },
  cacheStatValue: {
    fontSize: 13,
    fontFamily: 'Lexend_600SemiBold',
    color: theme.colors.onSurface,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  divider: {
    marginVertical: 8,
  },
});
