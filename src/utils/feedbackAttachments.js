export const MAX_FEEDBACK_FILES = 5;
export const MAX_FEEDBACK_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FEEDBACK_TOTAL_BYTES = 50 * 1024 * 1024;

export function feedbackFileType(file) {
  const extension = String(file?.name || "").split(".").at(-1).toLowerCase();
  const byExtension = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", pdf: "application/pdf", txt: "text/plain", log: "text/plain" };
  return byExtension[extension] || file?.type || "";
}

export function validateFeedbackFiles(files) {
  if (files.length > MAX_FEEDBACK_FILES) return "Можно прикрепить до 5 файлов.";
  if (files.some(file => !/^(image\/(jpeg|png|webp)|video\/(mp4|webm|quicktime)|application\/pdf|text\/plain)$/.test(feedbackFileType(file)))) return "Подойдут JPG, PNG, WebP, MP4, WebM, MOV, PDF, TXT или LOG.";
  if (files.some(file => !Number.isFinite(file.size) || file.size <= 0 || file.size >= MAX_FEEDBACK_FILE_BYTES)) return "Каждый файл должен быть непустым и меньше 25 МБ.";
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_FEEDBACK_TOTAL_BYTES) return "Общий размер вложений — не больше 50 МБ.";
  return "";
}

export function mergeFeedbackFiles(current, incoming) {
  const unique = new Map(current.map(file => [`${file.name}:${file.size}:${file.lastModified}`, file]));
  for (const file of incoming) unique.set(`${file.name}:${file.size}:${file.lastModified}`, file);
  return [...unique.values()];
}
