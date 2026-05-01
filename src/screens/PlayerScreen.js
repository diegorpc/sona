import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  ImageBackground,
  TouchableOpacity,
  Easing,
  Dimensions,
} from 'react-native';
import { Text } from 'react-native-paper';
import Slider from '@react-native-assets/slider';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import AudioPlayer from '../services/AudioPlayer';
import SubsonicAPI from '../services/SubsonicAPI';
import { useTheme } from '../contexts/ThemeContext';
import { createStyles } from '../styles/PlayerScreen.styles';
import TextTicker from 'react-native-text-ticker';

const DEFAULT_ART = require('../../assets/default-album.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PLAYER_ART_SIZE = SCREEN_WIDTH - 80;

export default function PlayerScreen({ onClose, onShowQueue, safeAreaInsets, isExpanded = true }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [playerState, setPlayerState] = useState(AudioPlayer.getCurrentState());
  const [isSliding, setIsSliding] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);
  const [isStarred, setIsStarred] = useState(false);
  const isSlidingRef = useRef(false);
  const topInset = safeAreaInsets?.top ?? 0;
  const bottomInset = safeAreaInsets?.bottom ?? 0;

  useEffect(() => {
    AudioPlayer.loadSavedState();
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

  const getCoverArtUrl = (track) => {
    if (track?.coverArt) return SubsonicAPI.getCoverArtUrl(track.coverArt, 400);
    return null;
  };

  const formatTime = (ms) => AudioPlayer.formatTime(ms);

  const { currentTrack, isPlaying, position, duration, isLoading } = playerState;

  const [artDisplaySize, setArtDisplaySize] = useState({ width: PLAYER_ART_SIZE, height: PLAYER_ART_SIZE });
  useEffect(() => {
    setArtDisplaySize({ width: PLAYER_ART_SIZE, height: PLAYER_ART_SIZE });
  }, [currentTrack?.id]);
  const handleArtLoad = useCallback((e) => {
    const { width: w, height: h } = e.nativeEvent.source;
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

  const coverArtUrl = getCoverArtUrl(currentTrack);
  const shouldShowDuration = !isLoading && Number.isFinite(duration) && duration > 0;
  const endTimeDisplay = shouldShowDuration ? formatTime(duration) : 'Loading…';

  return (
    <ImageBackground
      source={coverArtUrl ? { uri: coverArtUrl } : DEFAULT_ART}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <BlurView intensity={65} tint="dark" style={styles.blurOverlay}>
        {/* Accent radial glow - only show when expanded */}
        {isExpanded && (
          <LinearGradient
            colors={[`${theme.colors.primary}48`, 'transparent']}
            style={[
              styles.accentGlow,
              { position: 'absolute', top: -100, left: 0, right: 0, height: 300 },
            ]}
          />
        )}

        <View style={[styles.container, { paddingBottom: bottomInset + 16 }]}>
          {/* Header */}
          <View style={[styles.header, { paddingTop: topInset + 12 }]}>
            <View style={styles.dragIndicator} />
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { top: topInset + 4 }]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <MaterialIcons name="keyboard-arrow-down" size={28} color={theme.colors.onBackground} />
            </TouchableOpacity>
          </View>

          {/* Album art */}
          <View style={styles.albumArtContainer}>
            <View style={[styles.albumArtShadow, artDisplaySize]}>
              <Image
                source={coverArtUrl ? { uri: coverArtUrl } : DEFAULT_ART}
                style={[styles.albumArt, artDisplaySize]}
                defaultSource={DEFAULT_ART}
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
            {currentTrack.album && (
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

              <TouchableOpacity onPress={handlePlayPause} style={styles.playButton} disabled={isLoading}>
                <MaterialIcons
                  name={isLoading ? 'hourglass-empty' : isPlaying ? 'pause' : 'play-arrow'}
                  size={32}
                  color="#fff"
                />
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
                  size={22}
                  color={isStarred ? theme.colors.primary : theme.colors.onSurface}
                  style={{ opacity: isStarred ? 1 : 0.55 }}
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
                style={styles.secondaryButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="more-horiz" size={22} color={theme.colors.onSurface} style={{ opacity: 0.55 }} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </BlurView>
    </ImageBackground>
  );
}
