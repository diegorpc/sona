import { StyleSheet } from 'react-native';

export const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flex: 1,
    paddingVertical: 40,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.onSurfaceVariant,
  },
  activeTabText: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  card: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: theme.colors.surface,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 20,
    lineHeight: 20,
  },
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
    backgroundColor: theme.colors.surfaceVariant,
  },
  accentColorSwatch: {
    width: 30,
    height: 15,
    borderRadius: 20,
    marginRight: 12,
  },
  accentColorName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
    flex: 1,
  },
  button: {
    marginTop: 16,
  },
  logoutButton: {
    margin: 16,
    marginTop: 8,
  },
  dialogInput: {
    marginBottom: 16,
  },
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
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
  },
  cacheStatValue: {
    fontSize: 14,
    fontWeight: '600',
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
  dialogDescription: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 20,
    lineHeight: 20,
  },
  sliderContainer: {
    paddingVertical: 8,
  },
  sliderLabel: {
    fontSize: 18,
    fontWeight: 'bold',
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
    color: theme.colors.onSurfaceVariant,
  },
});
