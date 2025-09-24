import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#9a6bff',
    primaryContainer: '#7441e0',
    secondary: '#9a6bff',
    secondaryContainer: '#7441e0',
    surface: '#121212',
    surfaceVariant: '#1e1e1e',
    background: '#000000',
    error: '#cf6679',
    onPrimary: '#000000',
    onSecondary: '#000000',
    onSurface: '#ffffff',
    onBackground: '#ffffff',
    outline: '#333333',
  },
};

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#9a6bff',
    primaryContainer: '#7441e0',
    secondary: '#9a6bff',
    secondaryContainer: '#7441e0',
    surface: '#ffffff',
    surfaceVariant: '#f5f5f5',
    background: '#fafafa',
    error: '#b00020',
    onPrimary: '#ffffff',
    onSecondary: '#ffffff',
    onSurface: '#000000',
    onBackground: '#000000',
    outline: '#e0e0e0',
  },
};

export const theme = darkTheme;
