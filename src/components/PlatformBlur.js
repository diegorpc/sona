import React from 'react';
import { Platform, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../contexts/ThemeContext';

export default function PlatformBlur({ intensity, tint = 'default', style, children, ...props }) {
  const { theme } = useTheme();

  if (Platform.OS === 'android') {
    const backgroundColor = tint === 'light' ? theme.colors.surface : theme.colors.background;
    return (
      <View style={[{ backgroundColor }, style]} {...props}>
        {children}
      </View>
    );
  }

  return (
    <BlurView intensity={intensity} tint={tint} style={style} {...props}>
      {children}
    </BlurView>
  );
}
