/**
 * @fileoverview Imperative bridge to the PlayerOverlay component, which is
 * mounted at the app root outside the navigator and therefore unreachable
 * through navigation or props. PlayerOverlay registers its callbacks on
 * mount; anything else (e.g. a screen that just called `playTrack`) can then
 * expand/collapse the overlay without a ref to it.
 */

let expandCallback = null;
let collapseCallback = null;
let collapseAllCallback = null;

/**
 * Called by PlayerOverlay on mount to install its handlers.
 * @param {{expand: Function, collapse: Function, collapseAll: Function}} handlers
 */
export const registerPlayerOverlay = ({ expand, collapse, collapseAll }) => {
  expandCallback = typeof expand === 'function' ? expand : null;
  collapseCallback = typeof collapse === 'function' ? collapse : null;
  collapseAllCallback = typeof collapseAll === 'function' ? collapseAll : null;
};

/** Called by PlayerOverlay on unmount. */
export const unregisterPlayerOverlay = () => {
  expandCallback = null;
  collapseCallback = null;
  collapseAllCallback = null;
};

/** Expand the overlay to the full-screen player. No-op when unregistered. */
export const expandPlayerOverlay = () => {
  if (typeof expandCallback === 'function') {
    expandCallback();
  }
};

/** Collapse the overlay back to the MiniPlayer. No-op when unregistered. */
export const collapsePlayerOverlay = () => {
  if (typeof collapseCallback === 'function') {
    collapseCallback();
  }
};

/**
 * Collapse both the queue overlay and the player in one shot — use when
 * navigating away underneath the overlay.
 */
export const collapseAllPlayerOverlay = () => {
  if (typeof collapseAllCallback === 'function') {
    collapseAllCallback();
  }
};
