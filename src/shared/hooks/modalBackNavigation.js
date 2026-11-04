const layers = [];
const listeners = new Set();

const notify = () => listeners.forEach(listener => listener());

export function registerModalBackLayer(onBack) {
  const layer = { onBack };
  layers.push(layer);
  notify();
  return () => {
    const index = layers.indexOf(layer);
    if (index < 0) return;
    layers.splice(index, 1);
    notify();
  };
}

export function subscribeModalBackLayers(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getModalBackLayerCount = () => layers.length;

export function consumeModalBackLayer() {
  const layer = layers.at(-1);
  if (!layer) return false;
  // A busy dialog can deliberately leave onBack as a no-op. It still owns Back.
  layer.onBack();
  return true;
}
