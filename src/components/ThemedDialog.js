import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { useTheme } from '../contexts/ThemeContext';

// Shared dialog shell so modal surfaces match the app's cards and bottom
// sheets (SongMenu / AddToPlaylistModal) instead of react-native-paper's stock
// MD3 elevation surface, which ignores our palette entirely.

export default function ThemedDialog({
  visible,
  onDismiss,
  title,
  children,
  confirmLabel = 'Save',
  onConfirm,
  confirmDisabled = false,
  cancelLabel = 'Cancel',
}) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <View style={styles.surfaceLayer}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill}>
              <View style={[StyleSheet.absoluteFill, styles.iosTint]} />
            </BlurView>
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.solidSurface]} />
          )}
        </View>

        {title ? <Text style={styles.title}>{title}</Text> : null}

        <Dialog.Content style={styles.content}>{children}</Dialog.Content>

        <Dialog.Actions style={styles.actions}>
          <Button
            onPress={onDismiss}
            textColor={theme.colors.onSurfaceVariant}
            labelStyle={styles.actionLabel}
          >
            {cancelLabel}
          </Button>
          {onConfirm ? (
            <Button
              onPress={onConfirm}
              disabled={confirmDisabled}
              textColor={theme.colors.primary}
              labelStyle={styles.actionLabel}
            >
              {confirmLabel}
            </Button>
          ) : null}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const DIALOG_RADIUS = 20;

const createStyles = (theme) =>
  StyleSheet.create({
    dialog: {
      backgroundColor: 'transparent',
      borderRadius: DIALOG_RADIUS,
    },
    surfaceLayer: {
      ...StyleSheet.absoluteFillObject,
      marginTop: 0,
      borderRadius: DIALOG_RADIUS,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.borderLowOpacity,
    },
    iosTint: {
      backgroundColor: 'rgba(18, 18, 18, 0.72)',
    },
    solidSurface: {
      backgroundColor: theme.colors.surface,
    },
    title: {
      fontSize: 18,
      fontFamily: 'Lexend_600SemiBold',
      color: theme.colors.onSurface,
      paddingTop: 22,
      paddingHorizontal: 24,
      paddingBottom: 4,
    },
    content: {
      paddingTop: 8,
      paddingBottom: 8,
    },
    actions: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    actionLabel: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 14,
    },
  });
