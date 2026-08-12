import React, { createContext, useContext, useEffect, useState } from 'react';

import AudioPlayer from '../services/AudioPlayer';

// Bound once at module scope. AudioPlayer is a singleton, so these never need
// to change identity — and they must not. Re-binding them per render (which
// this used to do inside a useMemo keyed on playerState) handed every consumer
// brand-new callbacks ~10x a second, since AudioPlayer's 100ms status timer
// pushes a new state object that often. That silently defeated downstream
// memoization: in LibraryScreen it invalidated `handleAddLast` → `renderItem`
// → every row's memo comparator, so the whole visible list genuinely
// re-rendered 10x/sec and VirtualizedList started logging slow-update warnings.
const playerActions = Object.freeze({
  playTrack: AudioPlayer.playTrack.bind(AudioPlayer),
  playNext: AudioPlayer.playNext.bind(AudioPlayer),
  playPrevious: AudioPlayer.playPrevious.bind(AudioPlayer),
  togglePlayPause: AudioPlayer.togglePlayPause.bind(AudioPlayer),
  seekTo: AudioPlayer.seekTo.bind(AudioPlayer),
  stop: AudioPlayer.stop.bind(AudioPlayer),
  formatTime: AudioPlayer.formatTime.bind(AudioPlayer),
  setPriorityQueue: AudioPlayer.setPriorityQueue.bind(AudioPlayer),
  reorderPriorityQueue: AudioPlayer.reorderPriorityQueue.bind(AudioPlayer),
  removePriorityTrack: AudioPlayer.removePriorityTrack.bind(AudioPlayer),
  insertIntoPriorityQueue: AudioPlayer.insertIntoPriorityQueue.bind(AudioPlayer),
  appendToContextQueue: AudioPlayer.appendToContextQueue.bind(AudioPlayer),
  reorderContextQueue: AudioPlayer.reorderContextQueue.bind(AudioPlayer),
  moveContextTrackToPriority: AudioPlayer.moveContextTrackToPriority.bind(AudioPlayer),
  toggleShuffle: AudioPlayer.toggleShuffle.bind(AudioPlayer),
  toggleRepeatAll: AudioPlayer.toggleRepeatAll.bind(AudioPlayer),
  toggleRepeatOne: AudioPlayer.toggleRepeatOne.bind(AudioPlayer),
  cycleRepeatMode: AudioPlayer.cycleRepeatMode.bind(AudioPlayer),
});

// Split by update frequency, since a context consumer re-renders whenever its
// context value changes regardless of which fields it actually reads:
//   State   — full playback state incl. position; changes ~10x/sec
//   Track   — current track only; changes only when the track changes
//   Actions — never changes
// Screens that just need "what's playing" (for backdrop art / row highlight)
// should use useCurrentTrack() + usePlayerActions() and stay off the 10x/sec
// path entirely. Only surfaces that show live progress (PlayerScreen,
// PlayerOverlay, QueueScreen) need the full usePlayer().
const PlayerStateContext = createContext(undefined);
const PlayerTrackContext = createContext(null);
const PlayerActionsContext = createContext(playerActions);

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

  // AudioPlayer only reassigns currentTrack on an actual track change, so this
  // value stays referentially stable across the 10x/sec status notifications.
  const { currentTrack } = playerState;

  return (
    <PlayerActionsContext.Provider value={playerActions}>
      <PlayerTrackContext.Provider value={currentTrack}>
        <PlayerStateContext.Provider value={playerState}>
          {children}
        </PlayerStateContext.Provider>
      </PlayerTrackContext.Provider>
    </PlayerActionsContext.Provider>
  );
};

const useAssertedState = () => {
  const playerState = useContext(PlayerStateContext);

  if (playerState === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }

  return playerState;
};

// Full playback state + actions. Re-renders ~10x/sec while a track plays —
// only use this when you actually render live position/duration.
export const usePlayer = () => {
  const playerState = useAssertedState();
  return { playerState, ...playerActions };
};

// Just the current track. Re-renders only when the track itself changes.
export const useCurrentTrack = () => useContext(PlayerTrackContext);

// Just the (permanently stable) action callbacks — never triggers a re-render.
export const usePlayerActions = () => useContext(PlayerActionsContext);
