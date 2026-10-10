import { normalizeExerciseVideoCrop } from "../../functions/exerciseVideoCrop.js";

export function exerciseVideoCropStyle(value) {
  const crop = normalizeExerciseVideoCrop(value);
  if (!crop) return undefined;
  const position = `${crop.x * 100}% ${crop.y * 100}%`;
  return { objectFit: "cover", objectPosition: position, transform: `scale(${crop.zoom})`, transformOrigin: position, borderRadius: 0 };
}

export function panExerciseVideoCrop(crop, { width, height, videoWidth, videoHeight }, dx, dy) {
  const scale = Math.max(width / videoWidth, height / videoHeight) * crop.zoom;
  const overflowX = videoWidth * scale - width;
  const overflowY = videoHeight * scale - height;
  const clamp = value => Math.min(1, Math.max(0, value));
  return { ...crop, x: overflowX > 0.5 ? clamp(crop.x - dx / overflowX) : crop.x,
    y: overflowY > 0.5 ? clamp(crop.y - dy / overflowY) : crop.y };
}
