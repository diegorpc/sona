import { StyleSheet } from 'react-native';
import { theme } from '../theme/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: theme.colors.primary,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 32,
    color: theme.colors.onSurface,
    opacity: 0.7,
  },
  card: {
    elevation: 4,
    backgroundColor: theme.colors.surface,
  },
  input: {
    marginBottom: 16,
  },
  loginButton: {
    marginTop: 8,
    paddingVertical: 8,
  },
  helpSection: {
    marginTop: 24,
    padding: 16,
  },
  helpText: {
    textAlign: 'center',
    fontSize: 12,
    color: theme.colors.onSurface,
    opacity: 0.6,
    lineHeight: 18,
  },
});
