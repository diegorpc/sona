import { MD3DarkTheme } from 'react-native-paper';

// Color palettes for different accent colors
export const accentPalettes = {
  velvet: {
    name: 'Velvet',
    primary: '#a14da0',
    primaryContainer: '#893487',
    secondary: '#a14da0',
    secondaryContainer: '#893487',
  },
  ruby: {
    name: 'Ruby',
    primary: '#bf4342',
    primaryContainer: '#9a3635',
    secondary: '#bf4342',
    secondaryContainer: '#9a3635',
  },
  olive: {
    name: 'Olive',
    primary: '#89b481',
    primaryContainer: '#6b9462',
    secondary: '#89b481',
    secondaryContainer: '#6b9462',
  },  
  caramel: {
    name: 'Caramel',
    primary: '#c8691c',
    primaryContainer: '#a15516',
    secondary: '#c8691c',
    secondaryContainer: '#a15516',
  },
  rose: {
    name: 'Rose',
    primary: '#d3869b',
    primaryContainer: '#b5687d',
    secondary: '#d3869b',
    secondaryContainer: '#b5687d',
  },
  pearl: {
    name: 'Pearl',
    primary: '#44a1a0',
    primaryContainer: '#368483',
    secondary: '#44a1a0',
    secondaryContainer: '#368483',
  },
};

// Generate theme with specified accent color (dark mode only)
export const createTheme = (accentKey = 'velvet') => {
  const accent = accentPalettes[accentKey] || accentPalettes.velvet;
  
  return {
    ...MD3DarkTheme,
    colors: {
      ...MD3DarkTheme.colors,
      primary: accent.primary,
      primaryContainer: accent.primaryContainer,
      secondary: accent.secondary,
      secondaryContainer: accent.secondaryContainer,
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
};

// Default theme export for backward compatibility
export const theme = createTheme('velvet');
