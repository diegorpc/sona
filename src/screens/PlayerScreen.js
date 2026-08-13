import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Easing,
  Dimensions,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import Slider from '@react-native-assets/slider';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenBackground from '../components/ScreenBackground';
import SongMenu from '../components/SongMenu';
import AddToPlaylistModal from '../components/AddToPlaylistModal';

import AudioPlayer from '../services/AudioPlayer';
import SubsonicAPI from '../services/SubsonicAPI';
import CachedImage from '../components/CachedImage';
import { useArtworkSource } from '../hooks/useArtwork';
import { usePlayerActions } from '../contexts/PlayerContext';
import { useTheme } from '../contexts/ThemeContext';
import { createStyles } from '../styles/PlayerScreen.styles';
import TextTicker from 'react-native-text-ticker';

const DEFAULT_ART = require('../../assets/default-album.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PLAYER_ART_SIZE = SCREEN_WIDTH - 80;

export default function PlayerScreen({ onClose, onShowQueue, onNavigateToArtist, onNavigateToAlbum, safeAreaInsets }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { insertIntoPriorityQueue } = usePlayerActions();
  const [playerState, setPlayerState] = useState(AudioPlayer.getCurrentState());
  const [isSliding, setIsSliding] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);
  const [isStarred, setIsStarred] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [addToPlaylistVisible, setAddToPlaylistVisible] = useState(false);
  const isSlidingRef = useRef(false);
  const topInset = safeAreaInsets?.top ?? 0;
  const bottomInset = safeAreaInsets?.bottom ?? 0;

  useEffect(() => {
    // Session restore (AudioPlayer.loadSavedState) is owned by PlayerProvider;
    // calling it here too raced two concurrent restores at launch.
    const listener = (state) => {
      setPlayerState(state);
      if (!isSlidingRef.current) {
        setSliderValue(state.position);
      }
      setIsStarred(Boolean(state.currentTrack?.starred));
    };
    AudioPlayer.addListener(listener);
    return () => AudioPlayer.removeListener(listener);
  }, []);

  const handlePlayPause = () => AudioPlayer.togglePlayPause();
  const handleNext = () => AudioPlayer.playNext();
  const handlePrevious = () => AudioPlayer.playPrevious();

  const handleSeek = async (value) => {
    if (duration > 0) {
      await AudioPlayer.seekTo((value / 100) * duration);
    }
  };

  const handleSliderStart = () => {
    isSlidingRef.current = true;
    setIsSliding(true);
  };

  const handleSliderComplete = async (value) => {
    await handleSeek(value);
    isSlidingRef.current = false;
    setIsSliding(false);
  };

  const handleSliderChange = (value) => {
    if (isSliding) {
      setSliderValue((value / 100) * duration);
    }
  };

  const handleStarToggle = async () => {
    const { currentTrack } = playerState;
    if (!currentTrack) return;
    if (isStarred) {
      await SubsonicAPI.unstar(currentTrack.id);
      setIsStarred(false);
    } else {
      await SubsonicAPI.star(currentTrack.id);
      setIsStarred(true);
    }
  };

  const formatTime = (ms) => AudioPlayer.formatTime(ms);

  const { currentTrack, isPlaying, isBuffering, position, duration, isLoading } = playerState;

  const menuOptions = useMemo(() => {
    if (!currentTrack) return [];
    return [
      onNavigateToAlbum && currentTrack.albumId ? {
        key: 'goToAlbum',
        label: 'Go to album',
        icon: 'album',
        onPress: () => onNavigateToAlbum(),
      } : null,
      onNavigateToArtist && currentTrack.artistId ? {
        key: 'goToArtist',
        label: 'Go to artist',
        icon: 'person',
        onPress: () => onNavigateToArtist(),
      } : null,
      {
        key: 'addToPlaylist',
        label: 'Add to playlist',
        icon: 'playlist-add',
        onPress: () => setAddToPlaylistVisible(true),
      },
      {
        key: 'addNext',
        label: 'Add next in queue',
        icon: 'queue-play-next',
        onPress: () => insertIntoPriorityQueue(currentTrack, 0),
      },
      {
        key: 'addLast',
        label: 'Add last in queue',
        icon: 'add-to-queue',
        onPress: () => insertIntoPriorityQueue(currentTrack),
      },
      {
        key: 'download',
        label: 'Download',
        icon: 'download',
        disabled: true,
        onPress: () => {},
      },
    ].filter(Boolean);
  }, [currentTrack, onNavigateToAlbum, onNavigateToArtist, insertIntoPriorityQueue]);


  const artSource = useArtworkSource(currentTrack?.coverArt, DEFAULT_ART);

  const [artDisplaySize, setArtDisplaySize] = useState({ width: PLAYER_ART_SIZE, height: PLAYER_ART_SIZE });
  useEffect(() => {
    setArtDisplaySize({ width: PLAYER_ART_SIZE, height: PLAYER_ART_SIZE });
  }, [currentTrack?.id]);
  const handleArtLoad = useCallback((e) => {
    const { width: w, height: h } = e.source || {};
    if (!w || !h) return;
    const ratio = w / h;
    if (ratio >= 1) {
      setArtDisplaySize({ width: PLAYER_ART_SIZE, height: Math.round(PLAYER_ART_SIZE / ratio) });
    } else {
      setArtDisplaySize({ width: Math.round(PLAYER_ART_SIZE * ratio), height: PLAYER_ART_SIZE });
    }
  }, []);

  if (!currentTrack) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialIcons name="music-note" size={64} color={theme.colors.outline} />
        <Text style={styles.emptyText}>No track selected</Text>
        <Text style={styles.emptySubtext}>Choose a song from your library to start playing</Text>
      </View>
    );
  }

  const shouldShowDuration = !isLoading && Number.isFinite(duration) && duration > 0;
  const endTimeDisplay = shouldShowDuration ? formatTime(duration) : 'Loading…';

  return (
    <ScreenBackground
      source={artSource}
      backgroundStyle={styles.backgroundImage}
      blurStyle={styles.blurOverlay}
    >
        <View style={[styles.container, { paddingBottom: bottomInset + 16 }]}>
          {/* Header */}
          <View style={[styles.header, { paddingTop: topInset + 12 }]}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.dragIndicator}
              hitSlop={{ top: 10, bottom: 10, left: 40, right: 40 }}
              activeOpacity={0.6}
            >
              <MaterialIcons name="expand-more" size={32} color={theme.colors.onBackground} style={{ opacity: 0.45 }} />
            </TouchableOpacity>
          </View>

          {/* Album art */}
          <View style={styles.albumArtContainer}>
            <View style={[styles.albumArtShadow, artDisplaySize]}>
              <CachedImage
                coverArtId={currentTrack?.coverArt}
                fallbackSource={DEFAULT_ART}
                style={[styles.albumArt, artDisplaySize]}
                resizeMode="contain"
                indicatorSize="large"
                onLoad={handleArtLoad}
              />
            </View>
          </View>

          {/* Track info */}
          <View style={styles.trackInfo}>
            <TextTicker
              style={styles.trackTitle}
              duration={4000}
              bounce
              loop
              easing={Easing.linear}
              animationType="bounce"
              repeatSpacer={50}
              marqueeDelay={1000}
              bouncePadding={{ left: 0, right: 5 }}
              bounceDelay={1000}
            >
              {currentTrack.title}
            </TextTicker>
            <TouchableOpacity onPress={onNavigateToArtist} activeOpacity={0.7} disabled={!onNavigateToArtist}>
              <TextTicker
                style={styles.trackArtist}
                duration={4000}
                bounce
                loop
                easing={Easing.linear}
                animationType="bounce"
                repeatSpacer={50}
                marqueeDelay={1000}
                bouncePadding={{ left: 0, right: 5 }}
                bounceDelay={1000}
              >
                {currentTrack.artist}
              </TextTicker>
            </TouchableOpacity>
            {currentTrack.album && (
              <TouchableOpacity onPress={onNavigateToAlbum} activeOpacity={0.7} disabled={!onNavigateToAlbum}>
                <TextTicker
                  style={styles.trackAlbum}
                  duration={4000}
                  bounce
                  loop
                  easing={Easing.linear}
                  animationType="bounce"
                  repeatSpacer={50}
                  marqueeDelay={1000}
                  bouncePadding={{ left: 0, right: 5 }}
                  bounceDelay={1000}
                >
                  {currentTrack.album}
                </TextTicker>
              </TouchableOpacity>
            )}
          </View>

          {/* Glass controls card */}
          <View style={styles.controlsCard}>
            {/* Progress */}
            <View style={styles.progressContainer}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={100}
                value={
                  duration > 0
                    ? isSliding
                      ? (sliderValue / duration) * 100
                      : (position / duration) * 100
                    : 0
                }
                onValueChange={handleSliderChange}
                onSlidingStart={handleSliderStart}
                onSlidingComplete={handleSliderComplete}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor="rgba(255,255,255,0.12)"
                thumbTintColor="#fff"
                thumbSize={13}
                trackHeight={3.5}
              />
              <View style={styles.timeContainer}>
                <Text style={styles.timeText}>
                  {formatTime(isSliding ? sliderValue : position)}
                </Text>
                <Text style={styles.timeText}>{endTimeDisplay}</Text>
              </View>
            </View>

            {/* Full-width transport: prev · play/pause · next */}
            <View style={styles.transportRow}>
              <TouchableOpacity onPress={handlePrevious} style={styles.skipButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <MaterialIcons name="skip-previous" size={34} color={theme.colors.onBackground} />
              </TouchableOpacity>

              {/* Stays tappable while buffering so a stalled stream can be paused */}
              <TouchableOpacity onPress={handlePlayPause} style={styles.playButton} disabled={isLoading}>
                {isLoading || isBuffering ? (
                  <ActivityIndicator animating size={28} color="#fff" />
                ) : (
                  <MaterialIcons
                    name={isPlaying ? 'pause' : 'play-arrow'}
                    color="#fff"
                    size={34}
                  />
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={handleNext} style={styles.skipButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <MaterialIcons name="skip-next" size={34} color={theme.colors.onBackground} />
              </TouchableOpacity>
            </View>

            {/* Secondary controls: heart · queue · dots */}
            <View style={styles.secondaryRow}>
              <TouchableOpacity
                onPress={handleStarToggle}
                style={styles.secondaryButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons
                  name={isStarred ? 'favorite' : 'favorite-border'}
                  color={isStarred ? theme.colors.primary : theme.colors.onSurface}
                  style={{ opacity: isStarred ? 1 : 0.55 }}
                  size={22}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onShowQueue}
                style={styles.secondaryButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="queue-music" size={22} color={theme.colors.onSurface} style={{ opacity: 0.55 }} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setMenuVisible(true)}
                style={styles.secondaryButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="more-horiz" size={22} color={theme.colors.onSurface} style={{ opacity: 0.55 }} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      <SongMenu
        song={currentTrack}
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        options={menuOptions}
      />
      <AddToPlaylistModal
        song={currentTrack}
        visible={addToPlaylistVisible}
        onClose={() => setAddToPlaylistVisible(false)}
      />
    </ScreenBackground>
  );
}
