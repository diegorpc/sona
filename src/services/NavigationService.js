import { createRef } from 'react';

export const navigationRef = createRef();

export function navigate(name, params) {
  if (navigationRef.current?.isReady()) {
    navigationRef.current.navigate(name, params);
  }
}

let authChangeHandler = null;

export function setAuthChangeHandler(handler) {
  authChangeHandler = handler;
}

export function notifyAuthChange() {
  authChangeHandler?.();
}
