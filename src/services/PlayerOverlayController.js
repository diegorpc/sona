let expandCallback = null;
let collapseCallback = null;

export const registerPlayerOverlay = ({ expand, collapse }) => {
  expandCallback = typeof expand === 'function' ? expand : null;
  collapseCallback = typeof collapse === 'function' ? collapse : null;
};

export const unregisterPlayerOverlay = () => {
  expandCallback = null;
  collapseCallback = null;
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
