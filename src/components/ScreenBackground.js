import React from 'react';
import { Platform, View, ImageBackground } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../contexts/ThemeContext';

export default function ScreenBackground({ source, backgroundStyle, blurStyle, intensity = 65, tint = 'dark', children }) {
  const { theme } = useTheme();

  if (Platform.OS === 'android') {
    return (
      <View style={[backgroundStyle, { backgroundColor: theme.colors.background }]}>
        <View style={blurStyle}>
          {children}
        </View>
      </View>
    );
  }

  return (
    <ImageBackground source={source} style={backgroundStyle} resizeMode="cover">
      <BlurView intensity={intensity} tint={tint} style={blurStyle}>
        {children}
      </BlurView>
    </ImageBackground>
  );
}
