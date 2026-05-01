import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createThemeWithVariants as createTheme } from '../theme/theme';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [accentColor, setAccentColor] = useState('velvet');
  const [theme, setTheme] = useState(createTheme('velvet'));

  useEffect(() => {
    loadAccentColor();
  }, []);

  const loadAccentColor = async () => {
    try {
      const savedAccent = await AsyncStorage.getItem('accentColor');
      if (savedAccent) {
        setAccentColor(savedAccent);
        setTheme(createTheme(savedAccent));
      }
    } catch (error) {
      console.error('Error loading accent color:', error);
    }
  };

  const changeAccentColor = async (newAccent) => {
    try {
      await AsyncStorage.setItem('accentColor', newAccent);
      setAccentColor(newAccent);
      setTheme(createTheme(newAccent));
    } catch (error) {
      console.error('Error saving accent color:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, accentColor, changeAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
