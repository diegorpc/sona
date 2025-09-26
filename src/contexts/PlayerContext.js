import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import AudioPlayer from '../services/AudioPlayer';

const PlayerContext = createContext(undefined);

export const PlayerProvider = ({ children }) => {
  const [playerState, setPlayerState] = useState(AudioPlayer.getCurrentState());

  useEffect(() => {
    let isMounted = true;

    const listener = (state) => {
      if (isMounted) {
        setPlayerState(state);
      }
    };

    AudioPlayer.loadSavedState();
    AudioPlayer.addListener(listener);

    return () => {
      isMounted = false;
      AudioPlayer.removeListener(listener);
    };
  }, []);

  const value = useMemo(
    () => ({
      playerState,
      playTrack: AudioPlayer.playTrack.bind(AudioPlayer),
      playNext: AudioPlayer.playNext.bind(AudioPlayer),
      playPrevious: AudioPlayer.playPrevious.bind(AudioPlayer),
      togglePlayPause: AudioPlayer.togglePlayPause.bind(AudioPlayer),
      seekTo: AudioPlayer.seekTo.bind(AudioPlayer),
      stop: AudioPlayer.stop.bind(AudioPlayer),
      formatTime: AudioPlayer.formatTime.bind(AudioPlayer),
    }),
    [playerState]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);

  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }

  return context;
};
