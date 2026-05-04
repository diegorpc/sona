import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SubsonicAPI from '../services/SubsonicAPI';
import { useTheme } from '../contexts/ThemeContext';
import { createStyles } from '../styles/AddToPlaylistModal.styles';

const DEFAULT_ART = require('../../assets/default-album.png');

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = Math.min(Math.round(SCREEN_HEIGHT * 0.6), 520);

export default function AddToPlaylistModal({ song, visible, onClose }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  // sheetHeightAnim: SHEET_HEIGHT (collapsed) → SCREEN_HEIGHT (fullscreen when keyboard shows)
  const sheetHeightAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  // radiusAnim: 18 (collapsed) → 0 (fullscreen)
  const radiusAnim = useRef(new Animated.Value(18)).current;
  const [isExpanded, setIsExpanded] = useState(false);

  const [playlists, setPlaylists] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [addedPlaylistId, setAddedPlaylistId] = useState(null);

  // Keyboard listeners: expand to fullscreen on show, collapse on hide
  useEffect(() => {
    if (!visible) {
      setIsExpanded(false);
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e) => {
      setIsExpanded(true);
      Animated.parallel([
        Animated.timing(sheetHeightAnim, {
          toValue: SCREEN_HEIGHT,
          duration: e.duration || 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(radiusAnim, {
          toValue: 0,
          duration: e.duration || 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start();
    };

    const onHide = (e) => {
      setIsExpanded(false);
      Animated.parallel([
        Animated.timing(sheetHeightAnim, {
          toValue: SHEET_HEIGHT,
          duration: e.duration || 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(radiusAnim, {
          toValue: 18,
          duration: e.duration || 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start();
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible, sheetHeightAnim, radiusAnim]);

  const closeWithAnimation = useCallback(() => {
    Keyboard.dismiss();
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setSearchQuery('');
      onClose();
    });
  }, [fadeAnim, onClose]);

  useEffect(() => {
    if (!visible) return;

    sheetHeightAnim.setValue(SHEET_HEIGHT);
    radiusAnim.setValue(18);
    fadeAnim.setValue(0);
    setSearchQuery('');
    setAddedPlaylistId(null);
    setIsExpanded(false);

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    setIsLoading(true);
    SubsonicAPI.getPlaylists()
      .then(result => setPlaylists(result?.playlist || []))
      .catch(() => setPlaylists([]))
      .finally(() => setIsLoading(false));
  }, [visible]);

  const filteredPlaylists = useMemo(() => {
    if (!searchQuery) return playlists;
    const q = searchQuery.toLowerCase();
    return playlists.filter(p => p.name?.toLowerCase().includes(q));
  }, [playlists, searchQuery]);

  const handleAddToPlaylist = useCallback(async (playlist) => {
    setAddedPlaylistId(playlist.id);
    SubsonicAPI.addSongToPlaylist(playlist.id, song.id).catch(e =>
      console.error('Error adding to playlist:', e)
    );
    setTimeout(() => closeWithAnimation(), 550);
  }, [song, closeWithAnimation]);

  const handleCreate = useCallback(async () => {
    const name = searchQuery.trim();
    if (!name || isCreating) return;
    setIsCreating(true);
    try {
      await SubsonicAPI.createPlaylist(name, song.id);
    } catch (e) {
      console.error('Error creating playlist:', e);
    }
    setIsCreating(false);
    closeWithAnimation();
  }, [searchQuery, song, isCreating, closeWithAnimation]);

  const renderPlaylistItem = useCallback(({ item }) => {
    const coverUrl = item.coverArt
      ? SubsonicAPI.getCoverArtUrl(item.coverArt, 200)
      : null;
    const songCount = item.songCount ?? 0;
    const isAdded = item.id === addedPlaylistId;
    return (
      <Pressable
        style={({ pressed }) => [
          styles.playlistItem,
          pressed && styles.playlistItemPressed,
          isAdded && styles.playlistItemAdded,
        ]}
        onPress={() => !addedPlaylistId && handleAddToPlaylist(item)}
      >
        <Image
          source={coverUrl ? { uri: coverUrl } : DEFAULT_ART}
          style={styles.playlistThumb}
          defaultSource={DEFAULT_ART}
        />
        <View style={styles.playlistInfo}>
          <Text
            style={[styles.playlistName, isAdded && styles.playlistNameAdded]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text style={styles.playlistMeta}>
            {songCount} {songCount === 1 ? 'song' : 'songs'}
          </Text>
        </View>
        {isAdded && (
          <MaterialIcons name="check" size={20} color={theme.colors.primary} />
        )}
      </Pressable>
    );
  }, [handleAddToPlaylist, addedPlaylistId, styles, theme]);

  if (!song && !visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeWithAnimation}
    >
      {/* Dimming backdrop — covers full screen independently */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.65)', opacity: fadeAnim }]}
      />

      {/* Container: bottom-anchored. Sheet grows from SHEET_HEIGHT to fullscreen. */}
      <View style={localStyles.container}>
        <TouchableWithoutFeedback onPress={closeWithAnimation}>
          <View style={{ flex: 1 }} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetHeightAnim,
              borderTopLeftRadius: radiusAnim,
              borderTopRightRadius: radiusAnim,
            },
          ]}
        >
          <TouchableOpacity style={styles.handleBar} onPress={closeWithAnimation} activeOpacity={0.6}>
            <MaterialIcons name="expand-more" size={30} color="rgba(255,255,255,0.35)" />
          </TouchableOpacity>

          <Text style={styles.title}>Add to playlist</Text>
          {song && (
            <Text style={styles.songLabel} numberOfLines={1}>
              {song.title}{song.artist ? ` — ${song.artist}` : ''}
            </Text>
          )}

          <View style={styles.searchRow}>
            <MaterialIcons name="search" size={20} color={theme.colors.onSurface} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search or name a new playlist..."
              placeholderTextColor={theme.colors.onSurface + '55'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              blurOnSubmit
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="close" size={18} color={theme.colors.onSurface} style={styles.clearIcon} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.divider} />

          {searchQuery.trim().length > 0 && (
            <TouchableOpacity
              style={styles.createRow}
              onPress={handleCreate}
              activeOpacity={0.7}
              disabled={isCreating}
            >
              {isCreating ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <MaterialIcons name="add-circle-outline" size={22} color={theme.colors.primary} />
              )}
              <Text style={styles.createLabel}>
                Create "{searchQuery.trim()}"
              </Text>
            </TouchableOpacity>
          )}

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : (
            <FlatList
              data={filteredPlaylists}
              keyExtractor={item => item.id}
              renderItem={renderPlaylistItem}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No matching playlists' : 'No playlists found'}
                </Text>
              }
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
});
