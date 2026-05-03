let expandCallback = null;
let collapseCallback = null;
let collapseAllCallback = null;

export const registerPlayerOverlay = ({ expand, collapse, collapseAll }) => {
  expandCallback = typeof expand === 'function' ? expand : null;
  collapseCallback = typeof collapse === 'function' ? collapse : null;
  collapseAllCallback = typeof collapseAll === 'function' ? collapseAll : null;
};

export const unregisterPlayerOverlay = () => {
  expandCallback = null;
  collapseCallback = null;
  collapseAllCallback = null;
};

export const expandPlayerOverlay = () => {
  if (typeof expandCallback === 'function') {
    expandCallback();
  }
};

export const collapsePlayerOverlay = () => {
  if (typeof collapseCallback === 'function') {
    collapseCallback();
  }
};

// Collapses both the queue overlay and the player in one shot — use when navigating away.
export const collapseAllPlayerOverlay = () => {
  if (typeof collapseAllCallback === 'function') {
    collapseAllCallback();
  }
};
