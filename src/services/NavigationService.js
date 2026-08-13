/**
 * @fileoverview Navigation from outside the component tree.
 *
 * `navigationRef` is attached to the root NavigationContainer in App.js;
 * `navigate` lets non-component code (services, the player overlay) push
 * screens imperatively. The auth-change handler lets SubsonicAPI-adjacent
 * code (e.g. SettingsScreen's logout) trigger App.js's login-status
 * re-check without a prop chain.
 */

import { createRef } from 'react';

export const navigationRef = createRef();

/**
 * Navigate imperatively. Silently dropped when the container isn't ready
 * yet (e.g. during launch).
 * @param {string} name Route name.
 * @param {Object} [params] Route params.
 */
export function navigate(name, params) {
  if (navigationRef.current?.isReady()) {
    navigationRef.current.navigate(name, params);
  }
}

let authChangeHandler = null;

/** Called by App.js on mount to install its login-status re-check. */
export function setAuthChangeHandler(handler) {
  authChangeHandler = handler;
}

/** Ask App.js to re-evaluate login state (e.g. after logout). */
export function notifyAuthChange() {
  authChangeHandler?.();
}
