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
  lemon: {
    name: 'Lemon',
    primary: '#F2D335',
    primaryContainer: '#C5A92B',
    secondary: '#F2D335',
    secondaryContainer: '#C5A92B',
  },
  cobalt: {
    name: 'Cobalt',
    primary: '#056CF2',
    primaryContainer: '#0459C7',
    secondary: '#056CF2',
    secondaryContainer: '#0459C7',
  },
  neon: {
    name: 'Neon',
    primary: '#1BBF15',
    primaryContainer: '#169F12',
    secondary: '#1BBF15',
    secondaryContainer: '#169F12',
  },
  sand: { 
    name: 'Sand',
    primary: '#BFA678',
    primaryContainer: '#9A855F',
    secondary: '#BFA678',
    secondaryContainer: '#9A855F',
  }
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
      onSurfaceVariant: '#a0a0a0',
      onBackground: '#ffffff',
      outline: '#333333',
      // Low opacity variants for borders and backgrounds
      borderLowOpacity: `rgba(161, 77, 160, 0.09)`,
      playingBackground: `rgba(161, 77, 160, 0.18)`,
      badgeBackground: `rgba(161, 77, 160, 0.2)`,
      badgeBorder: `rgba(161, 77, 160, 0.3)`,
    },
  };
};

// Helper function to create rgba from hex with opacity
const hexToRgba = (hex, opacity) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Enhanced theme with dynamic opacity variants based on accent color
export const createThemeWithVariants = (accentKey = 'velvet') => {
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
      onSurfaceVariant: '#a0a0a0',
      outline: '#333333',
      // Dynamic low opacity variants based on primary color
      borderLowOpacity: hexToRgba(accent.primary, 0.09),
      playingBackground: hexToRgba(accent.primary, 0.18),
      badgeBackground: hexToRgba(accent.primary, 0.2),
      badgeBorder: hexToRgba(accent.primary, 0.3),
    },
  };
};

// Default theme export for backward compatibility
export const theme = createTheme('velvet');
