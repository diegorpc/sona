import { StyleSheet } from 'react-native';
import { theme } from '../theme/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
});
