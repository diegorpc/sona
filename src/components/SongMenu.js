import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Easing,
  PanResponder,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import CachedImage from './CachedImage';
import { useTheme } from '../contexts/ThemeContext';
import { createStyles } from '../styles/SongMenu.styles';

const DEFAULT_ART = require('../../assets/default-album.png');

// options: Array<{ key, label, icon, onPress, disabled? } | null>
// null entries are skipped (used for conditional items)
export default function SongMenu({ song, visible, onClose, options }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const dragOffset = useRef(new Animated.Value(0)).current;

  const closeWithAnimation = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(400);
      fadeAnim.setValue(0);
      dragOffset.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gestureState.dy > 2 || Math.abs(gestureState.vy) > 0.05,
        onPanResponderGrant: () => {
          dragOffset.setValue(0);
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            dragOffset.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          const shouldClose = gestureState.dy > 60 || gestureState.vy > 0.4;
          
          if (shouldClose) {
            closeWithAnimation();
          } else {
            Animated.spring(dragOffset, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [dragOffset]
  );

  if (!song && !visible) return null;

  const activeOptions = (options || []).filter(Boolean);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <TouchableWithoutFeedback onPress={closeWithAnimation}>
          <View style={styles.backdropTouch} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [
                { translateY: Animated.add(slideAnim, dragOffset) },
              ],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity style={styles.handleBar} onPress={closeWithAnimation} activeOpacity={0.6}>
            <MaterialIcons name="expand-more" size={30} color="rgba(255,255,255,0.35)" />
          </TouchableOpacity>

          {/* Song header */}
          {song && (
            <View style={styles.songHeader}>
              <CachedImage
                coverArtId={song?.coverArt}
                fallbackSource={DEFAULT_ART}
                style={styles.songHeaderArt}
              />
              <View style={styles.songHeaderInfo}>
                <Text style={styles.songHeaderTitle} numberOfLines={1}>
                  {song.title}
                </Text>
                <Text style={styles.songHeaderArtist} numberOfLines={1}>
                  {song.artist}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.divider} />

          {/* Options */}
          {activeOptions.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[styles.menuItem, option.disabled && styles.menuItemDisabled]}
              onPress={() => {
                if (!option.disabled) {
                  onClose();
                  // slight delay so menu closes before navigation or other effects
                  setTimeout(() => option.onPress(), 80);
                }
              }}
              activeOpacity={option.disabled ? 1 : 0.7}
            >
              <MaterialIcons
                name={option.icon}
                style={[styles.menuItemIcon, option.disabled && styles.menuItemIconDisabled]}
              />
              <Text
                style={[
                  styles.menuItemLabel,
                  option.disabled && styles.menuItemLabelDisabled,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
