import { StyleSheet } from 'react-native';
import { theme } from '../theme/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingVertical: 40,
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
